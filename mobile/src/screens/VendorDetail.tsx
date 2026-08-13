import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { apiRequest, mediaUrl } from '../api'
import { Button, Chip, Field, Notice, SectionTitle, Sheet, StatusPill, money } from '../components/ui'
import { colors, radii, shadows, spacing } from '../theme'
import type { AddOn, Booking, CaterPackage, Vendor } from '../types'

type Props = {
  apiUrl: string
  token: string
  vendor: Vendor
  addOns: AddOn[]
  onBack: () => void
  onBookingCreated: (booking: Booking) => void
}

export function VendorDetail({ apiUrl, token, vendor, addOns, onBack, onBookingCreated }: Props) {
  const [selectedPackage, setSelectedPackage] = useState<CaterPackage>(vendor.packages[0]!)
  const [date, setDate] = useState(vendor.availability[0] || '')
  const [eventType, setEventType] = useState(vendor.eventTypes[0] || 'Event')
  const [guests, setGuests] = useState(Math.max(vendor.packages[0]?.minGuests || 25, 50))
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [paymentChoice, setPaymentChoice] = useState<'deposit' | 'full'>('deposit')
  const [checkoutMode, setCheckoutMode] = useState<'quote' | 'instant' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const amount = useMemo(() => {
    const extras = addOns.filter((item) => selectedAddOns.includes(item.id)).reduce((sum, item) => sum + item.price, 0)
    return selectedPackage.pricePerGuest * guests + extras
  }, [addOns, guests, selectedAddOns, selectedPackage])
  const payable = paymentChoice === 'full' ? amount : Math.ceil(amount * 0.3)

  const selectPackage = (pack: CaterPackage) => {
    setSelectedPackage(pack)
    setGuests((value) => Math.max(value, pack.minGuests))
  }

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const createBooking = async () => {
    if (!date || guests < selectedPackage.minGuests || !checkoutMode) return
    setBusy(true)
    setError('')
    try {
      const response = await apiRequest<{ booking: Booking }>(apiUrl, '/bookings', {
        token,
        body: {
          vendorId: vendor.id,
          packageId: selectedPackage.id,
          eventType,
          date,
          guests,
          addOns: selectedAddOns,
          note,
          paymentChoice,
          mode: checkoutMode,
        },
      })
      setCheckoutMode(null)
      onBookingCreated(response.booking)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create booking')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <View style={styles.hero}>
        <Image source={mediaUrl(apiUrl, vendor.image)} style={styles.heroImage} contentFit="cover" transition={220} />
        <View style={styles.heroShade} />
        <Pressable accessibilityLabel="Back to caterers" onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={23} color={colors.ink} /></Pressable>
        <View style={styles.heroCopy}>
          <Text style={styles.heroName}>{vendor.name}</Text>
          <Text style={styles.heroMeta}>{vendor.cuisine} · {vendor.address}</Text>
        </View>
      </View>

      <View style={styles.quickFacts}>
        <View style={styles.fact}><Ionicons name="star" size={17} color={colors.gold} /><Text style={styles.factValue}>{vendor.rating.toFixed(1)}</Text><Text style={styles.factLabel}>{vendor.reviewCount} reviews</Text></View>
        <View style={styles.fact}><Ionicons name="location" size={17} color={colors.teal} /><Text style={styles.factValue}>{vendor.distanceKm.toFixed(1)} km</Text><Text style={styles.factLabel}>{vendor.serviceRadius} km radius</Text></View>
        <View style={styles.fact}><Ionicons name="chatbubble" size={17} color={colors.coral} /><Text style={styles.factValue}>{vendor.responseMinutes || 'New'}</Text><Text style={styles.factLabel}>min response</Text></View>
      </View>

      <View style={styles.aboutRow}>
        <StatusPill status={vendor.status} />
        <Text style={styles.license} numberOfLines={1}><Ionicons name="document-text-outline" size={14} /> {vendor.license}</Text>
      </View>

      <SectionTitle eyebrow="Menus" title="Choose a package" detail={`${vendor.packages.length} options`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packages}>
        {vendor.packages.map((pack) => (
          <Pressable key={pack.id} onPress={() => selectPackage(pack)} style={[styles.packageCard, selectedPackage.id === pack.id && styles.packageCardSelected]}>
            <Image source={mediaUrl(apiUrl, pack.image || vendor.image)} style={styles.packageImage} contentFit="cover" transition={180} />
            <View style={styles.packageBody}>
              <Text style={styles.packageTitle} numberOfLines={2}>{pack.title}</Text>
              <Text style={styles.packagePrice}>{money(pack.pricePerGuest)} <Text style={styles.packageUnit}>per guest</Text></Text>
              <Text style={styles.packageMinimum}>Minimum {pack.minGuests} guests</Text>
              {pack.instantBook ? <View style={styles.instantBadge}><Ionicons name="flash" size={12} color={colors.coral} /><Text style={styles.instantText}>Instant book</Text></View> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle eyebrow="Package details" title={selectedPackage.title} />
      <Text style={styles.description}>{selectedPackage.description}</Text>
      <View style={styles.menuList}>{selectedPackage.items.map((item) => <View key={item} style={styles.menuItem}><Ionicons name="checkmark-circle" size={18} color={colors.green} /><Text style={styles.menuItemText}>{item}</Text></View>)}</View>

      <SectionTitle eyebrow="Event" title="Build your booking" />
      <View style={styles.bookingForm}>
        <Text style={styles.fieldLabel}>Available dates</Text>
        <View style={styles.chips}>{vendor.availability.length ? vendor.availability.slice(0, 6).map((item) => <Chip key={item} label={item} selected={date === item} onPress={() => setDate(item)} icon="calendar-outline" />) : <Notice text="No published dates. Ask the vendor for a custom date." />}</View>
        <Text style={styles.fieldLabel}>Event type</Text>
        <View style={styles.chips}>{vendor.eventTypes.map((item) => <Chip key={item} label={item} selected={eventType === item} onPress={() => setEventType(item)} />)}</View>
        <Field label="Guests" value={String(guests)} onChangeText={(value) => setGuests(Number(value.replace(/\D/g, '')) || 0)} keyboardType="number-pad" icon="people-outline" />
        {guests < selectedPackage.minGuests ? <Notice tone="error" text={`This package requires at least ${selectedPackage.minGuests} guests.`} /> : null}
        <Text style={styles.fieldLabel}>Useful add-ons</Text>
        <View style={styles.addOns}>{addOns.map((item) => (
          <Pressable key={item.id} onPress={() => toggleAddOn(item.id)} style={[styles.addOn, selectedAddOns.includes(item.id) && styles.addOnSelected]}>
            <Ionicons name={selectedAddOns.includes(item.id) ? 'checkbox' : 'square-outline'} size={22} color={selectedAddOns.includes(item.id) ? colors.green : colors.muted} />
            <Text style={styles.addOnName}>{item.name}</Text><Text style={styles.addOnPrice}>{money(item.price)}</Text>
          </Pressable>
        ))}</View>
        <Field label="Notes for vendor" value={note} onChangeText={setNote} placeholder="Dietary details, venue access, timing..." multiline icon="chatbubble-ellipses-outline" />
      </View>

      <View style={styles.totalBar}>
        <View><Text style={styles.totalLabel}>Package + add-ons</Text><Text style={styles.totalHint}>{guests} guests · {selectedAddOns.length} add-ons</Text></View>
        <Text style={styles.total}>{money(amount)}</Text>
      </View>
      {error ? <Notice tone="error" text={error} /> : null}
      <View style={styles.actions}>
        <View style={styles.action}><Button label="Request quote" icon="chatbubble-outline" variant="secondary" onPress={() => setCheckoutMode('quote')} disabled={!date || guests < selectedPackage.minGuests} /></View>
        <View style={styles.action}><Button label={selectedPackage.instantBook ? `Pay ${money(Math.ceil(amount * 0.3))}` : 'Request first'} icon="card-outline" onPress={() => setCheckoutMode('instant')} disabled={!selectedPackage.instantBook || !date || guests < selectedPackage.minGuests} /></View>
      </View>

      <Sheet visible={Boolean(checkoutMode)} title={checkoutMode === 'instant' ? 'Secure demo checkout' : 'Confirm quote request'} onClose={() => !busy && setCheckoutMode(null)}>
        <View style={styles.checkoutSummary}><Text style={styles.checkoutVendor}>{vendor.name}</Text><Text style={styles.checkoutPackage}>{selectedPackage.title}</Text><Text style={styles.checkoutMeta}>{date} · {guests} guests</Text></View>
        {checkoutMode === 'instant' ? (
          <>
            <Text style={styles.fieldLabel}>Payment amount</Text>
            <View style={styles.chips}><Chip label={`30% deposit · ${money(Math.ceil(amount * 0.3))}`} selected={paymentChoice === 'deposit'} onPress={() => setPaymentChoice('deposit')} /><Chip label={`Full · ${money(amount)}`} selected={paymentChoice === 'full'} onPress={() => setPaymentChoice('full')} /></View>
            <Notice text="This demo uses FeastFlowPay Sandbox. It creates a real payment record in MySQL without charging a bank card." />
            <View style={styles.payable}><Text style={styles.payableLabel}>Pay now</Text><Text style={styles.payableValue}>{money(payable)}</Text></View>
          </>
        ) : <Notice text="The vendor will receive this request and can accept, counter, or decline it from their dashboard." />}
        {error ? <Notice tone="error" text={error} /> : null}
        <Button label={checkoutMode === 'instant' ? `Pay ${money(payable)}` : 'Send request'} icon={checkoutMode === 'instant' ? 'lock-closed-outline' : 'send-outline'} onPress={createBooking} busy={busy} />
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  hero: { height: 290, marginHorizontal: -spacing.md, position: 'relative', backgroundColor: '#DDE4DF' },
  heroImage: { width: '100%', height: '100%' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,17,11,0.28)' },
  backButton: { position: 'absolute', left: 16, top: 16, width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { position: 'absolute', left: 18, right: 18, bottom: 20 },
  heroName: { color: colors.white, fontSize: 31, lineHeight: 36, fontWeight: '900' },
  heroMeta: { color: '#E7EFEA', fontSize: 14, lineHeight: 20, marginTop: 5 },
  quickFacts: { flexDirection: 'row', backgroundColor: colors.white, marginTop: -1, marginHorizontal: -spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  fact: { flex: 1, minHeight: 88, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  factValue: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 3 },
  factLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  aboutRow: { paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  license: { flex: 1, textAlign: 'right', color: colors.muted, fontSize: 12 },
  packages: { gap: 12, paddingRight: 8 },
  packageCard: { width: 245, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadows.card },
  packageCardSelected: { borderWidth: 2, borderColor: colors.green },
  packageImage: { width: '100%', height: 126, backgroundColor: '#DDE4DF' },
  packageBody: { padding: 13 },
  packageTitle: { color: colors.ink, fontSize: 17, lineHeight: 21, fontWeight: '900' },
  packagePrice: { color: colors.greenDark, fontSize: 16, fontWeight: '900', marginTop: 7 },
  packageUnit: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  packageMinimum: { color: colors.muted, fontSize: 11, marginTop: 3 },
  instantBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radii.pill, backgroundColor: colors.coralSoft, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 },
  instantText: { color: '#96351F', fontSize: 10, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  menuList: { marginTop: 13, gap: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuItemText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  bookingForm: { gap: 14 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  addOns: { gap: 8 },
  addOn: { minHeight: 52, paddingHorizontal: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 9 },
  addOnSelected: { borderColor: '#8BC7A9', backgroundColor: '#F2FBF6' },
  addOnName: { flex: 1, color: colors.ink, fontWeight: '700' },
  addOnPrice: { color: colors.ink, fontWeight: '900' },
  totalBar: { marginTop: 22, paddingVertical: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  totalHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
  total: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  action: { flex: 1 },
  checkoutSummary: { padding: 14, borderRadius: radii.md, backgroundColor: colors.canvas },
  checkoutVendor: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  checkoutPackage: { color: colors.greenDark, fontSize: 14, fontWeight: '800', marginTop: 3 },
  checkoutMeta: { color: colors.muted, fontSize: 12, marginTop: 6 },
  payable: { paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between' },
  payableLabel: { color: colors.muted, fontWeight: '700' },
  payableValue: { color: colors.ink, fontSize: 23, fontWeight: '900' },
})
