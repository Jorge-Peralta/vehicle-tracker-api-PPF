import type { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../shared/db/prisma.js'
import { normalizeDriverName } from './driver-name.js'
import type { ListDriversQuery } from './driver.schemas.js'

/** Lists drivers alphabetically, optionally filtered by name. */
export async function listDrivers({ search }: ListDriversQuery) {
  return prisma.driver.findMany({
    where: search ? { fullName: { contains: search, mode: 'insensitive' } } : {},
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true },
  })
}

/**
 * Returns the driver with this name (ignoring case and spacing), creating it if needed.
 * Runs inside the caller's transaction so the driver is only created if the movement is.
 */
export async function findOrCreateDriver(transaction: Prisma.TransactionClient, fullName: string) {
  const normalizedName = normalizeDriverName(fullName)

  return transaction.driver.upsert({
    where: { normalizedName },
    update: {},
    create: { fullName, normalizedName },
  })
}
