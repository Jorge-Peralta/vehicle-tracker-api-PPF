import type { Prisma, Vehicle } from '../../generated/prisma/client.js'
import { prisma } from '../../shared/db/prisma.js'
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from '../../shared/db/prisma-errors.js'
import { ConflictError, NotFoundError } from '../../shared/errors/app-error.js'
import { formatPlate, type ListVehiclesQuery, type VehicleInput } from './vehicle.schemas.js'

/** Where a vehicle is according to its last movement; `null` if it has none. */
export type VehicleStatus = 'INSIDE' | 'OUTSIDE' | null

export type VehicleDetail = Vehicle & {
  currentStatus: VehicleStatus
  lastMileage: number | null
  lastMovementAt: Date | null
}

export type DeleteVehicleResult = 'deleted' | 'deactivated'

export function vehicleNotFoundError(id: number) {
  return new NotFoundError(`No se encontró el vehículo con id ${id}`)
}

function duplicatePlateError(plate: string) {
  return new ConflictError(`Ya existe un vehículo con la placa ${formatPlate(plate)}`)
}

/** Lists vehicles by plate. Inactive (soft-deleted) vehicles are hidden unless requested. */
export async function listVehicles({ search, includeInactive }: ListVehiclesQuery) {
  const where: Prisma.VehicleWhereInput = includeInactive ? {} : { isActive: true }

  if (search) {
    // Plates are stored without spaces, so "haa 12" should still match "HAA1234".
    const plateSearch = search.replace(/\s/g, '')
    where.OR = [
      { brand: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { plate: { contains: plateSearch, mode: 'insensitive' } },
    ]
  }

  return prisma.vehicle.findMany({ where, orderBy: { plate: 'asc' } })
}

/** Gets a vehicle (active or not) with its current status and last recorded mileage. */
export async function getVehicleById(id: number): Promise<VehicleDetail> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { type: true, mileage: true, occurredAt: true },
      },
    },
  })

  if (!vehicle) {
    throw vehicleNotFoundError(id)
  }

  const { movements, ...vehicleData } = vehicle
  const lastMovement = movements[0]

  return {
    ...vehicleData,
    currentStatus: lastMovement ? (lastMovement.type === 'ENTRY' ? 'INSIDE' : 'OUTSIDE') : null,
    lastMileage: lastMovement?.mileage ?? null,
    lastMovementAt: lastMovement?.occurredAt ?? null,
  }
}

/**
 * Creates a vehicle. If the plate belongs to a soft-deleted vehicle, that vehicle is
 * reactivated with the new data instead, so its movement history is kept.
 */
export async function createVehicle(
  input: VehicleInput,
): Promise<{ vehicle: Vehicle; reactivated: boolean }> {
  const existingVehicle = await prisma.vehicle.findUnique({ where: { plate: input.plate } })

  if (existingVehicle?.isActive) {
    throw duplicatePlateError(input.plate)
  }

  if (existingVehicle) {
    const vehicle = await prisma.vehicle.update({
      where: { id: existingVehicle.id },
      data: { ...input, isActive: true },
    })
    return { vehicle, reactivated: true }
  }

  try {
    const vehicle = await prisma.vehicle.create({ data: input })
    return { vehicle, reactivated: false }
  } catch (error) {
    // Another request created the same plate between the check and the insert.
    if (isUniqueConstraintError(error)) throw duplicatePlateError(input.plate)
    throw error
  }
}

async function findActiveVehicleOrThrow(id: number) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } })

  if (!vehicle?.isActive) {
    throw vehicleNotFoundError(id)
  }

  return vehicle
}

/** Replaces the editable fields of an active vehicle. */
export async function updateVehicle(id: number, input: VehicleInput): Promise<Vehicle> {
  await findActiveVehicleOrThrow(id)

  try {
    return await prisma.vehicle.update({ where: { id }, data: input })
  } catch (error) {
    if (isUniqueConstraintError(error)) throw duplicatePlateError(input.plate)
    throw error
  }
}

/**
 * Deletes a vehicle. Without movements it is removed for good; with movements it is
 * deactivated (soft delete) so the entry/exit history stays intact.
 */
export async function deleteVehicle(id: number): Promise<DeleteVehicleResult> {
  await findActiveVehicleOrThrow(id)

  const movementCount = await prisma.movement.count({ where: { vehicleId: id } })

  if (movementCount === 0) {
    try {
      await prisma.vehicle.delete({ where: { id } })
      return 'deleted'
    } catch (error) {
      // A movement was registered after the count: fall back to a soft delete.
      if (!isForeignKeyConstraintError(error)) throw error
    }
  }

  await prisma.vehicle.update({ where: { id }, data: { isActive: false } })
  return 'deactivated'
}
