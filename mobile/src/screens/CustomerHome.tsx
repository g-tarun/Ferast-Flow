import { useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Location from 'expo-location'
import { apiRequest, mediaUrl } from '../api'
import { Button, Chip, EmptyState, Field, Notice, SectionTitle, StatusPill, money } from '../components/ui'
import { colors, radii, shadows, spacing } from '../theme'
import type { SearchFilters, Vendor } from '../types'

type Props = {
  apiUrl: string
  token: string
  vendors: Vendor[]
  onSelectVendor: (vendor: Vendor) => void
}

const eventTypes = ['Any', 'Wedding', 'Corporate', 'House party', 'Festival']
const dietaryTypes = ['Any', 'Vegetarian', 'Vegan', 'Jain', 'Halal']

const tomorrow = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function CustomerHome({ apiUrl, token, vendors, onSelectVendor }: Props) {
  const [filters, setFilters] = useState<SearchFilters>({ location: '', geo: null, eventType: 'Any', date: '', guests: 50, budget: 1200, dietary: 'Any' })
  const [results, setResults] = useState(() => vendors.filter((vendor) => vendor.status === 'approved'))
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [locationBusy, setLocationBusy] = useState(false)
  const [error, setError] = useState('')

  const suggestions = useMemo(() => {
    const query = filters.location.trim().toLowerCase()
    if (query.length < 2 || filters.geo) return []
    const values = vendors.flatMap((vendor) => [vendor.address, vendor.pincode, vendor.coordinates?.label]).filter(Boolean)
    return Array.from(new Set(values)).filter((value) => value.toLowerCase().includes(query)).slice(0, 5)
  }, [filters.geo, filters.location, vendors])

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const search = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await apiRequest<{ vendors: Vendor[]; count: number }>(apiUrl, '/vendors/search', {
        token,
        body: { filters },
      })
      setResults(response.vendors)
      setSearched(true)
    } catch (requestError) {
      setResults([])
      setSearched(true)
      setError(requestError instanceof Error ? requestError.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  const useLocation = async () => {
    setLocationBusy(true)
    setError('')
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') throw new Error('Location permission was not granted. You can still choose an area manually.')
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const places = await Location.reverseGeocodeAsync(current.coords).catch(() => [])
      const place = places[0]
      const label = [place?.district || place?.city, place?.postalCode].filter(Boolean).join(' · ') || 'Current location'
      setFilters((value) => ({
        ...value,
        location: label,
        geo: { latitude: current.coords.latitude, longitude: current.coords.longitude, label },
      }))
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'Could not read location')
    } finally {
      setLocationBusy(false)
    }
  }

  return (
    <>
      <View style={styles.welcome}>
        <View style={styles.welcomeCopy}>
          <Text style={styles.kicker}>PLAN SOMETHING DELICIOUS</Text>
          <Text style={styles.heading}>Catering that fits the whole event.</Text>
          <Text style={styles.subheading}>Verified teams, transparent packages, and one place for every conversation.</Text>
        </View>
        <View style={styles.spark}><Ionicons name="sparkles" size={24} color={colors.coral} /></View>
      </View>

      <View style={styles.searchPanel}>
        <Field
          label="Event area or pincode"
          value={filters.location}
          onChangeText={(value) => setFilters((current) => ({ ...current, location: value, geo: null }))}
          placeholder="Try Indiranagar or 560038"
          icon="search-outline"
        />
        {suggestions.length ? (
          <View style={styles.suggestions}>
            {suggestions.map((suggestion) => (
              <Pressable key={suggestion} style={styles.suggestion} onPress={() => update('location', suggestion)}>
                <Ionicons name="location-outline" size={17} color={colors.green} />
                <Text style={styles.suggestionText} numberOfLines={1}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Button label={locationBusy ? 'Finding your location' : 'Use my location'} icon="navigate-outline" variant="ghost" onPress={useLocation} busy={locationBusy} />

        <View style={styles.twoColumns}>
          <View style={styles.column}><Field label="Guests" value={String(filters.guests)} onChangeText={(value) => update('guests', Math.max(1, Number(value.replace(/\D/g, '')) || 0))} keyboardType="number-pad" icon="people-outline" /></View>
          <View style={styles.column}><Field label="Budget per guest" value={String(filters.budget)} onChangeText={(value) => update('budget', Number(value.replace(/\D/g, '')) || 0)} keyboardType="number-pad" icon="wallet-outline" /></View>
        </View>
        <Field label="Event date (YYYY-MM-DD)" value={filters.date} onChangeText={(value) => update('date', value)} placeholder={tomorrow()} icon="calendar-outline" />
        <Text style={styles.optionLabel}>Event type</Text>
        <View style={styles.chips}>{eventTypes.map((item) => <Chip key={item} label={item} selected={filters.eventType === item} onPress={() => update('eventType', item)} />)}</View>
        <Text style={styles.optionLabel}>Dietary</Text>
        <View style={styles.chips}>{dietaryTypes.map((item) => <Chip key={item} label={item} selected={filters.dietary === item} onPress={() => update('dietary', item)} />)}</View>
        {error ? <Notice tone="error" text={error} /> : null}
        <Button label="Search caterers" icon="search" onPress={search} busy={busy} />
      </View>

      <SectionTitle eyebrow="Ranked for your event" title={searched ? `${results.length} matching caterers` : 'Popular nearby caterers'} detail={`${results.length} live`} />
      {results.length ? results.map((vendor, index) => <VendorCard key={vendor.id} vendor={vendor} apiUrl={apiUrl} index={index} onPress={() => onSelectVendor(vendor)} />) : (
        <EmptyState icon="search-outline" title="No caterers matched" body="Adjust the location, date, guest count, or budget and search again. No unrelated vendor cards are shown." />
      )}
    </>
  )
}

function VendorCard({ vendor, apiUrl, index, onPress }: { vendor: Vendor; apiUrl: string; index: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current
  const animate = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: true, speed: 30, bounciness: 5 }).start()
  return (
    <Animated.View style={{ transform: [{ scale }], opacity: 1 }}>
      <Pressable onPressIn={() => animate(0.985)} onPressOut={() => animate(1)} onPress={onPress} style={[styles.vendorCard, index === 0 && styles.vendorCardFeatured]}>
        <Image source={mediaUrl(apiUrl, vendor.image)} style={styles.vendorImage} contentFit="cover" transition={220} />
        <View style={styles.vendorBody}>
          <View style={styles.vendorTitleRow}>
            <View style={styles.vendorTitleCopy}><Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text><Text style={styles.vendorCuisine} numberOfLines={1}>{vendor.cuisine}</Text></View>
            <View style={styles.rating}><Ionicons name="star" size={13} color={colors.white} /><Text style={styles.ratingText}>{vendor.rating.toFixed(1)}</Text></View>
          </View>
          <View style={styles.vendorFacts}>
            <Text style={styles.vendorFact}><Ionicons name="location-outline" size={14} /> {vendor.distanceKm.toFixed(1)} km</Text>
            <Text style={styles.vendorFact}><Ionicons name="wallet-outline" size={14} /> From {money(vendor.minPrice)}</Text>
            <Text style={styles.vendorFact}><Ionicons name="people-outline" size={14} /> Up to {vendor.maxGuests}</Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.badges}>{vendor.badges.slice(0, 2).map((badge) => <Chip key={badge} label={badge} />)}</View>
            <View style={styles.viewAction}><Text style={styles.viewActionText}>View packages</Text><Ionicons name="arrow-forward" size={17} color={colors.greenDark} /></View>
          </View>
          <View style={styles.offer}><Ionicons name="pricetag" size={15} color={colors.coral} /><Text style={styles.offerText}>{vendor.packages.some((pack) => pack.instantBook) ? 'Instant booking available' : 'Fast quote response'} · {vendor.responseMinutes || 'New'} min</Text></View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  welcome: { marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: 24, backgroundColor: colors.black, flexDirection: 'row', alignItems: 'flex-start' },
  welcomeCopy: { flex: 1 },
  kicker: { color: colors.gold, fontSize: 11, fontWeight: '900' },
  heading: { color: colors.white, fontSize: 34, lineHeight: 39, fontWeight: '900', maxWidth: 350, marginTop: 6 },
  subheading: { color: '#C9D6CF', fontSize: 14, lineHeight: 21, maxWidth: 340, marginTop: 8 },
  spark: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  searchPanel: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, marginTop: -7, gap: 14, ...shadows.card },
  suggestions: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, overflow: 'hidden', marginTop: -8 },
  suggestion: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  suggestionText: { flex: 1, color: colors.ink, fontSize: 13 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  optionLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  vendorCard: { backgroundColor: colors.white, borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, marginBottom: 15, ...shadows.card },
  vendorCardFeatured: { borderColor: '#8BC7A9' },
  vendorImage: { width: '100%', height: 178, backgroundColor: '#DDE4DF' },
  vendorBody: { padding: 14 },
  vendorTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  vendorTitleCopy: { flex: 1, minWidth: 0 },
  vendorName: { color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  vendorCuisine: { color: colors.muted, fontSize: 13, marginTop: 2 },
  rating: { backgroundColor: colors.greenDark, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  vendorFacts: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vendorFact: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  cardBottom: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  viewAction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewActionText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  offer: { marginTop: 12, padding: 10, borderRadius: radii.sm, backgroundColor: colors.coralSoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
  offerText: { color: '#8A311E', fontSize: 12, fontWeight: '800' },
})
