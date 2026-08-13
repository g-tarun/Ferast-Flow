import 'dotenv/config'
import mysql from 'mysql2/promise'

const apiBase = `${process.env.SMOKE_API_URL || 'http://127.0.0.1:4010'}/api`

const request = async (path, { token, body, method } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path}: ${payload.message || response.status}`)
  return payload
}

const login = (role, email) => request('/auth/login', { body: { role, email, password: 'demo1234' } })

let bookingId
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'feastflow_local',
  connectionLimit: 2,
})

try {
  const [customer, vendor, admin] = await Promise.all([
    login('customer', 'customer@feastflow.test'),
    login('vendor', 'vendor@feastflow.test'),
    login('admin', 'admin@feastflow.test'),
  ])
  const customerBootstrap = await request('/bootstrap', { token: customer.token })
  const targetVendor = customerBootstrap.vendors.find((item) => item.id === vendor.user.vendorId)
  const targetPackage = targetVendor?.packages?.[0]
  if (!targetVendor || !targetPackage) throw new Error('Smoke-test vendor package is unavailable')

  const created = await request('/bookings', {
    token: customer.token,
    body: {
      vendorId: targetVendor.id,
      packageId: targetPackage.id,
      eventType: targetVendor.eventTypes[0] || 'Wedding',
      date: targetVendor.availability[0],
      guests: Math.max(targetPackage.minGuests, 40),
      addOns: [],
      note: 'Automated mobile API smoke test',
      paymentChoice: 'deposit',
      mode: 'quote',
    },
  })
  bookingId = created.booking.id
  if (created.booking.customerId !== customer.user.id) throw new Error('Booking customer ownership was not saved')

  await request(`/bookings/${bookingId}/messages`, { token: customer.token, body: { text: 'Mobile chat smoke test' } })
  await request(`/bookings/${bookingId}/vendor-decision`, { token: vendor.token, body: { decision: 'accept' } })
  const intent = await request('/payments/intent', { token: customer.token, body: { bookingId } })
  const confirmed = await request(`/payments/${intent.payment.id}/confirm`, { token: customer.token, body: {} })
  if (confirmed.booking.status !== 'confirmed') throw new Error('Payment did not confirm the booking')

  const adminBootstrap = await request('/bootstrap', { token: admin.token })
  if (!adminBootstrap.bookings.some((item) => item.id === bookingId)) throw new Error('Admin cannot see the test booking')

  console.log(JSON.stringify({ auth: true, ownership: true, chat: true, vendorDecision: true, payment: true, adminVisibility: true }, null, 2))
} finally {
  if (bookingId) {
    await pool.execute('DELETE FROM bookings WHERE id = ?', [bookingId])
    await pool.execute("DELETE FROM event_log WHERE payload LIKE ?", [`%${bookingId}%`])
  }
  await pool.end()
}
