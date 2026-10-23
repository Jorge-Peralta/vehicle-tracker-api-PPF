import { z } from 'zod'
import { driverNameSchema } from '../drivers/driver.schemas.js'

/** Allowed clock difference between the browser and the server when checking future dates. */
const CLOCK_SKEW_MS = 60 * 1000

export const MAX_PAGE_SIZE = 100

const positiveIdSchema = (fieldName: string) =>
  z.coerce
    .number({ error: `${fieldName} debe ser un número` })
    .int(`${fieldName} debe ser un número entero`)
    .positive(`${fieldName} debe ser positivo`)

export const movementTypeSchema = z.enum(['ENTRY', 'EXIT'], {
  error: 'El tipo debe ser ENTRY (entrada) o EXIT (salida)',
})

export const registerMovementSchema = z.object({
  vehicleId: z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? 'El vehículo es obligatorio'
          : 'El id del vehículo debe ser un número',
    })
    .int('El id del vehículo debe ser un número entero')
    .positive('El id del vehículo debe ser positivo'),
  driverName: driverNameSchema,
  type: movementTypeSchema,
  // ISO 8601 with offset, e.g. "2026-03-10T08:30:00-06:00"; stored in UTC.
  occurredAt: z.iso
    .datetime({
      offset: true,
      error: (issue) =>
        issue.input === undefined
          ? 'La fecha es obligatoria'
          : 'La fecha debe estar en formato ISO 8601 con zona horaria',
    })
    .transform((value) => new Date(value))
    .refine(
      (date) => date.getTime() <= Date.now() + CLOCK_SKEW_MS,
      'La fecha no puede estar en el futuro',
    ),
  mileage: z
    .number({
      error: (issue) =>
        issue.input === undefined
          ? 'El kilometraje es obligatorio'
          : 'El kilometraje debe ser un número',
    })
    .int('El kilometraje debe ser un número entero')
    .min(0, 'El kilometraje no puede ser negativo')
    .max(9_999_999, 'El kilometraje debe ser como máximo 9,999,999'),
})

/** `from` and `to` are local calendar days (YYYY-MM-DD), both inclusive. */
export const listMovementsQuerySchema = z
  .object({
    from: z.iso.date({ error: 'from debe ser una fecha (AAAA-MM-DD)' }).optional(),
    to: z.iso.date({ error: 'to debe ser una fecha (AAAA-MM-DD)' }).optional(),
    vehicleId: positiveIdSchema('vehicleId').optional(),
    driverId: positiveIdSchema('driverId').optional(),
    type: movementTypeSchema.optional(),
    page: positiveIdSchema('page').default(1),
    pageSize: positiveIdSchema('pageSize')
      .max(MAX_PAGE_SIZE, `pageSize debe ser como máximo ${MAX_PAGE_SIZE}`)
      .default(20),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'La fecha final debe ser igual o posterior a la fecha inicial',
    path: ['to'],
  })

export type RegisterMovementInput = z.infer<typeof registerMovementSchema>
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>
