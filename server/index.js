import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import path from 'path'
import { fileURLToPath } from 'url'
import { createDatabaseStore, databaseLabel, isMysqlEnabled } from './database.js'

const app = express()
const port = Number(process.env.PORT || process.env.API_PORT || 4000)
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1')
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientDistDirectory = path.resolve(serverDirectory, '../dist')
const jwtSecret = process.env.JWT_SECRET || 'feastflow-local-development-secret'
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '2h'

app.use(cors())
app.use(express.json({ limit: '16mb' }))

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}

const futureDate = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const seedAddOns = () => [
  { id: 'live-counter', name: 'Live counter', price: 18000 },
  { id: 'premium-dessert', name: 'Premium dessert bar', price: 12000 },
  { id: 'service-staff', name: 'Service staff', price: 9000 },
  { id: 'eco-serveware', name: 'Eco serveware', price: 4500 },
]

const demoAccounts = {
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

const extraDemoVendorAccounts = [
  {
    role: 'vendor',
    email: 'vendor-blue@feastflow.test',
    password: 'demo1234',
    name: 'Neha Kapoor',
    vendorId: 'vendor-blue-feastflow-test',
  },
  {
    role: 'vendor',
    email: 'vendor-green@feastflow.test',
    password: 'demo1234',
    name: 'Imran Qureshi',
    vendorId: 'vendor-green-feastflow-test',
  },
  {
    role: 'vendor',
    email: 'vendor-royal@feastflow.test',
    password: 'demo1234',
    name: 'Leela Nair',
    vendorId: 'vendor-royal-feastflow-test',
  },
]

const accountIdFor = (role, email) => `${role}-${email.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`

const seedAccounts = () =>
  [
    ...Object.entries(demoAccounts).map(([role, account]) => ({
      id: accountIdFor(role, account.email),
      email: account.email,
      password: account.password,
      name: account.name,
      role,
      vendorId: account.vendorId,
    })),
    ...extraDemoVendorAccounts.map((account) => ({
      id: accountIdFor(account.role, account.email),
      ...account,
    })),
  ]

const applicationBannerImages = [
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1800&q=80',
]

const pickApplicationBanner = () => applicationBannerImages[Math.floor(Math.random() * applicationBannerImages.length)]
const applicationDocumentItems = {
  foodLicense: 'Food license',
  identity: 'Owner ID',
  insurance: 'Insurance',
}

const sanitizeBannerImage = (bannerImage) => {
  const image = String(bannerImage || '')
  if (image.startsWith('data:image/') && image.length < 3_500_000) return image
  if (applicationBannerImages.includes(image)) return image
  return pickApplicationBanner()
}

const sanitizeUploadedDocument = ({ key, document, vendorId, uploadedBy }) => {
  if (!document || typeof document !== 'object') return null
  const name = String(document.name || '').trim()
  const type = String(document.type || '').trim()
  const dataUrl = String(document.dataUrl || '')
  const size = Number(document.size || 0)
  const isAcceptedType = type.startsWith('image/') || type === 'application/pdf'
  const isAcceptedData = dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:application/pdf')

  if (!name || !isAcceptedType || !isAcceptedData || size <= 0 || size > 2_500_000 || dataUrl.length > 3_500_000) {
    return null
  }

  return {
    id: document.id || makeId('DOC'),
    parentId: vendorId,
    parentType: 'vendor',
    vendorId,
    key,
    documentName: applicationDocumentItems[key] || key,
    name,
    type,
    size,
    dataUrl,
    status: 'pending',
    uploadedBy,
    uploadedAt: document.uploadedAt || new Date().toISOString(),
  }
}

const safeAttachmentName = (fileName) =>
  String(fileName || 'document.pdf')
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .slice(0, 180) || 'document.pdf'

const isMysqlPacketError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return (
    error?.code === 'ER_NET_PACKET_TOO_LARGE' ||
    error?.code === 'ECONNRESET' ||
    message.includes('max_allowed_packet') ||
    message.includes('packet')
  )
}

const applicationVendorIdForUser = (user) => {
  if (user.vendorId && user.vendorId !== 'spice-stem') return user.vendorId
  return `application-${String(user.id || user.email || 'vendor')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 72)}`
}

const seedVendors = () => [
  {
    id: 'spice-stem',
    name: 'Spice & Stem Catering',
    owner: 'Aarav Mehta',
    status: 'approved',
    cuisine: 'Indian, Continental',
    address: 'MG Road, Bengaluru',
    pincode: '560001',
    coordinates: { latitude: 12.9758, longitude: 77.6096, label: 'MG Road, Bengaluru' },
    serviceRadius: 24,
    servicePincodes: ['560001', '560025', '560034', '560043'],
    distanceKm: 3.2,
    rating: 4.8,
    reviewCount: 186,
    responseMinutes: 18,
    minPrice: 650,
    maxGuests: 900,
    license: 'FSSAI-KA-11822002640',
    docs: ['Food license', 'Owner ID', 'Insurance'],
    dietary: ['Vegetarian', 'Vegan', 'Jain', 'Gluten-free'],
    eventTypes: ['Wedding', 'Corporate', 'House party', 'Festival'],
    badges: ['Verified', 'Instant book', 'Top rated'],
    image: '/images/wedding-buffet.png',
    payoutDue: 118000,
    availability: [futureDate(14), futureDate(21), futureDate(35), futureDate(48)],
    packages: [
      {
        id: 'royal-wedding',
        title: 'Royal wedding buffet',
        description: 'Full service buffet with live counters, chaat, mains, breads, desserts, and floor captain.',
        pricePerGuest: 1050,
        minGuests: 80,
        image: '/images/wedding-buffet.png',
        tags: ['Wedding', 'Live counters', 'Vegetarian'],
        instantBook: true,
        items: ['Welcome drinks', '3 starters', '4 mains', 'Assorted breads', '2 desserts'],
      },
      {
        id: 'office-premium',
        title: 'Premium office lunch',
        description: 'Balanced corporate spread with bowls, wraps, regional mains, beverages, and desserts.',
        pricePerGuest: 720,
        minGuests: 35,
        image: '/images/corporate-lunch.png',
        tags: ['Corporate', 'Buffet', 'Gluten-free'],
        instantBook: true,
        items: ['Salad bar', '2 mains', 'Rice or breads', 'Dessert bites', 'Beverages'],
      },
      {
        id: 'dessert-social',
        title: 'Dessert social station',
        description: 'Mocktails, mini pastries, fruit tartlets, chocolate bites, and compact staffing.',
        pricePerGuest: 520,
        minGuests: 30,
        image: '/images/dessert-station.png',
        tags: ['House party', 'Desserts', 'Mocktails'],
        instantBook: false,
        items: ['3 mocktails', 'Pastry selection', 'Fruit tartlets', 'Chocolate bites'],
      },
    ],
  },
  {
    id: 'urban-plate',
    name: 'Urban Plate Collective',
    owner: 'Nisha Rao',
    status: 'approved',
    cuisine: 'Healthy corporate, Fusion',
    address: 'Indiranagar, Bengaluru',
    pincode: '560038',
    coordinates: { latitude: 12.9784, longitude: 77.6408, label: 'Indiranagar, Bengaluru' },
    serviceRadius: 16,
    servicePincodes: ['560001', '560038', '560071', '560075'],
    distanceKm: 5.7,
    rating: 4.6,
    reviewCount: 92,
    responseMinutes: 25,
    minPrice: 540,
    maxGuests: 450,
    license: 'FSSAI-KA-21433001992',
    docs: ['Food license', 'Owner ID', 'Insurance'],
    dietary: ['Vegetarian', 'Vegan', 'Gluten-free'],
    eventTypes: ['Corporate', 'House party', 'Launch'],
    badges: ['Verified', 'Fast response'],
    image: '/images/corporate-lunch.png',
    payoutDue: 62000,
    availability: [futureDate(7), futureDate(14), futureDate(28), futureDate(42)],
    packages: [
      {
        id: 'boardroom-bowls',
        title: 'Boardroom bowls',
        description: 'Individually served lunch bowls, salads, wraps, fruit, and beverage station.',
        pricePerGuest: 620,
        minGuests: 20,
        image: '/images/corporate-lunch.png',
        tags: ['Corporate', 'Individual meals', 'Vegan'],
        instantBook: true,
        items: ['Grain bowls', 'Wraps', 'Seasonal fruit', 'Cold beverages'],
      },
      {
        id: 'launch-spread',
        title: 'Product launch spread',
        description: 'Finger food, dessert bar, mocktails, coffee service, and elegant counter styling.',
        pricePerGuest: 880,
        minGuests: 50,
        image: '/images/dessert-station.png',
        tags: ['Launch', 'Canapes', 'Mocktails'],
        instantBook: false,
        items: ['6 canapes', 'Mocktails', 'Dessert bar', 'Coffee service'],
      },
    ],
  },
  {
    id: 'heritage-millet',
    name: 'Heritage Millet Kitchens',
    owner: 'Sahana Iyer',
    status: 'approved',
    cuisine: 'South Indian, Millet specials',
    address: 'Jayanagar, Bengaluru',
    pincode: '560041',
    coordinates: { latitude: 12.925, longitude: 77.5938, label: 'Jayanagar, Bengaluru' },
    serviceRadius: 20,
    servicePincodes: ['560004', '560011', '560041', '560070'],
    distanceKm: 8.1,
    rating: 4.9,
    reviewCount: 134,
    responseMinutes: 34,
    minPrice: 480,
    maxGuests: 700,
    license: 'FSSAI-KA-99114001210',
    docs: ['Food license', 'Owner ID', 'Insurance'],
    dietary: ['Vegetarian', 'Jain'],
    eventTypes: ['Wedding', 'Festival', 'House party'],
    badges: ['Verified', 'Regional specialist'],
    image: '/images/wedding-buffet.png',
    payoutDue: 78000,
    availability: [futureDate(10), futureDate(35), futureDate(39), futureDate(61)],
    packages: [
      {
        id: 'banana-leaf',
        title: 'Banana leaf feast',
        description: 'Traditional plated meal with regional sides, sweets, payasam, and managed service.',
        pricePerGuest: 640,
        minGuests: 60,
        image: '/images/wedding-buffet.png',
        tags: ['Wedding', 'Festival', 'Vegetarian'],
        instantBook: false,
        items: ['Welcome drink', '12-course meal', 'Payasam', 'Managed service'],
      },
    ],
  },
  {
    id: 'fresh-leaf',
    name: 'The Fresh Leaf Studio',
    owner: 'Kabir Sen',
    status: 'pending',
    cuisine: 'Modern vegetarian',
    address: 'Kalyan Nagar, Bengaluru',
    pincode: '560043',
    coordinates: { latitude: 13.0221, longitude: 77.6408, label: 'Kalyan Nagar, Bengaluru' },
    serviceRadius: 12,
    servicePincodes: ['560043', '560084'],
    distanceKm: 10.4,
    rating: 0,
    reviewCount: 0,
    responseMinutes: 0,
    minPrice: 500,
    maxGuests: 220,
    license: 'FSSAI-REVIEW-7782',
    docs: ['Food license', 'Owner ID'],
    dietary: ['Vegetarian', 'Vegan'],
    eventTypes: ['House party', 'Corporate'],
    badges: ['Under review'],
    image: '/images/dessert-station.png',
    payoutDue: 0,
    availability: [futureDate(20), futureDate(31)],
    packages: [
      {
        id: 'garden-party',
        title: 'Garden party table',
        description: 'Fresh vegetarian bites, salads, mocktails, and compact dessert counter.',
        pricePerGuest: 560,
        minGuests: 25,
        image: '/images/dessert-station.png',
        tags: ['Vegetarian', 'House party'],
        instantBook: false,
        items: ['Salads', '2 mains', 'Mocktails', 'Dessert cups'],
      },
    ],
  },
  {
    id: 'coastal-crave',
    name: 'Coastal Crave Caterers',
    owner: 'Meera D Souza',
    status: 'approved',
    cuisine: 'Coastal, Seafood, Mangalorean',
    address: 'Koramangala, Bengaluru',
    pincode: '560034',
    coordinates: { latitude: 12.9352, longitude: 77.6245, label: 'Koramangala, Bengaluru' },
    serviceRadius: 18,
    servicePincodes: ['560034', '560095', '560029', '560102'],
    distanceKm: 6.4,
    rating: 4.7,
    reviewCount: 78,
    responseMinutes: 22,
    minPrice: 760,
    maxGuests: 520,
    license: 'FSSAI-KA-77182004401',
    docs: ['Food license', 'Owner ID', 'Insurance'],
    dietary: ['Gluten-free'],
    eventTypes: ['Corporate', 'House party', 'Launch'],
    badges: ['Verified', 'Seafood specialist'],
    image: '/images/corporate-lunch.png',
    payoutDue: 43000,
    availability: [futureDate(12), futureDate(24), futureDate(35), futureDate(52)],
    packages: [
      {
        id: 'coastal-table',
        title: 'Coastal tasting table',
        description: 'Curated seafood and coastal vegetarian counter with appams, curries, grills, and dessert.',
        pricePerGuest: 920,
        minGuests: 45,
        image: '/images/corporate-lunch.png',
        tags: ['Corporate', 'Seafood', 'Live grills'],
        instantBook: false,
        items: ['2 grills', '3 coastal mains', 'Appams', 'Rice', 'Dessert'],
      },
    ],
  },
  {
    id: 'saffron-sage',
    name: 'Saffron & Sage Events',
    owner: 'Zoya Khan',
    status: 'approved',
    cuisine: 'North Indian, Mughlai, Global',
    address: 'Whitefield, Bengaluru',
    pincode: '560066',
    coordinates: { latitude: 12.9698, longitude: 77.75, label: 'Whitefield, Bengaluru' },
    serviceRadius: 28,
    servicePincodes: ['560066', '560048', '560067', '560087'],
    distanceKm: 14.9,
    rating: 4.5,
    reviewCount: 61,
    responseMinutes: 31,
    minPrice: 700,
    maxGuests: 650,
    license: 'FSSAI-KA-54192001873',
    docs: ['Food license', 'Owner ID', 'Insurance'],
    dietary: ['Vegetarian', 'Jain'],
    eventTypes: ['Wedding', 'Corporate', 'Festival'],
    badges: ['Verified', 'Large events'],
    image: '/images/wedding-buffet.png',
    payoutDue: 96000,
    availability: [futureDate(14), futureDate(27), futureDate(35), futureDate(45)],
    packages: [
      {
        id: 'mehfil-buffet',
        title: 'Mehfil buffet',
        description: 'North Indian buffet with kebabs, vegetarian grills, breads, biryani, and dessert counter.',
        pricePerGuest: 840,
        minGuests: 70,
        image: '/images/wedding-buffet.png',
        tags: ['Wedding', 'Buffet', 'Jain'],
        instantBook: true,
        items: ['4 starters', '4 mains', 'Biryani', 'Breads', 'Dessert counter'],
      },
    ],
  },
]

const seedBookings = () => [
  {
    id: 'BK-2401',
    vendorId: 'spice-stem',
    packageId: 'royal-wedding',
    customerName: 'Priya Sharma',
    eventType: 'Wedding',
    date: futureDate(35),
    guests: 180,
    addOns: ['live-counter', 'premium-dessert'],
    note: 'Prefer a Jain-friendly counter and extra welcome drinks.',
    amount: 219000,
    deposit: 65700,
    paymentChoice: 'deposit',
    status: 'quote-sent',
    createdAt: new Date().toISOString(),
    timeline: ['Customer sent booking request', 'Awaiting vendor response'],
    messages: [{ from: 'customer', text: 'Can you include a Jain counter and two dessert options?', time: '10:20' }],
  },
  {
    id: 'BK-2388',
    vendorId: 'urban-plate',
    packageId: 'boardroom-bowls',
    customerName: 'Rohan Kapoor',
    eventType: 'Corporate',
    date: futureDate(14),
    guests: 55,
    addOns: ['eco-serveware'],
    note: 'Delivery before 12:15 PM.',
    amount: 38600,
    deposit: 38600,
    paymentChoice: 'full',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    timeline: ['Instant booking created', 'Payment captured', 'Booking confirmed'],
    messages: [{ from: 'vendor', text: 'Our captain will call the previous evening to confirm entry details.', time: '14:05' }],
  },
  {
    id: 'BK-2320',
    vendorId: 'heritage-millet',
    packageId: 'banana-leaf',
    customerName: 'Ananya Iyer',
    eventType: 'Festival',
    date: futureDate(-12),
    guests: 90,
    addOns: ['service-staff'],
    note: 'Temple-style vegetarian menu.',
    amount: 66600,
    deposit: 66600,
    paymentChoice: 'full',
    status: 'completed',
    createdAt: new Date().toISOString(),
    timeline: ['Booking confirmed', 'Service delivered', 'Marked completed'],
    messages: [],
    review: { rating: 5, text: 'Beautifully served and punctual.' },
  },
  {
    id: 'BK-2416',
    vendorId: 'saffron-sage',
    packageId: 'mehfil-buffet',
    customerName: 'Devika Menon',
    eventType: 'Wedding',
    date: futureDate(27),
    guests: 140,
    addOns: ['service-staff', 'eco-serveware'],
    note: 'Need separate vegetarian and Jain labels on counters.',
    amount: 131100,
    deposit: 39330,
    paymentChoice: 'deposit',
    status: 'accepted',
    createdAt: new Date().toISOString(),
    timeline: ['Customer sent booking request', 'Vendor accepted the request', 'Payment link generated'],
    messages: [{ from: 'vendor', text: 'We can support separate Jain labels and a dedicated service line.', time: '16:15' }],
  },
]

let accounts = seedAccounts()
let vendors = seedVendors()
let bookings = seedBookings()
let addOns = seedAddOns()
let payments = []
let persistedEvents = []
let databaseStore = null
const eventClients = new Set()

const makeId = (prefix) => `${prefix}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`

const publicUser = (account) => ({
  id: account.id,
  name: account.name,
  email: account.email,
  role: account.role,
  vendorId: account.vendorId,
})

const issueToken = (user) => jwt.sign(user, jwtSecret, { expiresIn: jwtExpiresIn, subject: user.id })

const findAccountForLogin = async ({ role, email }) => {
  if (databaseStore?.findUserForLogin) {
    return databaseStore.findUserForLogin({ role, email })
  }
  return accounts.find((item) => item.role === role && item.email === email) || null
}

const findAccountById = async (id) => {
  if (databaseStore?.findUserById) {
    return databaseStore.findUserById(id)
  }
  return accounts.find((item) => item.id === id) || null
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token
  if (!token) return res.status(401).json({ message: 'Missing auth token' })

  let payload
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    return res.status(401).json({ message: 'Invalid or expired auth token' })
  }

  const account = await findAccountById(payload.sub)
  if (!account) {
    return res.status(401).json({ message: 'Session user no longer exists. Please sign in again.' })
  }
  if (account.email !== payload.email || account.role !== payload.role) {
    return res.status(401).json({ message: 'Session no longer matches the database user. Please sign in again.' })
  }

  req.user = publicUser(account)
  next()
})

const distanceInKm = (from, to) => {
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

const vendorDistance = (vendor, geo) => {
  if (!geo) return vendor.distanceKm
  return Number(distanceInKm(geo, vendor.coordinates).toFixed(1))
}

const vendorSearchText = (vendor) =>
  [
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

const hasRejectedDocument = (vendor) =>
  Object.values(vendor.documents || {}).some((document) => document?.status === 'rejected')

const isCustomerVisibleVendor = (vendor) => vendor.status === 'approved' && !hasRejectedDocument(vendor)

const findVendorAndPackage = (vendorId, packageId) => {
  const vendor = vendors.find((item) => item.id === vendorId)
  const caterPackage = vendor?.packages.find((item) => item.id === packageId)
  return { vendor, caterPackage }
}

const calculateBookingTotal = ({ vendorId, packageId, guests, addOnIds = [] }) => {
  const { caterPackage } = findVendorAndPackage(vendorId, packageId)
  if (!caterPackage) return 0

  const packageTotal = Math.max(Number(guests), caterPackage.minGuests) * caterPackage.pricePerGuest
  const addOnTotal = addOns
    .filter((addOn) => addOnIds.includes(addOn.id))
    .reduce((total, addOn) => total + addOn.price, 0)
  return packageTotal + addOnTotal
}

const appState = () => ({
  accounts,
  vendors,
  bookings,
  addOns,
  payments,
  events: persistedEvents,
  updatedAt: new Date().toISOString(),
})

const applyPersistedState = (state) => {
  accounts = Array.isArray(state.accounts) ? state.accounts : seedAccounts()
  vendors = Array.isArray(state.vendors) ? state.vendors : seedVendors()
  bookings = Array.isArray(state.bookings) ? state.bookings : seedBookings()
  addOns = Array.isArray(state.addOns) ? state.addOns : seedAddOns()
  payments = Array.isArray(state.payments) ? state.payments : []
  persistedEvents = Array.isArray(state.events) ? state.events.slice(0, 100) : []
}

const saveState = async () => {
  if (!databaseStore) return
  await databaseStore.saveState(appState())
}

const reloadStateFromDatabase = async () => {
  if (!databaseStore) return
  const state = await databaseStore.loadState()
  if (state) applyPersistedState(state)
}

const ensureDemoAccounts = async () => {
  const seededAccounts = seedAccounts()
  for (const account of seededAccounts) {
    if (!accounts.some((item) => item.id === account.id)) {
      accounts = [...accounts, account]
    }
    await databaseStore?.insertUserIfMissing?.(account)
  }
}

const initializePersistence = async () => {
  if (!isMysqlEnabled()) {
    console.log('FeastFlow API using in-memory storage. Set DB_MODE=mysql in .env to persist to MySQL.')
    return
  }

  databaseStore = await createDatabaseStore()
  const persistedState = await databaseStore.loadState()
  if (persistedState) {
    applyPersistedState(persistedState)
    await ensureDemoAccounts()
    console.log(`FeastFlow API loaded persisted state from MySQL: ${databaseLabel()}`)
  } else {
    await saveState()
    await ensureDemoAccounts()
    console.log(`FeastFlow API created initial MySQL state: ${databaseLabel()}`)
  }
}

const publishEvent = (title, body, payload = {}) => {
  const event = {
    id: makeId('EVT'),
    title,
    body,
    payload,
    time: nowTime(),
  }
  for (const client of eventClients) {
    client.write(`event: marketplace\n`)
    client.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  persistedEvents = [event, ...persistedEvents].slice(0, 100)
  databaseStore?.logEvent(event).catch((error) => {
    console.error('Failed to persist event log:', error.message)
  })
  return event
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'feastflow-api',
    database: databaseStore ? 'mysql' : 'memory',
    databaseTarget: isMysqlEnabled() ? databaseLabel() : null,
    time: new Date().toISOString(),
  })
})

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const role = req.body.role
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!demoAccounts[role] || !email || !password) {
    return res.status(400).json({ message: 'Role, email, and password are required' })
  }

  const account = await findAccountForLogin({ role, email })

  if (!account || account.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials for this role' })
  }

  const user = publicUser(account)
  res.json({ token: issueToken(user), user })
}))

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const role = req.body.role
  const email = String(req.body.email || '').trim().toLowerCase()
  const name = String(req.body.name || '').trim()
  if (!demoAccounts[role] || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid role and email are required' })
  }

  if (await findAccountForLogin({ role, email })) {
    return res.status(409).json({ message: 'An account already exists for this email and role' })
  }

  const account = {
    id: accountIdFor(role, email),
    email,
    password: String(req.body.password || 'demo1234'),
    name: name || email.split('@')[0],
    role,
  }
  if (role === 'vendor') {
    account.vendorId = `vendor-${email.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 42)}`
  }
  accounts = [account, ...accounts]
  if (databaseStore?.upsertUser) {
    await databaseStore.upsertUser(account)
  } else {
    await saveState()
  }
  const user = publicUser(account)
  res.status(201).json({ token: issueToken(user), user })
}))

app.get('/api/bootstrap', requireAuth, asyncHandler(async (req, res) => {
  await reloadStateFromDatabase()
  const account = await findAccountById(req.user.id)
  if (!account) {
    return res.status(401).json({ message: 'Session user no longer exists. Please sign in again.' })
  }
  res.json({
    vendors,
    bookings,
    addOns,
    user: publicUser(account),
  })
}))

app.post('/api/vendors/search', requireAuth, (req, res) => {
  const filters = req.body.filters || {}
  const normalizedLocation = String(filters.location || '').trim().toLowerCase()
  const geo = filters.geo || null
  const approvedVendors = vendors.filter(isCustomerVisibleVendor)

  let results = approvedVendors.filter((vendor) => {
    const searchableText = vendorSearchText(vendor)
    const distance = vendorDistance(vendor, geo)
    const matchesLocation =
      !normalizedLocation ||
      searchableText.includes(normalizedLocation) ||
      (geo ? distance <= vendor.serviceRadius : false)
    const matchesBudget = !filters.budget || vendor.minPrice <= Number(filters.budget)
    const matchesDiet = !filters.dietary || filters.dietary === 'Any' || vendor.dietary.includes(filters.dietary)
    const matchesEvent =
      !filters.eventType || filters.eventType === 'Any' || vendor.eventTypes.includes(filters.eventType)
    const matchesDate = !filters.date || vendor.availability.includes(filters.date)
    return matchesLocation && matchesBudget && matchesDiet && matchesEvent && matchesDate
  })

  if (results.length === 0 && normalizedLocation) {
    results = approvedVendors.filter((vendor) => vendorSearchText(vendor).includes(normalizedLocation))
  }

  results = results
    .map((vendor) => ({ ...vendor, distanceKm: vendorDistance(vendor, geo) }))
    .sort((first, second) => second.rating - first.rating || first.distanceKm - second.distanceKm)

  publishEvent('Search updated', `${results.length} caterers matched the latest search.`, { count: results.length })
  res.json({ vendors: results, count: results.length })
})

app.post('/api/vendors/application', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor role required' })

  const application = req.body.application || {}
  const businessName = String(application.businessName || '').trim()
  const cuisine = String(application.cuisine || '').trim() || 'Catering'
  const pincode = String(application.pincode || '').trim() || '560043'
  const license = String(application.license || '').trim()
  const vendorId = applicationVendorIdForUser(req.user)
  const uploadedDocuments = Object.fromEntries(
    Object.keys(applicationDocumentItems)
      .map((key) => [
        key,
        sanitizeUploadedDocument({
          key,
          document: application.documents?.[key],
          vendorId,
          uploadedBy: req.user.id,
        }),
      ])
      .filter(([, document]) => Boolean(document)),
  )
  const foodLicense = Boolean(uploadedDocuments.foodLicense)
  const identity = Boolean(uploadedDocuments.identity)
  const insurance = Boolean(uploadedDocuments.insurance)

  if (!businessName || !license) {
    return res.status(400).json({ message: 'Business name and license number are required' })
  }
  if (!foodLicense || !identity) {
    return res.status(400).json({ message: 'Food license and ID proof are mandatory for review' })
  }

  const bannerImage = sanitizeBannerImage(application.bannerImage)
  const appVendor = {
    id: vendorId,
    name: businessName,
    owner: req.user.name || 'Vendor',
    status: insurance ? 'pending' : 'needs-info',
    cuisine,
    address: `Service base near ${pincode}`,
    pincode,
    coordinates: { latitude: 13.0221, longitude: 77.6408, label: `Service base ${pincode}` },
    serviceRadius: Number(application.radius || 12),
    servicePincodes: [pincode],
    distanceKm: 0,
    rating: 0,
    reviewCount: 0,
    responseMinutes: 0,
    minPrice: 500,
    maxGuests: 250,
    license,
    docs: Object.entries(applicationDocumentItems)
      .filter(([key]) => Boolean(uploadedDocuments[key]))
      .map(([, label]) => label),
    documents: uploadedDocuments,
    dietary: ['Vegetarian'],
    eventTypes: ['Corporate', 'House party'],
    badges: ['Under review'],
    image: bannerImage,
    payoutDue: 0,
    availability: [futureDate(18), futureDate(30)],
    adminNote: insurance ? undefined : 'Insurance document is missing.',
    packages: [
      {
        id: `${vendorId}-starter-package`,
        title: 'Starter celebration package',
        description: 'A review-ready starter package for admin approval and marketplace listing.',
        pricePerGuest: 500,
        minGuests: 25,
        image: bannerImage,
        tags: ['House party', 'Vegetarian'],
        instantBook: false,
        items: ['2 starters', '2 mains', 'Dessert cups'],
      },
    ],
  }

  const previousVendors = vendors
  const vendorAccount = accounts.find((account) => account.id === req.user.id)
  const previousVendorId = vendorAccount?.vendorId
  if (vendorAccount && vendorAccount.vendorId !== vendorId) {
    vendorAccount.vendorId = vendorId
    await databaseStore?.upsertUser?.(vendorAccount)
  }
  vendors = vendors.some((vendor) => vendor.id === appVendor.id)
    ? vendors.map((vendor) => (vendor.id === appVendor.id ? appVendor : vendor))
    : [appVendor, ...vendors]

  try {
    await saveState()
    await reloadStateFromDatabase()
  } catch (error) {
    vendors = previousVendors
    if (vendorAccount) {
      vendorAccount.vendorId = previousVendorId
      await databaseStore?.upsertUser?.(vendorAccount).catch(() => undefined)
    }
    await reloadStateFromDatabase().catch(() => undefined)
    throw error
  }

  const persistedVendor = vendors.find((vendor) => vendor.id === appVendor.id) || appVendor
  publishEvent('Vendor application submitted', `${persistedVendor.name} is waiting for admin review.`, {
    vendorId: persistedVendor.id,
  })
  res.status(201).json({ vendor: persistedVendor })
}))

app.post('/api/vendors/:vendorId/packages', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Vendor or admin role required' })
  }

  const vendor = vendors.find((item) => item.id === req.params.vendorId)
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' })
  if (req.user.role === 'vendor' && req.user.vendorId && req.user.vendorId !== vendor.id) {
    return res.status(403).json({ message: 'You can only update your own vendor profile' })
  }

  const title = String(req.body.title || '').trim()
  const pricePerGuest = Number(req.body.pricePerGuest || 0)
  const minGuests = Number(req.body.minGuests || 0)
  const tag = String(req.body.tag || 'Custom').trim() || 'Custom'

  if (!title || pricePerGuest < 1 || minGuests < 1) {
    return res.status(400).json({ message: 'Package title, price, and minimum guests are required' })
  }

  const packageToAdd = {
    id: makeId('PKG').toLowerCase(),
    title,
    description: 'Custom package added from the vendor operations dashboard.',
    pricePerGuest,
    minGuests,
    image: req.body.image || '/images/corporate-lunch.png',
    tags: [tag],
    instantBook: false,
    items: ['Starter selection', 'Main course', 'Dessert'],
  }

  vendor.packages = [...vendor.packages, packageToAdd]
  vendor.minPrice = Math.min(vendor.minPrice, pricePerGuest)

  publishEvent('Package added', `${packageToAdd.title} was added to ${vendor.name}.`, {
    vendorId: vendor.id,
    packageId: packageToAdd.id,
  })
  await saveState()
  res.status(201).json({ vendor, package: packageToAdd })
}))

app.post('/api/bookings', requireAuth, asyncHandler(async (req, res) => {
  const { vendorId, packageId, eventType, date, guests, addOns: addOnIds = [], note = '', paymentChoice = 'deposit', mode = 'quote' } =
    req.body
  const { vendor, caterPackage } = findVendorAndPackage(vendorId, packageId)
  if (!vendor || !caterPackage) return res.status(404).json({ message: 'Vendor package not found' })
  if (!date || Number(guests) < caterPackage.minGuests) {
    return res.status(400).json({ message: `Minimum guest count is ${caterPackage.minGuests}` })
  }

  const amount = calculateBookingTotal({ vendorId, packageId, guests, addOnIds })
  const booking = {
    id: makeId('BK'),
    vendorId,
    packageId,
    customerName: req.user.name || 'Customer',
    eventType,
    date,
    guests: Number(guests),
    addOns: addOnIds,
    note,
    amount,
    deposit: mode === 'instant' ? (paymentChoice === 'full' ? amount : Math.ceil(amount * 0.3)) : 0,
    paymentChoice,
    status: mode === 'instant' ? 'confirmed' : 'quote-sent',
    createdAt: new Date().toISOString(),
    timeline:
      mode === 'instant'
        ? ['Instant booking created', 'Payment captured', 'Booking confirmed']
        : ['Customer sent booking request', 'Awaiting vendor response'],
    messages: note ? [{ from: 'customer', text: note, time: nowTime() }] : [],
  }

  bookings = [booking, ...bookings]
  publishEvent(mode === 'instant' ? 'Booking confirmed' : 'Quote request sent', `${booking.id} with ${vendor.name}`, {
    bookingId: booking.id,
  })
  await saveState()
  res.status(201).json({ booking })
}))

app.post('/api/bookings/:bookingId/messages', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })

  const text = String(req.body.text || '').trim()
  const from = req.body.from === 'vendor' ? 'vendor' : req.body.from === 'admin' ? 'admin' : 'customer'
  if (!text) return res.status(400).json({ message: 'Message text is required' })

  booking.messages.push({ from, text, time: nowTime() })
  publishEvent('New chat message', `${booking.id}: ${text}`, { bookingId: booking.id })
  await saveState()
  res.json({ booking })
}))

app.post('/api/bookings/:bookingId/vendor-decision', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })

  const decision = req.body.decision
  if (decision === 'decline') {
    booking.status = 'declined'
    booking.timeline.push('Vendor declined the request')
    booking.messages.push({ from: 'vendor', text: 'We are unable to serve this slot.', time: nowTime() })
  } else if (decision === 'counter') {
    booking.amount = Math.ceil(booking.amount * 1.08)
    booking.status = 'countered'
    booking.timeline.push('Vendor sent a counter offer')
    booking.messages.push({
      from: 'vendor',
      text: `We can serve this with an adjusted total of INR ${booking.amount}.`,
      time: nowTime(),
    })
  } else {
    booking.status = 'accepted'
    booking.timeline.push('Vendor accepted the request', 'Payment link generated')
    booking.messages.push({ from: 'vendor', text: 'We accepted the request. Payment link is ready.', time: nowTime() })
  }

  publishEvent('Vendor response saved', `${booking.id} is now ${booking.status}.`, { bookingId: booking.id })
  await saveState()
  res.json({ booking })
}))

app.post('/api/payments/intent', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.body.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })

  const amount = booking.paymentChoice === 'full' ? booking.amount : Math.ceil(booking.amount * 0.3)
  const payment = {
    id: makeId('PAY'),
    bookingId: booking.id,
    amount,
    currency: 'INR',
    status: 'requires_confirmation',
    provider: 'FeastFlowPay Sandbox',
    createdAt: new Date().toISOString(),
  }
  payments.push(payment)
  await saveState()
  res.status(201).json({ payment })
}))

app.post('/api/payments/:paymentId/confirm', requireAuth, asyncHandler(async (req, res) => {
  const payment = payments.find((item) => item.id === req.params.paymentId)
  if (!payment) return res.status(404).json({ message: 'Payment intent not found' })
  const booking = bookings.find((item) => item.id === payment.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })

  payment.status = 'succeeded'
  payment.confirmedAt = new Date().toISOString()
  booking.status = 'confirmed'
  booking.deposit = payment.amount
  booking.timeline.push('Customer completed payment', 'Booking confirmed')

  publishEvent('Payment successful', `${booking.id} payment captured.`, { bookingId: booking.id, paymentId: payment.id })
  await saveState()
  res.json({ payment, booking })
}))

app.post('/api/bookings/:bookingId/complete', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  booking.status = 'completed'
  booking.timeline.push('Service delivered', 'Marked completed')
  publishEvent('Booking completed', `${booking.id} was marked completed.`, { bookingId: booking.id })
  await saveState()
  res.json({ booking })
}))

app.post('/api/bookings/:bookingId/review', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  booking.review = { rating: Number(req.body.rating || 5), text: String(req.body.text || 'Great service and food quality.') }
  if (!booking.timeline.includes('Review submitted')) booking.timeline.push('Review submitted')
  publishEvent('Review submitted', `${booking.id} received a customer review.`, { bookingId: booking.id })
  await saveState()
  res.json({ booking })
}))

app.patch('/api/admin/vendors/:vendorId/status', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin role required' })
  const vendor = vendors.find((item) => item.id === req.params.vendorId)
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' })

  vendor.status = req.body.status
  vendor.adminNote = req.body.adminNote
  if (vendor.status === 'approved') {
    vendor.badges = Array.from(new Set([...vendor.badges.filter((badge) => badge !== 'Under review'), 'Verified']))
  }

  publishEvent('Vendor verification updated', `${vendor.name} moved to ${vendor.status}.`, { vendorId: vendor.id })
  await saveState()
  res.json({ vendor })
}))

app.get('/api/documents/:documentId/download', requireAuth, asyncHandler(async (req, res) => {
  if (!databaseStore?.getDocumentById) {
    return res.status(503).json({ message: 'Document storage requires the MySQL backend' })
  }

  const document = await databaseStore.getDocumentById(req.params.documentId)
  if (!document) return res.status(404).json({ message: 'Document not found' })

  const canDownload =
    req.user.role === 'admin' ||
    (req.user.role === 'vendor' &&
      (req.user.vendorId === document.vendorId || document.uploadedBy === req.user.id))

  if (!canDownload) return res.status(403).json({ message: 'You cannot download this document' })

  const fileName = safeAttachmentName(document.originalFileName || document.name)
  const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment'
  res.setHeader('Content-Type', document.mimeType || 'application/octet-stream')
  res.setHeader('Content-Length', document.fileBlob.length)
  res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(document.fileBlob)
}))

app.patch('/api/documents/:documentId/status', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin role required' })
  if (!databaseStore?.updateDocumentStatus) {
    return res.status(503).json({ message: 'Document approval requires the MySQL backend' })
  }

  const status = String(req.body.status || '').trim()
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Document status must be pending, approved, or rejected' })
  }
  const rejectionReason = String(req.body.rejectionReason || '').trim()
  if (status === 'rejected' && !rejectionReason) {
    return res.status(400).json({ message: 'Rejection reason is required' })
  }

  const document = await databaseStore.updateDocumentStatus({
    id: req.params.documentId,
    status,
    approvedBy: req.user.id,
    rejectionReason,
  })
  if (!document) return res.status(404).json({ message: 'Document not found' })

  await reloadStateFromDatabase()
  let vendor = vendors.find((item) => item.id === document.vendorId)
  if (vendor && status === 'rejected') {
    vendor.status = 'needs-info'
    vendor.adminNote = `${document.documentName} rejected: ${rejectionReason}`
    vendor.badges = Array.from(new Set([...vendor.badges.filter((badge) => badge !== 'Verified'), 'Needs document review']))
    await saveState()
    await reloadStateFromDatabase()
    vendor = vendors.find((item) => item.id === document.vendorId)
  }
  publishEvent('Document review updated', `${document.documentName} is now ${status}.`, {
    documentId: document.id,
    vendorId: document.vendorId,
  })
  res.json({ document, vendor })
}))

app.get('/api/events', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
  })
  res.write(`event: marketplace\n`)
  res.write(
    `data: ${JSON.stringify({
      id: makeId('EVT'),
      title: 'Realtime API connected',
      body: 'Live booking and chat events are streaming from the backend.',
      time: nowTime(),
    })}\n\n`,
  )

  eventClients.add(res)
  req.on('close', () => {
    eventClients.delete(res)
  })
})

if (process.env.SERVE_CLIENT !== 'false') {
  app.use(express.static(clientDistDirectory))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDistDirectory, 'index.html'))
  })
}

app.use((err, _req, res, _next) => {
  console.error(err)
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Upload is too large. Keep each file under 2.5 MB.' })
  }
  if (isMysqlPacketError(err)) {
    return res.status(413).json({
      message: 'Upload is too large for the local MySQL packet limit. Restart the API and try a PDF under 2.5 MB.',
    })
  }
  res.status(500).json({ message: 'Unexpected server error' })
})

initializePersistence()
  .then(() => {
    app.listen(port, host, () => {
      console.log(`FeastFlow API listening on http://${host}:${port}`)
    })
  })
  .catch((error) => {
    console.error('FeastFlow API could not initialize persistence.')
    console.error(error.message)
    if (isMysqlEnabled()) {
      console.error('Check that MySQL Server is running and .env has the correct MYSQL_* values.')
    }
    process.exit(1)
  })
