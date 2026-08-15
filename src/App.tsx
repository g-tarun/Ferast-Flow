import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Heart,
  Home,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  PackagePlus,
  PartyPopper,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react'

type Role = 'customer' | 'vendor' | 'admin'
type Section = 'marketplace' | 'bookings' | 'vendor' | 'admin'
type AuthMode = 'login' | 'register'
type AppNotificationPermission = NotificationPermission | 'unsupported'
type VendorStatus = 'approved' | 'pending' | 'needs-info' | 'rejected'
type DocumentApprovalStatus = 'pending' | 'approved' | 'rejected'
type BookingStatus =
  | 'quote-sent'
  | 'countered'
  | 'accepted'
  | 'payment-due'
  | 'confirmed'
  | 'completed'
  | 'declined'

type ApplicationDocumentKey = 'foodLicense' | 'identity' | 'insurance'

type UploadedDocument = {
  id?: string
  parentId?: string
  parentType?: 'vendor'
  vendorId?: string
  key?: ApplicationDocumentKey
  documentName?: string
  name: string
  type: string
  size: number
  dataUrl?: string
  status?: DocumentApprovalStatus
  uploadedBy?: string
  uploadedAt: string
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
}

type CaterPackage = {
  id: string
  title: string
  description: string
  pricePerGuest: number
  minGuests: number
  image: string
  tags: string[]
  items: string[]
  instantBook: boolean
}

type GeoPoint = {
  latitude: number
  longitude: number
  label: string
}

type Vendor = {
  id: string
  publicId?: string
  name: string
  owner: string
  status: VendorStatus
  cuisine: string
  address: string
  pincode: string
  coordinates: GeoPoint
  serviceRadius: number
  servicePincodes: string[]
  distanceKm: number
  rating: number
  reviewCount: number
  responseMinutes: number
  minPrice: number
  maxGuests: number
  license: string
  docs: string[]
  dietary: string[]
  eventTypes: string[]
  badges: string[]
  image: string
  documents?: Partial<Record<ApplicationDocumentKey, UploadedDocument>>
  packages: CaterPackage[]
  availability: string[]
  payoutDue: number
  adminNote?: string
}

type PublicEventType = 'wedding' | 'kitty-party' | 'half-saree' | 'housewarming' | 'corporate' | 'other'
type PublicAccessMode = Role

type PublicMenuHighlight = {
  title: string
  pricePerGuest: number
  minGuests: number
  itemCount: number
  instantBook: boolean
}

type PublicVendor = {
  publicId: string
  alias: string
  cuisine: string
  rating: number
  reviewCount: number
  responseMinutes: number
  minPrice: number
  maxGuests: number
  dietary: string[]
  badges: string[]
  image: string
  eventLabel: string
  menuHighlights: PublicMenuHighlight[]
}

type PublicSelection = {
  publicId: string
  alias: string
  eventType: PublicEventType
  pincode: string
  guests: number
  perPlate: number
  estimatedTotal: number
}

type Booking = {
  id: string
  vendorId: string
  packageId: string
  customerName: string
  eventType: string
  date: string
  guests: number
  addOns: string[]
  note: string
  amount: number
  deposit: number
  paymentChoice: 'deposit' | 'full'
  status: BookingStatus
  createdAt: string
  timeline: string[]
  messages: ChatMessage[]
  review?: {
    rating: number
    text: string
  }
}

type ChatMessage = {
  from: 'customer' | 'vendor' | 'admin'
  text: string
  time: string
}

type AddOn = {
  id: string
  name: string
  price: number
}

type Filters = {
  location: string
  geo: GeoPoint | null
  eventType: string
  date: string
  guests: number
  budget: number
  dietary: string
}

type VendorApplication = {
  businessName: string
  cuisine: string
  pincode: string
  radius: number
  license: string
  foodLicense: boolean
  identity: boolean
  insurance: boolean
  bannerImage?: string
  documents?: Partial<Record<ApplicationDocumentKey, UploadedDocument>>
}

type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  vendorId?: string
}

type JwtPayload = AuthUser & {
  sub: string
  iat: number
  exp: number
}

type AuthSession = {
  token: string
  user: AuthUser
  expiresAt: number
}

type LiveEvent = {
  id: string
  title: string
  body: string
  time: string
}

type ApiBootstrap = {
  vendors: Vendor[]
  bookings: Booking[]
  addOns: AddOn[]
  user: AuthUser
}

type ApiAuthenticatedResponse = {
  token: string
  user: AuthUser
}

type MfaChallenge = {
  mfaRequired: true
  challengeId: string
  delivery: string
  expiresAt: string
}

type ApiAuthResponse = ApiAuthenticatedResponse | MfaChallenge

const generatedImageVersion = 'v=20260712-doc-flow'
const versionedDemoImage = (path: string) => `${path}?${generatedImageVersion}`
const heroImage = versionedDemoImage('/images/hero-catering.png')
const landingHeroImage = '/images/feastflow-landing-v2.webp'
const weddingImage = versionedDemoImage('/images/wedding-buffet.png')
const corporateImage = versionedDemoImage('/images/corporate-lunch.png')
const dessertImage = versionedDemoImage('/images/dessert-station.png')
const publicEventOptions: Array<{
  id: PublicEventType
  label: string
  eyebrow: string
  headline: string
  description: string
  image: string
  marketplaceEvent: string
  marketplaceEvents: string[]
}> = [
  {
    id: 'wedding',
    label: 'Wedding',
    eyebrow: 'A feast worthy of the vows',
    headline: 'Make the table as memorable as the day.',
    description: 'Discover verified teams for intimate ceremonies, grand receptions, and everything between.',
    image: '/images/event-wedding.webp',
    marketplaceEvent: 'Wedding',
    marketplaceEvents: ['Wedding'],
  },
  {
    id: 'kitty-party',
    label: 'Kitty party',
    eyebrow: 'Easy hosting, lively tables',
    headline: 'Bring the group. We will bring the flavour.',
    description: 'Find flexible menus, delightful small plates, and service that lets the host join the fun.',
    image: '/images/event-kitty-party.webp',
    marketplaceEvent: 'House party',
    marketplaceEvents: ['House party'],
  },
  {
    id: 'half-saree',
    label: 'Half saree',
    eyebrow: 'Tradition, served beautifully',
    headline: 'Celebrate her milestone with a generous feast.',
    description: 'Compare regional specialists prepared for traditional menus, family service, and larger guest lists.',
    image: '/images/event-half-saree.webp',
    marketplaceEvent: 'Festival',
    marketplaceEvents: ['Festival', 'Wedding'],
  },
  {
    id: 'housewarming',
    label: 'Housewarming',
    eyebrow: 'A warm welcome to a new beginning',
    headline: 'Fill the new home with people, stories, and good food.',
    description: 'Book dependable caterers for puja breakfasts, family lunches, and relaxed evening gatherings.',
    image: '/images/event-housewarming.webp',
    marketplaceEvent: 'House party',
    marketplaceEvents: ['House party', 'Festival'],
  },
  {
    id: 'corporate',
    label: 'Corporate',
    eyebrow: 'Professional service, without the fuss',
    headline: 'Keep the agenda moving and every guest well served.',
    description: 'Explore teams built for office lunches, launches, offsites, and high-volume service.',
    image: '/images/event-corporate.webp',
    marketplaceEvent: 'Corporate',
    marketplaceEvents: ['Corporate', 'Launch'],
  },
  {
    id: 'other',
    label: 'Other event',
    eyebrow: 'Your occasion, your way',
    headline: 'Tell us the gathering. We will shape the feast.',
    description: 'From birthdays and anniversaries to reunions and community events, find a team that fits the moment.',
    image: '/images/event-other.webp',
    marketplaceEvent: 'Any',
    marketplaceEvents: ['Wedding', 'Corporate', 'House party', 'Festival', 'Launch'],
  },
]
const publicEventOptionById = (eventType: PublicEventType) =>
  publicEventOptions.find((option) => option.id === eventType) ?? publicEventOptions[0]
const displayImageSrc = (image?: string) => {
  if (!image) return heroImage
  if (image.startsWith('/images/') && !image.includes('?')) return versionedDemoImage(image)
  return image
}
const applicationFallbackImages = [weddingImage, corporateImage, dessertImage, heroImage]
const maxUploadBytes = 2_500_000
const documentUploadAccept = 'image/*,application/pdf'
const documentsForApplication = (
  applicationDocuments?: Partial<Record<ApplicationDocumentKey, UploadedDocument>>,
  vendorDocuments?: Partial<Record<ApplicationDocumentKey, UploadedDocument>>,
) => {
  const documents = { ...(vendorDocuments ?? {}) }
  for (const [key, document] of Object.entries(applicationDocuments ?? {}) as Array<
    [ApplicationDocumentKey, UploadedDocument]
  >) {
    const savedDocument = vendorDocuments?.[key]
    const isNewLocalUpload = Boolean(document.dataUrl && (!document.id || document.id !== savedDocument?.id))
    documents[key] = isNewLocalUpload ? document : savedDocument ?? document
  }
  return documents
}
const applicationDocumentItems: Array<{
  key: ApplicationDocumentKey
  label: string
  required: boolean
}> = [
  { key: 'foodLicense', label: 'Food license', required: true },
  { key: 'identity', label: 'Owner ID', required: true },
  { key: 'insurance', label: 'Insurance', required: false },
]

const todayIso = new Date().toISOString().slice(0, 10)
const futureDate = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const sessionTokenKey = 'feastflow-session-token'
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:4000')

const documentDownloadUrl = (documentId: string, token: string) =>
  `${apiBaseUrl}/api/documents/${documentId}/download?token=${encodeURIComponent(token)}`

const documentPreviewUrl = (documentId: string, token: string) =>
  `${documentDownloadUrl(documentId, token)}&disposition=inline`

const roleSections: Record<Role, Section[]> = {
  customer: ['marketplace', 'bookings'],
  vendor: ['vendor'],
  admin: ['admin'],
}

const demoAccounts: Record<Role, { email: string; password: string; name: string; vendorId?: string }> = {
  customer: {
    email: 'customer@feastflow.test',
    password: 'demo1234',
    name: 'Priya Sharma',
  },
  vendor: {
    email: 'vendor@feastflow.test',
    password: 'demo1234',
    name: 'Aarav Mehta',
    vendorId: 'spice-stem',
  },
  admin: {
    email: 'admin@feastflow.test',
    password: 'demo1234',
    name: 'Maya Rao',
  },
}

const initialFilters: Filters = {
  location: '',
  geo: null,
  eventType: 'Any',
  date: futureDate(35),
  guests: 120,
  budget: 1000,
  dietary: 'Any',
}

const initialApplication: VendorApplication = {
  businessName: '',
  cuisine: '',
  pincode: '',
  radius: 12,
  license: '',
  foodLicense: false,
  identity: false,
  insurance: false,
  bannerImage: '',
  documents: {},
}
const onboardingDraftLicense = 'PENDING-ONBOARDING'

const vendorStatusMeta: Record<VendorStatus, { label: string; tone: string }> = {
  approved: { label: 'Approved', tone: 'success' },
  pending: { label: 'Pending review', tone: 'warning' },
  'needs-info': { label: 'Needs info', tone: 'notice' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

const documentStatusMeta: Record<DocumentApprovalStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

const bookingStatusMeta: Record<BookingStatus, { label: string; tone: string }> = {
  'quote-sent': { label: 'Request sent', tone: 'notice' },
  countered: { label: 'Counter offer', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  'payment-due': { label: 'Payment due', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  declined: { label: 'Declined', tone: 'danger' },
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function getNotificationPermission(): AppNotificationPermission {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

function showBrowserNotification(permission: AppNotificationPermission, title: string, body: string) {
  if (permission !== 'granted' || typeof Notification === 'undefined') return
  new Notification(title, {
    body,
    icon: '/images/hero-catering.png',
  })
}

let notificationAudioContext: AudioContext | undefined

function prepareNotificationSound() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null
  if (!notificationAudioContext || notificationAudioContext.state === 'closed') {
    notificationAudioContext = new window.AudioContext()
  }
  if (notificationAudioContext.state === 'suspended') {
    void notificationAudioContext.resume().catch(() => undefined)
  }
  return notificationAudioContext
}

function playNotificationSound() {
  const audioContext = prepareNotificationSound()
  if (!audioContext) return

  const playTone = () => {
    const startTime = audioContext.currentTime
    const gain = audioContext.createGain()
    const oscillator = audioContext.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(740, startTime)
    oscillator.frequency.exponentialRampToValueAtTime(980, startTime + 0.1)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.07, startTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + 0.24)
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume().then(playTone).catch(() => undefined)
    return
  }
  playTone()
}

function pushApplicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function distanceInKm(from: GeoPoint, to: GeoPoint) {
  const earthRadiusKm = 6371
  const degreesToRadians = Math.PI / 180
  const latitudeDelta = (to.latitude - from.latitude) * degreesToRadians
  const longitudeDelta = (to.longitude - from.longitude) * degreesToRadians
  const fromLatitude = from.latitude * degreesToRadians
  const toLatitude = to.latitude * degreesToRadians
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function getVendorDistance(vendor: Vendor, geo: GeoPoint | null | undefined) {
  if (!geo || !vendor.coordinates) return vendor.distanceKm
  return Number(distanceInKm(geo, vendor.coordinates).toFixed(1))
}

function vendorSearchText(vendor: Vendor) {
  return [
    vendor.name,
    vendor.owner,
    vendor.cuisine,
    vendor.address,
    vendor.pincode,
    vendor.servicePincodes.join(' '),
    vendor.dietary.join(' '),
    vendor.eventTypes.join(' '),
    vendor.packages.map((pack) => `${pack.title} ${pack.tags.join(' ')}`).join(' '),
  ]
    .join(' ')
    .toLowerCase()
}

function hasRejectedDocument(vendor: Vendor) {
  return Object.values(vendor.documents ?? {}).some((document) => document?.status === 'rejected')
}

function isVendorOnboardingDraft(vendor: Vendor | undefined | null) {
  return Boolean(
    vendor &&
      vendor.license === onboardingDraftLicense &&
      Object.keys(vendor.documents ?? {}).length === 0 &&
      vendor.packages.length === 0,
  )
}

function isCustomerVisibleVendor(vendor: Vendor) {
  return vendor.status === 'approved' && !hasRejectedDocument(vendor)
}

function applicationFromVendor(vendor: Vendor): VendorApplication {
  const documents = vendor.documents ?? {}
  const onboardingDraft = isVendorOnboardingDraft(vendor)
  return {
    businessName: onboardingDraft ? '' : vendor.name || '',
    cuisine: vendor.cuisine || '',
    pincode: vendor.pincode || '',
    radius: vendor.serviceRadius || initialApplication.radius,
    license: onboardingDraft ? '' : vendor.license || '',
    foodLicense: Boolean(documents.foodLicense),
    identity: Boolean(documents.identity),
    insurance: Boolean(documents.insurance),
    bannerImage: vendor.image || '',
    documents,
  }
}

function vendorDocumentCount(vendor: Vendor) {
  return Object.values(vendor.documents ?? {}).filter(Boolean).length
}

function vendorIdentityKey(vendor: Vendor) {
  const name = vendor.name.trim().toLowerCase()
  const pincode = vendor.pincode.trim().toLowerCase()
  const cuisine = vendor.cuisine.trim().toLowerCase()
  if (!name || name === 'complete vendor onboarding' || !pincode) return vendor.id
  return `${name}|${pincode}|${cuisine}`
}

function dedupeAdminVendorRecords(vendorRecords: Vendor[]) {
  const groups = new Map<string, Vendor[]>()
  vendorRecords.forEach((vendor) => {
    const key = vendorIdentityKey(vendor)
    groups.set(key, [...(groups.get(key) ?? []), vendor])
  })

  return vendorRecords.filter((vendor) => {
    const sameBusinessVendors = groups.get(vendorIdentityKey(vendor)) ?? []
    if (sameBusinessVendors.length < 2 || vendorDocumentCount(vendor) > 0) return true
    return !sameBusinessVendors.some((candidate) => candidate.id !== vendor.id && vendorDocumentCount(candidate) > 0)
  })
}

function makeId(prefix: string) {
  if ('randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  }
  return `${prefix}-${Math.floor(Math.random() * 900000 + 100000)}`
}

function defaultSectionForRole(role: Role) {
  return roleSections[role][0]
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return atob(padded)
}

function sessionFromToken(token: string): AuthSession | null {
  try {
    const [, body] = token.split('.')
    if (!body) return null
    const payload = JSON.parse(decodeBase64Url(body)) as Partial<JwtPayload>
    if (
      !payload.sub ||
      !payload.email ||
      !payload.name ||
      !payload.role ||
      !payload.exp ||
      !roleSections[payload.role]
    ) {
      return null
    }
    if (payload.exp * 1000 <= Date.now()) {
      sessionStorage.removeItem(sessionTokenKey)
      return null
    }
    return {
      token,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        vendorId: payload.vendorId,
      },
      expiresAt: payload.exp * 1000,
    }
  } catch {
    sessionStorage.removeItem(sessionTokenKey)
    return null
  }
}

function getStoredSession() {
  try {
    const token = sessionStorage.getItem(sessionTokenKey)
    return token ? sessionFromToken(token) : null
  } catch {
    return null
  }
}

class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

async function apiRequest<T>(
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {},
) {
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiRequestError(error?.message ?? `API request failed: ${response.status}`, response.status)
  }

  return (await response.json()) as T
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`status-pill ${tone}`}>{label}</span>
}

function notificationInitials(title: string) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
  return initials || 'FF'
}

function NotificationDrawer({
  open,
  notifications,
  unreadCount,
  notificationPermission,
  pushSubscribed,
  pushBusy,
  soundEnabled,
  onClose,
  onEnablePush,
  onToggleSound,
}: {
  open: boolean
  notifications: LiveEvent[]
  unreadCount: number
  notificationPermission: AppNotificationPermission
  pushSubscribed: boolean
  pushBusy: boolean
  soundEnabled: boolean
  onClose: () => void
  onEnablePush: () => void
  onToggleSound: () => void
}) {
  if (!open) return null

  const browserAlertLabel = pushBusy
    ? 'Enabling browser alerts...'
    : pushSubscribed
      ? 'Browser alerts enabled'
      : notificationPermission === 'denied'
        ? 'Browser alerts blocked'
        : notificationPermission === 'unsupported'
          ? 'Browser alerts unavailable'
          : 'Enable browser alerts'

  return (
    <div className="notification-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Notification center"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="notification-drawer-header">
          <div>
            <p className="eyebrow">Notification center</p>
            <h2>Updates for you</h2>
          </div>
          <button type="button" className="notification-close" onClick={onClose} aria-label="Close notifications">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <section className="notification-preferences" aria-label="Notification preferences">
          <div>
            <strong>Browser alerts</strong>
            <span>
              {pushSubscribed
                ? 'Push updates will reach this device.'
                : notificationPermission === 'denied'
                  ? 'Allow notifications in browser settings to enable them.'
                  : 'Receive booking, document, payment, and chat updates.'}
            </span>
          </div>
          <button
            type="button"
            className={pushSubscribed ? 'notification-setting active' : 'notification-setting'}
            onClick={onEnablePush}
            disabled={pushBusy || pushSubscribed || notificationPermission === 'denied' || notificationPermission === 'unsupported'}
          >
            {pushSubscribed ? <CheckCircle2 size={16} aria-hidden="true" /> : <BellRing size={16} aria-hidden="true" />}
            {browserAlertLabel}
          </button>
          <button
            type="button"
            className={soundEnabled ? 'notification-setting active' : 'notification-setting'}
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            {soundEnabled ? 'Alert sound on' : 'Alert sound off'}
          </button>
        </section>

        <div className="notification-list" aria-live="polite">
          {notifications.length === 0 ? (
            <p className="notification-empty">New booking, document, payment, and chat updates will appear here.</p>
          ) : (
            notifications.map((notification, index) => (
              <article
                className={index < unreadCount ? 'notification-item unread' : 'notification-item'}
                key={notification.id}
              >
                <span className="notification-avatar">{notificationInitials(notification.title)}</span>
                <div className="notification-content">
                  <div className="notification-item-head">
                    <strong>{notification.title}</strong>
                    <time>{notification.time || 'Now'}</time>
                  </div>
                  <p>{notification.body}</p>
                </div>
                {index < unreadCount && <span className="notification-unread-dot" aria-label="Unread notification" />}
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}

function DocumentPreviewModal({
  document,
  sessionToken,
  onClose,
}: {
  document: UploadedDocument | null
  sessionToken: string
  onClose: () => void
}) {
  if (!document || (!document.id && !document.dataUrl)) return null

  const title = document.documentName || document.name || 'Document'
  const previewUrl = document.id ? documentPreviewUrl(document.id, sessionToken) : document.dataUrl || ''
  const downloadUrl = document.id ? documentDownloadUrl(document.id, sessionToken) : document.dataUrl || ''

  return (
    <div className="document-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="document-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} preview`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="document-modal-header">
          <div>
            <p className="eyebrow">Document preview</p>
            <h2>{title}</h2>
            <small>{document.name}</small>
          </div>
          <div className="document-modal-actions">
            <a className="primary-btn" href={downloadUrl} download={document.id ? undefined : document.name}>
              <Download size={16} aria-hidden="true" />
              Download
            </a>
            <button type="button" className="secondary-btn" onClick={onClose}>
              <XCircle size={16} aria-hidden="true" />
              Close
            </button>
          </div>
        </header>
        <iframe className="document-frame" title={`${title} preview`} src={previewUrl} />
      </section>
    </div>
  )
}

function DocumentRejectionModal({
  document,
  reason,
  setReason,
  onCancel,
  onConfirm,
}: {
  document: UploadedDocument | null
  reason: string
  setReason: (reason: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!document) return null

  return (
    <div className="document-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="reject-modal"
        aria-label="Reject document"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
      >
        <div>
          <p className="eyebrow">Reject document</p>
          <h2>{document.documentName || document.name}</h2>
          <small>{document.name}</small>
        </div>
        <label>
          <span>Rejection reason</span>
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: License number is not readable or the document has expired."
          />
        </label>
        <div className="document-modal-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="ghost-btn danger">
            <XCircle size={16} aria-hidden="true" />
            Reject and notify vendor
          </button>
        </div>
      </form>
    </div>
  )
}

function DocumentReuploadModal({
  document,
  reason,
  setReason,
  onCancel,
  onConfirm,
}: {
  document: UploadedDocument | null
  reason: string
  setReason: (reason: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!document) return null

  return (
    <div className="document-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="reject-modal"
        aria-label="Request document reupload"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
      >
        <div>
          <p className="eyebrow">Request reupload</p>
          <h2>{document.documentName || document.name}</h2>
          <small>{document.name}</small>
        </div>
        <p className="admin-note">This opens the upload slot again and sends the vendor your reason.</p>
        <label>
          <span>Reason for vendor</span>
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: Please upload a clearer, current document."
          />
        </label>
        <div className="document-modal-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-btn">
            <RefreshCw size={16} aria-hidden="true" />
            Send reupload request
          </button>
        </div>
      </form>
    </div>
  )
}

function DocumentDeleteModal({
  document,
  reason,
  setReason,
  onCancel,
  onConfirm,
}: {
  document: UploadedDocument | null
  reason: string
  setReason: (reason: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!document) return null

  return (
    <div className="document-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="reject-modal"
        aria-label="Delete document"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
      >
        <div>
          <p className="eyebrow">Delete document</p>
          <h2>{document.documentName || document.name}</h2>
          <small>{document.name}</small>
        </div>
        <p className="admin-note">
          This removes the stored file from the database. Use request reupload when you want the vendor to replace it.
        </p>
        <label>
          <span>Admin note optional</span>
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: Duplicate file removed during verification."
          />
        </label>
        <div className="document-modal-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="ghost-btn danger">
            <Trash2 size={16} aria-hidden="true" />
            Delete document
          </button>
        </div>
      </form>
    </div>
  )
}

function Rating({ value, count }: { value: number; count: number }) {
  return (
    <span className="rating">
      <Star size={15} fill="currentColor" aria-hidden="true" />
      {value > 0 ? value.toFixed(1) : 'New'}
      {count > 0 && <span>({count})</span>}
    </span>
  )
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactElement
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="metric">
      <span className="metric-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function FeastDepthScene({
  variant,
  image = landingHeroImage,
}: {
  variant: 'auth' | 'discovery'
  image?: string
}) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let cancelled = false
    let teardown = () => {}

    void import('three').then((THREE) => {
      if (cancelled || !mount.isConnected) return

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const compact = window.matchMedia('(max-width: 760px)').matches
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' })
      const scene = new THREE.Scene()
      const camera = new THREE.Camera()
      const pointer = new THREE.Vector2()
      const targetPointer = new THREE.Vector2()
      const clock = new THREE.Clock()
      let frameId = 0
      let visible = true

      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1 : 1.35))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.setAttribute('aria-hidden', 'true')
      mount.appendChild(renderer.domElement)
      teardown = () => {
        renderer.dispose()
        renderer.forceContextLoss()
        renderer.domElement.remove()
      }

      const loader = new THREE.TextureLoader()
      loader.load(
        image,
        (texture) => {
          if (cancelled || !mount.isConnected) {
            texture.dispose()
            return
          }

          texture.colorSpace = THREE.SRGBColorSpace
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter

          const source = texture.image as { naturalWidth?: number; naturalHeight?: number; width: number; height: number }
          const uniforms = {
            uTexture: { value: texture },
            uResolution: { value: new THREE.Vector2(1, 1) },
            uImageSize: {
              value: new THREE.Vector2(source.naturalWidth ?? source.width, source.naturalHeight ?? source.height),
            },
            uPointer: { value: pointer },
            uTime: { value: 0 },
            uStrength: { value: compact ? 0.004 : variant === 'auth' ? 0.012 : 0.009 },
          }
          const geometry = new THREE.PlaneGeometry(2, 2)
          const material = new THREE.ShaderMaterial({
            uniforms,
            depthTest: false,
            depthWrite: false,
            vertexShader: `
              varying vec2 vUv;

              void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
              }
            `,
            fragmentShader: `
              uniform sampler2D uTexture;
              uniform vec2 uResolution;
              uniform vec2 uImageSize;
              uniform vec2 uPointer;
              uniform float uTime;
              uniform float uStrength;
              varying vec2 vUv;

              vec2 coverUv(vec2 uv) {
                float viewportAspect = uResolution.x / uResolution.y;
                float imageAspect = uImageSize.x / uImageSize.y;
                vec2 scale = vec2(1.0);

                if (viewportAspect > imageAspect) {
                  scale.y = imageAspect / viewportAspect;
                } else {
                  scale.x = viewportAspect / imageAspect;
                }

                return (uv - 0.5) * scale + 0.5;
              }

              void main() {
                vec2 baseUv = coverUv(vUv);
                float foreground = smoothstep(0.18, 0.92, 1.0 - vUv.y);
                vec2 idleDrift = vec2(sin(uTime * 0.11), cos(uTime * 0.09)) * 0.0008;
                vec2 firstPassUv = baseUv + idleDrift + uPointer * uStrength * mix(0.28, 1.0, foreground);
                vec3 firstPass = texture2D(uTexture, firstPassUv).rgb;
                float luminance = dot(firstPass, vec3(0.2126, 0.7152, 0.0722));
                float localDepth = mix(0.72, 1.08, smoothstep(0.12, 0.88, luminance));
                vec2 finalUv = baseUv + idleDrift + uPointer * uStrength * foreground * localDepth;
                vec3 color = texture2D(uTexture, finalUv).rgb;
                float vignette = 1.0 - smoothstep(0.34, 0.78, distance(vUv, vec2(0.5))) * 0.13;
                color *= vignette;
                gl_FragColor = vec4(color, 1.0);
              }
            `,
          })
          const plane = new THREE.Mesh(geometry, material)
          scene.add(plane)

          const resize = () => {
            const width = Math.max(1, mount.clientWidth)
            const height = Math.max(1, mount.clientHeight)
            uniforms.uResolution.value.set(width, height)
            renderer.setSize(width, height, false)
          }

          const handlePointer = (event: PointerEvent) => {
            const bounds = mount.getBoundingClientRect()
            const inside =
              event.clientX >= bounds.left &&
              event.clientX <= bounds.right &&
              event.clientY >= bounds.top &&
              event.clientY <= bounds.bottom

            if (!inside) {
              targetPointer.set(0, 0)
              return
            }

            targetPointer.set(
              ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
              -((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
            )
          }

          const render = () => {
            if (!visible || document.hidden) return
            pointer.lerp(targetPointer, 0.045)
            uniforms.uTime.value = clock.getElapsedTime()
            renderer.render(scene, camera)
            if (!reduceMotion) frameId = window.requestAnimationFrame(render)
          }

          const start = () => {
            window.cancelAnimationFrame(frameId)
            if (!reduceMotion && visible && !document.hidden) frameId = window.requestAnimationFrame(render)
          }

          const handleVisibility = () => {
            if (document.hidden) window.cancelAnimationFrame(frameId)
            else start()
          }

          const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible) start()
            else window.cancelAnimationFrame(frameId)
          }, { threshold: 0.01 })
          const resizeObserver = new ResizeObserver(resize)

          resizeObserver.observe(mount)
          observer.observe(mount)
          window.addEventListener('pointermove', handlePointer, { passive: true })
          document.addEventListener('visibilitychange', handleVisibility)
          resize()
          render()

          teardown = () => {
            window.cancelAnimationFrame(frameId)
            window.removeEventListener('pointermove', handlePointer)
            document.removeEventListener('visibilitychange', handleVisibility)
            resizeObserver.disconnect()
            observer.disconnect()
            geometry.dispose()
            material.dispose()
            texture.dispose()
            renderer.dispose()
            renderer.forceContextLoss()
            renderer.domElement.remove()
          }
        },
        undefined,
        () => {
          mount.dataset.sceneUnavailable = 'true'
          renderer.dispose()
          renderer.domElement.remove()
        },
      )
    }).catch(() => {
      mount.dataset.sceneUnavailable = 'true'
    })

    return () => {
      cancelled = true
      teardown()
    }
  }, [image, variant])

  return <div ref={mountRef} className={`feast-depth-scene feast-depth-scene-${variant}`} aria-hidden="true" />
}

function PublicEventIcon({ eventType }: { eventType: PublicEventType }) {
  if (eventType === 'wedding') return <Heart size={20} aria-hidden="true" />
  if (eventType === 'kitty-party') return <PartyPopper size={20} aria-hidden="true" />
  if (eventType === 'half-saree') return <Sparkles size={20} aria-hidden="true" />
  if (eventType === 'housewarming') return <Home size={20} aria-hidden="true" />
  if (eventType === 'corporate') return <Users size={20} aria-hidden="true" />
  return <CalendarDays size={20} aria-hidden="true" />
}

function PublicDiscovery({
  onCustomerSignIn,
  onVendorSignIn,
  onAdminSignIn,
  onSelect,
}: {
  onCustomerSignIn: () => void
  onVendorSignIn: () => void
  onAdminSignIn: () => void
  onSelect: (selection: PublicSelection) => void
}) {
  const [eventType, setEventType] = useState<PublicEventType | null>(null)
  const [pincode, setPincode] = useState('')
  const [vendors, setVendors] = useState<PublicVendor[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [guestOption, setGuestOption] = useState<'20' | '30' | '40' | 'custom'>('20')
  const [customGuests, setCustomGuests] = useState('60')
  const resultsRef = useRef<HTMLElement>(null)
  const activeEvent = eventType ? publicEventOptionById(eventType) : publicEventOptions[0]
  const popularPincodes = ['560001', '560034', '560038', '560041', '560066']
  const guestCount = guestOption === 'custom'
    ? Math.min(Number(customGuests) || 0, 5000)
    : Number(guestOption)

  useEffect(() => {
    publicEventOptions.forEach((option) => {
      const preload = new Image()
      preload.decoding = 'async'
      preload.src = option.image
      void preload.decode?.().catch(() => undefined)
    })
  }, [])

  const chooseEvent = (nextEvent: PublicEventType) => {
    setEventType(nextEvent)
    setVendors(null)
    setSearchError('')
  }

  const searchPublicVendors = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!eventType) {
      setSearchError('Choose an event before searching.')
      return
    }
    if (!/^\d{6}$/.test(pincode)) {
      setSearchError('Enter a valid 6-digit pincode.')
      return
    }

    setSearching(true)
    setSearchError('')
    try {
      const response = await apiRequest<{ vendors: PublicVendor[]; count: number }>(
        '/public/vendors/search',
        { body: { eventType, pincode, guests: guestCount } },
      )
      setVendors(response.vendors)
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (apiError) {
      setVendors(null)
      setSearchError(apiError instanceof Error ? apiError.message : 'Caterers could not be loaded.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <main className="public-discovery">
      <section className="public-hero">
        <div className="public-hero-media" key={activeEvent.image} aria-hidden="true">
          <img src={activeEvent.image} alt="" />
        </div>
        <header className="public-topbar">
          <button className="public-brand" type="button" aria-label="FeastFlow home">
            <span className="public-brand-mark"><ChefHat size={23} aria-hidden="true" /></span>
            <span><strong>FeastFlow</strong><small>Catering marketplace</small></span>
          </button>
          <div className="public-access-actions">
            <button
              className="public-vendor-access"
              type="button"
              onClick={onVendorSignIn}
              aria-label="Vendor login"
              title="Vendor login"
            >
              <Store size={17} aria-hidden="true" />
              <span>Vendor</span>
            </button>
            <button
              className="public-admin-access"
              type="button"
              onClick={onAdminSignIn}
              aria-label="Admin login"
              title="Admin login"
            >
              <ShieldCheck size={17} aria-hidden="true" />
              <span>Admin</span>
            </button>
            <button
              className="public-signin"
              type="button"
              onClick={onCustomerSignIn}
              aria-label="Customer sign in"
              title="Customer sign in"
            >
              <UserRound size={18} aria-hidden="true" />
              <span>Customer sign in</span>
            </button>
          </div>
        </header>

        <div className="public-hero-content" key={eventType ?? 'welcome'}>
          <p className="public-kicker">{eventType ? activeEvent.eyebrow : 'Welcome to FeastFlow'}</p>
          <h1>{eventType ? activeEvent.headline : 'What are you celebrating?'}</h1>
          <p>
            {eventType
              ? activeEvent.description
              : 'Start with the occasion. We will shape the search around the kind of gathering you have in mind.'}
          </p>
        </div>

        <div className="public-journey" aria-label="Find a caterer">
          <div className="public-step-heading">
            <span>1</span>
            <div><strong>Choose your event</strong><small>The experience changes with your celebration.</small></div>
          </div>
          <div className="public-event-options" role="list">
            {publicEventOptions.map((option) => (
              <button
                key={option.id}
                className={eventType === option.id ? 'active' : ''}
                type="button"
                onClick={() => chooseEvent(option.id)}
                aria-pressed={eventType === option.id}
              >
                <PublicEventIcon eventType={option.id} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <div className="public-guest-step">
            <div className="public-step-heading">
              <span>2</span>
              <div><strong>How many guests?</strong><small>We will only show caterers with enough capacity.</small></div>
            </div>
            <div className="public-guest-options" role="group" aria-label="Guest count">
              {(['20', '30', '40'] as const).map((option) => (
                <button
                  key={option}
                  className={guestOption === option ? 'active' : ''}
                  type="button"
                  onClick={() => setGuestOption(option)}
                  aria-pressed={guestOption === option}
                >
                  {option} guests
                </button>
              ))}
              <button
                className={guestOption === 'custom' ? 'active' : ''}
                type="button"
                onClick={() => setGuestOption('custom')}
                aria-pressed={guestOption === 'custom'}
              >
                Custom
              </button>
              {guestOption === 'custom' && (
                <label className="public-custom-guests">
                  <span>Guests</span>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    min={1}
                    max={5000}
                    type="number"
                    value={customGuests}
                    onChange={(event) => setCustomGuests(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </label>
              )}
            </div>
          </div>

          <form className={`public-pincode-step ${eventType ? 'ready' : ''}`} onSubmit={searchPublicVendors}>
            <div className="public-step-heading">
              <span>3</span>
              <div><strong>Where is the event?</strong><small>See caterers that actively serve your pincode.</small></div>
            </div>
            <div className="public-pincode-control">
              <MapPin size={19} aria-hidden="true" />
              <input
                aria-label="Event pincode"
                inputMode="numeric"
                maxLength={6}
                placeholder={eventType ? 'Enter 6-digit pincode' : 'Choose an event first'}
                value={pincode}
                disabled={!eventType}
                onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button type="submit" disabled={!eventType || searching || pincode.length !== 6 || guestCount < 1}>
                <Search size={18} aria-hidden="true" />
                {searching ? 'Searching...' : 'Show caterers'}
              </button>
            </div>
            {eventType && (
              <div className="public-pincode-suggestions" aria-label="Popular service pincodes">
                <span>Popular:</span>
                {popularPincodes.map((value) => (
                  <button key={value} type="button" onClick={() => setPincode(value)}>{value}</button>
                ))}
              </div>
            )}
            {searchError && <p className="public-search-error" role="alert"><AlertCircle size={16} />{searchError}</p>}
          </form>
        </div>
      </section>

      {vendors !== null && (
        <section className="public-results" ref={resultsRef} aria-live="polite">
          <div className="public-results-head">
            <div>
              <p className="eyebrow">Handpicked for your {activeEvent.label.toLowerCase()}</p>
              <h2>{vendors.length ? `${vendors.length} celebration ${vendors.length === 1 ? 'team' : 'teams'} ready for ${guestCount} guests` : `No exact matches in ${pincode}`}</h2>
              <p>{vendors.length ? 'Compare the essentials now. Meet your favourite team, explore every menu, and check your date with one quick sign-in.' : 'Try another nearby pincode or a different event type.'}</p>
            </div>
            {vendors.length > 0 && <span className="public-protection"><Sparkles size={17} />Curated by FeastFlow</span>}
          </div>

          {vendors.length > 0 && (
            <div className="public-match-promises" aria-label="Why book with FeastFlow">
              <span><BadgeCheck size={19} /><span><strong>Verified before you enquire</strong><small>Every team is reviewed by FeastFlow.</small></span></span>
              <span><Utensils size={19} /><span><strong>Menus made for the moment</strong><small>See full packages after choosing your match.</small></span></span>
              <span><CalendarDays size={19} /><span><strong>Your plan stays together</strong><small>Availability, quotes, chat, and payment in one place.</small></span></span>
            </div>
          )}

          <div className="public-vendor-grid">
            {vendors.map((vendor, index) => {
              const estimatedTotal = vendor.minPrice * guestCount
              const withinCapacity = guestCount > 0 && guestCount <= vendor.maxGuests
              return (
              <article className="public-vendor-card" key={vendor.publicId} style={{ '--card-index': index } as CSSProperties}>
                <div className="public-vendor-image">
                  <img src={vendor.image} alt={`${vendor.eventLabel} catering setup`} />
                  <span><BadgeCheck size={16} />Handpicked for your event</span>
                </div>
                <div className="public-vendor-body">
                  <div className="public-vendor-title">
                    <div>
                      <p className="public-vendor-code"><Sparkles size={14} />A FeastFlow celebration favourite</p>
                      <h3>{vendor.alias}</h3>
                      <p>{vendor.cuisine}</p>
                    </div>
                    <Rating value={vendor.rating} count={vendor.reviewCount} />
                  </div>
                  <div className="public-vendor-facts">
                    <span><Clock3 size={16} />{vendor.responseMinutes} min response</span>
                    <span><Users size={16} />Up to {vendor.maxGuests} guests</span>
                    <span><Utensils size={16} />From {currency.format(vendor.minPrice)}/guest</span>
                  </div>
                  <div className="public-price-estimate" aria-label={`Estimated price for ${guestCount} guests`}>
                    <div>
                      <small>Starting per plate</small>
                      <strong>{currency.format(vendor.minPrice)}</strong>
                    </div>
                    <span aria-hidden="true">x {guestCount || '-'}</span>
                    <div>
                      <small>Approx. food total</small>
                      <strong>{guestCount ? currency.format(estimatedTotal) : 'Enter guests'}</strong>
                    </div>
                  </div>
                  <p className="public-estimate-note">Starting estimate only. Final price changes with menu, service, taxes, and add-ons.</p>
                  {vendor.menuHighlights[0] && (
                    <div className="public-menu-preview">
                      <div><strong>{vendor.menuHighlights[0].title}</strong><span>from {currency.format(vendor.menuHighlights[0].pricePerGuest)}/guest</span></div>
                      <p>Minimum {vendor.menuHighlights[0].minGuests} guests · {vendor.menuHighlights[0].itemCount} menu inclusions · Full menu and live availability await</p>
                    </div>
                  )}
                  <div className="public-vendor-footer">
                    <div className="public-vendor-tags">
                      {vendor.badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}
                    </div>
                    <button
                      type="button"
                      disabled={!withinCapacity}
                      onClick={() => onSelect({
                        publicId: vendor.publicId,
                        alias: vendor.alias,
                        eventType: eventType!,
                        pincode,
                        guests: guestCount,
                        perPlate: vendor.minPrice,
                        estimatedTotal,
                      })}
                    >
                      {guestCount > vendor.maxGuests ? `Capacity ${vendor.maxGuests}` : 'Meet this team'}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

function LoginPage({
  onAuthenticate,
  selection,
  accessMode,
  onBackToDiscovery,
  mfaChallenge,
  onVerifyMfa,
  onResendMfa,
  onCancelMfa,
  authBusy,
  authError,
}: {
  onAuthenticate: (details: {
    mode: AuthMode
    role: Role
    name: string
    email: string
    password: string
  }) => void
  selection: PublicSelection | null
  accessMode: PublicAccessMode
  onBackToDiscovery: () => void
  mfaChallenge: MfaChallenge | null
  onVerifyMfa: (code: string) => void
  onResendMfa: () => void
  onCancelMfa: () => void
  authBusy: boolean
  authError: string
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const role: Role = selection ? 'customer' : accessMode
  const [name, setName] = useState(demoAccounts[role].name)
  const [email, setEmail] = useState(demoAccounts[role].email)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mfaCode, setMfaCode] = useState('')

  useEffect(() => {
    setMfaCode('')
  }, [mfaChallenge?.challengeId])

  useEffect(() => {
    setMode('login')
    setName(demoAccounts[role].name)
    setEmail(demoAccounts[role].email)
    setPassword('')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [role, selection?.publicId])

  const selectMode = (nextMode: AuthMode) => {
    if (role === 'admin') return
    setMode(nextMode)
    setPassword('')
  }

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onAuthenticate({ mode, role, name, email, password })
  }

  const submitMfa = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onVerifyMfa(mfaCode)
  }

  const canSubmit = Boolean(email.trim() && password.trim().length >= 8 && (mode === 'login' || name.trim()))
  const roleDetails: Record<Role, { eyebrow: string; loginTitle: string; registerTitle: string; panelCopy: string; heroTitle: string; heroCopy: string }> = {
    customer: {
      eyebrow: 'Customer account',
      loginTitle: 'Welcome back to your celebrations',
      registerTitle: 'Create your customer account',
      panelCopy: 'Bring trusted caterers, quotes, and every event detail into one calm workspace.',
      heroTitle: 'Your next great table starts here.',
      heroCopy: 'Save caterers, compare menus, coordinate details, and pay securely from one thoughtful place.',
    },
    vendor: {
      eyebrow: 'Vendor portal',
      loginTitle: 'Welcome back, catering partner',
      registerTitle: 'Register your catering business',
      panelCopy: 'Run onboarding, packages, requests, and bookings without losing the thread.',
      heroTitle: 'Turn exceptional service into lasting growth.',
      heroCopy: 'Manage verification, menus, enquiries, bookings, and payouts with a workspace built for caterers.',
    },
    admin: {
      eyebrow: 'Admin console',
      loginTitle: 'Secure operations access',
      registerTitle: 'Admin access',
      panelCopy: 'Review vendors, documents, and marketplace activity from one clear view.',
      heroTitle: 'Keep every marketplace promise accountable.',
      heroCopy: 'Review vendor identity, documentation, customer activity, and operational alerts with protected access.',
    },
  }
  const selectedEvent = selection ? publicEventOptionById(selection.eventType) : null
  const authHeroImage = selectedEvent?.image ?? landingHeroImage

  const moveHero = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    event.currentTarget.style.setProperty('--hero-shift-x', `${x * -10}px`)
    event.currentTarget.style.setProperty('--hero-shift-y', `${y * -7}px`)
  }

  const resetHero = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--hero-shift-x', '0px')
    event.currentTarget.style.setProperty('--hero-shift-y', '0px')
  }

  return (
    <main className={`auth-page auth-page-${role} ${selection ? 'auth-page-customer-selection' : ''}`}>
      <section className="auth-hero" onPointerMove={moveHero} onPointerLeave={resetHero}>
        <div className="auth-hero-media-wrap" aria-hidden="true">
          <img className="auth-hero-media" src={authHeroImage} alt="" />
        </div>
        <FeastDepthScene key={authHeroImage} variant="auth" image={authHeroImage} />
        <div className="auth-brand">
          <span className="auth-brand-mark">
            <ChefHat size={22} aria-hidden="true" />
          </span>
          <span>
            <strong>FeastFlow</strong>
            <small>Catering marketplace</small>
          </span>
        </div>

        <div className="auth-live-pill">
          <span aria-hidden="true" />
          Verified kitchens. Real celebrations.
        </div>

        <div className="auth-copy">
          <p className="eyebrow">{selectedEvent ? `${selectedEvent.label} plan saved` : roleDetails[role].eyebrow}</p>
          <h1>{selectedEvent ? 'Your celebration team is waiting at the table.' : roleDetails[role].heroTitle}</h1>
          <p className="auth-tagline">
            {selection ? `${selection.guests} guests in ${selection.pincode}` : 'Great events start with the right table.'}
          </p>
          <p className="auth-intro">
            {selection
              ? `Your celebration shortlist is ready, with a starting estimate of ${currency.format(selection.estimatedTotal)}. Sign in to meet the team, explore every menu, and check your date.`
              : roleDetails[role].heroCopy}
          </p>
          {selection && (
            <div className="auth-selection-proof" aria-label="Saved catering estimate">
              <span><small>Starting per plate</small><strong>{currency.format(selection.perPlate)}</strong></span>
              <span><small>Starting food estimate</small><strong>{currency.format(selection.estimatedTotal)}</strong></span>
            </div>
          )}
          <div className="auth-proof" aria-label="Marketplace benefits">
            <span>
              <BadgeCheck size={17} aria-hidden="true" />
              Verified vendors
            </span>
            <span>
              <MessageCircle size={17} aria-hidden="true" />
              Live coordination
            </span>
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              Protected payments
            </span>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-label="Account access">
        <div className="auth-mobile-brand">
          <span className="auth-brand-mark">
            <ChefHat size={20} aria-hidden="true" />
          </span>
          <span>
            <strong>FeastFlow</strong>
            <small>Catering marketplace</small>
          </span>
        </div>

        <button className="auth-back-discovery" type="button" onClick={onBackToDiscovery}>
          <ArrowLeft size={17} aria-hidden="true" />
          {selection ? 'Back to caterers' : 'Explore without signing in'}
        </button>

        <div className="auth-card">
        {selection && !mfaChallenge && (
          <div className="auth-selection-context">
            <span><Sparkles size={18} aria-hidden="true" /></span>
            <div>
              <small>Saved to your celebration shortlist</small>
              <strong>{selection.alias}</strong>
              <p>
                {publicEventOptionById(selection.eventType).label} in {selection.pincode} for {selection.guests} guests,
                starting near {currency.format(selection.estimatedTotal)}. Meet the team, view complete menus, and request your date after sign-in.
              </p>
            </div>
          </div>
        )}
        {mfaChallenge ? (
          <form className="auth-form auth-mfa-form" onSubmit={submitMfa}>
            <span className="auth-mfa-mark">
              <ShieldCheck size={24} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">Step 2 of 2</p>
              <h2>Check your email</h2>
              <p className="auth-mfa-copy">
                We sent a six-digit sign-in code to <strong>{mfaChallenge.delivery}</strong>. It expires shortly.
              </p>
            </div>
            <label>
              <span>Verification code</span>
              <input
                autoComplete="one-time-code"
                className="mfa-code-input"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="000000"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>

            {authError && (
              <p className="form-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {authError}
              </p>
            )}

            <button type="submit" className="primary-btn auth-submit" disabled={authBusy || mfaCode.length !== 6}>
              <KeyRound size={16} aria-hidden="true" />
              {authBusy ? 'Verifying...' : 'Verify and continue'}
            </button>
            <div className="auth-mfa-actions">
              <button type="button" className="ghost-btn" onClick={onResendMfa} disabled={authBusy}>
                <RefreshCw size={16} aria-hidden="true" />
                Resend code
              </button>
              <button type="button" className="ghost-btn" onClick={onCancelMfa} disabled={authBusy}>
                Back to sign in
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="auth-card-head">
              <div className="auth-heading-copy">
                <p className="eyebrow">
                  {selection ? 'Secure customer access' : roleDetails[role].eyebrow}
                </p>
                <h2>
                  {selection
                    ? mode === 'login' ? 'Meet your shortlisted team' : 'Create your customer account'
                    : mode === 'login' ? roleDetails[role].loginTitle : roleDetails[role].registerTitle}
                </h2>
                <p className="auth-role-context" key={`${mode}-${role}`} aria-live="polite">
                  {selection
                    ? 'Your guest count, estimate, and favourite match are saved. Sign in to open the complete experience.'
                    : roleDetails[role].panelCopy}
                </p>
              </div>
              {role !== 'admin' && <div className={`auth-toggle ${mode}`} aria-label="Authentication mode">
                <button
                  type="button"
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => selectMode('login')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={mode === 'register' ? 'active' : ''}
                  onClick={() => selectMode('register')}
                >
                  Register
                </button>
              </div>}
            </div>

            <form className="auth-form auth-form-enter" key={`${mode}-${role}`} onSubmit={submitAuth}>
              {mode === 'register' && (
                <>
                  <label htmlFor="auth-name">
                    <span>Full name</span>
                    <input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <p className="auth-register-note">Administrator accounts are provisioned internally.</p>
                </>
              )}
              <label htmlFor="auth-email">
                <span>Email</span>
                <input
                  id="auth-email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label htmlFor="auth-password">
                <span>Password</span>
                <span className="password-field">
                  <input
                    id="auth-password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                  </button>
                </span>
                <small className="field-hint">Use at least 8 characters.</small>
              </label>

              {authError && (
                <p className="form-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {authError}
                </p>
              )}

              <button type="submit" className="primary-btn auth-submit" disabled={authBusy || !canSubmit}>
                <KeyRound size={16} aria-hidden="true" />
                {authBusy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </>
        )}
        </div>
        <p className="auth-legal">By continuing, you agree to use FeastFlow responsibly and protect your account access.</p>
      </section>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession())
  const [publicAuthOpen, setPublicAuthOpen] = useState(false)
  const [publicAccessMode, setPublicAccessMode] = useState<PublicAccessMode>('customer')
  const [pendingPublicSelection, setPendingPublicSelection] = useState<PublicSelection | null>(null)
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null)
  const [backendReady, setBackendReady] = useState(false)
  const [section, setSection] = useState<Section>('marketplace')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [addOns, setAddOns] = useState<AddOn[]>([])
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters)
  const [searchResults, setSearchResults] = useState<Vendor[] | null>(null)
  const [application, setApplication] = useState<VendorApplication>(initialApplication)
  const [selectedVendorId, setSelectedVendorId] = useState('spice-stem')
  const [selectedPackageId, setSelectedPackageId] = useState('royal-wedding')
  const [bookingDraft, setBookingDraft] = useState({
    guests: initialFilters.guests,
    date: initialFilters.date,
    eventType: 'Wedding',
    paymentChoice: 'deposit' as 'deposit' | 'full',
    addOns: ['service-staff'],
    note: '',
  })
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({})
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({})
  const [newPackage, setNewPackage] = useState({
    title: '',
    price: '',
    guests: '',
    tag: '',
  })
  const [notificationPermission, setNotificationPermission] = useState<AppNotificationPermission>(() => getNotificationPermission())
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [alertSoundEnabled, setAlertSoundEnabled] = useState(true)
  const [previewDocument, setPreviewDocument] = useState<UploadedDocument | null>(null)
  const [documentRejectionTarget, setDocumentRejectionTarget] = useState<UploadedDocument | null>(null)
  const [documentRejectionReason, setDocumentRejectionReason] = useState('')
  const [documentReuploadTarget, setDocumentReuploadTarget] = useState<UploadedDocument | null>(null)
  const [documentReuploadReason, setDocumentReuploadReason] = useState('')
  const [documentDeleteTarget, setDocumentDeleteTarget] = useState<UploadedDocument | null>(null)
  const [documentDeleteReason, setDocumentDeleteReason] = useState('')
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([
    {
      id: 'live-init',
      title: 'Realtime marketplace connected',
      body: 'Bookings, payments, and verification updates will appear here.',
      time: 'Now',
    },
  ])
  const [locationStatus, setLocationStatus] = useState<'idle' | 'asking' | 'allowed' | 'denied'>(
    appliedFilters.geo ? 'allowed' : 'idle',
  )
  const [toast, setToast] = useState('Ready to serve.')
  const [error, setError] = useState('')
  const clearSession = (message = 'Session expired. Please sign in again.') => {
    sessionStorage.removeItem(sessionTokenKey)
    setSession(null)
    setVendors([])
    setBookings([])
    setAddOns([])
    setSearchResults(null)
    setApplication(initialApplication)
    setBackendReady(false)
    setNotificationDrawerOpen(false)
    setUnreadNotificationCount(0)
    setMfaChallenge(null)
    setAuthBusy(false)
    setPublicAuthOpen(true)
    setAuthError(message)
    setToast(message)
  }

  const handleApiFailure = (apiError: unknown, fallback: string) => {
    if (apiError instanceof ApiRequestError && apiError.status === 401) {
      clearSession(apiError.message)
      return apiError.message
    }
    return apiError instanceof Error ? apiError.message : fallback
  }

  const role = session?.user.role ?? 'customer'
  const allowedSections = roleSections[role]
  const activeSection = allowedSections.includes(section) ? section : defaultSectionForRole(role)

  const approvedVendors = useMemo(
    () => vendors.filter(isCustomerVisibleVendor),
    [vendors],
  )
  const locationSuggestions = useMemo(() => {
    const suggestionSet = new Set<string>()
    approvedVendors.forEach((vendor) => {
      ;[
        vendor.address,
        vendor.pincode,
        vendor.coordinates.label,
        ...vendor.servicePincodes,
      ].forEach((value) => {
        const normalizedValue = value.trim()
        if (normalizedValue) suggestionSet.add(normalizedValue)
      })
    })
    return Array.from(suggestionSet).slice(0, 18)
  }, [approvedVendors])

  const filteredVendors = useMemo(() => {
    const normalizedLocation = appliedFilters.location.trim().toLowerCase()
    const activeGeo = appliedFilters.geo ?? null
    return approvedVendors
      .filter((vendor) => {
        const distance = getVendorDistance(vendor, activeGeo)
        const searchableText = vendorSearchText(vendor)
        const matchesLocation =
          normalizedLocation.length === 0 ||
          searchableText.includes(normalizedLocation) ||
          (activeGeo ? distance <= vendor.serviceRadius : false)
        const matchesBudget = appliedFilters.budget === 0 || vendor.minPrice <= appliedFilters.budget
        const matchesDiet = appliedFilters.dietary === 'Any' || vendor.dietary.includes(appliedFilters.dietary)
        const matchesEvent =
          appliedFilters.eventType === 'Any' || vendor.eventTypes.includes(appliedFilters.eventType)
        const matchesDate =
          appliedFilters.date.length === 0 || vendor.availability.includes(appliedFilters.date)
        return matchesLocation && matchesBudget && matchesDiet && matchesEvent && matchesDate
      })
      .sort((firstVendor, secondVendor) => {
        const ratingDelta = secondVendor.rating - firstVendor.rating
        if (ratingDelta !== 0) return ratingDelta
        return getVendorDistance(firstVendor, activeGeo) - getVendorDistance(secondVendor, activeGeo)
      })
  }, [approvedVendors, appliedFilters])

  const fallbackSearchVendors = useMemo(() => {
    const normalizedLocation = appliedFilters.location.trim().toLowerCase()
    if (normalizedLocation.length === 0) return approvedVendors
    return approvedVendors
      .filter((vendor) => vendorSearchText(vendor).includes(normalizedLocation))
      .sort(
        (firstVendor, secondVendor) =>
          getVendorDistance(firstVendor, appliedFilters.geo) - getVendorDistance(secondVendor, appliedFilters.geo),
      )
  }, [approvedVendors, appliedFilters.geo, appliedFilters.location])
  const rankedVendors =
    searchResults ??
    (filteredVendors.length > 0
      ? filteredVendors
      : fallbackSearchVendors.length > 0
        ? fallbackSearchVendors
        : approvedVendors)
  const displayedResultCount = rankedVendors.length
  const selectedVendor =
    rankedVendors.find((vendor) => vendor.id === selectedVendorId) ??
    rankedVendors[0]
  const selectedPackage =
    selectedVendor?.packages.find((pack) => pack.id === selectedPackageId) ??
    selectedVendor?.packages[0]
  const currentVendor =
    role === 'vendor'
      ? vendors.find((vendor) => vendor.id === session?.user.vendorId) ??
        vendors.find((vendor) =>
          Object.values(vendor.documents ?? {}).some((document) => document?.uploadedBy === session?.user.id),
        )
      : vendors.find((vendor) => vendor.id === session?.user.vendorId)
  const vendorBookings = bookings.filter((booking) => booking.vendorId === currentVendor?.id)
  const customerBookings = bookings
  const selectedAddOns = addOns.filter((item) => bookingDraft.addOns.includes(item.id))
  const selectedAddOnTotal = selectedAddOns.reduce((total, item) => total + item.price, 0)
  const bookingBaseTotal = selectedPackage
    ? Math.max(bookingDraft.guests, selectedPackage.minGuests) * selectedPackage.pricePerGuest
    : 0
  const bookingTotal = bookingBaseTotal + selectedAddOnTotal
  const depositAmount =
    bookingDraft.paymentChoice === 'full' ? bookingTotal : Math.ceil(bookingTotal * 0.3)
  const confirmedRevenue = bookings
    .filter((booking) => booking.status === 'confirmed' || booking.status === 'completed')
    .reduce((total, booking) => total + booking.amount, 0)

  useEffect(() => {
    if (role !== 'vendor' || !currentVendor) return

    setApplication(applicationFromVendor(currentVendor))
    setError('')
  }, [
    role,
    currentVendor?.id,
    currentVendor?.name,
    currentVendor?.cuisine,
    currentVendor?.pincode,
    currentVendor?.serviceRadius,
    currentVendor?.image,
    currentVendor?.license,
    currentVendor?.status,
    currentVendor?.documents,
  ])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeSection])

  useEffect(() => {
    if (!session) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [session?.token])

  useEffect(() => {
    if (!session) return
    const millisecondsUntilExpiry = session.expiresAt - Date.now()
    if (millisecondsUntilExpiry <= 0) {
      clearSession('Session expired. Please sign in again.')
      return
    }

    const timer = window.setTimeout(() => {
      clearSession('Session expired. Please sign in again.')
    }, millisecondsUntilExpiry)

    return () => window.clearTimeout(timer)
  }, [session?.expiresAt])

  useEffect(() => {
    if (!session) return
    let isCurrent = true

    apiRequest<ApiBootstrap>('/bootstrap', { token: session.token })
      .then((data) => {
        if (!isCurrent) return
        setVendors(data.vendors)
        setBookings(data.bookings)
        setAddOns(data.addOns)
        setSession((currentSession) =>
          currentSession ? { ...currentSession, user: data.user } : currentSession,
        )
        const publicMatch = pendingPublicSelection && data.user.role === 'customer'
          ? data.vendors.find((vendor) => vendor.publicId === pendingPublicSelection.publicId)
          : undefined
        if (publicMatch) {
          const eventOption = publicEventOptionById(pendingPublicSelection.eventType)
          const carriedVendors = data.vendors.filter((vendor) =>
            (vendor.pincode === pendingPublicSelection.pincode || vendor.servicePincodes.includes(pendingPublicSelection.pincode)) &&
            eventOption.marketplaceEvents.some((eventName) => vendor.eventTypes.includes(eventName)),
          )
          const carriedFilters: Filters = {
            ...initialFilters,
            location: pendingPublicSelection.pincode,
            eventType: eventOption.marketplaceEvent,
            guests: pendingPublicSelection.guests,
          }
          setFilters(carriedFilters)
          setAppliedFilters(carriedFilters)
          setSearchResults(carriedVendors)
          setSelectedVendorId(publicMatch.id)
          setSelectedPackageId(publicMatch.packages[0]?.id ?? '')
          setBookingDraft((current) => ({
            ...current,
            guests: pendingPublicSelection.guests,
            eventType: eventOption.marketplaceEvent,
          }))
          setSection('marketplace')
          setToast(`${pendingPublicSelection.alias} is ready. Explore the team, menus, and booking options.`)
        } else {
          setSearchResults(null)
          setToast('Backend connected. Live data loaded.')
        }
        setPendingPublicSelection(null)
        setPublicAuthOpen(false)
        setBackendReady(true)
      })
      .catch((apiError: unknown) => {
        if (!isCurrent) return
        setBackendReady(false)
        setToast(handleApiFailure(apiError, 'Could not load database data.'))
      })

    return () => {
      isCurrent = false
    }
  }, [session?.token])

  useEffect(() => {
    if (!session || activeSection !== 'admin') return
    let isCurrent = true

    apiRequest<{ vendors: Vendor[]; count: number }>('/admin/vendors', { token: session.token })
      .then((data) => {
        if (!isCurrent) return
        setVendors(data.vendors)
        setToast(`${data.count} vendor records refreshed from MySQL.`)
      })
      .catch((apiError: unknown) => {
        if (!isCurrent) return
        setToast(handleApiFailure(apiError, 'Admin review queue could not be refreshed.'))
      })

    return () => {
      isCurrent = false
    }
  }, [activeSection, session?.token])

  useEffect(() => {
    if (!session) return
    let isCurrent = true

    apiRequest<{ notifications: LiveEvent[] }>('/notifications', { token: session.token })
      .then((data) => {
        if (!isCurrent) return
        setLiveEvents((currentEvents) => {
          const initialEvent = currentEvents.filter((event) => event.id === 'live-init')
          const seenIds = new Set(initialEvent.map((event) => event.id))
          const persisted = data.notifications.filter((event) => {
            if (seenIds.has(event.id)) return false
            seenIds.add(event.id)
            return true
          })
          return [...persisted, ...initialEvent].slice(0, 20)
        })
        setUnreadNotificationCount(Math.min(data.notifications.length, 9))
      })
      .catch(() => undefined)

    return () => {
      isCurrent = false
    }
  }, [session?.token])

  useEffect(() => {
    if (!session || notificationPermission !== 'granted' || !('serviceWorker' in navigator)) {
      setPushSubscribed(false)
      return
    }

    navigator.serviceWorker.getRegistration('/').then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) return
      await apiRequest('/push/subscribe', {
        body: { subscription: subscription.toJSON() },
        token: session.token,
      })
      setPushSubscribed(true)
    }).catch(() => setPushSubscribed(false))
  }, [notificationPermission, session?.token])

  useEffect(() => {
    if (!session) return

    const events = new EventSource(`${apiBaseUrl}/api/events?token=${encodeURIComponent(session.token)}`)
    events.onopen = () => setBackendReady(true)
    events.addEventListener('marketplace', (event) => {
      const liveEvent = JSON.parse((event as MessageEvent).data) as LiveEvent
      setBackendReady(true)
      setLiveEvents((currentEvents) => [liveEvent, ...currentEvents].slice(0, 6))
      if (liveEvent.title !== 'Realtime API connected') {
        setUnreadNotificationCount((currentCount) => Math.min(currentCount + 1, 9))
        if (alertSoundEnabled) playNotificationSound()
      }
    })
    events.onerror = () => {
      setBackendReady(false)
    }

    return () => events.close()
  }, [alertSoundEnabled, session?.token])

  useEffect(() => {
    if (session && !allowedSections.includes(section)) {
      setSection(defaultSectionForRole(role))
    }
  }, [allowedSections, role, section, session, setSection])

  const updateFilter = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }))
  }

  const updateBookingDraft = <Key extends keyof typeof bookingDraft>(
    key: Key,
    value: (typeof bookingDraft)[Key],
  ) => {
    setBookingDraft((currentDraft) => ({ ...currentDraft, [key]: value }))
  }

  const addLiveEvent = (title: string, body: string) => {
    setLiveEvents((currentEvents) => [
      {
        id: makeId('EVT'),
        title,
        body,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...currentEvents,
    ].slice(0, 6))
  }

  const notify = async (title: string, body: string) => {
    addLiveEvent(title, body)
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      return
    }

    let permission = notificationPermission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
    showBrowserNotification(permission, title, body)
  }

  const enablePushNotifications = async () => {
    if (!session || !('serviceWorker' in navigator) || typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      setToast('This browser does not support push notifications.')
      return
    }

    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission !== 'granted') {
        setToast('Notification permission was not allowed. You can enable it from browser settings.')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const { publicKey } = await apiRequest<{ publicKey: string }>('/push/public-key', {
        token: session.token,
      })
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushApplicationServerKey(publicKey),
      })
      await apiRequest('/push/subscribe', {
        body: { subscription: subscription.toJSON() },
        token: session.token,
      })
      setPushSubscribed(true)
      setToast('Push notifications are enabled on this device.')
      await apiRequest('/push/test', { method: 'POST', token: session.token })
    } catch (apiError) {
      setPushSubscribed(false)
      setToast(handleApiFailure(apiError, 'Push notifications could not be enabled.'))
    } finally {
      setPushBusy(false)
    }
  }

  const runSearch = async (criteria = filters) => {
    setAppliedFilters(criteria)
    try {
      const data = await apiRequest<{ vendors: Vendor[]; count: number }>('/vendors/search', {
        body: { filters: criteria },
        token: session?.token,
      })
      setSearchResults(data.vendors)
      if (data.vendors.length > 0) {
        setSelectedVendorId(data.vendors[0].id)
        setSelectedPackageId(data.vendors[0].packages[0]?.id ?? '')
      } else {
        setSelectedVendorId('')
        setSelectedPackageId('')
      }
      setToast(`${data.count} caterers found.`)
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Search failed.'))
    }
  }

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      setError('Location is not supported in this browser.')
      return
    }

    setLocationStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: GeoPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Current location',
        }
        const nextFilters = {
          ...filters,
          location: 'Current location',
          geo: point,
        }
        setFilters(nextFilters)
        setAppliedFilters(nextFilters)
        setLocationStatus('allowed')
        setError('')
        setToast('Location allowed. Search results updated near you.')
        addLiveEvent('Location search updated', 'Vendors are ranked by distance from your current location.')
      },
      () => {
        setLocationStatus('denied')
        setError('Location permission was not allowed. You can still search by area, cuisine, or pincode.')
        setToast('Location permission was not allowed.')
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    )
  }

  const completeAuthentication = (token: string) => {
    const nextSession = sessionFromToken(token)
    if (!nextSession) {
      setAuthError('Unable to create a secure session.')
      return false
    }
    sessionStorage.setItem(sessionTokenKey, token)
    setSession(nextSession)
    setSection(defaultSectionForRole(nextSession.user.role))
    setMfaChallenge(null)
    setToast(`Welcome back, ${nextSession.user.name}.`)
    setAuthError('')
    setError('')
    return true
  }

  const handleAuthenticate = async ({
    mode,
    role: requestedRole,
    name,
    email,
    password,
  }: {
    mode: AuthMode
    role: Role
    name: string
    email: string
    password: string
  }) => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setAuthError('Enter a valid email address.')
      return
    }
    if (password.trim().length < 8) {
      setAuthError('Password must be at least 8 characters.')
      return
    }
    if (mode === 'register' && requestedRole === 'admin') {
      setAuthError('Administrator accounts are provisioned internally.')
      return
    }

    const resolvedName =
      mode === 'login'
        ? ''
        : name.trim() || trimmedEmail.split('@')[0] || 'FeastFlow User'
    setAuthBusy(true)
    try {
      const response = await apiRequest<ApiAuthResponse>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        {
          body: {
            role: requestedRole,
            name: resolvedName,
            email: trimmedEmail,
            password,
          },
        },
      )
      if ('mfaRequired' in response) {
        setMfaChallenge(response)
        setAuthError('')
        return
      }
      completeAuthentication(response.token)
    } catch (apiError) {
      setAuthError(apiError instanceof Error ? apiError.message : 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  const verifyMfa = async (code: string) => {
    if (!mfaChallenge) return
    setAuthBusy(true)
    try {
      const response = await apiRequest<ApiAuthenticatedResponse>('/auth/mfa/verify', {
        body: { challengeId: mfaChallenge.challengeId, code },
      })
      completeAuthentication(response.token)
    } catch (apiError) {
      setAuthError(apiError instanceof Error ? apiError.message : 'Verification failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  const resendMfa = async () => {
    if (!mfaChallenge) return
    setAuthBusy(true)
    try {
      const response = await apiRequest<MfaChallenge>('/auth/mfa/resend', {
        body: { challengeId: mfaChallenge.challengeId },
      })
      setMfaChallenge(response)
      setAuthError('')
      setToast(`A new verification code was sent to ${response.delivery}.`)
    } catch (apiError) {
      setAuthError(apiError instanceof Error ? apiError.message : 'Could not resend the verification code.')
    } finally {
      setAuthBusy(false)
    }
  }

  const cancelMfa = () => {
    setMfaChallenge(null)
    setAuthError('')
  }

  const logout = () => {
    sessionStorage.removeItem(sessionTokenKey)
    setSession(null)
    setVendors([])
    setBookings([])
    setAddOns([])
    setSearchResults(null)
    setApplication(initialApplication)
    setNotificationDrawerOpen(false)
    setUnreadNotificationCount(0)
    setMfaChallenge(null)
    setAuthBusy(false)
    setPublicAuthOpen(false)
    setPendingPublicSelection(null)
    setAuthError('')
    setToast('Signed out.')
  }

  const openNotificationDrawer = () => {
    prepareNotificationSound()
    setUnreadNotificationCount(0)
    setNotificationDrawerOpen(true)
  }

  const toggleAlertSound = () => {
    setAlertSoundEnabled((soundEnabled) => {
      const nextSoundEnabled = !soundEnabled
      if (nextSoundEnabled) playNotificationSound()
      return nextSoundEnabled
    })
  }

  const chooseVendor = (vendorId: string) => {
    const vendor = vendors.find((item) => item.id === vendorId)
    setSelectedVendorId(vendorId)
    setSelectedPackageId(vendor?.packages[0]?.id ?? '')
    setError('')
  }

  const toggleAddOn = (id: string) => {
    setBookingDraft((currentDraft) => {
      const hasAddOn = currentDraft.addOns.includes(id)
      return {
        ...currentDraft,
        addOns: hasAddOn
          ? currentDraft.addOns.filter((item) => item !== id)
          : [...currentDraft.addOns, id],
      }
    })
  }

  const createBooking = async (mode: 'instant' | 'quote') => {
    if (!selectedVendor || !selectedPackage) {
      setError('Select a vendor package first.')
      return
    }
    if (!bookingDraft.date || bookingDraft.date < todayIso) {
      setError('Choose a valid future event date.')
      return
    }
    if (bookingDraft.guests < selectedPackage.minGuests) {
      setError(`Minimum guest count for this package is ${selectedPackage.minGuests}.`)
      return
    }
    if (mode === 'instant' && !selectedVendor.availability.includes(bookingDraft.date)) {
      setError('This date is not open for instant booking. Send a quote request instead.')
      return
    }

    try {
      const data = await apiRequest<{ booking: Booking }>('/bookings', {
        body: {
          vendorId: selectedVendor.id,
          packageId: selectedPackage.id,
          eventType: bookingDraft.eventType,
          date: bookingDraft.date,
          guests: bookingDraft.guests,
          addOns: bookingDraft.addOns,
          note: bookingDraft.note,
          paymentChoice: bookingDraft.paymentChoice,
          mode,
        },
        token: session?.token,
      })

      setBookings((currentBookings) => [data.booking, ...currentBookings])
      setSection('bookings')
      const message =
        mode === 'instant'
          ? `Booking ${data.booking.id} confirmed with ${selectedVendor.name}.`
          : `Quote request ${data.booking.id} sent to ${selectedVendor.name}.`
      setToast(message)
      await notify(mode === 'instant' ? 'Booking confirmed' : 'Quote request sent', message)
      setError('')
    } catch (apiError) {
      setError(handleApiFailure(apiError, 'Booking request failed.'))
    }
  }

  const packageForBooking = (booking: Booking) => {
    const vendor = vendors.find((item) => item.id === booking.vendorId)
    const pack = vendor?.packages.find((item) => item.id === booking.packageId)
    return { vendor, pack }
  }

  const replaceBooking = (updatedBooking: Booking) => {
    setBookings((currentBookings) =>
      currentBookings.map((booking) => (booking.id === updatedBooking.id ? updatedBooking : booking)),
    )
  }

  const vendorDecision = async (bookingId: string, decision: 'accept' | 'counter' | 'decline') => {
    try {
      const data = await apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/vendor-decision`, {
        body: { decision },
        token: session?.token,
      })
      replaceBooking(data.booking)
      setToast(`Booking ${bookingId} updated.`)
      await notify('Booking request updated', `Vendor response saved for ${bookingId}.`)
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Vendor action failed.'))
    }
  }

  const customerPayment = async (bookingId: string) => {
    try {
      const intent = await apiRequest<{ payment: { id: string } }>('/payments/intent', {
        body: { bookingId },
        token: session?.token,
      })
      const confirmation = await apiRequest<{ booking: Booking }>(
        `/payments/${intent.payment.id}/confirm`,
        {
          method: 'POST',
          token: session?.token,
        },
      )
      replaceBooking(confirmation.booking)
      setToast(`Payment captured for ${bookingId}.`)
      await notify('Payment successful', `Your payment for ${bookingId} was captured.`)
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Payment failed.'))
    }
  }

  const markCompleted = async (bookingId: string) => {
    try {
      const data = await apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/complete`, {
        method: 'POST',
        token: session?.token,
      })
      replaceBooking(data.booking)
      setToast(`Booking ${bookingId} completed.`)
      await notify('Booking completed', `${bookingId} was marked completed.`)
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Could not complete booking.'))
    }
  }

  const sendMessage = async (bookingId: string, from: 'customer' | 'vendor') => {
    const text = chatDrafts[bookingId]?.trim()
    if (!text) return
    try {
      const data = await apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/messages`, {
        body: { from, text },
        token: session?.token,
      })
      replaceBooking(data.booking)
      setChatDrafts((currentDrafts) => ({ ...currentDrafts, [bookingId]: '' }))
      setToast('Message sent.')
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Message failed.'))
    }
  }

  const leaveReview = async (bookingId: string) => {
    const text = reviewDrafts[bookingId]?.trim() || 'Great service and food quality.'
    try {
      const data = await apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/review`, {
        body: { rating: 5, text },
        token: session?.token,
      })
      replaceBooking(data.booking)
      setToast(`Review saved for ${bookingId}.`)
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Review failed.'))
    }
  }

  const updateVendorStatus = async (vendorId: string, status: VendorStatus, adminNote?: string) => {
    try {
      const data = await apiRequest<{ vendor: Vendor }>(`/admin/vendors/${vendorId}/status`, {
        method: 'PATCH',
        body: { status, adminNote },
        token: session?.token,
      })
      setVendors((currentVendors) =>
        currentVendors.map((vendor) => (vendor.id === vendorId ? data.vendor : vendor)),
      )
      setToast(`Vendor moved to ${vendorStatusMeta[status].label}.`)
      await notify('Vendor verification updated', `Vendor moved to ${vendorStatusMeta[status].label}.`)
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Vendor verification failed.'))
    }
  }

  const updateDocumentStatus = async (
    documentId: string,
    status: DocumentApprovalStatus,
    rejectionReason?: string,
  ) => {
    try {
      const data = await apiRequest<{ document: UploadedDocument; vendor?: Vendor }>(
        `/documents/${documentId}/status`,
        {
          method: 'PATCH',
          body: { status, rejectionReason },
          token: session?.token,
        },
      )
      if (data.vendor) {
        setVendors((currentVendors) =>
          currentVendors.map((vendor) => (vendor.id === data.vendor?.id ? data.vendor : vendor)),
        )
      }
      setToast(`Document moved to ${documentStatusMeta[status].label}.`)
      await notify('Document review updated', `Document moved to ${documentStatusMeta[status].label}.`)
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Document review failed.'))
    }
  }

  const requestDocumentRejection = (document: UploadedDocument) => {
    setDocumentRejectionTarget(document)
    setDocumentRejectionReason(document.rejectionReason ?? '')
  }

  const confirmDocumentRejection = async () => {
    if (!documentRejectionTarget?.id) return
    const reason = documentRejectionReason.trim()
    if (!reason) {
      setToast('Reject reason is required.')
      return
    }
    await updateDocumentStatus(documentRejectionTarget.id, 'rejected', reason)
    setDocumentRejectionTarget(null)
    setDocumentRejectionReason('')
  }

  const requestDocumentReupload = (document: UploadedDocument) => {
    setDocumentReuploadTarget(document)
    setDocumentReuploadReason(document.rejectionReason ?? 'Please upload a clearer, current document.')
  }

  const confirmDocumentReupload = async () => {
    if (!documentReuploadTarget?.id) return
    const reason = documentReuploadReason.trim()
    if (!reason) {
      setToast('Reupload reason is required.')
      return
    }

    try {
      const data = await apiRequest<{ vendor: Vendor; documentKey: ApplicationDocumentKey }>(`/documents/${documentReuploadTarget.id}/reupload-request`, {
        body: { reason },
        method: 'POST',
        token: session?.token,
      })
      setVendors((currentVendors) =>
        currentVendors.map((vendor) => (vendor.id === data.vendor.id ? data.vendor : vendor)),
      )
      setApplication((current) => ({
        ...current,
        documents: data.vendor.documents ?? {},
        foodLicense: Boolean(data.vendor.documents?.foodLicense),
        identity: Boolean(data.vendor.documents?.identity),
        insurance: Boolean(data.vendor.documents?.insurance),
      }))
      setToast('Reupload request sent. Vendor can upload it again.')
      await notify('Document reupload requested', `${documentReuploadTarget.documentName || documentReuploadTarget.name} must be uploaded again.`)
      setDocumentReuploadTarget(null)
      setDocumentReuploadReason('')
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Document reupload request failed.'))
    }
  }

  const requestDocumentDelete = (document: UploadedDocument) => {
    setDocumentDeleteTarget(document)
    setDocumentDeleteReason('')
  }

  const confirmDocumentDelete = async () => {
    if (!documentDeleteTarget?.id) return

    try {
      const reason = documentDeleteReason.trim()
      const data = await apiRequest<{ vendor: Vendor; documentKey: ApplicationDocumentKey }>(`/documents/${documentDeleteTarget.id}`, {
        body: reason ? { reason } : {},
        method: 'DELETE',
        token: session?.token,
      })
      setVendors((currentVendors) =>
        currentVendors.map((vendor) => (vendor.id === data.vendor.id ? data.vendor : vendor)),
      )
      setApplication((current) => ({
        ...current,
        documents: data.vendor.documents ?? {},
        foodLicense: Boolean(data.vendor.documents?.foodLicense),
        identity: Boolean(data.vendor.documents?.identity),
        insurance: Boolean(data.vendor.documents?.insurance),
      }))
      setToast('Document deleted from the database.')
      await notify('Document deleted', `${documentDeleteTarget.documentName || documentDeleteTarget.name} was deleted.`)
      setDocumentDeleteTarget(null)
      setDocumentDeleteReason('')
    } catch (apiError) {
      setToast(handleApiFailure(apiError, 'Document delete failed.'))
    }
  }

  const uploadApplicationBanner = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Upload an image file for the vendor banner.')
      event.target.value = ''
      return
    }
    if (file.size > maxUploadBytes) {
      setError('Banner image must be under 2.5 MB.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const bannerImage = String(reader.result || '')
      setError('')
      event.target.value = ''

      if (!session?.token || role !== 'vendor' || !currentVendor?.id) {
        setApplication((current) => ({ ...current, bannerImage }))
        setToast('Banner ready. Submit the application to save it.')
        return
      }

      try {
        const data = await apiRequest<{ vendor: Vendor }>(`/vendors/${currentVendor.id}/banner`, {
          body: { bannerImage },
          method: 'PATCH',
          token: session.token,
        })
        setVendors((currentVendors) =>
          currentVendors.map((vendor) => (vendor.id === data.vendor.id ? data.vendor : vendor)),
        )
        setApplication((current) => ({ ...current, bannerImage: data.vendor.image }))
        setToast('Banner updated.')
      } catch (apiError) {
        setError(handleApiFailure(apiError, 'Banner upload failed.'))
      }
    }
    reader.onerror = () => {
      event.target.value = ''
      setError('Banner image could not be read.')
    }
    reader.readAsDataURL(file)
  }

  const uploadApplicationDocument = (
    key: ApplicationDocumentKey,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    const isAcceptedFile = file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!isAcceptedFile) {
      setError('Upload a PDF, PNG, or JPG document.')
      event.target.value = ''
      return
    }
    if (file.size > maxUploadBytes) {
      setError('Document must be under 2.5 MB.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const document: UploadedDocument = {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result || ''),
        uploadedAt: new Date().toISOString(),
      }
      setApplication((current) => ({
        ...current,
        [key]: true,
        documents: {
          ...(current.documents ?? {}),
          [key]: document,
        },
      }))
      setError('')
    }
    reader.onerror = () => setError('Document could not be read.')
    reader.readAsDataURL(file)
  }

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!application.businessName.trim() || !application.license.trim()) {
      setError('Business name and license number are required.')
      return
    }
    const effectiveDocuments = documentsForApplication(application.documents, currentVendor?.documents)
    if (!effectiveDocuments.foodLicense || !effectiveDocuments.identity) {
      setError('Food license and Owner ID uploads are mandatory for review.')
      return
    }

    try {
      const data = await apiRequest<{ vendor: Vendor }>('/vendors/application', {
        body: { application: { ...application, documents: effectiveDocuments } },
        token: session?.token,
      })
      setVendors((currentVendors) => {
        const exists = currentVendors.some((vendor) => vendor.id === data.vendor.id)
        return exists
          ? currentVendors.map((vendor) => (vendor.id === data.vendor.id ? data.vendor : vendor))
          : [data.vendor, ...currentVendors]
      })
      setApplication((current) => ({
        ...current,
        foodLicense: Boolean(data.vendor.documents?.foodLicense),
        identity: Boolean(data.vendor.documents?.identity),
        insurance: Boolean(data.vendor.documents?.insurance),
        documents: data.vendor.documents ?? current.documents,
        bannerImage: data.vendor.image,
      }))
      setError('')
      setToast(
        effectiveDocuments.insurance
          ? 'Application submitted for admin review.'
          : 'Application saved. Admin requested the missing insurance document.',
      )
      await notify('Vendor application submitted', `${data.vendor.name} is waiting for admin review.`)
    } catch (apiError) {
      setError(handleApiFailure(apiError, 'Application submission failed.'))
    }
  }

  const addPackage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const price = Number(newPackage.price)
    const guests = Number(newPackage.guests)
    if (!newPackage.title.trim() || price < 1 || guests < 1) {
      setError('Package title, price, and minimum guests are required.')
      return
    }

    try {
      const data = await apiRequest<{ vendor: Vendor; package: CaterPackage }>(
        `/vendors/${currentVendor.id}/packages`,
        {
          body: {
            title: newPackage.title.trim(),
            pricePerGuest: price,
            minGuests: guests,
            tag: newPackage.tag.trim() || 'Custom',
            image: corporateImage,
          },
          token: session?.token,
        },
      )

      setVendors((currentVendors) =>
        currentVendors.map((vendor) => (vendor.id === data.vendor.id ? data.vendor : vendor)),
      )
      setNewPackage({ title: '', price: '', guests: '', tag: '' })
      setError('')
      setToast('Package added to the database-backed vendor profile.')
      await notify('Package added', `${data.package.title} is now saved in MySQL.`)
    } catch (apiError) {
      setError(handleApiFailure(apiError, 'Package could not be saved.'))
    }
  }

  if (!session) {
    return (
      <>
        <div
          hidden={publicAuthOpen}
          inert={publicAuthOpen}
          aria-hidden={publicAuthOpen || undefined}
        >
          <PublicDiscovery
            onCustomerSignIn={() => {
              setPendingPublicSelection(null)
              setPublicAccessMode('customer')
              setAuthError('')
              setPublicAuthOpen(true)
            }}
            onVendorSignIn={() => {
              setPendingPublicSelection(null)
              setPublicAccessMode('vendor')
              setAuthError('')
              setPublicAuthOpen(true)
            }}
            onAdminSignIn={() => {
              setPendingPublicSelection(null)
              setPublicAccessMode('admin')
              setAuthError('')
              setPublicAuthOpen(true)
            }}
            onSelect={(selection) => {
              setPendingPublicSelection(selection)
              setPublicAccessMode('customer')
              setAuthError('')
              setPublicAuthOpen(true)
            }}
          />
        </div>
        {publicAuthOpen && (
          <LoginPage
            onAuthenticate={handleAuthenticate}
            selection={pendingPublicSelection}
            accessMode={publicAccessMode}
            onBackToDiscovery={() => {
              cancelMfa()
              setPublicAuthOpen(false)
            }}
            mfaChallenge={mfaChallenge}
            onVerifyMfa={verifyMfa}
            onResendMfa={resendMfa}
            onCancelMfa={cancelMfa}
            authBusy={authBusy}
            authError={authError}
          />
        )}
      </>
    )
  }

  return (
    <div className={`app-shell app-shell-${role}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setSection(defaultSectionForRole(role))}>
          <span className="brand-mark">
            <ChefHat size={22} aria-hidden="true" />
          </span>
          <span>
            <strong>FeastFlow</strong>
            <small>Catering marketplace</small>
          </span>
        </button>

        <nav className="main-nav" aria-label="Primary navigation">
          {allowedSections.includes('marketplace') && (
            <button
              className={activeSection === 'marketplace' ? 'active' : ''}
              type="button"
              onClick={() => setSection('marketplace')}
              aria-current={activeSection === 'marketplace' ? 'page' : undefined}
            >
              <Search size={17} aria-hidden="true" />
              Browse
            </button>
          )}
          {allowedSections.includes('bookings') && (
            <button
              className={activeSection === 'bookings' ? 'active' : ''}
              type="button"
              onClick={() => setSection('bookings')}
              aria-current={activeSection === 'bookings' ? 'page' : undefined}
            >
              <CalendarDays size={17} aria-hidden="true" />
              Bookings
            </button>
          )}
          {allowedSections.includes('vendor') && (
            <button
              className={activeSection === 'vendor' ? 'active' : ''}
              type="button"
              onClick={() => setSection('vendor')}
              aria-current={activeSection === 'vendor' ? 'page' : undefined}
            >
              <Store size={17} aria-hidden="true" />
              Vendor
            </button>
          )}
          {allowedSections.includes('admin') && (
            <button
              className={activeSection === 'admin' ? 'active' : ''}
              type="button"
              onClick={() => setSection('admin')}
              aria-current={activeSection === 'admin' ? 'page' : undefined}
            >
              <ShieldCheck size={17} aria-hidden="true" />
              Admin
            </button>
          )}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className={unreadNotificationCount > 0 ? 'notification-bell has-unread' : 'notification-bell'}
            onClick={openNotificationDrawer}
            aria-label={`Open notifications${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} unread` : ''}`}
            aria-expanded={notificationDrawerOpen}
          >
            <Bell size={19} aria-hidden="true" />
            {unreadNotificationCount > 0 && (
              <span className="notification-count" aria-hidden="true">
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>
          <div className="session-panel" aria-label="Current session">
            <span className="session-avatar">
              {role === 'customer' && <UserRound size={16} aria-hidden="true" />}
              {role === 'vendor' && <Store size={16} aria-hidden="true" />}
              {role === 'admin' && <ShieldCheck size={16} aria-hidden="true" />}
            </span>
            <span>
              <strong>{session.user.name}</strong>
              <small>{role} session</small>
            </span>
            <button type="button" onClick={logout} title="Logout">
              <LogOut size={16} aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <NotificationDrawer
        open={notificationDrawerOpen}
        notifications={liveEvents}
        unreadCount={unreadNotificationCount}
        notificationPermission={notificationPermission}
        pushSubscribed={pushSubscribed}
        pushBusy={pushBusy}
        soundEnabled={alertSoundEnabled}
        onClose={() => setNotificationDrawerOpen(false)}
        onEnablePush={enablePushNotifications}
        onToggleSound={toggleAlertSound}
      />

      <footer className="statusbar" aria-live="polite">
        <div>
          <Bell size={16} aria-hidden="true" />
          <span>{toast}</span>
        </div>
        <div className="live-summary" aria-label="Realtime marketplace updates">
          <StatusPill label={backendReady ? 'API connected' : 'API offline'} tone={backendReady ? 'success' : 'warning'} />
          <span>{liveEvents[0]?.title ?? 'No live updates yet'}</span>
        </div>
      </footer>

      <main className="workspace-main" key={activeSection}>
        {activeSection === 'marketplace' && role === 'customer' && (
          <CustomerMarketplace
            filters={filters}
            appliedFilters={appliedFilters}
            rankedVendors={rankedVendors}
            filteredCount={displayedResultCount}
            searchHasRun={searchResults !== null}
            selectedVendor={selectedVendor}
            selectedPackage={selectedPackage}
            bookingDraft={bookingDraft}
            addOns={addOns}
            bookingTotal={bookingTotal}
            depositAmount={depositAmount}
            selectedAddOnTotal={selectedAddOnTotal}
            error={error}
            locationStatus={locationStatus}
            locationSuggestions={locationSuggestions}
            updateFilter={updateFilter}
            updateBookingDraft={updateBookingDraft}
            runSearch={runSearch}
            requestCurrentLocation={requestCurrentLocation}
            chooseVendor={chooseVendor}
            setSelectedPackageId={setSelectedPackageId}
            toggleAddOn={toggleAddOn}
            createBooking={createBooking}
          />
        )}

        {activeSection === 'bookings' && role === 'customer' && (
          <CustomerBookings
            bookings={customerBookings}
            packageForBooking={packageForBooking}
            chatDrafts={chatDrafts}
            reviewDrafts={reviewDrafts}
            setChatDrafts={setChatDrafts}
            setReviewDrafts={setReviewDrafts}
            sendMessage={sendMessage}
            customerPayment={customerPayment}
            markCompleted={markCompleted}
            leaveReview={leaveReview}
          />
        )}

        {activeSection === 'vendor' && role === 'vendor' && currentVendor && (
          <VendorDashboard
            vendor={currentVendor}
            vendorBookings={vendorBookings}
            packageForBooking={packageForBooking}
            application={application}
            setApplication={setApplication}
            submitApplication={submitApplication}
            uploadApplicationBanner={uploadApplicationBanner}
            uploadApplicationDocument={uploadApplicationDocument}
            previewApplicationDocument={setPreviewDocument}
            newPackage={newPackage}
            setNewPackage={setNewPackage}
            addPackage={addPackage}
            vendorDecision={vendorDecision}
            markCompleted={markCompleted}
            chatDrafts={chatDrafts}
            setChatDrafts={setChatDrafts}
            sendMessage={sendMessage}
            confirmedRevenue={confirmedRevenue}
            error={error}
          />
        )}

        {activeSection === 'admin' && role === 'admin' && (
          <AdminPanel
            vendors={vendors}
            bookings={bookings}
            updateVendorStatus={updateVendorStatus}
            updateDocumentStatus={updateDocumentStatus}
            requestDocumentRejection={requestDocumentRejection}
            requestDocumentReupload={requestDocumentReupload}
            requestDocumentDelete={requestDocumentDelete}
            previewDocument={setPreviewDocument}
          />
        )}
      </main>

      <DocumentPreviewModal
        document={previewDocument}
        sessionToken={session.token}
        onClose={() => setPreviewDocument(null)}
      />
      <DocumentRejectionModal
        document={documentRejectionTarget}
        reason={documentRejectionReason}
        setReason={setDocumentRejectionReason}
        onCancel={() => {
          setDocumentRejectionTarget(null)
          setDocumentRejectionReason('')
        }}
        onConfirm={confirmDocumentRejection}
      />
      <DocumentReuploadModal
        document={documentReuploadTarget}
        reason={documentReuploadReason}
        setReason={setDocumentReuploadReason}
        onCancel={() => {
          setDocumentReuploadTarget(null)
          setDocumentReuploadReason('')
        }}
        onConfirm={confirmDocumentReupload}
      />
      <DocumentDeleteModal
        document={documentDeleteTarget}
        reason={documentDeleteReason}
        setReason={setDocumentDeleteReason}
        onCancel={() => {
          setDocumentDeleteTarget(null)
          setDocumentDeleteReason('')
        }}
        onConfirm={confirmDocumentDelete}
      />
    </div>
  )
}

function CustomerMarketplace({
  filters,
  appliedFilters,
  rankedVendors,
  filteredCount,
  searchHasRun,
  selectedVendor,
  selectedPackage,
  bookingDraft,
  addOns,
  bookingTotal,
  depositAmount,
  selectedAddOnTotal,
  error,
  locationStatus,
  locationSuggestions,
  updateFilter,
  updateBookingDraft,
  runSearch,
  requestCurrentLocation,
  chooseVendor,
  setSelectedPackageId,
  toggleAddOn,
  createBooking,
}: {
  filters: Filters
  appliedFilters: Filters
  rankedVendors: Vendor[]
  filteredCount: number
  searchHasRun: boolean
  selectedVendor?: Vendor
  selectedPackage?: CaterPackage
  bookingDraft: {
    guests: number
    date: string
    eventType: string
    paymentChoice: 'deposit' | 'full'
    addOns: string[]
    note: string
  }
  addOns: AddOn[]
  bookingTotal: number
  depositAmount: number
  selectedAddOnTotal: number
  error: string
  locationStatus: 'idle' | 'asking' | 'allowed' | 'denied'
  locationSuggestions: string[]
  updateFilter: <Key extends keyof Filters>(key: Key, value: Filters[Key]) => void
  updateBookingDraft: <Key extends keyof typeof bookingDraft>(
    key: Key,
    value: (typeof bookingDraft)[Key],
  ) => void
  runSearch: () => void
  requestCurrentLocation: () => void
  chooseVendor: (vendorId: string) => void
  setSelectedPackageId: (packageId: string) => void
  toggleAddOn: (id: string) => void
  createBooking: (mode: 'instant' | 'quote') => void
}) {
  const openVendor = (vendorId: string) => {
    chooseVendor(vendorId)
    if (window.matchMedia('(max-width: 940px)').matches) {
      window.requestAnimationFrame(() => {
        const selectedCaterer = document.getElementById('selected-caterer')
        const topbarHeight = document.querySelector<HTMLElement>('.topbar')?.offsetHeight ?? 92
        if (!selectedCaterer) return
        const targetTop = selectedCaterer.getBoundingClientRect().top + window.scrollY - topbarHeight - 12
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
      })
    }
  }

  return (
    <>
      <section className="hero-band" style={{ backgroundImage: `url(${landingHeroImage})` }}>
        <FeastDepthScene variant="discovery" />
        <div className="hero-copy">
          <StatusPill label="Verified vendors only" tone="success" />
          <h1>Book catering that can handle the whole event.</h1>
          <p>
            Search by location, budget, event style, date, and dietary needs, then move from quote
            to payment without leaving the marketplace.
          </p>
        </div>
        <form
          className="search-panel"
          aria-label="Catering search"
          onSubmit={(event) => {
            event.preventDefault()
            runSearch()
          }}
        >
          <label>
            <span>
              <MapPin size={16} aria-hidden="true" />
              Search caterers
            </span>
            <div className="location-control">
              <input
                value={filters.location}
                onChange={(event) => {
                  updateFilter('location', event.target.value)
                  updateFilter('geo', null)
                }}
                placeholder="Area, pincode, cuisine, or vendor"
              />
              <select
                aria-label="Choose area or pincode"
                value=""
                onChange={(event) => {
                  if (!event.target.value) return
                  updateFilter('location', event.target.value)
                  updateFilter('geo', null)
                }}
              >
                <option value="">Choose area or pincode</option>
                {locationSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion}>
                    {suggestion}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="geo-btn" onClick={requestCurrentLocation}>
              <MapPin size={15} aria-hidden="true" />
              {locationStatus === 'asking'
                ? 'Asking permission...'
                : locationStatus === 'allowed'
                  ? 'Using current location'
                  : 'Use my location'}
            </button>
          </label>
          <label>
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              Event date
            </span>
            <input
              min={todayIso}
              type="date"
              value={filters.date}
              onChange={(event) => {
                updateFilter('date', event.target.value)
                updateBookingDraft('date', event.target.value)
              }}
            />
          </label>
          <label>
            <span>
              <Users size={16} aria-hidden="true" />
              Guests
            </span>
            <input
              min={1}
              type="number"
              value={filters.guests}
              onChange={(event) => {
                const value = Number(event.target.value)
                updateFilter('guests', value)
                updateBookingDraft('guests', value)
              }}
            />
          </label>
          <label>
            <span>
              <SlidersHorizontal size={16} aria-hidden="true" />
              Budget per guest
            </span>
            <input
              min={0}
              step={50}
              type="number"
              value={filters.budget}
              onChange={(event) => updateFilter('budget', Number(event.target.value))}
            />
          </label>
          <label>
            <span>Event type</span>
            <select
              value={filters.eventType}
              onChange={(event) => {
                updateFilter('eventType', event.target.value)
                updateBookingDraft('eventType', event.target.value)
              }}
            >
              {['Any', 'Wedding', 'Corporate', 'House party', 'Festival', 'Launch'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Dietary</span>
            <select
              value={filters.dietary}
              onChange={(event) => updateFilter('dietary', event.target.value)}
            >
              {['Any', 'Vegetarian', 'Vegan', 'Jain', 'Gluten-free'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary-btn search-submit">
            <Search size={16} aria-hidden="true" />
            Search caterers
          </button>
        </form>
      </section>

      <section className="content-grid">
        <div className="results-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ranked vendors</p>
              <h2>
                {rankedVendors.length > 0
                  ? `${filteredCount} matching caterers`
                  : searchHasRun
                    ? 'No matching caterers found'
                  : appliedFilters.location.trim()
                    ? 'Showing closest text matches'
                  : appliedFilters.geo
                    ? 'No exact radius match. Showing expanded results'
                    : 'Expanded nearby search'}
              </h2>
            </div>
            <StatusPill label={appliedFilters.geo ? 'Geo-search active' : `${rankedVendors.length} live`} tone={appliedFilters.geo ? 'notice' : 'neutral'} />
          </div>

          <div className="vendor-list">
            {rankedVendors.map((vendor) => (
              <button
                type="button"
                className={`vendor-card ${selectedVendor?.id === vendor.id ? 'selected' : ''}`}
                key={vendor.id}
                aria-pressed={selectedVendor?.id === vendor.id}
                onClick={() => openVendor(vendor.id)}
              >
                <span className="vendor-card-media">
                  <img src={displayImageSrc(vendor.image)} alt={`${vendor.name} food setup`} />
                  <span className="vendor-card-mode">
                    {vendor.packages.some((pack) => pack.instantBook) ? (
                      <>
                        <Zap size={13} aria-hidden="true" /> Instant booking
                      </>
                    ) : (
                      <>
                        <MessageCircle size={13} aria-hidden="true" /> Custom quote
                      </>
                    )}
                  </span>
                  {selectedVendor?.id === vendor.id && (
                    <span className="vendor-selected-mark">
                      <CheckCircle2 size={15} aria-hidden="true" /> Selected
                    </span>
                  )}
                </span>
                <div className="vendor-card-body">
                  <div className="vendor-card-top">
                    <div>
                      <h3>{vendor.name}</h3>
                      <p>{vendor.cuisine}</p>
                    </div>
                    <Rating value={vendor.rating} count={vendor.reviewCount} />
                  </div>
                  <div className="vendor-meta">
                    <span>
                      <MapPin size={15} aria-hidden="true" />
                      {getVendorDistance(vendor, appliedFilters.geo)} km
                    </span>
                    <span>
                      <Clock3 size={15} aria-hidden="true" />
                      {vendor.responseMinutes} min
                    </span>
                    <span>
                      <Wallet size={15} aria-hidden="true" />
                      From {currency.format(vendor.minPrice)}
                    </span>
                    <span>
                      <Users size={15} aria-hidden="true" />
                      Up to {vendor.maxGuests}
                    </span>
                  </div>
                  <div className="tag-row">
                    {vendor.badges.slice(0, 2).map((badge) => (
                      <span key={badge}>{badge}</span>
                    ))}
                  </div>
                  <span className="vendor-card-action">
                    View menus and pricing
                    <ChevronRight size={18} aria-hidden="true" />
                  </span>
                </div>
              </button>
            ))}
            {rankedVendors.length === 0 && (
              <div className="empty-results">
                <Search size={26} aria-hidden="true" />
                <h3>No caterers match this search</h3>
                <p>Try another area, date, event type, dietary choice, or budget.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="booking-column" id="selected-caterer" aria-label="Selected caterer and payment">
          {selectedVendor ? (
            <div className="vendor-detail-stack" key={selectedVendor.id}>
          <section className="profile-panel">
            <div className="storefront-overview">
              <div className="profile-hero-media">
                <img src={displayImageSrc(selectedVendor.image)} alt={`${selectedVendor.name} catering`} />
                <div className="profile-hero-badges">
                  <span>
                    <Star size={14} fill="currentColor" aria-hidden="true" />
                    {selectedVendor.rating > 0 ? selectedVendor.rating.toFixed(1) : 'New'}
                  </span>
                  <span>
                    <BadgeCheck size={14} aria-hidden="true" /> Verified caterer
                  </span>
                </div>
              </div>
              <div className="profile-body storefront-summary">
                <div className="storefront-title-row">
                  <p className="eyebrow">Selected caterer</p>
                  <StatusPill
                    label={vendorStatusMeta[selectedVendor.status].label}
                    tone={vendorStatusMeta[selectedVendor.status].tone}
                  />
                </div>
                <h2>{selectedVendor.name}</h2>
                <p className="storefront-cuisine">{selectedVendor.cuisine}</p>
                <p className="storefront-address">
                  <MapPin size={16} aria-hidden="true" />
                  {selectedVendor.address}
                </p>
                <div className="storefront-rating-line">
                  <strong>
                    <Star size={15} fill="currentColor" aria-hidden="true" />
                    {selectedVendor.rating > 0 ? selectedVendor.rating.toFixed(1) : 'New'}
                  </strong>
                  <span>{selectedVendor.reviewCount} verified reviews</span>
                </div>
                <div className="storefront-starting-price">
                  <span>Menus start from</span>
                  <strong>{currency.format(selectedVendor.minPrice)} per guest</strong>
                </div>
              </div>
            </div>

            <div className="storefront-highlights" aria-label="Caterer booking facts">
              <div>
                <Clock3 size={19} aria-hidden="true" />
                <span>
                  <strong>{selectedVendor.responseMinutes} min</strong>
                  Typical response
                </span>
              </div>
              <div>
                <Users size={19} aria-hidden="true" />
                <span>
                  <strong>Up to {selectedVendor.maxGuests}</strong>
                  Guest capacity
                </span>
              </div>
              <div>
                <MapPin size={19} aria-hidden="true" />
                <span>
                  <strong>{selectedVendor.serviceRadius} km</strong>
                  Service radius
                </span>
              </div>
            </div>

            {selectedVendor.packages.length > 0 && (
              <div className="storefront-gallery">
                <div className="storefront-section-head">
                  <div>
                    <p className="eyebrow">Food and setups</p>
                    <h3>Popular event menus</h3>
                  </div>
                  <span>{selectedVendor.packages.length} collections</span>
                </div>
                <div className="storefront-gallery-grid">
                  {selectedVendor.packages.slice(0, 3).map((pack) => (
                    <button
                      type="button"
                      key={pack.id}
                      onClick={() => setSelectedPackageId(pack.id)}
                      className={selectedPackage?.id === pack.id ? 'selected' : ''}
                      aria-label={`Choose ${pack.title}`}
                    >
                      <img src={displayImageSrc(pack.image)} alt={`${pack.title} event menu`} />
                      <span>{pack.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="storefront-services">
              <div>
                <span className="storefront-service-icon"><ChefHat size={18} aria-hidden="true" /></span>
                <div>
                  <strong>Event specialities</strong>
                  <div className="storefront-tag-list">
                    {selectedVendor.eventTypes.slice(0, 4).map((eventType) => (
                      <span key={eventType}>{eventType}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <span className="storefront-service-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
                <div>
                  <strong>Food preferences</strong>
                  <div className="storefront-tag-list dietary">
                    {selectedVendor.dietary.slice(0, 4).map((preference) => (
                      <span key={preference}>{preference}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="storefront-license">
                <span>
                  <FileCheck2 size={15} aria-hidden="true" />
                  {selectedVendor.license}
                </span>
                <span>
                  <BadgeCheck size={15} aria-hidden="true" />
                  Documents verified
                </span>
              </div>
            </div>
          </section>

          <section className="package-picker">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Build your event</p>
                <h2>Choose a package</h2>
              </div>
              <StatusPill label={`${selectedVendor.packages.length} menus`} tone="notice" />
            </div>
            <div className="package-list">
              {selectedVendor.packages.map((pack) => (
                <button
                  className={`package-option ${selectedPackage?.id === pack.id ? 'selected' : ''}`}
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPackageId(pack.id)}
                >
                  <img src={displayImageSrc(pack.image)} alt={`${pack.title} package`} />
                  <span>
                    <strong>{pack.title}</strong>
                    <small>
                      {currency.format(pack.pricePerGuest)} per guest · min {pack.minGuests}
                    </small>
                  </span>
                  <span className={`package-mode ${pack.instantBook ? 'instant' : 'quote'}`}>
                    {pack.instantBook ? 'Instant payment' : 'Quote first'}
                  </span>
                </button>
              ))}
            </div>

            {selectedPackage && (
              <div className="checkout" key={selectedPackage.id}>
                <h3>{selectedPackage.title}</h3>
                <p>{selectedPackage.description}</p>
                <div className="tag-row">
                  {selectedPackage.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <ul className="menu-items">
                  {selectedPackage.items.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="booking-fields">
                  <label>
                    <span>Guests</span>
                    <input
                      min={selectedPackage.minGuests}
                      type="number"
                      value={bookingDraft.guests}
                      onChange={(event) => updateBookingDraft('guests', Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>Date</span>
                    <input
                      min={todayIso}
                      type="date"
                      value={bookingDraft.date}
                      onChange={(event) => updateBookingDraft('date', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Payment</span>
                    <select
                      value={bookingDraft.paymentChoice}
                      onChange={(event) =>
                        updateBookingDraft('paymentChoice', event.target.value as 'deposit' | 'full')
                      }
                    >
                      <option value="deposit">30% deposit</option>
                      <option value="full">Full amount</option>
                    </select>
                  </label>
                </div>

                <div className="addons">
                  {addOns.map((item) => (
                    <label key={item.id}>
                      <input
                        checked={bookingDraft.addOns.includes(item.id)}
                        type="checkbox"
                        onChange={() => toggleAddOn(item.id)}
                      />
                      <span>{item.name}</span>
                      <strong>{currency.format(item.price)}</strong>
                    </label>
                  ))}
                </div>

                <label className="note-field">
                  <span>Notes for vendor</span>
                  <textarea
                    value={bookingDraft.note}
                    onChange={(event) => updateBookingDraft('note', event.target.value)}
                    placeholder="Cuisine preferences, venue rules, serving style"
                  />
                </label>

                {error && (
                  <p className="form-error">
                    <AlertCircle size={16} aria-hidden="true" />
                    {error}
                  </p>
                )}

                <div className="total-row">
                  <span>
                    Package + add-ons
                    <small>Add-ons: {currency.format(selectedAddOnTotal)}</small>
                  </span>
                  <strong>{currency.format(bookingTotal)}</strong>
                </div>
                {!selectedPackage.instantBook && (
                  <div className="quote-required-note">
                    <MessageCircle size={17} aria-hidden="true" />
                    <span>
                      <strong>Vendor quote required</strong>
                      <small>Send a quote request first. You can pay from Bookings after the vendor accepts.</small>
                    </span>
                  </div>
                )}
                <div className="action-row">
                  <button
                    type="button"
                    className={selectedPackage.instantBook ? 'secondary-btn' : 'primary-btn'}
                    onClick={() => createBooking('quote')}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    Request quote
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => createBooking('instant')}
                    disabled={!selectedPackage.instantBook}
                    title={
                      selectedPackage.instantBook
                        ? 'Pay now and confirm this booking'
                        : 'This package needs vendor approval before payment'
                    }
                  >
                    <CreditCard size={16} aria-hidden="true" />
                    {selectedPackage.instantBook ? `Pay ${currency.format(depositAmount)}` : 'Pay after quote'}
                  </button>
                </div>
              </div>
            )}
          </section>
            </div>
          ) : (
            <section className="profile-panel empty-profile">
              <Search size={28} aria-hidden="true" />
              <p className="eyebrow">Vendor profile</p>
              <h2>No vendor selected</h2>
              <p>Search with a different location, date, event type, dietary choice, or budget.</p>
            </section>
          )}
        </aside>
      </section>
    </>
  )
}

function CustomerBookings({
  bookings,
  packageForBooking,
  chatDrafts,
  reviewDrafts,
  setChatDrafts,
  setReviewDrafts,
  sendMessage,
  customerPayment,
  markCompleted,
  leaveReview,
}: {
  bookings: Booking[]
  packageForBooking: (booking: Booking) => { vendor?: Vendor; pack?: CaterPackage }
  chatDrafts: Record<string, string>
  reviewDrafts: Record<string, string>
  setChatDrafts: (value: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void
  setReviewDrafts: (value: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void
  sendMessage: (bookingId: string, from: 'customer' | 'vendor') => void
  customerPayment: (bookingId: string) => void
  markCompleted: (bookingId: string) => void
  leaveReview: (bookingId: string) => void
}) {
  const payableBookings = bookings.filter(
    (booking) => booking.status === 'accepted' || booking.status === 'countered',
  )

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customer</p>
          <h1>Booking history</h1>
        </div>
        <StatusPill label={`${bookings.length} records`} tone="neutral" />
      </div>
      {payableBookings.length > 0 && (
        <div className="payment-banner">
          {payableBookings.map((booking) => {
            const { vendor, pack } = packageForBooking(booking)
            const dueNow =
              booking.paymentChoice === 'full' ? booking.amount : Math.ceil(booking.amount * 0.3)
            return (
              <article key={`pay-${booking.id}`}>
                <div>
                  <p className="eyebrow">Payment ready</p>
                  <h2>{booking.id}</h2>
                  <p>
                    {pack?.title ?? 'Custom package'} with {vendor?.name ?? 'vendor'} ·{' '}
                    {formatDate(booking.date)}
                  </p>
                </div>
                <div className="payment-banner-total">
                  <span>Due now</span>
                  <strong>{currency.format(dueNow)}</strong>
                </div>
                <button type="button" className="primary-btn" onClick={() => customerPayment(booking.id)}>
                  <CreditCard size={16} aria-hidden="true" />
                  Pay now
                </button>
              </article>
            )
          })}
        </div>
      )}
      <div className="booking-list">
        {bookings.map((booking) => {
          const { vendor, pack } = packageForBooking(booking)
          const status = bookingStatusMeta[booking.status]
          return (
            <article className="booking-card" key={booking.id}>
              <div className="booking-summary">
                <img src={displayImageSrc(pack?.image)} alt={`${pack?.title ?? 'Catering'} booking`} />
                <div>
                  <div className="vendor-card-top">
                    <div>
                      <h2>{booking.id}</h2>
                      <p>{pack?.title ?? 'Custom package'} with {vendor?.name ?? 'vendor'}</p>
                    </div>
                    <StatusPill label={status.label} tone={status.tone} />
                  </div>
                  <div className="vendor-meta">
                    <span>
                      <CalendarDays size={15} aria-hidden="true" />
                      {formatDate(booking.date)}
                    </span>
                    <span>
                      <Users size={15} aria-hidden="true" />
                      {booking.guests} guests
                    </span>
                    <span>
                      <Wallet size={15} aria-hidden="true" />
                      {currency.format(booking.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="booking-detail-grid">
                <div>
                  <h3>Timeline</h3>
                  <ol className="timeline">
                    {booking.timeline.map((item) => (
                      <li key={`${booking.id}-${item}`}>{item}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3>Chat</h3>
                  <div className="chat-box">
                    {booking.messages.length === 0 && <p className="empty">No messages yet.</p>}
                    {booking.messages.map((message) => (
                      <p className={`message ${message.from}`} key={`${message.time}-${message.text}`}>
                        <span>{message.from}</span>
                        {message.text}
                      </p>
                    ))}
                  </div>
                  <div className="inline-form">
                    <input
                      value={chatDrafts[booking.id] ?? ''}
                      onChange={(event) =>
                        setChatDrafts((current) => ({ ...current, [booking.id]: event.target.value }))
                      }
                      placeholder="Message vendor"
                    />
                    <button type="button" onClick={() => sendMessage(booking.id, 'customer')} title="Send message">
                      <Send size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="action-row">
                {(booking.status === 'accepted' || booking.status === 'countered') && (
                  <button type="button" className="primary-btn" onClick={() => customerPayment(booking.id)}>
                    <CreditCard size={16} aria-hidden="true" />
                    Pay now
                  </button>
                )}
                {booking.status === 'confirmed' && (
                  <button type="button" className="secondary-btn" onClick={() => markCompleted(booking.id)}>
                    <ClipboardCheck size={16} aria-hidden="true" />
                    Mark received
                  </button>
                )}
                {booking.status === 'completed' && !booking.review && (
                  <div className="review-row">
                    <input
                      value={reviewDrafts[booking.id] ?? ''}
                      onChange={(event) =>
                        setReviewDrafts((current) => ({
                          ...current,
                          [booking.id]: event.target.value,
                        }))
                      }
                      placeholder="Review"
                    />
                    <button type="button" className="primary-btn" onClick={() => leaveReview(booking.id)}>
                      <Star size={16} aria-hidden="true" />
                      5-star review
                    </button>
                  </div>
                )}
                {booking.review && (
                  <p className="review-text">
                    <Star size={16} fill="currentColor" aria-hidden="true" />
                    {booking.review.text}
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function VendorDashboard({
  vendor,
  vendorBookings,
  packageForBooking,
  application,
  setApplication,
  submitApplication,
  uploadApplicationBanner,
  uploadApplicationDocument,
  previewApplicationDocument,
  newPackage,
  setNewPackage,
  addPackage,
  vendorDecision,
  markCompleted,
  chatDrafts,
  setChatDrafts,
  sendMessage,
  confirmedRevenue,
  error,
}: {
  vendor: Vendor
  vendorBookings: Booking[]
  packageForBooking: (booking: Booking) => { vendor?: Vendor; pack?: CaterPackage }
  application: VendorApplication
  setApplication: (
    value: VendorApplication | ((current: VendorApplication) => VendorApplication),
  ) => void
  submitApplication: (event: FormEvent<HTMLFormElement>) => void
  uploadApplicationBanner: (event: ChangeEvent<HTMLInputElement>) => void
  uploadApplicationDocument: (
    key: ApplicationDocumentKey,
    event: ChangeEvent<HTMLInputElement>,
  ) => void
  previewApplicationDocument: (document: UploadedDocument) => void
  newPackage: { title: string; price: string; guests: string; tag: string }
  setNewPackage: (
    value:
      | { title: string; price: string; guests: string; tag: string }
      | ((current: { title: string; price: string; guests: string; tag: string }) => {
          title: string
          price: string
          guests: string
          tag: string
        }),
  ) => void
  addPackage: (event: FormEvent<HTMLFormElement>) => void
  vendorDecision: (bookingId: string, decision: 'accept' | 'counter' | 'decline') => void
  markCompleted: (bookingId: string) => void
  chatDrafts: Record<string, string>
  setChatDrafts: (value: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void
  sendMessage: (bookingId: string, from: 'customer' | 'vendor') => void
  confirmedRevenue: number
  error: string
}) {
  const activeRequests = vendorBookings.filter(
    (booking) =>
      booking.status === 'quote-sent' ||
      booking.status === 'countered' ||
      booking.status === 'accepted',
  )
  const onboardingDraft = isVendorOnboardingDraft(vendor)
  const dashboardTitle = onboardingDraft ? 'Complete vendor onboarding' : vendor.name
  const dashboardStatus = onboardingDraft
    ? { label: 'Onboarding pending', tone: 'notice' }
    : vendorStatusMeta[vendor.status]
  const effectiveDocuments = documentsForApplication(application.documents, vendor.documents)
  const requiredDocumentsMissing = applicationDocumentItems.some(
    (item) => item.required && !effectiveDocuments[item.key],
  )
  const rejectedDocuments = Object.values(effectiveDocuments).filter(
    (document) => document?.status === 'rejected',
  )
  const missingDocumentCount = applicationDocumentItems.filter((item) => !effectiveDocuments[item.key]).length
  const adminRequestedAction =
    vendor.status === 'needs-info' && (requiredDocumentsMissing || rejectedDocuments.length > 0 || missingDocumentCount > 0)
  const canSubmitApplication = onboardingDraft || vendor.status === 'rejected' || adminRequestedAction
  const applicationStatusMessage = onboardingDraft
    ? 'Complete the missing business details and required uploads.'
    : vendor.status === 'approved'
      ? 'Application approved. Verified business details and approved documents are locked.'
      : vendor.status === 'pending'
        ? 'Application already submitted. Admin review is in progress.'
        : canSubmitApplication
          ? 'Admin requested corrected or missing items before the next review.'
          : 'Application details are saved in the database.'
  const isApplicationLocked = vendor.status === 'approved' || vendor.status === 'pending'
  const isBusinessNameLocked =
    isApplicationLocked || (!onboardingDraft && Boolean(vendor.name.trim()) && vendor.name !== 'Complete vendor onboarding')
  const isCuisineLocked = isApplicationLocked || (!onboardingDraft && Boolean(vendor.cuisine.trim()))
  const isPincodeLocked = isApplicationLocked || (!onboardingDraft && Boolean(vendor.pincode.trim()))
  const isRadiusLocked = isApplicationLocked || (!onboardingDraft && vendor.serviceRadius > 0)
  const isLicenseLocked =
    isApplicationLocked || (!onboardingDraft && Boolean(vendor.license.trim()) && vendor.license !== onboardingDraftLicense)

  const updateApplication = <Key extends keyof VendorApplication>(
    key: Key,
    value: VendorApplication[Key],
  ) => {
    setApplication((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Vendor operations</p>
          <h1>{dashboardTitle}</h1>
        </div>
        <StatusPill label={dashboardStatus.label} tone={dashboardStatus.tone} />
      </div>

      {!onboardingDraft && <div className="metrics-grid">
        <Metric
          icon={<Wallet size={20} aria-hidden="true" />}
          label="Confirmed revenue"
          value={currency.format(confirmedRevenue)}
          detail="Across marketplace bookings"
        />
        <Metric
          icon={<PackagePlus size={20} aria-hidden="true" />}
          label="Live packages"
          value={`${vendor.packages.length}`}
          detail={`Starting at ${currency.format(vendor.minPrice)}`}
        />
        <Metric
          icon={<MessageCircle size={20} aria-hidden="true" />}
          label="Open requests"
          value={`${activeRequests.length}`}
          detail={`${vendor.responseMinutes} min response target`}
        />
        <Metric
          icon={<MapPin size={20} aria-hidden="true" />}
          label="Service area"
          value={`${vendor.serviceRadius} km`}
          detail={vendor.servicePincodes.join(', ')}
        />
      </div>}

      <div className={`operations-grid ${onboardingDraft ? 'onboarding-only' : ''}`}>
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Onboarding</p>
              <h2>Vendor application</h2>
            </div>
          </div>
          {onboardingDraft && (
            <p className="admin-note">
              Add your business details and required documents. This profile is stored in the database and is not visible to customers until admin approval.
            </p>
          )}
          <form className="stack-form" onSubmit={submitApplication}>
            {!onboardingDraft && (
              <div className={`application-state ${canSubmitApplication ? 'needs-action' : 'locked'}`}>
                <StatusPill label={dashboardStatus.label} tone={dashboardStatus.tone} />
                <span>{applicationStatusMessage}</span>
              </div>
            )}
            <label>
              <span>Business name</span>
              <input
                value={application.businessName}
                readOnly={isBusinessNameLocked}
                onChange={(event) => updateApplication('businessName', event.target.value)}
              />
            </label>
            <label>
              <span>Cuisine</span>
              <input
                value={application.cuisine}
                readOnly={isCuisineLocked}
                onChange={(event) => updateApplication('cuisine', event.target.value)}
              />
            </label>
            <div className="two-fields">
              <label>
                <span>Pincode</span>
                <input
                  value={application.pincode}
                  readOnly={isPincodeLocked}
                  onChange={(event) => updateApplication('pincode', event.target.value)}
                />
              </label>
              <label>
                <span>Radius km</span>
                <input
                  min={1}
                  type="number"
                  value={application.radius}
                  readOnly={isRadiusLocked}
                  onChange={(event) => updateApplication('radius', Number(event.target.value))}
                />
              </label>
            </div>
            <label>
              <span>License number</span>
              <input
                value={application.license}
                readOnly={isLicenseLocked}
                onChange={(event) => updateApplication('license', event.target.value)}
              />
            </label>
            <div className="banner-upload">
              <div className="banner-preview">
                <img
                  src={displayImageSrc(application.bannerImage || applicationFallbackImages[0])}
                  alt={`${application.businessName || 'Vendor'} banner preview`}
                />
              </div>
              <label className="file-upload">
                <UploadCloud size={16} aria-hidden="true" />
                <span>Upload banner</span>
                <input accept="image/*" type="file" onChange={uploadApplicationBanner} />
              </label>
            </div>
            <div className="docs-list">
              {applicationDocumentItems.map((item) => {
                const uploadedDocument = effectiveDocuments[item.key]
                const documentStatus = uploadedDocument?.status ?? 'pending'
                const isApprovedDocument = documentStatus === 'approved'
                const canUploadDocument = !uploadedDocument || documentStatus === 'rejected'
                return (
                  <div
                    className={`doc-upload-row ${uploadedDocument ? 'uploaded' : ''} ${
                      isApprovedDocument ? 'approved' : ''
                    }`}
                    key={item.key}
                  >
                    <div className="doc-upload-info">
                      {uploadedDocument ? (
                        <FileCheck2 size={18} aria-hidden="true" />
                      ) : (
                        <UploadCloud size={18} aria-hidden="true" />
                      )}
                      <span>
                        <strong>{item.label}</strong>
                        <small>
                          {uploadedDocument
                            ? uploadedDocument.name
                            : item.required
                              ? 'Required PDF, PNG, or JPG'
                              : 'Optional PDF, PNG, or JPG'}
                        </small>
                        {uploadedDocument && (
                          <small className={`doc-status-text ${documentStatus}`}>
                            {documentStatusMeta[documentStatus].label}
                          </small>
                        )}
                        {uploadedDocument?.status === 'rejected' && (
                          <small className="doc-rejection-reason">
                            Rejected: {uploadedDocument.rejectionReason || 'Admin requested a corrected document.'}
                          </small>
                        )}
                      </span>
                    </div>
                    <div className="doc-upload-actions">
                      {uploadedDocument && (
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => previewApplicationDocument(uploadedDocument)}
                        >
                          <FileText size={15} aria-hidden="true" />
                          Preview
                        </button>
                      )}
                      {canUploadDocument ? (
                        <label className="doc-upload-btn">
                          <UploadCloud size={15} aria-hidden="true" />
                          {uploadedDocument ? 'Replace' : 'Upload'}
                          <input
                            accept={documentUploadAccept}
                            type="file"
                            onChange={(event) => uploadApplicationDocument(item.key, event)}
                          />
                        </label>
                      ) : (
                        <span className="doc-approved-lock">
                          {isApprovedDocument ? (
                            <CheckCircle2 size={15} aria-hidden="true" />
                          ) : (
                            <FileCheck2 size={15} aria-hidden="true" />
                          )}
                          {documentStatusMeta[documentStatus].label}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {error && (
              <p className="form-error">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </p>
            )}
            {canSubmitApplication && (
              <button type="submit" className="primary-btn">
                <ClipboardCheck size={16} aria-hidden="true" />
                {onboardingDraft ? 'Submit for review' : 'Submit updated review'}
              </button>
            )}
          </form>
        </section>

        {!onboardingDraft && <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Menus</p>
              <h2>Package manager</h2>
            </div>
          </div>
          <form className="stack-form" onSubmit={addPackage}>
            <label>
              <span>Package title</span>
              <input
                value={newPackage.title}
                onChange={(event) =>
                  setNewPackage((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <div className="two-fields">
              <label>
                <span>Price per guest</span>
                <input
                  min={1}
                  type="number"
                  value={newPackage.price}
                  onChange={(event) =>
                    setNewPackage((current) => ({ ...current, price: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Min guests</span>
                <input
                  min={1}
                  type="number"
                  value={newPackage.guests}
                  onChange={(event) =>
                    setNewPackage((current) => ({ ...current, guests: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              <span>Tag</span>
              <input
                value={newPackage.tag}
                onChange={(event) =>
                  setNewPackage((current) => ({ ...current, tag: event.target.value }))
                }
              />
            </label>
            <button type="submit" className="primary-btn">
              <PackagePlus size={16} aria-hidden="true" />
              Add package
            </button>
          </form>
          <div className="mini-list">
            {vendor.packages.map((pack) => (
              <div key={pack.id}>
                <strong>{pack.title}</strong>
                <span>{currency.format(pack.pricePerGuest)} · min {pack.minGuests}</span>
              </div>
            ))}
          </div>
        </section>}
      </div>

      {!onboardingDraft && <section className="panel wide-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Requests</p>
            <h2>Booking operations</h2>
          </div>
        </div>
        <div className="booking-list vendor-bookings">
          {vendorBookings.length === 0 && <p className="empty">No bookings yet.</p>}
          {vendorBookings.map((booking) => {
            const { pack } = packageForBooking(booking)
            const status = bookingStatusMeta[booking.status]
            return (
              <article className="booking-card" key={booking.id}>
                <div className="vendor-card-top">
                  <div>
                    <h2>{booking.id}</h2>
                    <p>{pack?.title ?? 'Custom package'} · {booking.guests} guests · {formatDate(booking.date)}</p>
                  </div>
                  <StatusPill label={status.label} tone={status.tone} />
                </div>
                <p>{booking.note || 'No special notes.'}</p>
                <div className="action-row">
                  {booking.status === 'quote-sent' && (
                    <>
                      <button type="button" className="primary-btn" onClick={() => vendorDecision(booking.id, 'accept')}>
                        <CheckCircle2 size={16} aria-hidden="true" />
                        Accept
                      </button>
                      <button type="button" className="secondary-btn" onClick={() => vendorDecision(booking.id, 'counter')}>
                        <MessageCircle size={16} aria-hidden="true" />
                        Counter
                      </button>
                      <button type="button" className="ghost-btn danger" onClick={() => vendorDecision(booking.id, 'decline')}>
                        <XCircle size={16} aria-hidden="true" />
                        Decline
                      </button>
                    </>
                  )}
                  {booking.status === 'confirmed' && (
                    <button type="button" className="secondary-btn" onClick={() => markCompleted(booking.id)}>
                      <ClipboardCheck size={16} aria-hidden="true" />
                      Mark completed
                    </button>
                  )}
                </div>
                <div className="inline-form">
                  <input
                    value={chatDrafts[booking.id] ?? ''}
                    onChange={(event) =>
                      setChatDrafts((current) => ({ ...current, [booking.id]: event.target.value }))
                    }
                    placeholder="Message customer"
                  />
                  <button type="button" onClick={() => sendMessage(booking.id, 'vendor')} title="Send message">
                    <Send size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>}
    </section>
  )
}

function AdminPanel({
  vendors,
  bookings,
  updateVendorStatus,
  updateDocumentStatus,
  requestDocumentRejection,
  requestDocumentReupload,
  requestDocumentDelete,
  previewDocument,
}: {
  vendors: Vendor[]
  bookings: Booking[]
  updateVendorStatus: (vendorId: string, status: VendorStatus, adminNote?: string) => void
  updateDocumentStatus: (
    documentId: string,
    status: DocumentApprovalStatus,
    rejectionReason?: string,
  ) => void
  requestDocumentRejection: (document: UploadedDocument) => void
  requestDocumentReupload: (document: UploadedDocument) => void
  requestDocumentDelete: (document: UploadedDocument) => void
  previewDocument: (document: UploadedDocument) => void
}) {
  const [vendorQuery, setVendorQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | VendorStatus>('all')
  const reviewVendors = useMemo(() => dedupeAdminVendorRecords(vendors), [vendors])
  const visiblePendingVendors = reviewVendors.filter((vendor) => vendor.status !== 'approved')
  const confirmed = bookings.filter(
    (booking) => booking.status === 'confirmed' || booking.status === 'completed',
  ).length
  const pendingDocumentChecks = reviewVendors.reduce(
    (total, vendor) =>
      total +
      Object.values(vendor.documents ?? {}).filter((document) => document?.status !== 'approved').length,
    0,
  )
  const filteredVendors = useMemo(() => {
    const query = vendorQuery.trim().toLowerCase()
    const reviewPriority: Record<VendorStatus, number> = {
      pending: 0,
      'needs-info': 1,
      rejected: 2,
      approved: 3,
    }
    return reviewVendors
      .filter((vendor) => {
        const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter
        const matchesQuery =
          !query ||
          vendorSearchText(vendor).includes(query) ||
          vendor.license.toLowerCase().includes(query)
        return matchesStatus && matchesQuery
      })
      .sort((first, second) => {
        const firstOpenDocs = Object.values(first.documents ?? {}).filter(
          (document) => document?.status !== 'approved',
        ).length
        const secondOpenDocs = Object.values(second.documents ?? {}).filter(
          (document) => document?.status !== 'approved',
        ).length
        return (
          secondOpenDocs - firstOpenDocs ||
          reviewPriority[first.status] - reviewPriority[second.status] ||
          first.name.localeCompare(second.name)
        )
      })
  }, [reviewVendors, statusFilter, vendorQuery])

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Marketplace control room</h1>
        </div>
        <StatusPill label={`${visiblePendingVendors.length} checks open`} tone={visiblePendingVendors.length ? 'warning' : 'success'} />
      </div>

      <div className="metrics-grid">
        <Metric
          icon={<Store size={20} aria-hidden="true" />}
          label="Total vendors"
          value={`${reviewVendors.length}`}
          detail={`${reviewVendors.filter(isCustomerVisibleVendor).length} customer-visible`}
        />
        <Metric
          icon={<ClipboardCheck size={20} aria-hidden="true" />}
          label="Confirmed bookings"
          value={`${confirmed}`}
          detail={`${bookings.length} total booking records`}
        />
        <Metric
          icon={<ShieldCheck size={20} aria-hidden="true" />}
          label="Document checks"
          value={`${pendingDocumentChecks}`}
          detail="License, ID, insurance"
        />
        <Metric
          icon={<Wallet size={20} aria-hidden="true" />}
          label="Commission ledger"
          value={currency.format(bookings.reduce((total, booking) => total + booking.amount * 0.12, 0))}
          detail="Estimated at 12%"
        />
      </div>

      <div className="admin-review-toolbar">
        <label className="admin-search-field">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={vendorQuery}
            onChange={(event) => setVendorQuery(event.target.value)}
            placeholder="Search vendor, owner, pincode, cuisine, or license"
          />
        </label>
        <select
          aria-label="Filter vendors by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | VendorStatus)}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending review</option>
          <option value="needs-info">Needs info</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <StatusPill label={`${filteredVendors.length} shown`} tone="neutral" />
      </div>

      <div className="admin-grid compact">
        {filteredVendors.map((vendor) => {
          const meta = vendorStatusMeta[vendor.status]
          const uploadedCount = Object.values(vendor.documents ?? {}).filter(Boolean).length
          const openDocumentCount = Object.values(vendor.documents ?? {}).filter(
            (document) => document?.status !== 'approved',
          ).length
          return (
            <details className="admin-card admin-review" key={vendor.id}>
              <summary className="admin-review-summary">
                <div>
                  <h2>{vendor.name}</h2>
                  <p>{vendor.owner} · {vendor.cuisine || 'Onboarding'} · {vendor.pincode}</p>
                </div>
                <div className="admin-review-summary-meta">
                  <span>{uploadedCount} uploaded</span>
                  {openDocumentCount > 0 && <strong>{openDocumentCount} need review</strong>}
                  <StatusPill label={meta.label} tone={meta.tone} />
                </div>
              </summary>
              <div className="admin-review-body">
                <div className="admin-vendor-facts">
                  <span><FileCheck2 size={15} aria-hidden="true" /> {vendor.license}</span>
                  <span><MapPin size={15} aria-hidden="true" /> {vendor.address}</span>
                </div>
                <div className="docs-list readonly">
                {applicationDocumentItems.map((item) => {
                  const uploadedDocument = vendor.documents?.[item.key]
                  const isPresent = Boolean(uploadedDocument?.id) || vendor.docs.includes(item.label)
                  const documentStatus = uploadedDocument?.status ?? 'pending'
                  const documentMeta = documentStatusMeta[documentStatus]
                  return (
                    <div className={`admin-doc-card ${isPresent ? 'present' : 'missing'}`} key={item.key}>
                      <div className="admin-doc-main">
                        {isPresent ? (
                          <FileText size={17} aria-hidden="true" />
                        ) : (
                          <AlertCircle size={17} aria-hidden="true" />
                        )}
                        <span>
                          <strong>{item.label}</strong>
                          <small>{uploadedDocument?.name ?? 'Not uploaded yet'}</small>
                        </span>
                      </div>
                      <StatusPill
                        label={isPresent ? documentMeta.label : 'Missing'}
                        tone={isPresent ? documentMeta.tone : 'danger'}
                      />
                      {uploadedDocument?.id && (
                        <div className="admin-doc-actions">
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => previewDocument(uploadedDocument)}
                          >
                            <FileText size={15} aria-hidden="true" />
                            Preview
                          </button>
                          {documentStatus !== 'approved' && (
                            <button
                              type="button"
                              className="primary-btn"
                              onClick={() => updateDocumentStatus(uploadedDocument.id!, 'approved')}
                            >
                              <BadgeCheck size={15} aria-hidden="true" />
                              Approve doc
                            </button>
                          )}
                          {documentStatus !== 'rejected' && (
                            <button
                              type="button"
                              className="ghost-btn danger"
                              onClick={() => requestDocumentRejection(uploadedDocument)}
                            >
                              <XCircle size={15} aria-hidden="true" />
                              Reject doc
                            </button>
                          )}
                          <button
                            type="button"
                            className="secondary-btn doc-reupload-action"
                            onClick={() => requestDocumentReupload(uploadedDocument)}
                          >
                            <RefreshCw size={15} aria-hidden="true" />
                            Request reupload
                          </button>
                          <button
                            type="button"
                            className="ghost-btn danger"
                            onClick={() => requestDocumentDelete(uploadedDocument)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            Delete doc
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {vendor.adminNote && <p className="admin-note">{vendor.adminNote}</p>}
              <div className="action-row">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => updateVendorStatus(vendor.id, 'approved')}
                >
                  <BadgeCheck size={16} aria-hidden="true" />
                  Approve
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => updateVendorStatus(vendor.id, 'needs-info', 'Please upload missing documents.')}
                >
                  <FileCheck2 size={16} aria-hidden="true" />
                  Need info
                </button>
                <button
                  type="button"
                  className="ghost-btn danger"
                  onClick={() => updateVendorStatus(vendor.id, 'rejected', 'Documents did not pass verification.')}
                >
                  <XCircle size={16} aria-hidden="true" />
                  Reject
                </button>
              </div>
              </div>
            </details>
          )
        })}
        {filteredVendors.length === 0 && (
          <div className="empty-results">
            <Search size={24} aria-hidden="true" />
            <h3>No vendors match this search</h3>
            <p>Try a name, pincode, license number, or a different status.</p>
          </div>
        )}
      </div>
    </section>
  )
}
