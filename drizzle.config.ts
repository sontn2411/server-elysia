import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/models/*.model.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/elysia_db',
  },
})
