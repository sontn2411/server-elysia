import mysql from 'mysql2/promise'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true },
  })

  const [rows] = await connection.execute('SHOW CREATE TABLE users')
  console.log(rows[0]['Create Table'])
  await connection.end()
}
check()
