export type Role = 'customer' | 'vendor' | 'admin'
export type VendorStatus = 'approved' | 'pending' | 'needs-info' | 'rejected'
export type DocumentApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ApplicationDocumentKey = 'foodLicense' | 'identity' | 'insurance'
export type BookingStatus =
  | 'quote-sent'
  | 'countered'
  | 'accepted'
  | 'payment-due'
  | 'confirmed'
  | 'completed'
  | 'declined'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  vendorId?: string
}

export type AuthSession = {
  token: string
  user: AuthUser
  expiresAt?: number
}

export type UploadedDocument = {
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

export type CaterPackage = {
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

export type GeoPoint = {
  latitude: number
  longitude: number
  label: string
}

export type Vendor = {
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

export type ChatMessage = {
  from: Role
  text: string
  time: string
}

export type Booking = {
  id: string
  customerId?: string
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
  review?: { rating: number; text: string }
}

export type AddOn = { id: string; name: string; price: number }
export type LiveEvent = { id: string; title: string; body: string; time: string }

export type ApiBootstrap = {
  vendors: Vendor[]
  bookings: Booking[]
  addOns: AddOn[]
  user: AuthUser
}

export type AuthenticatedResponse = { token: string; user: AuthUser }
export type MfaChallenge = {
  mfaRequired: true
  challengeId: string
  delivery: string
  expiresAt: string
}
export type AuthResponse = AuthenticatedResponse | MfaChallenge

export type SearchFilters = {
  location: string
  geo: GeoPoint | null
  eventType: string
  date: string
  guests: number
  budget: number
  dietary: string
}

export type VendorApplication = {
  businessName: string
  cuisine: string
  pincode: string
  radius: number
  license: string
  bannerImage?: string
  documents?: Partial<Record<ApplicationDocumentKey, UploadedDocument>>
}
