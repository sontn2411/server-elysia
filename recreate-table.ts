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
    console.log('Dropping table...')
    await connection.execute('DROP TABLE IF EXISTS `users`;')

    console.log('Creating table...')
    await connection.execute(`
      CREATE TABLE \`users\` (
        \`id\` serial AUTO_INCREMENT NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`username\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(255) NOT NULL,
        \`refresh_token\` varchar(255),
        CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`users_user_id_unique\` UNIQUE(\`user_id\`),
        CONSTRAINT \`users_username_unique\` UNIQUE(\`username\`),
        CONSTRAINT \`users_email_unique\` UNIQUE(\`email\`)
      );
    `)
    console.log('Done!')
  } catch (err) {
    console.error('SQL Error:', err)
  }
  process.exit(0)
}

main()
