import mysql from 'mysql2/promise'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true },
  })

  try {
    console.log('Adding isAdmin column...')
    await connection.execute(
      'ALTER TABLE users ADD COLUMN isAdmin boolean DEFAULT false;',
    )
    console.log('Column added successfully.')
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column isAdmin already exists.')
    } else {
      console.error('Error adding column:', error.message)
    }
  }

  // Also let's check what constraints exist, if unique constraints were dropped, we should re-add them.
  const [rows] = await connection.execute('SHOW CREATE TABLE users')
  const createSql = rows[0]['Create Table']
  console.log('\\nCurrent Table Schema:\\n')
  console.log(createSql)

  // If missing unique constraints, re-add them
  if (!createSql.includes('users_user_id_unique')) {
    console.log('Re-adding unique constraints...')
    try {
      await connection.execute(
        'CREATE UNIQUE INDEX users_user_id_unique ON users(user_id);',
      )
      await connection.execute(
        'CREATE UNIQUE INDEX users_username_unique ON users(username);',
      )
      await connection.execute(
        'CREATE UNIQUE INDEX users_email_unique ON users(email);',
      )
      console.log('Unique constraints restored.')
    } catch (e: any) {
      console.log('Error restoring uniqueness:', e.message)
    }
  }

  await connection.end()
}
migrate()
