import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './src/models/user.model'
import { config } from 'dotenv'

// Load from .env.local
config({ path: '.env.local' })

async function main() {
  console.log('Pushing schema...')
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
  })

  // Drizzle doesn't have a programmatic "push" API that we can easily call here,
  // but we can just use `bun run drizzle-kit push` if we load the env vars correctly.
}

main()
