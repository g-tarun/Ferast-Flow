import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { apiRequest, mediaUrl, normalizeApiUrl, sessionFromAuth } from '../api'
import { Button, Chip, Field, Notice, Screen, Sheet } from '../components/ui'
import { colors, radii, shadows, spacing } from '../theme'
import type { AuthResponse, AuthSession, AuthenticatedResponse, MfaChallenge, Role } from '../types'

type Props = {
  apiUrl: string
  onApiUrlChange: (value: string) => Promise<void>
  onAuthenticated: (session: AuthSession) => Promise<void>
}

const demoAccounts: Record<Role, { email: string; password: string }> = {
  customer: { email: 'customer@feastflow.test', password: 'demo1234' },
  vendor: { email: 'vendor@feastflow.test', password: 'demo1234' },
  admin: { email: 'admin@feastflow.test', password: 'demo1234' },
}

export function AuthScreen({ apiUrl, onApiUrlChange, onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<Role>('customer')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [serverSheet, setServerSheet] = useState(false)
  const [endpointDraft, setEndpointDraft] = useState(apiUrl)
  const [serverState, setServerState] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle')

  const isValid = useMemo(() => {
    const basic = email.trim().includes('@') && password.length >= 8
    return mode === 'login' ? basic : basic && name.trim().length >= 2 && role !== 'admin'
  }, [email, mode, name, password, role])

  const chooseRole = (nextRole: Role) => {
    setRole(nextRole)
    setError('')
    if (mode === 'register' && nextRole === 'admin') setMode('login')
  }

  const fillDemo = () => {
    setMode('login')
    setEmail(demoAccounts[role].email)
    setPassword(demoAccounts[role].password)
    setError('')
  }

  const submit = async () => {
    if (!isValid || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await apiRequest<AuthResponse>(apiUrl, `/auth/${mode}`, {
        body: { role, email: email.trim(), password, ...(mode === 'register' ? { name: name.trim() } : {}) },
      })
      if ('mfaRequired' in response) {
        setChallenge(response)
        setMfaCode('')
      } else {
        await onAuthenticated(sessionFromAuth(response.token, response.user))
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  const verifyMfa = async () => {
    if (!challenge || mfaCode.length !== 6) return
    setBusy(true)
    setError('')
    try {
      const response = await apiRequest<AuthenticatedResponse>(apiUrl, '/auth/mfa/verify', {
        body: { challengeId: challenge.challengeId, code: mfaCode },
      })
      await onAuthenticated(sessionFromAuth(response.token, response.user))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  const resendMfa = async () => {
    if (!challenge) return
    setBusy(true)
    setError('')
    try {
      const response = await apiRequest<MfaChallenge>(apiUrl, '/auth/mfa/resend', {
        body: { challengeId: challenge.challengeId },
      })
      setChallenge(response)
      setMfaCode('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not resend code')
    } finally {
      setBusy(false)
    }
  }

  const testAndSaveEndpoint = async () => {
    setServerState('checking')
    setError('')
    try {
      const next = normalizeApiUrl(endpointDraft)
      await apiRequest(next, '/health')
      await onApiUrlChange(next)
      setEndpointDraft(next)
      setServerState('online')
      setTimeout(() => setServerSheet(false), 450)
    } catch (requestError) {
      setServerState('offline')
      setError(requestError instanceof Error ? requestError.message : 'Server is unavailable')
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.logo}><Ionicons name="restaurant-outline" size={25} color={colors.white} /></View>
            <View><Text style={styles.brand}>FeastFlow</Text><Text style={styles.brandDetail}>Catering marketplace</Text></View>
          </View>
          <Pressable accessibilityLabel="Server settings" style={styles.serverButton} onPress={() => setServerSheet(true)}>
            <View style={[styles.serverDot, serverState === 'offline' && styles.serverDotOffline]} />
            <Ionicons name="server-outline" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Image source={mediaUrl(apiUrl, '/images/hero-catering.png')} style={styles.heroImage} contentFit="cover" transition={250} />
          <LinearGradient colors={['rgba(7,35,24,0.08)', 'rgba(7,35,24,0.9)']} style={styles.heroOverlay}>
            <View style={styles.heroBadge}><Ionicons name="shield-checkmark" size={14} color={colors.greenDark} /><Text style={styles.heroBadgeText}>Verified caterers</Text></View>
            <Text style={styles.heroTitle}>Every event deserves a table people remember.</Text>
            <Text style={styles.heroBody}>Discover, book, pay, and coordinate with trusted catering teams.</Text>
          </LinearGradient>
        </View>

        <View style={styles.authPanel}>
          <View style={styles.modeRow}>
            <Pressable onPress={() => { setMode('login'); setError('') }} style={[styles.mode, mode === 'login' && styles.modeActive]}><Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>Sign in</Text></Pressable>
            <Pressable onPress={() => { if (role !== 'admin') setMode('register'); setError('') }} style={[styles.mode, mode === 'register' && styles.modeActive, role === 'admin' && styles.modeDisabled]}><Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>Register</Text></Pressable>
          </View>

          <Text style={styles.panelTitle}>{challenge ? 'Check your email' : mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={styles.panelBody}>{challenge ? challenge.delivery : mode === 'login' ? 'Choose your role and continue securely.' : 'Vendor profiles start empty and move through review.'}</Text>

          {challenge ? (
            <View style={styles.form}>
              <Field label="6-digit code" value={mfaCode} onChangeText={(value) => setMfaCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" icon="keypad-outline" />
              {error ? <Notice tone="error" text={error} /> : null}
              <Button label="Verify and continue" icon="shield-checkmark-outline" onPress={verifyMfa} disabled={mfaCode.length !== 6} busy={busy} />
              <Button label="Send a new code" variant="secondary" onPress={resendMfa} disabled={busy} />
              <Button label="Back to sign in" variant="ghost" onPress={() => { setChallenge(null); setError('') }} />
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.roles}>
                {(['customer', 'vendor', 'admin'] as Role[]).map((item) => (
                  <Chip key={item} label={item[0]!.toUpperCase() + item.slice(1)} selected={role === item} onPress={() => chooseRole(item)} icon={item === 'customer' ? 'person-outline' : item === 'vendor' ? 'storefront-outline' : 'shield-outline'} />
                ))}
              </View>
              {mode === 'register' ? <Field label="Full name" value={name} onChangeText={setName} placeholder="Your full name" icon="person-outline" /> : null}
              <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Minimum 8 characters" icon="lock-closed-outline" secureTextEntry />
              {role === 'admin' ? <Notice text="Admin accounts are issued internally and cannot be registered from the app." /> : null}
              {error ? <Notice tone="error" text={error} /> : null}
              <Button label={mode === 'login' ? 'Sign in securely' : 'Create account'} icon={mode === 'login' ? 'key-outline' : 'person-add-outline'} onPress={submit} disabled={!isValid} busy={busy} />
              {__DEV__ ? <Button label="Use local demo account" variant="ghost" icon="flask-outline" onPress={fillDemo} /> : null}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={serverSheet} title="Local API connection" onClose={() => setServerSheet(false)}>
        <Notice text="Use your laptop's Wi-Fi IP, not 127.0.0.1, when testing on a physical phone. Example: http://192.168.1.25:4000" />
        <Field label="API address" value={endpointDraft} onChangeText={setEndpointDraft} placeholder="http://192.168.1.25:4000" icon="server-outline" />
        {serverState === 'online' ? <Notice tone="success" text="Local API connected. MySQL data is available through the backend." /> : null}
        {serverState === 'offline' && error ? <Notice tone="error" text={error} /> : null}
        <Button label="Test and save" icon="pulse-outline" onPress={testAndSaveEndpoint} busy={serverState === 'checking'} disabled={!endpointDraft.trim()} />
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  brandDetail: { color: colors.muted, fontSize: 11 },
  serverButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  serverDot: { position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  serverDotOffline: { backgroundColor: colors.red },
  hero: { height: 265, justifyContent: 'flex-end', marginHorizontal: -spacing.md },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { flex: 1, justifyContent: 'flex-end', padding: 22 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.greenSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, marginBottom: 10 },
  heroBadgeText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  heroTitle: { color: colors.white, fontSize: 31, lineHeight: 36, fontWeight: '900', maxWidth: 360 },
  heroBody: { color: '#E5F2EB', fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 340 },
  authPanel: { backgroundColor: colors.white, borderRadius: radii.lg, marginTop: -9, padding: 18, ...shadows.card },
  modeRow: { flexDirection: 'row', backgroundColor: '#EFF2F0', borderRadius: radii.md, padding: 4, marginBottom: 20 },
  mode: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  modeActive: { backgroundColor: colors.white, ...shadows.card },
  modeDisabled: { opacity: 0.4 },
  modeText: { color: colors.muted, fontWeight: '800' },
  modeTextActive: { color: colors.ink },
  panelTitle: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  panelBody: { color: colors.muted, lineHeight: 20, marginTop: 5 },
  form: { gap: 15, marginTop: 20 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
