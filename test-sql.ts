import mysql from 'mysql2/promise'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
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

  try {
    const [rows] = await connection.execute(
      'select `id`, `user_id`, `username`, `email`, `password`, `refresh_token` from `users` where (`users`.`username` = ? or `users`.`email` = ?) limit 1',
      ['testuser', 'testuser'],
    )
    console.log('Result:', rows)
  } catch (err) {
    console.error('SQL Error:', err)
  }
  process.exit(0)
}

main()
