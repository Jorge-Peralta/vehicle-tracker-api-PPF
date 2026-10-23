import { defineConfig } from 'prisma/config'

// The Prisma CLI doesn't load .env on its own since v7.
try {
  process.loadEnvFile()
} catch {
  // No .env file (CI, Render): variables come from the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection on Neon; locally both URLs are the same.
    // Falls back to an empty string so `prisma generate` works without a database.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
})
