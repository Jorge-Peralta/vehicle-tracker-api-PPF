import type { MovementType, Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../shared/db/prisma.js'
import { ConflictError } from '../../shared/errors/app-error.js'
import {
  BUSINESS_UTC_OFFSET_MS,
  formatLocalDateTime,
  startOfLocalDay,
  startOfNextLocalDay,
} from '../../shared/lib/business-time.js'
import { findOrCreateDriver } from '../drivers/driver.service.js'
import { formatPlate } from '../vehicles/vehicle.schemas.js'
import { vehicleNotFoundError } from '../vehicles/vehicle.service.js'
import type {
  DailySummaryQuery,
  ListMovementsQuery,
  RegisterMovementInput,
} from './movement.schemas.js'

/** Fields returned for every movement, so the web can show plate and driver without extra calls. */
const movementSelect = {
  id: true,
  type: true,
  occurredAt: true,
  mileage: true,
  createdAt: true,
  vehicle: { select: { id: true, plate: true, brand: true, model: true, isActive: true } },
  driver: { select: { id: true, fullName: true } },
} satisfies Prisma.MovementSelect

/**
 * Registers an entry or exit. Business rules, checked against the vehicle's last movement:
 * - the vehicle must exist and be active;
 * - types must alternate (the first movement can be either);
 * - the date must be after the last movement's date;
 * - mileage can't be lower than the last recorded mileage.
 *
 * The vehicle row is locked (SELECT ... FOR UPDATE) for the whole transaction, so two
 * simultaneous requests for the same vehicle are checked one after the other.
 */
export async function registerMovement(input: RegisterMovementInput) {
  return prisma.$transaction(async (transaction) => {
    const [vehicle] = await transaction.$queryRaw<{ plate: string; is_active: boolean }[]>`
      SELECT plate, is_active FROM vehicles WHERE id = ${input.vehicleId} FOR UPDATE
    `

    if (!vehicle?.is_active) {
      throw vehicleNotFoundError(input.vehicleId)
    }

    const lastMovement = await transaction.movement.findFirst({
      where: { vehicleId: input.vehicleId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    })

    if (lastMovement) {
      if (lastMovement.type === input.type) {
        const message =
          lastMovement.type === 'ENTRY'
            ? `El vehículo ${formatPlate(vehicle.plate)} ya está dentro; el siguiente movimiento debe ser una salida`
            : `El vehículo ${formatPlate(vehicle.plate)} ya está fuera; el siguiente movimiento debe ser una entrada`
        throw new ConflictError(message)
      }

      if (input.occurredAt <= lastMovement.occurredAt) {
        throw new ConflictError(
          `La fecha debe ser posterior al último movimiento del vehículo (${formatLocalDateTime(lastMovement.occurredAt)})`,
        )
      }

      if (input.mileage < lastMovement.mileage) {
        throw new ConflictError(
          `El kilometraje no puede ser menor que el último registrado para el vehículo (${lastMovement.mileage} km)`,
        )
      }
    }

    const driver = await findOrCreateDriver(transaction, input.driverName)

    return transaction.movement.create({
      data: {
        vehicleId: input.vehicleId,
        driverId: driver.id,
        type: input.type,
        occurredAt: input.occurredAt,
        mileage: input.mileage,
      },
      select: movementSelect,
    })
  })
}

/** Lists movements, newest first, with filters and pagination. */
export async function listMovements(query: ListMovementsQuery) {
  const { from, to, vehicleId, driverId, type, page, pageSize } = query

  const where: Prisma.MovementWhereInput = { vehicleId, driverId, type }
  if (from || to) {
    where.occurredAt = {
      ...(from && { gte: startOfLocalDay(from) }),
      ...(to && { lt: startOfNextLocalDay(to) }),
    }
  }

  const [data, total] = await prisma.$transaction([
    prisma.movement.findMany({
      where,
      select: movementSelect,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.movement.count({ where }),
  ])

  return { data, total, page, pageSize }
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

/**
 * Entries and exits per local day (Honduras time), one row per day of the range,
 * including days without movements. Counted in the database with a single query.
 */
export async function getDailySummary({ from, to }: DailySummaryQuery) {
  const offsetSeconds = BUSINESS_UTC_OFFSET_MS / 1000
  const rows = await prisma.$queryRaw<{ date: string; type: MovementType; count: number }[]>`
    SELECT
      to_char((occurred_at AT TIME ZONE 'UTC') + ${offsetSeconds}::int * interval '1 second', 'YYYY-MM-DD') AS date,
      type::text AS type,
      count(*)::int AS count
    FROM movements
    WHERE occurred_at >= ${startOfLocalDay(from)} AND occurred_at < ${startOfNextLocalDay(to)}
    GROUP BY 1, 2
  `

  const days = new Map<string, { date: string; entries: number; exits: number }>()
  for (let time = Date.parse(from); time <= Date.parse(to); time += DAY_IN_MS) {
    const date = new Date(time).toISOString().slice(0, 10)
    days.set(date, { date, entries: 0, exits: 0 })
  }
  for (const { date, type, count } of rows) {
    const day = days.get(date)
    if (day) day[type === 'ENTRY' ? 'entries' : 'exits'] = count
  }
  return [...days.values()]
}
