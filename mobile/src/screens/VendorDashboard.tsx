import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { apiRequest, documentUrl, mediaUrl } from '../api'
import { Button, EmptyState, Field, Notice, SectionTitle, StatusPill, money } from '../components/ui'
import { colors, radii, shadows } from '../theme'
import type { ApplicationDocumentKey, AuthUser, Booking, UploadedDocument, Vendor } from '../types'

type Props = {
  apiUrl: string
  token: string
  user: AuthUser
  vendor?: Vendor
  bookings: Booking[]
  onVendorUpdated: (vendor: Vendor) => void
}

const documentLabels: Record<ApplicationDocumentKey, string> = {
  foodLicense: 'Food license',
  identity: 'Owner ID',
  insurance: 'Insurance',
}

export function VendorDashboard({ apiUrl, token, user, vendor, bookings, onVendorUpdated }: Props) {
  const isDraft = !vendor || vendor.name === 'Complete vendor onboarding' || vendor.license === 'PENDING-ONBOARDING'
  const locked = vendor?.status === 'approved'
  const [businessName, setBusinessName] = useState(isDraft ? '' : vendor?.name || '')
  const [cuisine, setCuisine] = useState(vendor?.cuisine || '')
  const [pincode, setPincode] = useState(vendor?.pincode || '')
  const [radius, setRadius] = useState(String(vendor?.serviceRadius || 12))
  const [license, setLicense] = useState(isDraft ? '' : vendor?.license || '')
  const [pendingDocuments, setPendingDocuments] = useState<Partial<Record<ApplicationDocumentKey, UploadedDocument>>>({})
  const [packageTitle, setPackageTitle] = useState('')
  const [packagePrice, setPackagePrice] = useState('')
  const [packageGuests, setPackageGuests] = useState('')
  const [packageTag, setPackageTag] = useState('Wedding')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!vendor) return
    const vendorIsDraft = vendor.name === 'Complete vendor onboarding' || vendor.license === 'PENDING-ONBOARDING'
    setBusinessName(vendorIsDraft ? '' : vendor.name)
    setCuisine(vendor.cuisine || '')
    setPincode(vendor.pincode || '')
    setRadius(String(vendor.serviceRadius || 12))
    setLicense(vendorIsDraft ? '' : vendor.license)
  }, [vendor])

  const vendorBookings = bookings.filter((booking) => booking.vendorId === vendor?.id)
  const confirmed = vendorBookings.filter((booking) => ['confirmed', 'completed'].includes(booking.status))
  const revenue = confirmed.reduce((sum, booking) => sum + booking.deposit, 0)
  const openRequests = vendorBookings.filter((booking) => ['quote-sent', 'countered', 'accepted'].includes(booking.status)).length
  const documents = vendor?.documents || {}
  const requiredMissing = (['foodLicense', 'identity'] as ApplicationDocumentKey[]).filter((key) => !documents[key] && !pendingDocuments[key])
  const rejectedKeys = (Object.keys(documents) as ApplicationDocumentKey[]).filter((key) => documents[key]?.status === 'rejected')
  const canSubmitReview = isDraft || requiredMissing.length > 0 || rejectedKeys.length > 0 || Object.keys(pendingDocuments).length > 0
  const validApplication = Boolean(businessName.trim().length >= 2 && cuisine.trim() && /^\d{5,8}$/.test(pincode) && license.trim().length >= 3 && requiredMissing.length === 0)

  const currentBanner = vendor?.image ? mediaUrl(apiUrl, vendor.image) : mediaUrl(apiUrl, '/images/wedding-buffet.png')

  const pickBanner = async () => {
    if (!vendor) return
    setBusy('banner')
    setError('')
    setSuccess('')
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) throw new Error('Photo access is required to choose a banner.')
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.72, base64: true, allowsEditing: true, aspect: [16, 9] })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset?.base64) throw new Error('The selected image could not be read.')
      if ((asset.fileSize || 0) > 2_500_000) throw new Error('Choose a banner smaller than 2.5 MB.')
      const dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
      const response = await apiRequest<{ vendor: Vendor }>(apiUrl, `/vendors/${vendor.id}/banner`, { token, method: 'PATCH', body: { bannerImage: dataUrl } })
      onVendorUpdated(response.vendor)
      setSuccess('Banner saved in MySQL.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Banner upload failed')
    } finally {
      setBusy('')
    }
  }

  const pickDocument = async (key: ApplicationDocumentKey) => {
    setBusy(key)
    setError('')
    setSuccess('')
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg'], copyToCacheDirectory: true })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset) return
      if (asset.size && asset.size > 2_500_000) throw new Error('Documents must be smaller than 2.5 MB.')
      const file = new File(asset.uri)
      const base64 = await file.base64()
      const type = asset.mimeType || file.type || 'application/pdf'
      setPendingDocuments((current) => ({
        ...current,
        [key]: {
          key,
          documentName: documentLabels[key],
          name: asset.name,
          type,
          size: asset.size || file.size,
          dataUrl: `data:${type};base64,${base64}`,
          uploadedAt: new Date().toISOString(),
          status: 'pending',
        },
      }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Document could not be read')
    } finally {
      setBusy('')
    }
  }

  const submitApplication = async () => {
    if (!validApplication || !canSubmitReview) return
    setBusy('application')
    setError('')
    setSuccess('')
    try {
      const response = await apiRequest<{ vendor: Vendor }>(apiUrl, '/vendors/application', {
        token,
        body: { application: { businessName: businessName.trim(), cuisine: cuisine.trim(), pincode, radius: Number(radius), license: license.trim(), documents: pendingDocuments } },
      })
      onVendorUpdated(response.vendor)
      setPendingDocuments({})
      setSuccess('Application submitted. The admin team can now review the database documents.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Application could not be submitted')
    } finally {
      setBusy('')
    }
  }

  const addPackage = async () => {
    if (!vendor || !packageTitle.trim() || Number(packagePrice) < 1 || Number(packageGuests) < 1) return
    setBusy('package')
    setError('')
    setSuccess('')
    try {
      const response = await apiRequest<{ vendor: Vendor }>(apiUrl, `/vendors/${vendor.id}/packages`, {
        token,
        body: { title: packageTitle.trim(), pricePerGuest: Number(packagePrice), minGuests: Number(packageGuests), tag: packageTag.trim(), image: vendor.image },
      })
      onVendorUpdated(response.vendor)
      setPackageTitle('')
      setPackagePrice('')
      setPackageGuests('')
      setSuccess('Package added to MySQL and the marketplace profile.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Package could not be added')
    } finally {
      setBusy('')
    }
  }

  const previewDocument = async (document?: UploadedDocument) => {
    if (!document?.id) return
    await WebBrowser.openBrowserAsync(documentUrl(apiUrl, document.id, token), { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })
  }

  if (!vendor) return <EmptyState icon="storefront-outline" title="Vendor profile is loading" body="Refresh after the local API creates the onboarding record for this account." />

  return (
    <>
      <View style={styles.titleRow}><View style={styles.titleCopy}><Text style={styles.eyebrow}>VENDOR OPERATIONS</Text><Text style={styles.title}>{isDraft ? 'Start your catering profile' : vendor.name}</Text><Text style={styles.subtitle}>{isDraft ? `Welcome, ${user.name}. Your profile starts empty.` : vendor.address}</Text></View><StatusPill status={vendor.status} /></View>

      <View style={styles.stats}>
        <Stat icon="wallet-outline" label="Confirmed revenue" value={money(revenue)} color={colors.green} />
        <Stat icon="cube-outline" label="Live packages" value={String(vendor.packages.length)} color={colors.teal} />
        <Stat icon="chatbubble-outline" label="Open requests" value={String(openRequests)} color={colors.coral} />
        <Stat icon="location-outline" label="Service area" value={`${vendor.serviceRadius} km`} color={colors.gold} />
      </View>

      {vendor.adminNote ? <Notice tone={vendor.status === 'approved' ? 'success' : vendor.status === 'rejected' || vendor.status === 'needs-info' ? 'error' : 'info'} text={vendor.adminNote} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      {success ? <Notice tone="success" text={success} /> : null}

      <SectionTitle eyebrow="Onboarding" title="Vendor application" detail={locked ? 'Admin approved' : 'Database-backed'} />
      <View style={styles.form}>
        <Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="Enter your registered business name" editable={!locked} />
        <Field label="Cuisine" value={cuisine} onChangeText={setCuisine} placeholder="Indian, Continental" editable={!locked} />
        <View style={styles.columns}><View style={styles.column}><Field label="Pincode" value={pincode} onChangeText={(value) => setPincode(value.replace(/\D/g, ''))} keyboardType="number-pad" editable={!locked} /></View><View style={styles.column}><Field label="Radius km" value={radius} onChangeText={(value) => setRadius(value.replace(/\D/g, ''))} keyboardType="number-pad" editable={!locked} /></View></View>
        <Field label="Food license number" value={license} onChangeText={setLicense} placeholder="FSSAI-APP-2026" editable={!locked} />

        <View style={styles.bannerBlock}>
          <Image source={currentBanner} style={styles.banner} contentFit="cover" transition={220} />
          <View style={styles.bannerAction}><Button label={vendor.image ? 'Change banner' : 'Upload banner'} icon="image-outline" variant="secondary" compact onPress={pickBanner} busy={busy === 'banner'} /></View>
        </View>

        {(Object.keys(documentLabels) as ApplicationDocumentKey[]).map((key) => {
          const stored = documents[key]
          const pending = pendingDocuments[key]
          const item = pending || stored
          const canReplace = stored?.status === 'rejected'
          return (
            <View key={key} style={[styles.documentRow, item && styles.documentRowFilled, stored?.status === 'rejected' && styles.documentRowRejected]}>
              <Ionicons name={item ? 'document-text-outline' : 'cloud-upload-outline'} size={23} color={item ? colors.greenDark : colors.muted} />
              <View style={styles.documentCopy}>
                <Text style={styles.documentTitle}>{documentLabels[key]}</Text>
                <Text style={styles.documentMeta} numberOfLines={1}>{item ? `${item.name} · ${pending ? 'Ready to submit' : item.status || 'pending'}` : key === 'insurance' ? 'Optional PDF, PNG, or JPG' : 'Required PDF, PNG, or JPG'}</Text>
                {stored?.rejectionReason ? <Text style={styles.rejectionReason}>{stored.rejectionReason}</Text> : null}
              </View>
              {stored?.id ? <Pressable accessibilityLabel={`Preview ${documentLabels[key]}`} style={styles.rowIcon} onPress={() => previewDocument(stored)}><Ionicons name="eye-outline" size={21} color={colors.ink} /></Pressable> : null}
              {!item || canReplace ? <Button label={canReplace ? 'Replace' : 'Upload'} icon="cloud-upload-outline" variant="secondary" compact onPress={() => pickDocument(key)} busy={busy === key} /> : null}
              {item && !pending && !canReplace ? <StatusPill status={item.status || 'pending'} /> : null}
            </View>
          )
        })}

        {canSubmitReview ? (
          <>
            {requiredMissing.length ? <Notice tone="error" text={`${requiredMissing.map((key) => documentLabels[key]).join(' and ')} ${requiredMissing.length === 1 ? 'is' : 'are'} required before review.`} /> : null}
            <Button label="Submit for review" icon="clipboard-outline" onPress={submitApplication} busy={busy === 'application'} disabled={!validApplication} />
          </>
        ) : <Notice tone={locked ? 'success' : 'info'} text={locked ? 'Application and required documents are approved. Admin must request a reupload before another document can be submitted.' : 'Application is already submitted and awaiting admin review.'} />}
      </View>

      <SectionTitle eyebrow="Menus" title="Package manager" detail={`${vendor.packages.length} packages`} />
      {locked ? (
        <View style={styles.form}>
          <Field label="Package title" value={packageTitle} onChangeText={setPackageTitle} placeholder="Seasonal celebration table" />
          <View style={styles.columns}><View style={styles.column}><Field label="Price per guest" value={packagePrice} onChangeText={(value) => setPackagePrice(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View><View style={styles.column}><Field label="Minimum guests" value={packageGuests} onChangeText={(value) => setPackageGuests(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View></View>
          <Field label="Tag" value={packageTag} onChangeText={setPackageTag} placeholder="Wedding" />
          <Button label="Add package" icon="add-circle-outline" onPress={addPackage} busy={busy === 'package'} disabled={!packageTitle.trim() || Number(packagePrice) < 1 || Number(packageGuests) < 1} />
        </View>
      ) : <Notice text="Package publishing unlocks after the admin approves the vendor application." />}

      <View style={styles.packageList}>{vendor.packages.map((pack) => <View key={pack.id} style={styles.packageRow}><Image source={mediaUrl(apiUrl, pack.image || vendor.image)} style={styles.packageImage} contentFit="cover" transition={180} /><View style={styles.packageCopy}><Text style={styles.packageName}>{pack.title}</Text><Text style={styles.packageMeta}>{money(pack.pricePerGuest)} per guest · Min {pack.minGuests}</Text></View></View>)}</View>
    </>
  )
}

function Stat({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  return <View style={styles.stat}><View style={[styles.statIcon, { backgroundColor: `${color}1A` }]}><Ionicons name={icon} size={21} color={color} /></View><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  titleRow: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleCopy: { flex: 1 },
  eyebrow: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 20 },
  stat: { width: '48%', minHeight: 124, backgroundColor: colors.white, borderRadius: radii.md, padding: 13, borderWidth: 1, borderColor: colors.line, ...shadows.card },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 9 },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 2 },
  form: { gap: 14 },
  columns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  bannerBlock: { position: 'relative' },
  banner: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md, backgroundColor: '#DDE4DF' },
  bannerAction: { alignSelf: 'flex-end', marginTop: 9 },
  documentRow: { minHeight: 72, padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 9 },
  documentRowFilled: { backgroundColor: '#F0FAF5', borderColor: '#A8D4BC' },
  documentRowRejected: { backgroundColor: colors.redSoft, borderColor: '#E9B5B5' },
  documentCopy: { flex: 1, minWidth: 0 },
  documentTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  documentMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  rejectionReason: { color: colors.red, fontSize: 10, fontWeight: '700', marginTop: 4 },
  rowIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  packageList: { gap: 10, marginTop: 15 },
  packageRow: { flexDirection: 'row', gap: 11, backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  packageImage: { width: 92, height: 82, backgroundColor: '#DDE4DF' },
  packageCopy: { flex: 1, justifyContent: 'center', paddingRight: 10 },
  packageName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  packageMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
})
