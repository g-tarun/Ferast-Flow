import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactElement } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  PackagePlus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Store,
  UploadCloud,
  UserRound,
  Users,
  Wallet,
  XCircle,
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

type ApiAuthResponse = {
  token: string
  user: AuthUser
}

const heroImage = '/images/hero-catering.png'
const weddingImage = '/images/wedding-buffet.png'
const corporateImage = '/images/corporate-lunch.png'
const dessertImage = '/images/dessert-station.png'
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
  businessName: 'My Catering Co.',
  cuisine: 'Regional Indian',
  pincode: '560043',
  radius: 18,
  license: 'FSSAI-APP-2026',
  foodLicense: false,
  identity: false,
  insurance: false,
  bannerImage: '',
  documents: {},
}

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

function isCustomerVisibleVendor(vendor: Vendor) {
  return vendor.status === 'approved' && !hasRejectedDocument(vendor)
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

function LoginPage({
  onAuthenticate,
  authError,
}: {
  onAuthenticate: (details: {
    mode: AuthMode
    role: Role
    name: string
    email: string
    password: string
  }) => void
  authError: string
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [role, setRole] = useState<Role>('customer')
  const [name, setName] = useState('Demo Customer')
  const [email, setEmail] = useState(demoAccounts.customer.email)
  const [password, setPassword] = useState(demoAccounts.customer.password)

  const selectRole = (nextRole: Role) => {
    setRole(nextRole)
    const account = demoAccounts[nextRole]
    setName(account.name)
    setEmail(account.email)
    setPassword(account.password)
  }

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onAuthenticate({ mode, role, name, email, password })
  }

  return (
    <main className="auth-page">
      <section className="auth-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="auth-copy">
          <span className="brand-mark">
            <ChefHat size={24} aria-hidden="true" />
          </span>
          <p className="eyebrow">FeastFlow secure access</p>
          <h1>Login to the right catering workspace.</h1>
          <p>
            Customers book events, vendors operate menus and requests, and admins verify the
            marketplace from protected role-based screens.
          </p>
          <div className="auth-proof">
            <span>
              <KeyRound size={16} aria-hidden="true" />
              Secure signed session
            </span>
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              8 hour session expiry
            </span>
            <span>
              <BadgeCheck size={16} aria-hidden="true" />
              Role-scoped navigation
            </span>
          </div>
        </div>
      </section>

      <section className="auth-card" aria-label="Login form">
        <div className="auth-card-head">
          <div>
            <p className="eyebrow">Account</p>
            <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
          </div>
          <div className="auth-toggle" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>
        </div>

        <div className="role-cards" aria-label="Choose role">
          {(['customer', 'vendor', 'admin'] as Role[]).map((item) => (
            <button
              key={item}
              className={role === item ? 'selected' : ''}
              type="button"
              onClick={() => selectRole(item)}
            >
              {item === 'customer' && <UserRound size={18} aria-hidden="true" />}
              {item === 'vendor' && <Store size={18} aria-hidden="true" />}
              {item === 'admin' && <ShieldCheck size={18} aria-hidden="true" />}
              <span>{item}</span>
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={submitAuth}>
          {mode === 'register' && (
            <label>
              <span>Full name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {authError && (
            <p className="form-error">
              <AlertCircle size={16} aria-hidden="true" />
              {authError}
            </p>
          )}

          <button type="submit" className="primary-btn auth-submit">
            <KeyRound size={16} aria-hidden="true" />
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

      </section>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession())
  const [authError, setAuthError] = useState('')
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
    title: 'Seasonal celebration table',
    price: '680',
    guests: '35',
    tag: 'House party',
  })
  const [notificationPermission, setNotificationPermission] = useState<AppNotificationPermission>(() => getNotificationPermission())
  const [previewDocument, setPreviewDocument] = useState<UploadedDocument | null>(null)
  const [documentRejectionTarget, setDocumentRejectionTarget] = useState<UploadedDocument | null>(null)
  const [documentRejectionReason, setDocumentRejectionReason] = useState('')
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
    vendors.find((vendor) => vendor.id === session?.user.vendorId) ??
    vendors.find((vendor) =>
      Object.values(vendor.documents ?? {}).some((document) => document?.uploadedBy === session?.user.id),
    ) ??
    vendors.find((vendor) => vendor.id === 'spice-stem') ??
    vendors[0]
  const pendingVendors = vendors.filter((vendor) => vendor.status !== 'approved')
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

    setApplication((current) => {
      const documents = documentsForApplication(current.documents, currentVendor.documents)
      return {
        ...current,
        businessName:
          current.businessName === initialApplication.businessName ? currentVendor.name : current.businessName,
        cuisine: current.cuisine === initialApplication.cuisine ? currentVendor.cuisine : current.cuisine,
        pincode: current.pincode === initialApplication.pincode ? currentVendor.pincode : current.pincode,
        radius: current.radius === initialApplication.radius ? currentVendor.serviceRadius : current.radius,
        license: current.license === initialApplication.license ? currentVendor.license : current.license,
        bannerImage: current.bannerImage || currentVendor.image,
        foodLicense: Boolean(documents.foodLicense),
        identity: Boolean(documents.identity),
        insurance: Boolean(documents.insurance),
        documents,
      }
    })
  }, [
    role,
    currentVendor?.id,
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
        setSearchResults(null)
        setBackendReady(true)
        setToast('Backend connected. Live data loaded.')
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
    if (!session) return

    const events = new EventSource(`${apiBaseUrl}/api/events?token=${encodeURIComponent(session.token)}`)
    events.addEventListener('marketplace', (event) => {
      const liveEvent = JSON.parse((event as MessageEvent).data) as LiveEvent
      setLiveEvents((currentEvents) => [liveEvent, ...currentEvents].slice(0, 6))
    })
    events.onerror = () => {
      setBackendReady(false)
    }

    return () => events.close()
  }, [session?.token])

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
    if (password.trim().length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }

    const resolvedName =
      mode === 'login'
        ? ''
        : name.trim() || trimmedEmail.split('@')[0] || 'FeastFlow User'
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
      const nextSession = sessionFromToken(response.token)
      if (!nextSession) {
        setAuthError('Unable to create session token.')
        return
      }

      sessionStorage.setItem(sessionTokenKey, response.token)
      setSession(nextSession)
      setSection(defaultSectionForRole(requestedRole))
      setToast(`Welcome back, ${nextSession.user.name}.`)
      setAuthError('')
      setError('')
    } catch (apiError) {
      setAuthError(apiError instanceof Error ? apiError.message : 'Authentication failed.')
    }
  }

  const logout = () => {
    sessionStorage.removeItem(sessionTokenKey)
    setSession(null)
    setVendors([])
    setBookings([])
    setAddOns([])
    setSearchResults(null)
    setApplication(initialApplication)
    setAuthError('')
    setToast('Signed out.')
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
      setApplication((current) => ({ ...current, bannerImage }))
      setError('')
      event.target.value = ''

      if (!session?.token || role !== 'vendor' || !currentVendor?.id) {
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

  const removeApplicationDocument = (key: ApplicationDocumentKey) => {
    setApplication((current) => {
      const documents = { ...(current.documents ?? {}) }
      delete documents[key]
      return {
        ...current,
        [key]: false,
        documents,
      }
    })
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
    return <LoginPage onAuthenticate={handleAuthenticate} authError={authError} />
  }

  return (
    <div className="app-shell">
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
            >
              <ShieldCheck size={17} aria-hidden="true" />
              Admin
            </button>
          )}
        </nav>

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
      </header>

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

      <main>
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
            removeApplicationDocument={removeApplicationDocument}
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
            pendingVendors={pendingVendors}
            bookings={bookings}
            updateVendorStatus={updateVendorStatus}
            updateDocumentStatus={updateDocumentStatus}
            requestDocumentRejection={requestDocumentRejection}
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
  return (
    <>
      <section className="hero-band" style={{ backgroundImage: `url(${heroImage})` }}>
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
              <article
                className={`vendor-card ${selectedVendor?.id === vendor.id ? 'selected' : ''}`}
                key={vendor.id}
              >
                <img src={vendor.image} alt={`${vendor.name} food setup`} />
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
                      <Wallet size={15} aria-hidden="true" />
                      From {currency.format(vendor.minPrice)}
                    </span>
                    <span>
                      <Users size={15} aria-hidden="true" />
                      Up to {vendor.maxGuests}
                    </span>
                  </div>
                  <div className="tag-row">
                    {vendor.badges.map((badge) => (
                      <span key={badge}>{badge}</span>
                    ))}
                  </div>
                  <button type="button" className="primary-btn" onClick={() => chooseVendor(vendor.id)}>
                    <Store size={16} aria-hidden="true" />
                    View packages
                  </button>
                </div>
              </article>
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

        <aside className="booking-column">
          {selectedVendor ? (
            <>
          <section className="profile-panel">
            <img src={selectedVendor.image} alt={`${selectedVendor.name} catering`} />
            <div className="profile-body">
              <div className="vendor-card-top">
                <div>
                  <p className="eyebrow">Vendor profile</p>
                  <h2>{selectedVendor.name}</h2>
                </div>
                <StatusPill
                  label={vendorStatusMeta[selectedVendor.status].label}
                  tone={vendorStatusMeta[selectedVendor.status].tone}
                />
              </div>
              <p>{selectedVendor.address}</p>
              <div className="quick-facts">
                <span>
                  <FileCheck2 size={15} aria-hidden="true" />
                  {selectedVendor.license}
                </span>
                <span>
                  <MessageCircle size={15} aria-hidden="true" />
                  {selectedVendor.responseMinutes} min response
                </span>
                <span>
                  <MapPin size={15} aria-hidden="true" />
                  {selectedVendor.serviceRadius} km service radius
                </span>
              </div>
            </div>
          </section>

          <section className="package-picker">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Packages</p>
                <h2>Menu builder</h2>
              </div>
            </div>
            <div className="package-list">
              {selectedVendor.packages.map((pack) => (
                <button
                  className={`package-option ${selectedPackage?.id === pack.id ? 'selected' : ''}`}
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPackageId(pack.id)}
                >
                  <img src={pack.image} alt={`${pack.title} package`} />
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
              <div className="checkout">
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
            </>
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
                <img src={pack?.image ?? heroImage} alt={`${pack?.title ?? 'Catering'} booking`} />
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
  removeApplicationDocument,
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
  removeApplicationDocument: (key: ApplicationDocumentKey) => void
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
          <h1>{vendor.name}</h1>
        </div>
        <StatusPill label={vendorStatusMeta[vendor.status].label} tone={vendorStatusMeta[vendor.status].tone} />
      </div>

      <div className="metrics-grid">
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
      </div>

      <div className="operations-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Onboarding</p>
              <h2>Vendor application</h2>
            </div>
          </div>
          <form className="stack-form" onSubmit={submitApplication}>
            <label>
              <span>Business name</span>
              <input
                value={application.businessName}
                onChange={(event) => updateApplication('businessName', event.target.value)}
              />
            </label>
            <label>
              <span>Cuisine</span>
              <input
                value={application.cuisine}
                onChange={(event) => updateApplication('cuisine', event.target.value)}
              />
            </label>
            <div className="two-fields">
              <label>
                <span>Pincode</span>
                <input
                  value={application.pincode}
                  onChange={(event) => updateApplication('pincode', event.target.value)}
                />
              </label>
              <label>
                <span>Radius km</span>
                <input
                  min={1}
                  type="number"
                  value={application.radius}
                  onChange={(event) => updateApplication('radius', Number(event.target.value))}
                />
              </label>
            </div>
            <label>
              <span>License number</span>
              <input
                value={application.license}
                onChange={(event) => updateApplication('license', event.target.value)}
              />
            </label>
            <div className="banner-upload">
              <div className="banner-preview">
                <img
                  src={application.bannerImage || applicationFallbackImages[0]}
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
                const uploadedDocument = documentsForApplication(application.documents, vendor.documents)[item.key]
                const documentStatus = uploadedDocument?.status ?? 'pending'
                const isApprovedDocument = documentStatus === 'approved'
                const canReplaceDocument = !isApprovedDocument
                const canRemoveDocument = Boolean(uploadedDocument?.dataUrl && !uploadedDocument.id && !isApprovedDocument)
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
                      {canRemoveDocument && (
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => removeApplicationDocument(item.key)}
                        >
                          <XCircle size={15} aria-hidden="true" />
                          Remove
                        </button>
                      )}
                      {canReplaceDocument ? (
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
                          <CheckCircle2 size={15} aria-hidden="true" />
                          Approved
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
            <button type="submit" className="primary-btn">
              <ClipboardCheck size={16} aria-hidden="true" />
              Submit for review
            </button>
          </form>
        </section>

        <section className="panel">
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
        </section>
      </div>

      <section className="panel wide-panel">
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
      </section>
    </section>
  )
}

function AdminPanel({
  vendors,
  pendingVendors,
  bookings,
  updateVendorStatus,
  updateDocumentStatus,
  requestDocumentRejection,
  previewDocument,
}: {
  vendors: Vendor[]
  pendingVendors: Vendor[]
  bookings: Booking[]
  updateVendorStatus: (vendorId: string, status: VendorStatus, adminNote?: string) => void
  updateDocumentStatus: (
    documentId: string,
    status: DocumentApprovalStatus,
    rejectionReason?: string,
  ) => void
  requestDocumentRejection: (document: UploadedDocument) => void
  previewDocument: (document: UploadedDocument) => void
}) {
  const confirmed = bookings.filter(
    (booking) => booking.status === 'confirmed' || booking.status === 'completed',
  ).length
  const pendingDocumentChecks = vendors.reduce(
    (total, vendor) =>
      total +
      Object.values(vendor.documents ?? {}).filter((document) => document?.status !== 'approved').length,
    0,
  )

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Marketplace control room</h1>
        </div>
        <StatusPill label={`${pendingVendors.length} checks open`} tone={pendingVendors.length ? 'warning' : 'success'} />
      </div>

      <div className="metrics-grid">
        <Metric
          icon={<Store size={20} aria-hidden="true" />}
          label="Total vendors"
          value={`${vendors.length}`}
          detail={`${vendors.filter(isCustomerVisibleVendor).length} customer-visible`}
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

      <div className="admin-grid">
        {vendors.map((vendor) => {
          const meta = vendorStatusMeta[vendor.status]
          return (
            <article className="admin-card" key={vendor.id}>
              <div className="vendor-card-top">
                <div>
                  <h2>{vendor.name}</h2>
                  <p>{vendor.owner} · {vendor.cuisine}</p>
                </div>
                <StatusPill label={meta.label} tone={meta.tone} />
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
            </article>
          )
        })}
      </div>
    </section>
  )
}
