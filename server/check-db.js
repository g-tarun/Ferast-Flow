import 'dotenv/config'
import { createDatabaseStore, databaseLabel, isMysqlEnabled } from './database.js'

if (!isMysqlEnabled()) {
  console.log('DB_MODE is not mysql. Set DB_MODE=mysql in .env to use local MySQL.')
  process.exit(0)
}

try {
  const store = await createDatabaseStore()
  await store.close()
  console.log(`MySQL is ready: ${databaseLabel()}`)
} catch (error) {
  console.error(`MySQL connection failed for ${databaseLabel()}`)
  console.error(error.message)
  process.exit(1)
}
