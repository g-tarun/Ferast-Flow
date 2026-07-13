import mysql from 'mysql2/promise'

const mysqlConnectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || ''

const parseMysqlConnectionUrl = (connectionUrl) => {
  if (!connectionUrl) return {}
  try {
    const url = new URL(connectionUrl)
    const sslValue = url.searchParams.get('ssl') || url.searchParams.get('sslmode')
    const shouldUseSsl =
      process.env.MYSQL_SSL === 'true' ||
      (sslValue && !['false', '0', 'disabled', 'disable'].includes(sslValue.toLowerCase()))

    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
      ...(shouldUseSsl
        ? {
            ssl: {
              rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false',
            },
          }
        : {}),
    }
  } catch (error) {
    console.warn(`Ignoring invalid MySQL connection URL: ${error.message}`)
    return {}
  }
}

const parsedMysqlUrl = parseMysqlConnectionUrl(mysqlConnectionUrl)
const databaseName = parsedMysqlUrl.database || process.env.MYSQL_DATABASE || 'feastflow_local'
const shouldCreateDatabase =
  process.env.MYSQL_CREATE_DATABASE === undefined
    ? !mysqlConnectionUrl || !parsedMysqlUrl.database
    : process.env.MYSQL_CREATE_DATABASE === 'true'

const mysqlConfig = {
  host: parsedMysqlUrl.host || process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(parsedMysqlUrl.port || process.env.MYSQL_PORT || 3306),
  user: parsedMysqlUrl.user || process.env.MYSQL_USER || 'root',
  password: parsedMysqlUrl.password || process.env.MYSQL_PASSWORD || '',
  ...(process.env.MYSQL_SSL === 'true' || parsedMysqlUrl.ssl
    ? {
        ssl: {
          rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      }
    : {}),
}
const mysqlMaxAllowedPacket = Math.max(Number(process.env.MYSQL_MAX_ALLOWED_PACKET || 67_108_864), 16_777_216)

const documentLabels = {
  foodLicense: 'Food license',
  identity: 'Owner ID',
  insurance: 'Insurance',
}

const defaultAddOns = [
  { id: 'live-counter', name: 'Live counter', price: 18000 },
  { id: 'premium-dessert', name: 'Premium dessert bar', price: 12000 },
  { id: 'service-staff', name: 'Service staff', price: 9000 },
  { id: 'eco-serveware', name: 'Eco serveware', price: 4500 },
]

const stateTables = [
  'reviews',
  'payments',
  'chat_messages',
  'booking_timeline',
  'booking_add_ons',
  'bookings',
  'package_items',
  'package_tags',
  'vendor_packages',
  'documents',
  'vendor_service_pincodes',
  'vendor_dietary_options',
  'vendor_event_types',
  'vendor_badges',
  'vendor_availability',
  'vendors',
  'add_ons',
]

const parseJsonValue = (value) => {
  if (!value) return null
  if (typeof value === 'string') return JSON.parse(value)
  return value
}

const groupBy = (items, key) =>
  items.reduce((groups, item) => {
    const groupKey = item[key]
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey).push(item)
    return groups
  }, new Map())

const asNumber = (value) => Number(value || 0)

const asBoolean = (value) => Boolean(Number(value))

const dateOnly = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

const dateTimeForMysql = (value) => {
  const date = value ? new Date(value) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  return safeDate.toISOString().slice(0, 19).replace('T', ' ')
}

const decodeDataUrl = (dataUrl) => {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(String(dataUrl || ''))
  if (!match) return null
  try {
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length === 0) return null
    return { mimeType: match[1], buffer }
  } catch {
    return null
  }
}

const escapePdfText = (value) => String(value || '').replace(/[\\()]/g, '\\$&')

const createDemoDocumentBuffer = ({ vendorName, documentName }) => {
  const lines = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  const stream = [
    'BT',
    '/F1 18 Tf',
    '72 720 Td',
    `(${escapePdfText(documentName)}) Tj`,
    '0 -30 Td',
    '/F1 12 Tf',
    `(${escapePdfText(vendorName)}) Tj`,
    '0 -22 Td',
    '(Demo verification document generated for local testing.) Tj',
    'ET',
  ].join('\n')
  lines.push(`5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`)

  let pdf = ''
  const offsets = []
  for (const line of lines) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += line
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${lines.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${lines.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}

const safeDocumentId = (vendorId, key) =>
  `${String(vendorId || 'vendor').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-${String(key || 'document')
    .replace(/[^a-z0-9-]+/gi, '-')
    .toLowerCase()}`

const documentStatusForVendor = (vendor) => (vendor.status === 'approved' ? 'approved' : 'pending')

const documentFromRow = (document) =>
  document
    ? {
        id: document.id,
        parentId: document.parent_id,
        parentType: document.parent_type,
        vendorId: document.vendor_id,
        key: document.document_key,
        documentName: document.document_name,
        name: document.original_file_name,
        type: document.mime_type,
        size: asNumber(document.file_size),
        status: document.status,
        uploadedBy: document.uploaded_by || undefined,
        uploadedAt: document.uploaded_at,
        approvedBy: document.approved_by || undefined,
        approvedAt: document.approved_at || undefined,
        rejectionReason: document.rejection_reason || undefined,
      }
    : null

const documentKeyFromLabel = (label) => {
  const match = Object.entries(documentLabels).find(([, value]) => value === label)
  if (match) return match[0]
  return String(label || 'document').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}

const legacyStateExists = async (pool) => {
  const [rows] = await pool.execute(
    `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_state'
    `,
    [databaseName],
  )
  return rows.length > 0
}

const loadLegacyState = async (pool) => {
  if (!(await legacyStateExists(pool))) return null
  const [rows] = await pool.execute('SELECT data FROM app_state WHERE id = ?', ['current'])
  if (rows.length === 0) return null
  return parseJsonValue(rows[0].data)
}

const legacyDocumentTableExists = async (pool) => {
  const [rows] = await pool.execute(
    `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vendor_documents'
    `,
    [databaseName],
  )
  return rows.length > 0
}

const migrateLegacyVendorDocuments = async (pool) => {
  if (!(await legacyDocumentTableExists(pool))) return

  const [[documentCountRows], [legacyRows], [vendorRows]] = await Promise.all([
    pool.query('SELECT COUNT(*) AS total FROM documents'),
    pool.query('SELECT * FROM vendor_documents ORDER BY vendor_id ASC, document_key ASC'),
    pool.query('SELECT id, name, status FROM vendors'),
  ])
  const vendorsById = new Map(vendorRows.map((vendor) => [vendor.id, vendor]))
  const documentsAlreadyExist = Number(documentCountRows[0]?.total || 0) > 0

  if (!documentsAlreadyExist) {
    for (const legacyDocument of legacyRows) {
      const vendor = vendorsById.get(legacyDocument.vendor_id) || {
        id: legacyDocument.vendor_id,
        name: legacyDocument.vendor_id,
        status: 'pending',
      }
      const key = legacyDocument.document_key
      const documentName = legacyDocument.label || documentLabels[key] || key
      const decoded = decodeDataUrl(legacyDocument.data_url)
      const fileBlob =
        decoded?.buffer ||
        createDemoDocumentBuffer({
          vendorName: vendor.name,
          documentName,
        })
      const mimeType = decoded?.mimeType || legacyDocument.mime_type || 'application/pdf'
      const fileName =
        legacyDocument.file_name ||
        `${String(documentName).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'document'}.pdf`
      const status = documentStatusForVendor(vendor)
      const approvedAt = status === 'approved' ? dateTimeForMysql(legacyDocument.uploaded_at || new Date()) : null

      await pool.execute(
        `
          INSERT IGNORE INTO documents (
            id, parent_id, parent_type, vendor_id, document_key, document_name,
            original_file_name, mime_type, file_size, file_blob, status,
            uploaded_by, uploaded_at, approved_by, approved_at, rejection_reason
          )
          VALUES (?, ?, 'vendor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          safeDocumentId(legacyDocument.vendor_id, key),
          legacyDocument.vendor_id,
          legacyDocument.vendor_id,
          key,
          documentName,
          fileName,
          mimeType,
          asNumber(legacyDocument.file_size) || fileBlob.length,
          fileBlob,
          status,
          null,
          dateTimeForMysql(legacyDocument.uploaded_at || new Date()),
          status === 'approved' ? 'migration' : null,
          approvedAt,
          null,
        ],
      )
    }
  }

  await pool.query('DROP TABLE IF EXISTS vendor_documents')
}

const createSchema = async (pool) => {
  const statements = [
    `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(120) PRIMARY KEY,
        email VARCHAR(180) NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(160) NOT NULL,
        role VARCHAR(32) NOT NULL,
        vendor_id VARCHAR(120) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY users_role_email_unique (role, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS mfa_challenges (
        id VARCHAR(120) PRIMARY KEY,
        user_id VARCHAR(120) NOT NULL,
        purpose VARCHAR(32) NOT NULL DEFAULT 'login',
        code_hash CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
        expires_at DATETIME NOT NULL,
        sent_at DATETIME NOT NULL,
        verified_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY mfa_challenges_user_status_index (user_id, status),
        KEY mfa_challenges_expiry_index (expires_at),
        CONSTRAINT mfa_challenges_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(120) PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        owner VARCHAR(160) NOT NULL,
        status VARCHAR(32) NOT NULL,
        cuisine VARCHAR(180) NOT NULL,
        address VARCHAR(240) NOT NULL,
        pincode VARCHAR(20) NOT NULL,
        latitude DECIMAL(10,7) NOT NULL,
        longitude DECIMAL(10,7) NOT NULL,
        location_label VARCHAR(220) NOT NULL,
        service_radius INT NOT NULL,
        distance_km DECIMAL(8,2) NOT NULL DEFAULT 0,
        rating DECIMAL(3,2) NOT NULL DEFAULT 0,
        review_count INT NOT NULL DEFAULT 0,
        response_minutes INT NOT NULL DEFAULT 0,
        min_price INT NOT NULL DEFAULT 0,
        max_guests INT NOT NULL DEFAULT 0,
        license VARCHAR(120) NOT NULL,
        image LONGTEXT NOT NULL,
        payout_due INT NOT NULL DEFAULT 0,
        admin_note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(120) PRIMARY KEY,
        parent_id VARCHAR(120) NOT NULL,
        parent_type VARCHAR(40) NOT NULL DEFAULT 'vendor',
        vendor_id VARCHAR(120) NOT NULL,
        document_key VARCHAR(64) NOT NULL,
        document_name VARCHAR(120) NOT NULL,
        original_file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NOT NULL,
        file_size INT NOT NULL,
        file_blob LONGBLOB NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        uploaded_by VARCHAR(120) NULL,
        uploaded_at DATETIME NOT NULL,
        approved_by VARCHAR(120) NULL,
        approved_at DATETIME NULL,
        rejection_reason TEXT NULL,
        UNIQUE KEY documents_vendor_key_unique (vendor_id, document_key),
        KEY documents_parent_index (parent_id, parent_type),
        KEY documents_status_index (status),
        CONSTRAINT documents_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS vendor_service_pincodes (
        vendor_id VARCHAR(120) NOT NULL,
        pincode VARCHAR(20) NOT NULL,
        PRIMARY KEY (vendor_id, pincode),
        CONSTRAINT vendor_pincodes_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS vendor_dietary_options (
        vendor_id VARCHAR(120) NOT NULL,
        option_name VARCHAR(80) NOT NULL,
        PRIMARY KEY (vendor_id, option_name),
        CONSTRAINT vendor_dietary_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS vendor_event_types (
        vendor_id VARCHAR(120) NOT NULL,
        event_type VARCHAR(80) NOT NULL,
        PRIMARY KEY (vendor_id, event_type),
        CONSTRAINT vendor_events_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS vendor_badges (
        vendor_id VARCHAR(120) NOT NULL,
        badge VARCHAR(80) NOT NULL,
        PRIMARY KEY (vendor_id, badge),
        CONSTRAINT vendor_badges_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS vendor_availability (
        vendor_id VARCHAR(120) NOT NULL,
        available_date DATE NOT NULL,
        PRIMARY KEY (vendor_id, available_date),
        CONSTRAINT vendor_availability_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS vendor_packages (
        id VARCHAR(120) PRIMARY KEY,
        vendor_id VARCHAR(120) NOT NULL,
        title VARCHAR(180) NOT NULL,
        description TEXT NOT NULL,
        price_per_guest INT NOT NULL,
        min_guests INT NOT NULL,
        image LONGTEXT NOT NULL,
        instant_book TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT vendor_packages_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS package_tags (
        package_id VARCHAR(120) NOT NULL,
        tag VARCHAR(80) NOT NULL,
        PRIMARY KEY (package_id, tag),
        CONSTRAINT package_tags_package_fk FOREIGN KEY (package_id) REFERENCES vendor_packages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS package_items (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        package_id VARCHAR(120) NOT NULL,
        sort_order INT NOT NULL,
        item_text VARCHAR(180) NOT NULL,
        CONSTRAINT package_items_package_fk FOREIGN KEY (package_id) REFERENCES vendor_packages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS add_ons (
        id VARCHAR(80) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        price INT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(120) PRIMARY KEY,
        vendor_id VARCHAR(120) NOT NULL,
        package_id VARCHAR(120) NOT NULL,
        customer_name VARCHAR(160) NOT NULL,
        event_type VARCHAR(80) NOT NULL,
        event_date DATE NOT NULL,
        guests INT NOT NULL,
        note TEXT NULL,
        amount INT NOT NULL,
        deposit INT NOT NULL,
        payment_choice VARCHAR(32) NOT NULL,
        status VARCHAR(40) NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT bookings_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS booking_add_ons (
        booking_id VARCHAR(120) NOT NULL,
        add_on_id VARCHAR(80) NOT NULL,
        PRIMARY KEY (booking_id, add_on_id),
        CONSTRAINT booking_addons_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS booking_timeline (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        booking_id VARCHAR(120) NOT NULL,
        sort_order INT NOT NULL,
        timeline_text VARCHAR(240) NOT NULL,
        CONSTRAINT booking_timeline_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        booking_id VARCHAR(120) NOT NULL,
        sender_role VARCHAR(32) NOT NULL,
        message_text TEXT NOT NULL,
        message_time VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chat_messages_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(120) PRIMARY KEY,
        booking_id VARCHAR(120) NOT NULL,
        amount INT NOT NULL,
        currency VARCHAR(12) NOT NULL,
        status VARCHAR(48) NOT NULL,
        provider VARCHAR(120) NOT NULL,
        created_at DATETIME NOT NULL,
        confirmed_at DATETIME NULL,
        CONSTRAINT payments_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS reviews (
        booking_id VARCHAR(120) PRIMARY KEY,
        rating INT NOT NULL,
        review_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT reviews_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS event_log (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(180) NOT NULL,
        body TEXT NOT NULL,
        payload JSON NULL,
        event_time VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR(120) PRIMARY KEY,
        user_id VARCHAR(120) NOT NULL,
        user_role VARCHAR(32) NOT NULL,
        vendor_id VARCHAR(120) NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY push_subscriptions_user_index (user_id),
        KEY push_subscriptions_role_index (user_role),
        KEY push_subscriptions_vendor_index (vendor_id),
        CONSTRAINT push_subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  ]

  for (const statement of statements) {
    await pool.query(statement)
  }

  await migrateLegacyVendorDocuments(pool)
}

const relationalStateExists = async (pool) => {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users')
  return Number(rows[0]?.total || 0) > 0
}

const readRelationalState = async (pool) => {
  const [
    [userRows],
    [addOnRows],
    [vendorRows],
    [documentRows],
    [pincodeRows],
    [dietaryRows],
    [eventTypeRows],
    [badgeRows],
    [availabilityRows],
    [packageRows],
    [tagRows],
    [itemRows],
    [bookingRows],
    [bookingAddOnRows],
    [timelineRows],
    [messageRows],
    [reviewRows],
    [paymentRows],
    [eventRows],
  ] = await Promise.all([
    pool.query('SELECT * FROM users ORDER BY created_at ASC'),
    pool.query('SELECT * FROM add_ons ORDER BY id ASC'),
    pool.query('SELECT * FROM vendors ORDER BY created_at ASC'),
    pool.query(
      `
        SELECT
          id, parent_id, parent_type, vendor_id, document_key, document_name,
          original_file_name, mime_type, file_size, status, uploaded_by,
          uploaded_at, approved_by, approved_at, rejection_reason
        FROM documents
        ORDER BY vendor_id ASC, document_key ASC, uploaded_at DESC
      `,
    ),
    pool.query('SELECT * FROM vendor_service_pincodes ORDER BY vendor_id ASC, pincode ASC'),
    pool.query('SELECT * FROM vendor_dietary_options ORDER BY vendor_id ASC, option_name ASC'),
    pool.query('SELECT * FROM vendor_event_types ORDER BY vendor_id ASC, event_type ASC'),
    pool.query('SELECT * FROM vendor_badges ORDER BY vendor_id ASC, badge ASC'),
    pool.query('SELECT * FROM vendor_availability ORDER BY vendor_id ASC, available_date ASC'),
    pool.query('SELECT * FROM vendor_packages ORDER BY created_at ASC'),
    pool.query('SELECT * FROM package_tags ORDER BY package_id ASC, tag ASC'),
    pool.query('SELECT * FROM package_items ORDER BY package_id ASC, sort_order ASC'),
    pool.query('SELECT * FROM bookings ORDER BY created_at DESC'),
    pool.query('SELECT * FROM booking_add_ons ORDER BY booking_id ASC, add_on_id ASC'),
    pool.query('SELECT * FROM booking_timeline ORDER BY booking_id ASC, sort_order ASC'),
    pool.query('SELECT * FROM chat_messages ORDER BY booking_id ASC, id ASC'),
    pool.query('SELECT * FROM reviews'),
    pool.query('SELECT * FROM payments ORDER BY created_at DESC'),
    pool.query('SELECT * FROM event_log ORDER BY created_at DESC LIMIT 100'),
  ])

  const documentsByVendor = groupBy(documentRows, 'vendor_id')
  const pincodesByVendor = groupBy(pincodeRows, 'vendor_id')
  const dietaryByVendor = groupBy(dietaryRows, 'vendor_id')
  const eventTypesByVendor = groupBy(eventTypeRows, 'vendor_id')
  const badgesByVendor = groupBy(badgeRows, 'vendor_id')
  const availabilityByVendor = groupBy(availabilityRows, 'vendor_id')
  const packagesByVendor = groupBy(packageRows, 'vendor_id')
  const tagsByPackage = groupBy(tagRows, 'package_id')
  const itemsByPackage = groupBy(itemRows, 'package_id')
  const addOnsByBooking = groupBy(bookingAddOnRows, 'booking_id')
  const timelineByBooking = groupBy(timelineRows, 'booking_id')
  const messagesByBooking = groupBy(messageRows, 'booking_id')
  const reviewsByBooking = new Map(reviewRows.map((review) => [review.booking_id, review]))

  const vendors = vendorRows.map((vendor) => {
    const documentEntries = documentsByVendor.get(vendor.id) || []
    const documents = {}
    for (const document of documentEntries) {
      documents[document.document_key] = documentFromRow(document)
    }

    return {
      id: vendor.id,
      name: vendor.name,
      owner: vendor.owner,
      status: vendor.status,
      cuisine: vendor.cuisine,
      address: vendor.address,
      pincode: vendor.pincode,
      coordinates: {
        latitude: asNumber(vendor.latitude),
        longitude: asNumber(vendor.longitude),
        label: vendor.location_label,
      },
      serviceRadius: asNumber(vendor.service_radius),
      servicePincodes: (pincodesByVendor.get(vendor.id) || []).map((item) => item.pincode),
      distanceKm: asNumber(vendor.distance_km),
      rating: asNumber(vendor.rating),
      reviewCount: asNumber(vendor.review_count),
      responseMinutes: asNumber(vendor.response_minutes),
      minPrice: asNumber(vendor.min_price),
      maxGuests: asNumber(vendor.max_guests),
      license: vendor.license,
      docs: documentEntries.map((item) => item.document_name),
      documents,
      dietary: (dietaryByVendor.get(vendor.id) || []).map((item) => item.option_name),
      eventTypes: (eventTypesByVendor.get(vendor.id) || []).map((item) => item.event_type),
      badges: (badgesByVendor.get(vendor.id) || []).map((item) => item.badge),
      image: vendor.image,
      payoutDue: asNumber(vendor.payout_due),
      availability: (availabilityByVendor.get(vendor.id) || []).map((item) => dateOnly(item.available_date)),
      adminNote: vendor.admin_note || undefined,
      packages: (packagesByVendor.get(vendor.id) || []).map((pack) => ({
        id: pack.id,
        title: pack.title,
        description: pack.description,
        pricePerGuest: asNumber(pack.price_per_guest),
        minGuests: asNumber(pack.min_guests),
        image: pack.image,
        tags: (tagsByPackage.get(pack.id) || []).map((item) => item.tag),
        instantBook: asBoolean(pack.instant_book),
        items: (itemsByPackage.get(pack.id) || []).map((item) => item.item_text),
      })),
    }
  })

  const bookings = bookingRows.map((booking) => {
    const review = reviewsByBooking.get(booking.id)
    return {
      id: booking.id,
      vendorId: booking.vendor_id,
      packageId: booking.package_id,
      customerName: booking.customer_name,
      eventType: booking.event_type,
      date: dateOnly(booking.event_date),
      guests: asNumber(booking.guests),
      addOns: (addOnsByBooking.get(booking.id) || []).map((item) => item.add_on_id),
      note: booking.note || '',
      amount: asNumber(booking.amount),
      deposit: asNumber(booking.deposit),
      paymentChoice: booking.payment_choice,
      status: booking.status,
      createdAt: booking.created_at,
      timeline: (timelineByBooking.get(booking.id) || []).map((item) => item.timeline_text),
      messages: (messagesByBooking.get(booking.id) || []).map((message) => ({
        from: message.sender_role,
        text: message.message_text,
        time: message.message_time,
      })),
      review: review ? { rating: asNumber(review.rating), text: review.review_text } : undefined,
    }
  })

  return {
    accounts: userRows.map((user) => ({
      id: user.id,
      email: user.email,
      password: user.password,
      name: user.name,
      role: user.role,
      vendorId: user.vendor_id || undefined,
    })),
    vendors,
    bookings,
    payments: paymentRows.map((payment) => ({
      id: payment.id,
      bookingId: payment.booking_id,
      amount: asNumber(payment.amount),
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      createdAt: payment.created_at,
      confirmedAt: payment.confirmed_at || undefined,
    })),
    addOns: addOnRows.map((addOn) => ({
      id: addOn.id,
      name: addOn.name,
      price: asNumber(addOn.price),
    })),
    events: eventRows.map((event) => ({
      id: event.id,
      title: event.title,
      body: event.body,
      payload: parseJsonValue(event.payload) || {},
      time: event.event_time,
    })),
  }
}

const userFromRow = (user) =>
  user
    ? {
        id: user.id,
        email: user.email,
        password: user.password,
        name: user.name,
        role: user.role,
        vendorId: user.vendor_id || undefined,
      }
    : null

const mfaChallengeFromRow = (challenge) =>
  challenge
    ? {
        id: challenge.id,
        userId: challenge.user_id,
        purpose: challenge.purpose,
        codeHash: challenge.code_hash,
        status: challenge.status,
        attempts: asNumber(challenge.attempts),
        maxAttempts: asNumber(challenge.max_attempts),
        expiresAt: challenge.expires_at ? new Date(challenge.expires_at).toISOString() : null,
        sentAt: challenge.sent_at ? new Date(challenge.sent_at).toISOString() : null,
        verifiedAt: challenge.verified_at ? new Date(challenge.verified_at).toISOString() : null,
      }
    : null

const upsertUser = async (executor, account) => {
  await executor.execute(
    `
      INSERT INTO users (id, email, password, name, role, vendor_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        password = VALUES(password),
        name = VALUES(name),
        role = VALUES(role),
        vendor_id = VALUES(vendor_id)
    `,
    [
      account.id,
      account.email,
      account.password,
      account.name,
      account.role,
      account.vendorId || null,
    ],
  )
}

const insertUserIfMissing = async (executor, account) => {
  await executor.execute(
    `
      INSERT IGNORE INTO users (id, email, password, name, role, vendor_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      account.id,
      account.email,
      account.password,
      account.name,
      account.role,
      account.vendorId || null,
    ],
  )
}

const saveRelationalState = async (pool, state, options = {}) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [existingDocumentRows] = await connection.query('SELECT id, file_blob FROM documents')
    const existingDocumentBlobs = new Map(existingDocumentRows.map((document) => [document.id, document.file_blob]))
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of stateTables) {
      await connection.query(`DELETE FROM ${table}`)
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')

    if (options.syncUsers) {
      await connection.query('DELETE FROM users')
      for (const account of state.accounts || []) {
        await upsertUser(connection, account)
      }
    }

    const addOns = Array.isArray(state.addOns) && state.addOns.length > 0 ? state.addOns : defaultAddOns
    for (const addOn of addOns) {
      await connection.execute(
        'INSERT INTO add_ons (id, name, price) VALUES (?, ?, ?)',
        [addOn.id, addOn.name, addOn.price],
      )
    }

    for (const vendor of state.vendors || []) {
      await connection.execute(
        `
          INSERT INTO vendors (
            id, name, owner, status, cuisine, address, pincode, latitude, longitude,
            location_label, service_radius, distance_km, rating, review_count,
            response_minutes, min_price, max_guests, license, image, payout_due, admin_note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          vendor.id,
          vendor.name,
          vendor.owner,
          vendor.status,
          vendor.cuisine,
          vendor.address,
          vendor.pincode,
          vendor.coordinates?.latitude || 0,
          vendor.coordinates?.longitude || 0,
          vendor.coordinates?.label || vendor.address,
          vendor.serviceRadius,
          vendor.distanceKm,
          vendor.rating,
          vendor.reviewCount,
          vendor.responseMinutes,
          vendor.minPrice,
          vendor.maxGuests,
          vendor.license,
          vendor.image,
          vendor.payoutDue || 0,
          vendor.adminNote || null,
        ],
      )

      for (const pincode of vendor.servicePincodes || []) {
        await connection.execute(
          'INSERT INTO vendor_service_pincodes (vendor_id, pincode) VALUES (?, ?)',
          [vendor.id, pincode],
        )
      }
      for (const option of vendor.dietary || []) {
        await connection.execute(
          'INSERT INTO vendor_dietary_options (vendor_id, option_name) VALUES (?, ?)',
          [vendor.id, option],
        )
      }
      for (const eventType of vendor.eventTypes || []) {
        await connection.execute(
          'INSERT INTO vendor_event_types (vendor_id, event_type) VALUES (?, ?)',
          [vendor.id, eventType],
        )
      }
      for (const badge of vendor.badges || []) {
        await connection.execute(
          'INSERT INTO vendor_badges (vendor_id, badge) VALUES (?, ?)',
          [vendor.id, badge],
        )
      }
      for (const availableDate of vendor.availability || []) {
        await connection.execute(
          'INSERT INTO vendor_availability (vendor_id, available_date) VALUES (?, ?)',
          [vendor.id, dateOnly(availableDate)],
        )
      }

      const documentsByKey = new Map()
      for (const label of vendor.docs || []) {
        const key = documentKeyFromLabel(label)
        documentsByKey.set(key, { documentName: label })
      }
      for (const [key, document] of Object.entries(vendor.documents || {})) {
        documentsByKey.set(key, {
          documentName: documentLabels[key] || key,
          ...document,
        })
      }
      for (const [key, document] of documentsByKey.entries()) {
        const decoded = decodeDataUrl(document.dataUrl)
        const id = document.id || safeDocumentId(vendor.id, key)
        const documentName = document.documentName || document.label || documentLabels[key] || key
        const fileBlob =
          decoded?.buffer ||
          existingDocumentBlobs.get(id) ||
          createDemoDocumentBuffer({
            vendorName: vendor.name,
            documentName,
          })
        const mimeType = decoded?.mimeType || document.type || 'application/pdf'
        const uploadTime = dateTimeForMysql(document.uploadedAt || new Date())
        const status = ['pending', 'approved', 'rejected'].includes(document.status)
          ? document.status
          : documentStatusForVendor(vendor)
        const approvedAt =
          status === 'approved'
            ? dateTimeForMysql(document.approvedAt || document.uploadedAt || new Date())
            : null
        await connection.execute(
          `
            INSERT INTO documents (
              id, parent_id, parent_type, vendor_id, document_key, document_name,
              original_file_name, mime_type, file_size, file_blob, status,
              uploaded_by, uploaded_at, approved_by, approved_at, rejection_reason
            )
            VALUES (?, ?, 'vendor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            id,
            document.parentId || vendor.id,
            vendor.id,
            key,
            documentName,
            document.name || `${String(documentName).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'document'}.pdf`,
            mimeType,
            asNumber(document.size) || fileBlob.length,
            fileBlob,
            status,
            document.uploadedBy || null,
            uploadTime,
            status === 'approved' ? document.approvedBy || 'system' : null,
            approvedAt,
            status === 'rejected' ? document.rejectionReason || null : null,
          ],
        )
      }

      for (const pack of vendor.packages || []) {
        await connection.execute(
          `
            INSERT INTO vendor_packages (
              id, vendor_id, title, description, price_per_guest, min_guests, image, instant_book
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            pack.id,
            vendor.id,
            pack.title,
            pack.description,
            pack.pricePerGuest,
            pack.minGuests,
            pack.image,
            pack.instantBook ? 1 : 0,
          ],
        )
        for (const tag of pack.tags || []) {
          await connection.execute('INSERT INTO package_tags (package_id, tag) VALUES (?, ?)', [pack.id, tag])
        }
        for (const [index, item] of (pack.items || []).entries()) {
          await connection.execute(
            'INSERT INTO package_items (package_id, sort_order, item_text) VALUES (?, ?, ?)',
            [pack.id, index, item],
          )
        }
      }
    }

    for (const booking of state.bookings || []) {
      await connection.execute(
        `
          INSERT INTO bookings (
            id, vendor_id, package_id, customer_name, event_type, event_date, guests,
            note, amount, deposit, payment_choice, status, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          booking.id,
          booking.vendorId,
          booking.packageId,
          booking.customerName,
          booking.eventType,
          dateOnly(booking.date),
          booking.guests,
          booking.note || '',
          booking.amount,
          booking.deposit,
          booking.paymentChoice,
          booking.status,
          dateTimeForMysql(booking.createdAt),
        ],
      )
      for (const addOnId of booking.addOns || []) {
        await connection.execute(
          'INSERT INTO booking_add_ons (booking_id, add_on_id) VALUES (?, ?)',
          [booking.id, addOnId],
        )
      }
      for (const [index, item] of (booking.timeline || []).entries()) {
        await connection.execute(
          'INSERT INTO booking_timeline (booking_id, sort_order, timeline_text) VALUES (?, ?, ?)',
          [booking.id, index, item],
        )
      }
      for (const message of booking.messages || []) {
        await connection.execute(
          `
            INSERT INTO chat_messages (booking_id, sender_role, message_text, message_time)
            VALUES (?, ?, ?, ?)
          `,
          [booking.id, message.from, message.text, message.time],
        )
      }
      if (booking.review) {
        await connection.execute(
          'INSERT INTO reviews (booking_id, rating, review_text) VALUES (?, ?, ?)',
          [booking.id, booking.review.rating, booking.review.text],
        )
      }
    }

    for (const payment of state.payments || []) {
      await connection.execute(
        `
          INSERT INTO payments (id, booking_id, amount, currency, status, provider, created_at, confirmed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payment.id,
          payment.bookingId,
          payment.amount,
          payment.currency,
          payment.status,
          payment.provider,
          dateTimeForMysql(payment.createdAt),
          payment.confirmedAt ? dateTimeForMysql(payment.confirmedAt) : null,
        ],
      )
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    throw error
  } finally {
    connection.release()
  }
}

export const isMysqlEnabled = () => (process.env.DB_MODE || 'memory').toLowerCase() === 'mysql'

export const databaseLabel = () =>
  `${mysqlConfig.user}@${mysqlConfig.host}:${mysqlConfig.port}/${databaseName}`

export async function createDatabaseStore() {
  if (shouldCreateDatabase) {
    const serverConnection = await mysql.createConnection(mysqlConfig)
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    await serverConnection.query(`SET GLOBAL max_allowed_packet = ${mysqlMaxAllowedPacket}`).catch((error) => {
      console.warn(`Could not update MySQL max_allowed_packet: ${error.message}`)
    })
    await serverConnection.end()
  }

  const pool = mysql.createPool({
    ...mysqlConfig,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    dateStrings: true,
  })

  await createSchema(pool)

  return {
    async loadState() {
      if (await relationalStateExists(pool)) {
        await pool.query('DROP TABLE IF EXISTS app_state')
        return readRelationalState(pool)
      }

      const legacyState = await loadLegacyState(pool)
      if (legacyState) {
        await saveRelationalState(pool, legacyState, { syncUsers: true })
        await pool.query('DROP TABLE IF EXISTS app_state')
        return readRelationalState(pool)
      }

      await pool.query('DROP TABLE IF EXISTS app_state')
      return null
    },

    async saveState(state) {
      const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users')
      await saveRelationalState(pool, state, { syncUsers: Number(rows[0]?.total || 0) === 0 })
    },

    async upsertUser(account) {
      await upsertUser(pool, account)
    },

    async insertUserIfMissing(account) {
      await insertUserIfMissing(pool, account)
    },

    async findUserForLogin({ role, email }) {
      const [rows] = await pool.execute(
        `
          SELECT id, email, password, name, role, vendor_id
          FROM users
          WHERE role = ? AND email = ?
          LIMIT 1
        `,
        [role || null, email || null],
      )
      return userFromRow(rows[0])
    },

    async findUserById(id) {
      const [rows] = await pool.execute(
        `
          SELECT id, email, password, name, role, vendor_id
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [id],
      )
      return userFromRow(rows[0])
    },

    async createMfaChallenge({ id, userId, purpose, codeHash, expiresAt, maxAttempts }) {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        await connection.execute(
          `
            UPDATE mfa_challenges
            SET status = 'superseded'
            WHERE user_id = ? AND purpose = ? AND status = 'pending'
          `,
          [userId, purpose],
        )
        await connection.execute(
          `
            INSERT INTO mfa_challenges (
              id, user_id, purpose, code_hash, status, attempts, max_attempts, expires_at, sent_at
            )
            VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
          `,
          [
            id,
            userId,
            purpose,
            codeHash,
            maxAttempts,
            dateTimeForMysql(expiresAt),
            dateTimeForMysql(new Date()),
          ],
        )
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    },

    async getMfaChallengeById(id) {
      const [rows] = await pool.execute(
        `
          SELECT
            id, user_id, purpose, code_hash, status, attempts, max_attempts,
            expires_at, sent_at, verified_at
          FROM mfa_challenges
          WHERE id = ?
          LIMIT 1
        `,
        [id],
      )
      return mfaChallengeFromRow(rows[0])
    },

    async recordMfaChallengeAttempt(id) {
      await pool.execute(
        `
          UPDATE mfa_challenges
          SET attempts = attempts + 1
          WHERE id = ? AND status = 'pending'
        `,
        [id],
      )
      return this.getMfaChallengeById(id)
    },

    async verifyMfaChallenge(id) {
      const [result] = await pool.execute(
        `
          UPDATE mfa_challenges
          SET status = 'verified', verified_at = ?
          WHERE id = ? AND status = 'pending' AND expires_at > NOW() AND attempts < max_attempts
        `,
        [dateTimeForMysql(new Date()), id],
      )
      return Boolean(result.affectedRows)
    },

    async invalidateMfaChallenge(id) {
      await pool.execute(
        `
          UPDATE mfa_challenges
          SET status = CASE WHEN status = 'pending' THEN 'expired' ELSE status END
          WHERE id = ?
        `,
        [id],
      )
    },

    async logEvent(event) {
      await pool.execute(
        `
          INSERT INTO event_log (id, title, body, payload, event_time)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), payload = VALUES(payload)
        `,
        [
          event.id,
          event.title,
          event.body,
          JSON.stringify(event.payload || {}),
          event.time,
        ],
      )
    },

    async getDocumentById(id) {
      const [rows] = await pool.execute(
        `
          SELECT
            id, parent_id, parent_type, vendor_id, document_key, document_name,
            original_file_name, mime_type, file_size, file_blob, status, uploaded_by,
            uploaded_at, approved_by, approved_at, rejection_reason
          FROM documents
          WHERE id = ?
          LIMIT 1
        `,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      return {
        ...documentFromRow(row),
        originalFileName: row.original_file_name,
        mimeType: row.mime_type,
        fileBlob: row.file_blob,
      }
    },

    async updateDocumentStatus({ id, status, approvedBy, rejectionReason }) {
      const approvedAt = status === 'approved' ? dateTimeForMysql(new Date()) : null
      const [result] = await pool.execute(
        `
          UPDATE documents
          SET
            status = ?,
            approved_by = ?,
            approved_at = ?,
            rejection_reason = ?
          WHERE id = ?
        `,
        [
          status,
          status === 'approved' ? approvedBy : null,
          approvedAt,
          status === 'rejected' ? rejectionReason || 'Document was rejected during review.' : null,
          id,
        ],
      )
      if (!result.affectedRows) return null

      const [rows] = await pool.execute(
        `
          SELECT
            id, parent_id, parent_type, vendor_id, document_key, document_name,
            original_file_name, mime_type, file_size, status, uploaded_by,
            uploaded_at, approved_by, approved_at, rejection_reason
          FROM documents
          WHERE id = ?
          LIMIT 1
        `,
        [id],
      )
      return documentFromRow(rows[0])
    },

    async upsertPushSubscription({ id, userId, userRole, vendorId, endpoint, p256dh, auth }) {
      await pool.execute(
        `
          INSERT INTO push_subscriptions (
            id, user_id, user_role, vendor_id, endpoint, p256dh, auth_key
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            user_role = VALUES(user_role),
            vendor_id = VALUES(vendor_id),
            endpoint = VALUES(endpoint),
            p256dh = VALUES(p256dh),
            auth_key = VALUES(auth_key),
            updated_at = CURRENT_TIMESTAMP
        `,
        [id, userId, userRole, vendorId || null, endpoint, p256dh, auth],
      )
    },

    async listPushSubscriptions() {
      const [rows] = await pool.query(
        `
          SELECT id, user_id, user_role, vendor_id, endpoint, p256dh, auth_key
          FROM push_subscriptions
        `,
      )
      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userRole: row.user_role,
        vendorId: row.vendor_id,
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth_key },
      }))
    },

    async deletePushSubscription(id) {
      await pool.execute('DELETE FROM push_subscriptions WHERE id = ?', [id])
    },

    async close() {
      await pool.end()
    },
  }
}
