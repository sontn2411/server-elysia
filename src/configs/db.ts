import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../models/user.model'

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'elysia_db',
  ssl: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  },
})

export const db = drizzle(connection, { schema, mode: 'default' })
