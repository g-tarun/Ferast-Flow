import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import crypto from 'crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import path from 'path'
import webPush from 'web-push'
import { z } from 'zod'
import { fileURLToPath } from 'url'
import { createDatabaseStore, databaseLabel, isMysqlEnabled } from './database.js'

const app = express()
app.set('trust proxy', 1)
const port = Number(process.env.PORT || process.env.API_PORT || 4000)
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1')
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientDistDirectory = path.resolve(serverDirectory, '../dist')
const jwtSecret = process.env.JWT_SECRET || 'feastflow-local-development-secret'
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '2h'
const mfaCodeSecret = process.env.MFA_CODE_SECRET || jwtSecret
const mfaRequired = String(process.env.MFA_REQUIRED || 'false').toLowerCase() === 'true'
const mfaCodeTtlMinutes = Math.min(Math.max(Number(process.env.MFA_CODE_TTL_MINUTES || 10), 5), 30)
const mfaMaxAttempts = Math.min(Math.max(Number(process.env.MFA_MAX_ATTEMPTS || 5), 3), 8)
const smtpHost = String(process.env.SMTP_HOST || '').trim()
const smtpPort = Number(process.env.SMTP_PORT || 465)
const smtpUser = String(process.env.SMTP_USER || '').trim()
const smtpPass = String(process.env.SMTP_PASS || '').trim()
const smtpFrom = String(process.env.SMTP_FROM || smtpUser).trim()
const smtpSecure = String(process.env.SMTP_SECURE || (smtpPort === 465 ? 'true' : 'false')).toLowerCase() === 'true'
const emailMfaConfigured = Boolean(smtpHost && smtpUser && smtpPass && smtpFrom)
let emailTransporter = null
const vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim()
const vapidPrivateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim()
const vapidSubject = String(process.env.VAPID_SUBJECT || 'mailto:admin@feastflow.local').trim()
const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey)
const loginRateLimit = Math.min(Math.max(Number(process.env.AUTH_LOGIN_RATE_LIMIT || 40), 10), 200)
const loginRateWindowMs = Math.min(Math.max(Number(process.env.AUTH_LOGIN_RATE_WINDOW_MS || 5 * 60_000), 60_000), 60 * 60_000)
const registerRateLimit = Math.min(Math.max(Number(process.env.AUTH_REGISTER_RATE_LIMIT || 12), 3), 80)
const registerRateWindowMs = Math.min(
  Math.max(Number(process.env.AUTH_REGISTER_RATE_WINDOW_MS || 15 * 60_000), 60_000),
  60 * 60_000,
)

if (pushEnabled) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

app.use(cors())
app.use(express.json({ limit: '16mb' }))

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}

const authRoleSchema = z.enum(['customer', 'vendor', 'admin'])
const accountEmailSchema = z.string().trim().email('Enter a valid email address').max(180)
const accountPasswordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128)
const loginRequestSchema = z.object({
  role: authRoleSchema,
  email: accountEmailSchema,
  password: accountPasswordSchema,
})
const registerRequestSchema = z.object({
  role: authRoleSchema,
  email: accountEmailSchema,
  password: accountPasswordSchema,
  name: z.string().trim().min(2, 'Enter your full name').max(160),
})
const mfaCodeSchema = z.object({
  challengeId: z.string().regex(/^MFA-[A-F0-9-]{16,}$/i, 'Invalid verification request').max(120),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
})
const mfaResendSchema = z.object({
  challengeId: z.string().regex(/^MFA-[A-F0-9-]{16,}$/i, 'Invalid verification request').max(120),
})
const mobilePushSubscriptionSchema = z.object({
  expoPushToken: z.string().regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/, 'Invalid Expo push token').max(255),
  platform: z.enum(['android', 'ios']),
})
const mobilePushTokenSchema = mobilePushSubscriptionSchema.pick({ expoPushToken: true })
const publicVendorSearchSchema = z.object({
  eventType: z.enum(['wedding', 'kitty-party', 'half-saree', 'housewarming', 'corporate', 'other']),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  guests: z.coerce.number().int().min(1, 'Enter at least one guest').max(5000, 'Guest count is too large'),
})

const parseBody = (schema, req, res) => {
  const result = schema.safeParse(req.body)
  if (result.success) return result.data
  res.status(400).json({ message: result.error.issues[0]?.message || 'Invalid request data' })
  return null
}

const authRateLimitBuckets = new Map()
const requestClientIp = (req) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return req.ip || forwardedFor || req.socket.remoteAddress || 'unknown'
}
const requestRateIdentity = (req) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim().toLowerCase() : ''
  if (challengeId) return `challenge:${challengeId}`
  const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : 'role'
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  return email ? `account:${role}:${email}` : 'anonymous'
}
const rateLimit = ({ scope, limit, windowMs, scoped = false }) => (req, res, next) => {
  const identity = scoped ? requestRateIdentity(req) : 'global'
  const key = `${scope}:${requestClientIp(req)}:${identity}`
  const now = Date.now()
  const previous = (authRateLimitBuckets.get(key) || []).filter((time) => time > now - windowMs)
  if (previous.length >= limit) {
    res.setHeader('Retry-After', Math.ceil((previous[0] + windowMs - now) / 1000))
    return res.status(429).json({ message: 'Too many attempts. Please wait and try again.' })
  }
  previous.push(now)
  authRateLimitBuckets.set(key, previous)
  next()
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
  '/images/wedding-buffet.png',
  '/images/corporate-lunch.png',
  '/images/dessert-station.png',
  '/images/hero-catering.png',
]

const pickApplicationBanner = () => applicationBannerImages[Math.floor(Math.random() * applicationBannerImages.length)]
const applicationDocumentItems = {
  foodLicense: 'Food license',
  identity: 'Owner ID',
  insurance: 'Insurance',
}
const onboardingDraftLicense = 'PENDING-ONBOARDING'

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

const demoImageAssets = {
  'wedding-buffet.png': {
    title: 'Wedding buffet',
    subtitle: 'Live counters and plated service',
    palette: ['#0e4f3a', '#d99a1b', '#8f241d'],
  },
  'corporate-lunch.png': {
    title: 'Corporate lunch',
    subtitle: 'Bowls, wraps, salads, beverages',
    palette: ['#074f5c', '#33a38f', '#d8791f'],
  },
  'dessert-station.png': {
    title: 'Dessert station',
    subtitle: 'Pastries, fruit tarts, mocktails',
    palette: ['#6e193f', '#d84975', '#d9a018'],
  },
  'hero-catering.png': {
    title: 'FeastFlow catering',
    subtitle: 'Verified vendors for every event',
    palette: ['#0f332f', '#16734d', '#c97818'],
  },
}

const escapeSvgText = (value) =>
  String(value || '').replace(/[&<>"']/g, (character) => {
    const replacements = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    }
    return replacements[character]
  })

const createDemoImageSvg = ({ title, subtitle, palette }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" role="img" aria-label="${escapeSvgText(title)}">
  <title>${escapeSvgText(title)}</title>
  <desc>${escapeSvgText(subtitle)}</desc>
  <defs>
    <linearGradient id="background" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${palette[0]}"/>
      <stop offset="0.48" stop-color="${palette[1]}"/>
      <stop offset="1" stop-color="${palette[2]}"/>
    </linearGradient>
    <radialGradient id="plate" cx="50%" cy="45%" r="58%">
      <stop offset="0" stop-color="#fff7df"/>
      <stop offset="0.62" stop-color="#f3d893"/>
      <stop offset="1" stop-color="#b8792f"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#111" flood-opacity="0.24"/>
    </filter>
  </defs>
  <rect width="1200" height="700" fill="url(#background)"/>
  <rect width="1200" height="700" fill="#111" opacity="0.16"/>
  <circle cx="180" cy="120" r="150" fill="#fff" opacity="0.16"/>
  <circle cx="1040" cy="140" r="210" fill="#fff" opacity="0.15"/>
  <circle cx="1000" cy="620" r="260" fill="#111" opacity="0.18"/>
  <path d="M0 535 C180 455 315 590 520 500 C720 410 900 525 1200 430 L1200 700 L0 700 Z" fill="#1d1108" opacity="0.26"/>
  <g filter="url(#softShadow)">
    <ellipse cx="610" cy="360" rx="425" ry="198" fill="#fff3d0"/>
    <ellipse cx="610" cy="350" rx="365" ry="150" fill="url(#plate)"/>
    <circle cx="430" cy="315" r="52" fill="#c44732"/>
    <circle cx="545" cy="300" r="64" fill="#237346"/>
    <circle cx="675" cy="305" r="54" fill="#f5c542"/>
    <circle cx="790" cy="325" r="62" fill="#7f2f23"/>
    <rect x="385" y="380" width="440" height="36" rx="18" fill="#fff5ce"/>
    <rect x="415" y="430" width="380" height="30" rx="15" fill="#f7d98b"/>
    <path d="M330 405 C430 360 510 430 615 390 C720 350 835 390 900 360" fill="none" stroke="#6b3f1d" stroke-width="18" stroke-linecap="round" opacity="0.62"/>
  </g>
  <g opacity="0.92">
    <circle cx="92" cy="598" r="34" fill="#fff3d0"/>
    <circle cx="92" cy="598" r="20" fill="${palette[1]}"/>
    <circle cx="178" cy="614" r="24" fill="#fff3d0"/>
    <circle cx="178" cy="614" r="13" fill="${palette[2]}"/>
    <path d="M235 606 C320 570 405 630 485 592" fill="none" stroke="#fff3d0" stroke-width="16" stroke-linecap="round" opacity="0.72"/>
    <path d="M900 590 C975 555 1045 625 1125 585" fill="none" stroke="#fff3d0" stroke-width="14" stroke-linecap="round" opacity="0.68"/>
  </g>
</svg>
`

const applicationVendorIdForUser = (user) => {
  if (user.vendorId) return user.vendorId
  return `application-${String(user.id || user.email || 'vendor')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 72)}`
}

const createOnboardingDraftVendor = (account) => ({
  id: account.vendorId,
  name: 'Complete vendor onboarding',
  owner: account.name || account.email.split('@')[0] || 'Vendor',
  status: 'needs-info',
  cuisine: '',
  address: '',
  pincode: '',
  coordinates: { latitude: 0, longitude: 0, label: 'Onboarding pending' },
  serviceRadius: 12,
  servicePincodes: [],
  distanceKm: 0,
  rating: 0,
  reviewCount: 0,
  responseMinutes: 0,
  minPrice: 0,
  maxGuests: 0,
  license: onboardingDraftLicense,
  docs: [],
  documents: {},
  dietary: [],
  eventTypes: [],
  badges: ['Onboarding pending'],
  image: '',
  payoutDue: 0,
  availability: [],
  adminNote: 'Complete onboarding details and upload required documents.',
  packages: [],
})

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
    customerId: accountIdFor('customer', demoAccounts.customer.email),
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

const isPasswordHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ''))

const securePlaintextMatch = (storedPassword, submittedPassword) => {
  const stored = Buffer.from(String(storedPassword || ''))
  const submitted = Buffer.from(String(submittedPassword || ''))
  return stored.length === submitted.length && crypto.timingSafeEqual(stored, submitted)
}

const verifyAccountPassword = async (account, submittedPassword) => {
  if (!account) return false
  const matched = isPasswordHash(account.password)
    ? await bcrypt.compare(submittedPassword, account.password)
    : securePlaintextMatch(account.password, submittedPassword)
  if (!matched || isPasswordHash(account.password)) return matched

  const upgradedAccount = { ...account, password: await bcrypt.hash(submittedPassword, 12) }
  accounts = accounts.some((item) => item.id === upgradedAccount.id)
    ? accounts.map((item) => (item.id === upgradedAccount.id ? upgradedAccount : item))
    : [upgradedAccount, ...accounts]
  await databaseStore?.upsertUser?.(upgradedAccount)
  Object.assign(account, upgradedAccount)
  return true
}

const maskEmail = (email) => {
  const [localPart, domain = ''] = String(email || '').split('@')
  if (!localPart || !domain) return 'your registered email'
  const visible = localPart.slice(0, Math.min(2, localPart.length))
  return `${visible}${'*'.repeat(Math.max(localPart.length - visible.length, 2))}@${domain}`
}

const hashMfaCode = (challengeId, code) =>
  crypto.createHmac('sha256', mfaCodeSecret).update(`${challengeId}:${code}`).digest('hex')

const isMfaOperational = () => mfaRequired && emailMfaConfigured && Boolean(databaseStore?.createMfaChallenge)

const getEmailTransporter = () => {
  if (!emailMfaConfigured) return null
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    })
  }
  return emailTransporter
}

const sendMfaCodeEmail = async (account, code) => {
  const transporter = getEmailTransporter()
  if (!transporter) throw new Error('Email MFA is not configured')
  const expiryLabel = `${mfaCodeTtlMinutes} minutes`
  await transporter.sendMail({
    from: smtpFrom,
    to: account.email,
    subject: `${code} is your FeastFlow verification code`,
    text: `Your FeastFlow verification code is ${code}. It expires in ${expiryLabel}. Do not share this code with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#151311;max-width:560px;margin:auto;padding:28px;border:1px solid #ded8cf;border-radius:8px">
        <p style="margin:0 0 8px;color:#a63623;font-size:12px;font-weight:700;letter-spacing:1px">FEASTFLOW SECURITY</p>
        <h1 style="margin:0 0 16px;font-size:24px">Verify your sign-in</h1>
        <p style="line-height:1.55">Use this one-time code to finish signing in. It expires in ${expiryLabel}.</p>
        <p style="margin:22px 0;padding:16px;background:#dff1e7;border-radius:6px;font-size:28px;font-weight:800;letter-spacing:8px;text-align:center">${code}</p>
        <p style="color:#67625a;line-height:1.5">Do not share this code. If you did not try to sign in, you can safely ignore this email.</p>
      </div>
    `,
  })
}

const issueEmailMfaChallenge = async (account) => {
  const challengeId = `MFA-${crypto.randomUUID().toUpperCase()}`
  const code = String(crypto.randomInt(100000, 1_000_000))
  const expiresAt = new Date(Date.now() + mfaCodeTtlMinutes * 60_000)
  await databaseStore.createMfaChallenge({
    id: challengeId,
    userId: account.id,
    purpose: 'login',
    codeHash: hashMfaCode(challengeId, code),
    expiresAt,
    maxAttempts: mfaMaxAttempts,
  })
  try {
    await sendMfaCodeEmail(account, code)
  } catch (error) {
    await databaseStore.invalidateMfaChallenge(challengeId).catch(() => undefined)
    throw error
  }
  return {
    mfaRequired: true,
    challengeId,
    delivery: maskEmail(account.email),
    expiresAt: expiresAt.toISOString(),
  }
}

const ensureVendorProfileForAccount = async (account) => {
  if (!account || account.role !== 'vendor') return account

  if (!account.vendorId) {
    account.vendorId = applicationVendorIdForUser(account)
  }

  const localAccountIndex = accounts.findIndex((item) => item.id === account.id)
  if (localAccountIndex >= 0) {
    accounts[localAccountIndex] = { ...accounts[localAccountIndex], vendorId: account.vendorId }
  } else {
    accounts = [account, ...accounts]
  }

  if (databaseStore?.upsertUser) {
    await databaseStore.upsertUser(account)
  }

  if (!vendors.some((vendor) => vendor.id === account.vendorId)) {
    vendors = [createOnboardingDraftVendor(account), ...vendors]
    await saveState()
    await reloadStateFromDatabase()
  }

  return (await findAccountById(account.id)) || account
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

const publicVendorId = (vendorId) =>
  crypto
    .createHmac('sha256', jwtSecret)
    .update(`public-vendor:${vendorId}`)
    .digest('hex')
    .slice(0, 16)

const publicProfileTitles = [
  'Signature Celebration Team',
  'Grand Gathering Specialist',
  'Festive Table Favourite',
  'Premium Event Kitchen',
  'Celebration Menu Expert',
  'Trusted Banquet Team',
  'Gathering Day Favourite',
  'FeastFlow Signature Partner',
]

const publicProfileTitle = (opaqueId) =>
  publicProfileTitles[Number.parseInt(opaqueId.slice(0, 8), 16) % publicProfileTitles.length]

const publicEventDetails = {
  wedding: {
    label: 'Wedding',
    vendorEvents: ['Wedding'],
    image: '/images/event-wedding.webp',
  },
  'kitty-party': {
    label: 'Kitty party',
    vendorEvents: ['House party'],
    image: '/images/event-kitty-party.webp',
  },
  'half-saree': {
    label: 'Half saree function',
    vendorEvents: ['Festival', 'Wedding'],
    image: '/images/event-half-saree.webp',
  },
  housewarming: {
    label: 'Housewarming',
    vendorEvents: ['House party', 'Festival'],
    image: '/images/event-housewarming.webp',
  },
  corporate: {
    label: 'Corporate event',
    vendorEvents: ['Corporate', 'Launch'],
    image: '/images/event-corporate.webp',
  },
  other: {
    label: 'Other event',
    vendorEvents: ['Wedding', 'Corporate', 'House party', 'Festival', 'Launch'],
    image: '/images/event-other.webp',
  },
}

const toPublicVendorCard = (vendor, eventType) => {
  const event = publicEventDetails[eventType]
  const opaqueId = publicVendorId(vendor.id)
  const publicBadgeAllowlist = new Set([
    'Verified',
    'Instant book',
    'Top rated',
    'Fast response',
    'Regional specialist',
    'Seafood specialist',
    'Large events',
  ])
  return {
    publicId: opaqueId,
    alias: publicProfileTitle(opaqueId),
    cuisine: vendor.cuisine,
    rating: vendor.rating,
    reviewCount: vendor.reviewCount,
    responseMinutes: vendor.responseMinutes,
    minPrice: vendor.minPrice,
    maxGuests: vendor.maxGuests,
    dietary: vendor.dietary,
    badges: vendor.badges.filter((badge) => publicBadgeAllowlist.has(badge)),
    image: event.image,
    eventLabel: event.label,
    menuHighlights: vendor.packages.slice(0, 3).map((caterPackage, index) => ({
      title: `${event.label} menu ${index + 1}`,
      pricePerGuest: caterPackage.pricePerGuest,
      minGuests: caterPackage.minGuests,
      itemCount: caterPackage.items.length,
      instantBook: caterPackage.instantBook,
    })),
  }
}

const vendorDocumentCount = (vendor) => Object.values(vendor.documents || {}).filter(Boolean).length

const vendorIdentityKey = (vendor) => {
  const name = String(vendor.name || '').trim().toLowerCase()
  const pincode = String(vendor.pincode || '').trim().toLowerCase()
  const cuisine = String(vendor.cuisine || '').trim().toLowerCase()
  if (!name || name === 'complete vendor onboarding' || !pincode) return vendor.id
  return `${name}|${pincode}|${cuisine}`
}

const dedupeAdminVendorRecords = (vendorRecords) => {
  const groups = new Map()
  for (const vendor of vendorRecords) {
    const key = vendorIdentityKey(vendor)
    groups.set(key, [...(groups.get(key) || []), vendor])
  }

  return vendorRecords.filter((vendor) => {
    const sameBusinessVendors = groups.get(vendorIdentityKey(vendor)) || []
    if (sameBusinessVendors.length < 2 || vendorDocumentCount(vendor) > 0) return true
    return !sameBusinessVendors.some(
      (candidate) => candidate.id !== vendor.id && vendorDocumentCount(candidate) > 0,
    )
  })
}

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

const canAccessBooking = (user, booking) => {
  if (!user || !booking) return false
  if (user.role === 'admin') return true
  if (user.role === 'vendor') return Boolean(user.vendorId && user.vendorId === booking.vendorId)
  return booking.customerId === user.id || (!booking.customerId && booking.customerName === user.name)
}

const bookingsVisibleTo = (user) => bookings.filter((booking) => canAccessBooking(user, booking))
const bookingCustomerAudience = (booking) => booking.customerId
  ? { userIds: [booking.customerId] }
  : { roles: ['customer'] }

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

const matchesAudience = (identity, audience) => {
  if (!audience) return true
  if (audience.userIds?.includes(identity.userId || identity.id)) return true
  if (audience.vendorIds?.includes(identity.vendorId)) return true
  if (audience.roles?.includes(identity.userRole || identity.role)) return true
  return false
}

const sendPushNotification = async (title, body, payload = {}, audience = null) => {
  const message = JSON.stringify({
    title,
    body,
    url: payload.url || '/',
    tag: payload.tag || payload.bookingId || payload.vendorId || title,
  })
  let delivered = 0

  if (pushEnabled && databaseStore?.listPushSubscriptions) {
    const subscriptions = await databaseStore.listPushSubscriptions()
    const recipients = subscriptions.filter((subscription) => matchesAudience(subscription, audience))
    await Promise.all(
      recipients.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            { endpoint: subscription.endpoint, keys: subscription.keys },
            message,
          )
          delivered += 1
        } catch (error) {
          if ([404, 410].includes(error?.statusCode)) {
            await databaseStore.deletePushSubscription(subscription.id)
            return
          }
          console.error('Web push notification failed:', error?.message || error)
        }
      }),
    )
  }

  if (databaseStore?.listMobilePushSubscriptions) {
    const subscriptions = await databaseStore.listMobilePushSubscriptions()
    const recipients = subscriptions.filter((subscription) => matchesAudience(subscription, audience))
    if (recipients.length) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(recipients.map((subscription) => ({
            to: subscription.expoPushToken,
            title,
            body,
            sound: 'default',
            channelId: 'feastflow-updates',
            data: payload,
          }))),
        })
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.errors?.[0]?.message || `Expo push failed (${response.status})`)
        const tickets = Array.isArray(result?.data) ? result.data : [result?.data]
        for (const [index, ticket] of tickets.entries()) {
          if (ticket?.status === 'ok') {
            delivered += 1
          } else if (ticket?.details?.error === 'DeviceNotRegistered') {
            const subscription = recipients[index]
            if (subscription) await databaseStore.deleteMobilePushSubscription(subscription.id)
          }
        }
      } catch (error) {
        console.error('Expo push notification failed:', error?.message || error)
      }
    }
  }
  return delivered
}

const publishEvent = (title, body, payload = {}, audience = null) => {
  const event = {
    id: makeId('EVT'),
    title,
    body,
    payload,
    time: nowTime(),
  }
  for (const client of eventClients) {
    if (!matchesAudience(client.user, audience)) continue
    client.response.write(`event: marketplace\n`)
    client.response.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  const persistedEvent = {
    ...event,
    payload: audience ? { ...payload, audience } : payload,
  }
  persistedEvents = [persistedEvent, ...persistedEvents].slice(0, 100)
  databaseStore?.logEvent(persistedEvent).catch((error) => {
    console.error('Failed to persist event log:', error.message)
  })
  if (audience) {
    sendPushNotification(title, body, payload, audience).catch((error) => {
      console.error('Failed to send push event:', error.message)
    })
  }
  return event
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'feastflow-api',
    database: databaseStore ? 'mysql' : 'memory',
    databaseTarget: isMysqlEnabled() ? databaseLabel() : null,
    pushNotifications: pushEnabled && Boolean(databaseStore),
    mobilePushNotifications: Boolean(databaseStore?.upsertMobilePushSubscription),
    emailMfa: {
      required: mfaRequired,
      configured: emailMfaConfigured && Boolean(databaseStore),
    },
    time: new Date().toISOString(),
  })
})

app.post('/api/auth/login', rateLimit({
  scope: 'login',
  limit: loginRateLimit,
  windowMs: loginRateWindowMs,
  scoped: true,
}), asyncHandler(async (req, res) => {
  const input = parseBody(loginRequestSchema, req, res)
  if (!input) return

  let account = await findAccountForLogin({ role: input.role, email: input.email })
  if (!account || !(await verifyAccountPassword(account, input.password))) {
    return res.status(401).json({ message: 'Invalid credentials for this role' })
  }

  account = await ensureVendorProfileForAccount(account)
  if (mfaRequired) {
    if (!isMfaOperational()) {
      return res.status(503).json({ message: 'Email MFA is not configured. Add SMTP settings before enabling MFA.' })
    }
    try {
      return res.status(202).json(await issueEmailMfaChallenge(account))
    } catch (error) {
      console.error('Could not deliver MFA email:', error.message)
      return res.status(503).json({ message: 'Verification email could not be sent. Please try again shortly.' })
    }
  }
  const user = publicUser(account)
  res.json({ token: issueToken(user), user })
}))

app.post('/api/auth/register', rateLimit({
  scope: 'register',
  limit: registerRateLimit,
  windowMs: registerRateWindowMs,
  scoped: true,
}), asyncHandler(async (req, res) => {
  const input = parseBody(registerRequestSchema, req, res)
  if (!input) return

  if (input.role === 'admin') {
    return res.status(403).json({ message: 'Administrator accounts are provisioned internally' })
  }

  if (await findAccountForLogin({ role: input.role, email: input.email })) {
    return res.status(409).json({ message: 'An account already exists for this email and role' })
  }

  let account = {
    id: accountIdFor(input.role, input.email),
    email: input.email,
    password: await bcrypt.hash(input.password, 12),
    name: input.name,
    role: input.role,
  }
  if (input.role === 'vendor') {
    account.vendorId = `vendor-${input.email.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 42)}`
  }
  accounts = [account, ...accounts]
  if (databaseStore?.upsertUser) {
    await databaseStore.upsertUser(account)
  }
  account = await ensureVendorProfileForAccount(account)
  if (input.role !== 'vendor') await saveState()
  if (mfaRequired) {
    if (!isMfaOperational()) {
      return res.status(503).json({ message: 'Email MFA is not configured. Add SMTP settings before enabling MFA.' })
    }
    try {
      return res.status(202).json(await issueEmailMfaChallenge(account))
    } catch (error) {
      console.error('Could not deliver MFA email:', error.message)
      return res.status(503).json({ message: 'Verification email could not be sent. Please try again shortly.' })
    }
  }
  const user = publicUser(account)
  res.status(201).json({ token: issueToken(user), user })
}))

app.post('/api/auth/mfa/verify', rateLimit({
  scope: 'mfa-verify',
  limit: 8,
  windowMs: 10 * 60_000,
  scoped: true,
}), asyncHandler(async (req, res) => {
  const input = parseBody(mfaCodeSchema, req, res)
  if (!input) return
  if (!mfaRequired) return res.status(404).json({ message: 'Email MFA is not enabled' })
  if (!isMfaOperational()) return res.status(503).json({ message: 'Email MFA is not configured' })

  const challenge = await databaseStore.getMfaChallengeById(input.challengeId)
  if (!challenge || challenge.purpose !== 'login' || challenge.status !== 'pending') {
    return res.status(400).json({ message: 'This verification request is no longer valid. Sign in again.' })
  }
  if (!challenge.expiresAt || new Date(challenge.expiresAt).getTime() <= Date.now()) {
    await databaseStore.invalidateMfaChallenge(challenge.id)
    return res.status(410).json({ message: 'This verification code has expired. Sign in again.' })
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    await databaseStore.invalidateMfaChallenge(challenge.id)
    return res.status(429).json({ message: 'Too many incorrect codes. Sign in again to receive a new code.' })
  }

  if (!securePlaintextMatch(challenge.codeHash, hashMfaCode(challenge.id, input.code))) {
    const updatedChallenge = await databaseStore.recordMfaChallengeAttempt(challenge.id)
    if (updatedChallenge?.attempts >= updatedChallenge.maxAttempts) {
      await databaseStore.invalidateMfaChallenge(challenge.id)
      return res.status(429).json({ message: 'Too many incorrect codes. Sign in again to receive a new code.' })
    }
    return res.status(400).json({ message: 'That verification code is not correct.' })
  }

  const account = await findAccountById(challenge.userId)
  if (!account || !(await databaseStore.verifyMfaChallenge(challenge.id))) {
    return res.status(400).json({ message: 'This verification request is no longer valid. Sign in again.' })
  }
  const user = publicUser(account)
  res.json({ token: issueToken(user), user })
}))

app.post('/api/auth/mfa/resend', rateLimit({
  scope: 'mfa-resend',
  limit: 3,
  windowMs: 10 * 60_000,
  scoped: true,
}), asyncHandler(async (req, res) => {
  const input = parseBody(mfaResendSchema, req, res)
  if (!input) return
  if (!mfaRequired) return res.status(404).json({ message: 'Email MFA is not enabled' })
  if (!isMfaOperational()) return res.status(503).json({ message: 'Email MFA is not configured' })

  const challenge = await databaseStore.getMfaChallengeById(input.challengeId)
  if (!challenge || challenge.purpose !== 'login' || challenge.status !== 'pending') {
    return res.status(400).json({ message: 'This verification request is no longer valid. Sign in again.' })
  }
  const account = await findAccountById(challenge.userId)
  if (!account) return res.status(400).json({ message: 'This verification request is no longer valid. Sign in again.' })

  await databaseStore.invalidateMfaChallenge(challenge.id)
  try {
    return res.status(202).json(await issueEmailMfaChallenge(account))
  } catch (error) {
    console.error('Could not resend MFA email:', error.message)
    return res.status(503).json({ message: 'Verification email could not be sent. Please try again shortly.' })
  }
}))

app.post('/api/public/vendors/search', rateLimit({
  scope: 'public-vendor-search',
  limit: 80,
  windowMs: 5 * 60_000,
}), asyncHandler(async (req, res) => {
  const input = parseBody(publicVendorSearchSchema, req, res)
  if (!input) return

  await reloadStateFromDatabase()
  const event = publicEventDetails[input.eventType]
  const results = vendors
    .filter(isCustomerVisibleVendor)
    .filter((vendor) => vendor.pincode === input.pincode || vendor.servicePincodes.includes(input.pincode))
    .filter((vendor) => event.vendorEvents.some((eventName) => vendor.eventTypes.includes(eventName)))
    .filter((vendor) => vendor.maxGuests >= input.guests)
    .sort((first, second) => second.rating - first.rating || first.minPrice - second.minPrice)
    .map((vendor) => toPublicVendorCard(vendor, input.eventType))

  res.json({
    vendors: results,
    count: results.length,
    event: event.label,
    pincode: input.pincode,
    guests: input.guests,
  })
}))

app.get('/api/bootstrap', requireAuth, asyncHandler(async (req, res) => {
  await reloadStateFromDatabase()
  let account = await findAccountById(req.user.id)
  if (!account) {
    return res.status(401).json({ message: 'Session user no longer exists. Please sign in again.' })
  }
  account = await ensureVendorProfileForAccount(account)
  const visibleVendors = account.role === 'customer'
    ? vendors.filter(isCustomerVisibleVendor)
    : account.role === 'vendor'
      ? vendors.filter((vendor) => vendor.id === account.vendorId)
      : vendors
  res.json({
    vendors: visibleVendors.map((vendor) => ({ ...vendor, publicId: publicVendorId(vendor.id) })),
    bookings: bookingsVisibleTo(publicUser(account)),
    addOns,
    user: publicUser(account),
  })
}))

app.get('/api/notifications', requireAuth, asyncHandler(async (req, res) => {
  await reloadStateFromDatabase()
  const notifications = persistedEvents
    .filter((event) => event.payload?.audience && matchesAudience(req.user, event.payload.audience))
    .map((event) => ({
      id: event.id,
      title: event.title,
      body: event.body,
      time: event.time,
    }))
    .slice(0, 20)
  res.json({ notifications })
}))

app.get('/api/admin/vendors', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin role required' })
  await reloadStateFromDatabase()

  const search = String(req.query.search || '').trim().toLowerCase()
  const status = String(req.query.status || 'all').trim()
  const reviewPriority = { pending: 0, 'needs-info': 1, rejected: 2, approved: 3 }
  const results = dedupeAdminVendorRecords(vendors)
    .filter((vendor) => status === 'all' || vendor.status === status)
    .filter((vendor) => !search || vendorSearchText(vendor).includes(search) || vendor.license.toLowerCase().includes(search))
    .sort((first, second) => {
      const firstOpenDocs = Object.values(first.documents || {}).filter((document) => document?.status !== 'approved').length
      const secondOpenDocs = Object.values(second.documents || {}).filter((document) => document?.status !== 'approved').length
      return secondOpenDocs - firstOpenDocs || reviewPriority[first.status] - reviewPriority[second.status] || first.name.localeCompare(second.name)
    })

  res.json({ vendors: results, count: results.length })
}))

app.get('/api/push/public-key', requireAuth, (_req, res) => {
  if (!pushEnabled) return res.status(503).json({ message: 'Push notifications are not configured' })
  res.json({ publicKey: vapidPublicKey })
})

app.post('/api/push/subscribe', requireAuth, asyncHandler(async (req, res) => {
  if (!pushEnabled || !databaseStore?.upsertPushSubscription) {
    return res.status(503).json({ message: 'Push notifications require MySQL and VAPID configuration' })
  }
  const subscription = req.body.subscription || {}
  const endpoint = String(subscription.endpoint || '').trim()
  const p256dh = String(subscription.keys?.p256dh || '').trim()
  const auth = String(subscription.keys?.auth || '').trim()
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ message: 'A valid browser push subscription is required' })
  }

  const id = `PUSH-${crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 48)}`
  await databaseStore.upsertPushSubscription({
    id,
    userId: req.user.id,
    userRole: req.user.role,
    vendorId: req.user.vendorId,
    endpoint,
    p256dh,
    auth,
  })
  res.status(201).json({ subscribed: true })
}))

app.delete('/api/push/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const endpoint = String(req.body.endpoint || '').trim()
  if (!endpoint || !databaseStore?.deletePushSubscription) {
    return res.json({ subscribed: false })
  }
  const id = `PUSH-${crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 48)}`
  await databaseStore.deletePushSubscription(id)
  res.json({ subscribed: false })
}))

app.post('/api/push/test', requireAuth, asyncHandler(async (req, res) => {
  const delivered = await sendPushNotification(
    'FeastFlow notifications enabled',
    'Booking, document, payment, and chat updates can now reach this device.',
    { url: '/', tag: 'feastflow-push-enabled' },
    { userIds: [req.user.id] },
  )
  res.json({ delivered })
}))

app.post('/api/push/mobile/subscribe', requireAuth, asyncHandler(async (req, res) => {
  if (!databaseStore?.upsertMobilePushSubscription) {
    return res.status(503).json({ message: 'Mobile push storage requires the MySQL backend' })
  }
  const input = parseBody(mobilePushSubscriptionSchema, req, res)
  if (!input) return
  const id = `MPUSH-${crypto.createHash('sha256').update(input.expoPushToken).digest('hex').slice(0, 36)}`
  await databaseStore.upsertMobilePushSubscription({
    id,
    userId: req.user.id,
    userRole: req.user.role,
    vendorId: req.user.vendorId,
    expoPushToken: input.expoPushToken,
    platform: input.platform,
  })
  res.status(201).json({ subscribed: true })
}))

app.delete('/api/push/mobile/subscribe', requireAuth, asyncHandler(async (req, res) => {
  if (!databaseStore?.deleteMobilePushSubscriptionByToken) {
    return res.status(503).json({ message: 'Mobile push storage requires the MySQL backend' })
  }
  const input = parseBody(mobilePushTokenSchema, req, res)
  if (!input) return
  await databaseStore.deleteMobilePushSubscriptionByToken(input.expoPushToken, req.user.id)
  res.json({ subscribed: false })
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
  const currentVendor = vendors.find((vendor) => vendor.id === vendorId)
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
  const mergedDocuments = {
    ...(currentVendor?.documents ?? {}),
    ...uploadedDocuments,
  }
  const foodLicense = Boolean(mergedDocuments.foodLicense)
  const identity = Boolean(mergedDocuments.identity)

  if (!businessName || !license) {
    return res.status(400).json({ message: 'Business name and license number are required' })
  }
  if (!foodLicense || !identity) {
    return res.status(400).json({ message: 'Food license and ID proof are mandatory for review' })
  }

  const bannerImage = application.bannerImage ? sanitizeBannerImage(application.bannerImage) : currentVendor?.image || pickApplicationBanner()
  const hasRejectedDocuments = Object.values(mergedDocuments).some((document) => document?.status === 'rejected')
  const nextStatus =
    hasRejectedDocuments
      ? 'needs-info'
      : currentVendor?.status === 'approved'
        ? 'approved'
        : 'pending'
  const preservedPackages = currentVendor?.packages?.length
    ? currentVendor.packages.map((pack) => ({
        ...pack,
        image: pack.image === currentVendor.image ? bannerImage : pack.image,
      }))
    : []
  const appVendor = {
    id: vendorId,
    name: businessName,
    owner: currentVendor?.owner || req.user.name || 'Vendor',
    status: nextStatus,
    cuisine,
    address: `Service base near ${pincode}`,
    pincode,
    coordinates: { latitude: 13.0221, longitude: 77.6408, label: `Service base ${pincode}` },
    serviceRadius: Number(application.radius || 12),
    servicePincodes: [pincode],
    distanceKm: currentVendor?.distanceKm || 0,
    rating: currentVendor?.rating || 0,
    reviewCount: currentVendor?.reviewCount || 0,
    responseMinutes: currentVendor?.responseMinutes || 0,
    minPrice: currentVendor?.minPrice || 500,
    maxGuests: currentVendor?.maxGuests || 250,
    license,
    docs: Object.entries(applicationDocumentItems)
      .filter(([key]) => Boolean(mergedDocuments[key]))
      .map(([, label]) => label),
    documents: mergedDocuments,
    dietary: currentVendor?.dietary?.length ? currentVendor.dietary : ['Vegetarian'],
    eventTypes: currentVendor?.eventTypes?.length ? currentVendor.eventTypes : ['Corporate', 'House party'],
    badges:
      currentVendor?.status === 'approved'
        ? currentVendor.badges
        : ['Under review'],
    image: bannerImage,
    payoutDue: currentVendor?.payoutDue || 0,
    availability: currentVendor?.availability?.length ? currentVendor.availability : [futureDate(18), futureDate(30)],
    adminNote: hasRejectedDocuments
      ? currentVendor?.adminNote || 'A document needs correction.'
      : currentVendor?.adminNote,
    packages: preservedPackages.length
      ? preservedPackages
      : [
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
    url: '/',
  }, { roles: ['admin'] })
  res.status(201).json({ vendor: persistedVendor })
}))

app.patch('/api/vendors/:vendorId/banner', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Vendor or admin role required' })
  }

  const vendor = vendors.find((item) => item.id === req.params.vendorId)
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' })
  if (req.user.role === 'vendor' && req.user.vendorId !== vendor.id) {
    return res.status(403).json({ message: 'You can only update your own vendor banner' })
  }

  const requestedImage = String(req.body.bannerImage || '')
  const isValidBanner =
    applicationBannerImages.includes(requestedImage) ||
    (requestedImage.startsWith('data:image/') && requestedImage.length < 3_500_000)
  if (!isValidBanner) {
    return res.status(400).json({ message: 'Upload a banner image under 2.5 MB.' })
  }

  const previousImage = vendor.image
  const bannerImage = sanitizeBannerImage(requestedImage)
  vendor.image = bannerImage
  vendor.packages = vendor.packages.map((pack) => ({
    ...pack,
    image: pack.image === previousImage ? bannerImage : pack.image,
  }))

  await saveState()
  await reloadStateFromDatabase()
  const persistedVendor = vendors.find((item) => item.id === vendor.id) || vendor
  publishEvent('Vendor banner updated', `${persistedVendor.name} refreshed their marketplace banner.`, {
    vendorId: persistedVendor.id,
  })
  res.json({ vendor: persistedVendor })
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
  vendor.minPrice = vendor.minPrice > 0 ? Math.min(vendor.minPrice, pricePerGuest) : pricePerGuest

  publishEvent('Package added', `${packageToAdd.title} was added to ${vendor.name}.`, {
    vendorId: vendor.id,
    packageId: packageToAdd.id,
  })
  await saveState()
  res.status(201).json({ vendor, package: packageToAdd })
}))

app.post('/api/bookings', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Customer role required' })
  const { vendorId, packageId, eventType, date, guests, addOns: addOnIds = [], note = '', paymentChoice = 'deposit', mode = 'quote' } =
    req.body
  const { vendor, caterPackage } = findVendorAndPackage(vendorId, packageId)
  if (!vendor || !caterPackage) return res.status(404).json({ message: 'Vendor package not found' })
  if (!isCustomerVisibleVendor(vendor)) return res.status(409).json({ message: 'This vendor is not currently available for booking' })
  if (!date || Number(guests) < caterPackage.minGuests) {
    return res.status(400).json({ message: `Minimum guest count is ${caterPackage.minGuests}` })
  }

  const amount = calculateBookingTotal({ vendorId, packageId, guests, addOnIds })
  const booking = {
    id: makeId('BK'),
    customerId: req.user.id,
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
  if (mode === 'instant') {
    payments.push({
      id: makeId('PAY'),
      bookingId: booking.id,
      amount: booking.deposit,
      currency: 'INR',
      status: 'succeeded',
      provider: 'FeastFlowPay Sandbox',
      createdAt: booking.createdAt,
      confirmedAt: booking.createdAt,
    })
  }
  publishEvent(mode === 'instant' ? 'Booking confirmed' : 'Quote request sent', `${booking.id} with ${vendor.name}`, {
    bookingId: booking.id,
    url: '/',
  }, { vendorIds: [vendor.id] })
  await saveState()
  res.status(201).json({ booking })
}))

app.post('/api/bookings/:bookingId/messages', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  if (!canAccessBooking(req.user, booking)) return res.status(403).json({ message: 'You cannot access this booking' })

  const text = String(req.body.text || '').trim()
  const from = req.user.role
  if (!text) return res.status(400).json({ message: 'Message text is required' })

  booking.messages.push({ from, text, time: nowTime() })
  publishEvent(
    'New chat message',
    `${booking.id}: ${text}`,
    { bookingId: booking.id, url: '/' },
    from === 'customer' ? { vendorIds: [booking.vendorId] } : bookingCustomerAudience(booking),
  )
  await saveState()
  res.json({ booking })
}))

app.post('/api/bookings/:bookingId/vendor-decision', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  if (req.user.role !== 'vendor' || req.user.vendorId !== booking.vendorId) {
    return res.status(403).json({ message: 'This booking belongs to another vendor' })
  }

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

  publishEvent('Vendor response saved', `${booking.id} is now ${booking.status}.`, { bookingId: booking.id, url: '/' }, bookingCustomerAudience(booking))
  await saveState()
  res.json({ booking })
}))

app.post('/api/payments/intent', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.body.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  if (req.user.role !== 'customer' || !canAccessBooking(req.user, booking)) {
    return res.status(403).json({ message: 'You cannot pay for this booking' })
  }

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
  if (req.user.role !== 'customer' || !canAccessBooking(req.user, booking)) {
    return res.status(403).json({ message: 'You cannot confirm this payment' })
  }

  payment.status = 'succeeded'
  payment.confirmedAt = new Date().toISOString()
  booking.status = 'confirmed'
  booking.deposit = payment.amount
  booking.timeline.push('Customer completed payment', 'Booking confirmed')

  publishEvent('Payment successful', `${booking.id} payment captured.`, { bookingId: booking.id, paymentId: payment.id, url: '/' }, { vendorIds: [booking.vendorId] })
  await saveState()
  res.json({ payment, booking })
}))

app.post('/api/bookings/:bookingId/complete', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  if (req.user.role !== 'admin' && (req.user.role !== 'vendor' || req.user.vendorId !== booking.vendorId)) {
    return res.status(403).json({ message: 'Vendor or admin role required for this booking' })
  }
  booking.status = 'completed'
  booking.timeline.push('Service delivered', 'Marked completed')
  publishEvent('Booking completed', `${booking.id} was marked completed.`, { bookingId: booking.id, url: '/' }, bookingCustomerAudience(booking))
  await saveState()
  res.json({ booking })
}))

app.post('/api/bookings/:bookingId/review', requireAuth, asyncHandler(async (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.bookingId)
  if (!booking) return res.status(404).json({ message: 'Booking not found' })
  if (req.user.role !== 'customer' || !canAccessBooking(req.user, booking)) {
    return res.status(403).json({ message: 'You cannot review this booking' })
  }
  booking.review = { rating: Number(req.body.rating || 5), text: String(req.body.text || 'Great service and food quality.') }
  if (!booking.timeline.includes('Review submitted')) booking.timeline.push('Review submitted')
  publishEvent('Review submitted', `${booking.id} received a customer review.`, { bookingId: booking.id, url: '/' }, { vendorIds: [booking.vendorId] })
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

  publishEvent('Vendor verification updated', `${vendor.name} moved to ${vendor.status}.`, { vendorId: vendor.id, url: '/' }, { vendorIds: [vendor.id] })
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
    url: '/',
  }, { vendorIds: [document.vendorId] })
  res.json({ document, vendor })
}))

const findDocumentForAdminAction = async (documentId) => {
  let document = databaseStore?.getDocumentById
    ? await databaseStore.getDocumentById(documentId)
    : null
  if (!document) {
    for (const vendor of vendors) {
      const match = Object.values(vendor.documents || {}).find((item) => item?.id === documentId)
      if (match) {
        document = match
        break
      }
    }
  }
  return document
}

const removeDocumentFromVendor = async ({ document, adminNote, eventTitle, eventBody, eventPayload }) => {
  if (!document) return null

  await reloadStateFromDatabase()
  let vendor = vendors.find((item) => item.id === document.vendorId)
  if (!vendor) return null

  const documentKey = document.key || documentKeyFromLabel(document.documentName)
  const documentLabel = document.documentName || applicationDocumentItems[documentKey] || 'Document'
  vendor.documents = { ...(vendor.documents || {}) }
  delete vendor.documents[documentKey]
  vendor.docs = (vendor.docs || []).filter((label) => label !== documentLabel)
  vendor.status = 'needs-info'
  vendor.adminNote = adminNote(documentLabel, vendor)
  vendor.badges = Array.from(
    new Set([...vendor.badges.filter((badge) => badge !== 'Verified'), 'Needs document review']),
  )

  await saveState()
  await reloadStateFromDatabase()
  vendor = vendors.find((item) => item.id === document.vendorId) || vendor
  publishEvent(eventTitle, eventBody(documentLabel, vendor), {
    documentId: document.id,
    vendorId: vendor.id,
    documentKey,
    ...(eventPayload || {}),
    url: '/',
  }, { vendorIds: [vendor.id] })
  return { documentId: document.id, documentKey, vendor }
}

app.post('/api/documents/:documentId/reupload-request', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin role required' })

  const reason = String(req.body.reason || '').trim()
  if (!reason) {
    return res.status(400).json({ message: 'Reupload reason is required' })
  }

  const document = await findDocumentForAdminAction(req.params.documentId)
  if (!document) return res.status(404).json({ message: 'Document not found' })

  const result = await removeDocumentFromVendor({
    document,
    adminNote: (documentLabel) => `${documentLabel} requires reupload: ${reason}`,
    eventTitle: 'Document reupload requested',
    eventBody: (documentLabel) => `${documentLabel} must be uploaded again.`,
    eventPayload: { reason },
  })
  if (!result) return res.status(404).json({ message: 'Vendor not found for this document' })
  res.json(result)
}))

app.delete('/api/documents/:documentId', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin role required' })

  const reason = String(req.body?.reason || '').trim()
  const document = await findDocumentForAdminAction(req.params.documentId)
  if (!document) return res.status(404).json({ message: 'Document not found' })

  const result = await removeDocumentFromVendor({
    document,
    adminNote: (documentLabel) =>
      reason ? `${documentLabel} deleted by admin: ${reason}` : `${documentLabel} was deleted by admin.`,
    eventTitle: 'Document deleted',
    eventBody: (documentLabel, vendor) => `${documentLabel} was deleted from ${vendor.name}.`,
    eventPayload: reason ? { reason } : {},
  })
  if (!result) return res.status(404).json({ message: 'Vendor not found for this document' })
  res.json({ ...result, deleted: true })
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

  const client = { response: res, user: req.user }
  eventClients.add(client)
  req.on('close', () => {
    eventClients.delete(client)
  })
})

app.get('/images/:imageName', (req, res, next) => {
  const image = demoImageAssets[req.params.imageName]
  if (!image) return next()
  res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate')
  res.type('image/svg+xml').send(createDemoImageSvg(image))
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
