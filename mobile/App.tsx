import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ApiError, apiRequest, defaultApiUrl, isSessionExpired } from './src/api'
import { Button, EmptyState, LoadingState, Notice, Screen, Sheet, TopBar } from './src/components/ui'
import { AdminDashboard } from './src/screens/AdminDashboard'
import { AuthScreen } from './src/screens/AuthScreen'
import { BookingsScreen } from './src/screens/BookingsScreen'
import { CustomerHome } from './src/screens/CustomerHome'
import { VendorDashboard } from './src/screens/VendorDashboard'
import { VendorDetail } from './src/screens/VendorDetail'
import { clearSession, loadApiEndpoint, loadSession, saveApiEndpoint, saveSession } from './src/storage'
import { colors, shadows } from './src/theme'
import type { ApiBootstrap, AuthSession, Booking, LiveEvent, Role, Vendor } from './src/types'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

type AppTab = 'discover' | 'bookings' | 'vendor' | 'admin'

export default function App() {
  return <SafeAreaProvider><StatusBar style="dark" /><FeastFlowApp /></SafeAreaProvider>
}

function FeastFlowApp() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl())
  const [session, setSession] = useState<AuthSession | null>(null)
  const [data, setData] = useState<ApiBootstrap | null>(null)
  const [hydrating, setHydrating] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fatalError, setFatalError] = useState('')
  const [tab, setTab] = useState<AppTab>('discover')
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<LiveEvent[]>([])
  const [notificationEnabled, setNotificationEnabled] = useState(false)
  const [remotePushEnabled, setRemotePushEnabled] = useState(false)
  const [mobilePushToken, setMobilePushToken] = useState('')
  const [notificationBusy, setNotificationBusy] = useState(false)
  const seenNotificationIds = useRef(new Set<string>())

  const logout = useCallback(async () => {
    if (session?.token && mobilePushToken) {
      await apiRequest(apiUrl, '/push/mobile/subscribe', {
        token: session.token,
        method: 'DELETE',
        body: { expoPushToken: mobilePushToken },
      }).catch(() => undefined)
    }
    await clearSession()
    setSession(null)
    setData(null)
    setSelectedVendor(null)
    setNotifications([])
    seenNotificationIds.current.clear()
    setNotificationEnabled(false)
    setRemotePushEnabled(false)
    setMobilePushToken('')
    setTab('discover')
  }, [apiUrl, mobilePushToken, session?.token])

  const bootstrap = useCallback(async (activeSession: AuthSession, activeApiUrl = apiUrl) => {
    if (isSessionExpired(activeSession)) {
      await logout()
      throw new Error('Your session expired. Sign in again.')
    }
    try {
      const response = await apiRequest<ApiBootstrap>(activeApiUrl, '/bootstrap', { token: activeSession.token })
      setData(response)
      if (response.user.id !== activeSession.user.id || response.user.vendorId !== activeSession.user.vendorId) {
        const nextSession = { ...activeSession, user: response.user }
        setSession(nextSession)
        await saveSession(nextSession)
      }
      return response
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await logout()
      throw error
    }
  }, [apiUrl, logout])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [storedEndpoint, storedSession] = await Promise.all([loadApiEndpoint(), loadSession()])
        if (!alive) return
        const endpoint = storedEndpoint || defaultApiUrl()
        setApiUrl(endpoint)
        if (storedSession && !isSessionExpired(storedSession)) {
          setSession(storedSession)
          await bootstrap(storedSession, endpoint)
        } else if (storedSession) {
          await clearSession()
        }
      } catch (error) {
        if (alive) setFatalError(error instanceof Error ? error.message : 'Could not start FeastFlow')
      } finally {
        if (alive) setHydrating(false)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!session) return
    const timer = setInterval(() => {
      if (isSessionExpired(session)) void logout()
    }, 30_000)
    return () => clearInterval(timer)
  }, [logout, session])

  const fetchNotifications = useCallback(async () => {
    if (!session) return
    try {
      const response = await apiRequest<{ notifications: LiveEvent[] }>(apiUrl, '/notifications', { token: session.token })
      const newEvents = response.notifications.filter((event) => !seenNotificationIds.current.has(event.id))
      if (seenNotificationIds.current.size && notificationEnabled) {
        for (const event of newEvents.slice(0, 3)) {
          await Notifications.scheduleNotificationAsync({ content: { title: event.title, body: event.body, sound: true, data: { eventId: event.id } }, trigger: null })
        }
      }
      response.notifications.forEach((event) => seenNotificationIds.current.add(event.id))
      setNotifications(response.notifications)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await logout()
    }
  }, [apiUrl, logout, notificationEnabled, session])

  useEffect(() => {
    if (!session) return
    void fetchNotifications()
    const timer = setInterval(() => void fetchNotifications(), 20_000)
    return () => clearInterval(timer)
  }, [fetchNotifications, session])

  const authenticate = async (nextSession: AuthSession) => {
    await saveSession(nextSession)
    setSession(nextSession)
    setFatalError('')
    await bootstrap(nextSession)
    setTab(nextSession.user.role === 'customer' ? 'discover' : nextSession.user.role === 'vendor' ? 'vendor' : 'admin')
  }

  const changeApiUrl = async (nextUrl: string) => {
    await saveApiEndpoint(nextUrl)
    setApiUrl(nextUrl)
    setFatalError('')
  }

  const refresh = async () => {
    if (!session) return
    setRefreshing(true)
    setFatalError('')
    try { await bootstrap(session) } catch (error) { setFatalError(error instanceof Error ? error.message : 'Refresh failed') } finally { setRefreshing(false) }
  }

  const updateVendor = (vendor: Vendor) => {
    setData((current) => current ? { ...current, vendors: current.vendors.some((item) => item.id === vendor.id) ? current.vendors.map((item) => item.id === vendor.id ? vendor : item) : [vendor, ...current.vendors] } : current)
    setSelectedVendor((current) => current?.id === vendor.id ? vendor : current)
  }

  const updateBooking = (booking: Booking) => {
    setData((current) => current ? { ...current, bookings: current.bookings.some((item) => item.id === booking.id) ? current.bookings.map((item) => item.id === booking.id ? booking : item) : [booking, ...current.bookings] } : current)
  }

  const enableNotifications = async () => {
    setNotificationBusy(true)
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('feastflow-updates', { name: 'FeastFlow updates', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 180, 90, 180], lightColor: colors.green })
      }
      const permission = await Notifications.requestPermissionsAsync()
      setNotificationEnabled(permission.granted)
      if (permission.granted) {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId
        if (Device.isDevice && (Platform.OS === 'android' || Platform.OS === 'ios') && projectId && projectId !== 'REPLACE_WITH_EXPO_PROJECT_ID') {
          try {
            const pushToken = await Notifications.getExpoPushTokenAsync({ projectId })
            await apiRequest(apiUrl, '/push/mobile/subscribe', {
              token: session?.token,
              body: { expoPushToken: pushToken.data, platform: Platform.OS },
            })
            setMobilePushToken(pushToken.data)
            setRemotePushEnabled(true)
          } catch {
            setRemotePushEnabled(false)
          }
        }
        await Notifications.scheduleNotificationAsync({ content: { title: 'FeastFlow notifications are on', body: 'Booking, payment, document, and chat updates will appear here.', sound: true }, trigger: null })
      }
    } finally {
      setNotificationBusy(false)
    }
  }

  if (hydrating) return <View style={styles.full}><LoadingState label="Connecting to the local database API" /></View>
  if (!session) return <AuthScreen apiUrl={apiUrl} onApiUrlChange={changeApiUrl} onAuthenticated={authenticate} />
  if (!data) return <View style={styles.full}><LoadingState label="Loading your FeastFlow workspace" />{fatalError ? <View style={styles.errorWrap}><Notice tone="error" text={fatalError} /><Button label="Try again" icon="refresh" onPress={refresh} busy={refreshing} /></View> : null}</View>

  const role = session.user.role
  const vendor = data.vendors.find((item) => item.id === session.user.vendorId)
  const navTabs = tabsForRole(role)
  const activeTab = navTabs.some((item) => item.id === tab) ? tab : navTabs[0]!.id
  const title = role === 'customer' ? 'FeastFlow' : role === 'vendor' ? vendor?.name || 'Vendor workspace' : 'FeastFlow Admin'

  if (selectedVendor && role === 'customer') {
    return (
      <Screen>
        <VendorDetail apiUrl={apiUrl} token={session.token} vendor={selectedVendor} addOns={data.addOns} onBack={() => setSelectedVendor(null)} onBookingCreated={(booking) => { updateBooking(booking); setSelectedVendor(null); setTab('bookings') }} />
      </Screen>
    )
  }

  return (
    <View style={styles.full}>
      <Screen>
        <TopBar title={title} subtitle={`${session.user.name} · ${role}`} notificationCount={notifications.length} onNotifications={() => setNotificationOpen(true)} onLogout={logout} />
        {fatalError ? <Notice tone="error" text={fatalError} /> : null}
        {activeTab === 'discover' ? <CustomerHome apiUrl={apiUrl} token={session.token} vendors={data.vendors} onSelectVendor={setSelectedVendor} /> : null}
        {activeTab === 'bookings' ? <BookingsScreen apiUrl={apiUrl} token={session.token} role={role} bookings={data.bookings} vendors={data.vendors} onBookingUpdated={updateBooking} /> : null}
        {activeTab === 'vendor' ? <VendorDashboard apiUrl={apiUrl} token={session.token} user={session.user} vendor={vendor} bookings={data.bookings} onVendorUpdated={updateVendor} /> : null}
        {activeTab === 'admin' ? <AdminDashboard apiUrl={apiUrl} token={session.token} vendors={data.vendors} onVendorUpdated={updateVendor} /> : null}
      </Screen>
      <BottomNav tabs={navTabs} active={activeTab} onChange={(next) => { setTab(next); setFatalError('') }} />

      <Sheet visible={notificationOpen} title="Notifications" onClose={() => setNotificationOpen(false)}>
        {!notificationEnabled ? <Button label="Enable alerts and sound" icon="notifications-outline" onPress={enableNotifications} busy={notificationBusy} /> : <Notice tone="success" text={remotePushEnabled ? 'Remote push, alerts, and sound are enabled on this device.' : 'Local alerts and sound are enabled. A development build and Expo project ID enable background remote push.'} />}
        <Button label="Refresh updates" icon="refresh-outline" variant="secondary" onPress={fetchNotifications} />
        {notifications.length ? notifications.map((event) => <View key={event.id} style={styles.notification}><View style={styles.notificationIcon}><Ionicons name="notifications" size={19} color={colors.coral} /></View><View style={styles.notificationCopy}><Text style={styles.notificationTitle}>{event.title}</Text><Text style={styles.notificationBody}>{event.body}</Text><Text style={styles.notificationTime}>{event.time}</Text></View></View>) : <EmptyState icon="notifications-off-outline" title="No updates yet" body="New booking, payment, chat, and document events will appear here." />}
      </Sheet>
    </View>
  )
}

function tabsForRole(role: Role): { id: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] {
  if (role === 'customer') return [{ id: 'discover', label: 'Discover', icon: 'search-outline' }, { id: 'bookings', label: 'Bookings', icon: 'calendar-outline' }]
  if (role === 'vendor') return [{ id: 'vendor', label: 'Dashboard', icon: 'storefront-outline' }, { id: 'bookings', label: 'Requests', icon: 'calendar-outline' }]
  return [{ id: 'admin', label: 'Vendors', icon: 'shield-checkmark-outline' }, { id: 'bookings', label: 'Bookings', icon: 'calendar-outline' }]
}

function BottomNav({ tabs, active, onChange }: { tabs: ReturnType<typeof tabsForRole>; active: AppTab; onChange: (tab: AppTab) => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((item) => (
        <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: active === item.id }} onPress={() => onChange(item.id)} style={[styles.navItem, active === item.id && styles.navItemActive]}>
          <Ionicons name={item.icon} size={22} color={active === item.id ? colors.white : colors.muted} />
          <Text style={[styles.navText, active === item.id && styles.navTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.canvas },
  errorWrap: { padding: 16, gap: 12 },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 8, minHeight: 70, padding: 7, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 7, ...shadows.raised },
  navItem: { flex: 1, minHeight: 54, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  navItemActive: { backgroundColor: colors.green },
  navText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  navTextActive: { color: colors.white },
  notification: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  notificationIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1 },
  notificationTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  notificationBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  notificationTime: { color: colors.teal, fontSize: 10, fontWeight: '700', marginTop: 4 },
})
