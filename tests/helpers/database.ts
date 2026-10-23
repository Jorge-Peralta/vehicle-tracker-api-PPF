import { prisma } from '../../src/shared/db/prisma.js'

/** Empties every table and resets ids, so each test starts from a clean database. */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE movements, drivers, vehicles RESTART IDENTITY CASCADE',
  )
}

export { prisma }
