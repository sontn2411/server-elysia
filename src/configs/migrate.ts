import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runMigrations() {
  console.log('Connecting to database for migration...')
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true },
  })

  const db = drizzle(connection)

  console.log('Running migrations...')
  try {
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('✨ Migrations completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await connection.end()
  }
}

runMigrations()
