import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '../../config/env.js'
import { PrismaClient } from '../../generated/prisma/client.js'

/**
 * Single Prisma client for the whole process.
 * Uses the pooled DATABASE_URL; migrations use DIRECT_URL via prisma.config.ts.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
})
