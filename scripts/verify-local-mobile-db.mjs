import 'dotenv/config'
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'feastflow_local',
  connectionLimit: 2,
})

try {
  const [customerIdColumns] = await pool.query("SHOW COLUMNS FROM bookings LIKE 'customer_id'")
  const tableNames = ['users', 'vendors', 'documents', 'bookings', 'payments', 'chat_messages', 'mobile_push_subscriptions']
  const counts = {}
  for (const tableName of tableNames) {
    const [rows] = await pool.query(`SELECT COUNT(1) AS total FROM \`${tableName}\``)
    counts[tableName] = Number(rows[0]?.total || 0)
  }
  console.log(JSON.stringify({ customerIdColumn: customerIdColumns.length === 1, counts }, null, 2))
  if (customerIdColumns.length !== 1) process.exitCode = 1
} finally {
  await pool.end()
}
