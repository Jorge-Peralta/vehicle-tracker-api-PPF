import type { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../shared/db/prisma.js'
import { NotFoundError } from '../../shared/errors/app-error.js'
import type { ListDriversQuery } from './driver.schemas.js'

export function driverNotFoundError(id: number) {
  return new NotFoundError(`No se encontró el conductor con id ${id}`)
}

/**
 * Lists drivers alphabetically, optionally filtered by name or identity number
 * (dashes are ignored, so "0801-1990" matches "0801199012345").
 */
export async function listDrivers({ search }: ListDriversQuery) {
  const where: Prisma.DriverWhereInput = {}
  if (search) {
    const identityDigits = search.replace(/\D/g, '')
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      ...(identityDigits ? [{ identityNumber: { contains: identityDigits } }] : []),
    ]
  }

  return prisma.driver.findMany({
    where,
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, identityNumber: true },
  })
}
