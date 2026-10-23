import { z } from 'zod'

/**
 * Honduran plate: three letters and four digits, with an optional space (e.g. "HAA 1234").
 * Adjust here if the format changes; everything else uses this constant.
 */
export const PLATE_PATTERN = /^[A-Z]{3}\s?\d{4}$/

const MIN_VEHICLE_YEAR = 1900

/** Accepts "haa 1234" or "HAA1234" and stores "HAA1234". */
export const plateSchema = z
  .string({ error: 'La placa es obligatoria' })
  .trim()
  .toUpperCase()
  .regex(PLATE_PATTERN, 'La placa debe tener 3 letras y 4 dígitos, por ejemplo HAA 1234')
  .transform((plate) => plate.replace(/\s/g, ''))

const vehicleTextSchema = (messages: { required: string; tooLong: string }) =>
  z.string({ error: messages.required }).trim().min(1, messages.required).max(50, messages.tooLong)

const yearSchema = z
  .number({ error: 'El año debe ser un número' })
  .int('El año debe ser un número entero')
  .min(MIN_VEHICLE_YEAR, `El año debe ser ${MIN_VEHICLE_YEAR} o posterior`)
  .refine(
    (year) => year <= new Date().getFullYear() + 1,
    'El año no puede ser posterior al próximo año',
  )

/** Body for both create and update (PUT replaces all editable fields). */
export const vehicleInputSchema = z.object({
  brand: vehicleTextSchema({
    required: 'La marca es obligatoria',
    tooLong: 'La marca debe tener como máximo 50 caracteres',
  }),
  model: vehicleTextSchema({
    required: 'El modelo es obligatorio',
    tooLong: 'El modelo debe tener como máximo 50 caracteres',
  }),
  plate: plateSchema,
  year: yearSchema.nullish().transform((year) => year ?? null),
})

export const vehicleIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'El id debe ser un número' })
    .int('El id debe ser un número entero')
    .positive('El id debe ser positivo'),
})

export const listVehiclesQuerySchema = z.object({
  search: z.string().trim().max(50, 'La búsqueda debe tener como máximo 50 caracteres').optional(),
  includeInactive: z
    .stringbool({ error: 'includeInactive debe ser true o false' })
    .optional()
    .default(false),
})

export type VehicleInput = z.infer<typeof vehicleInputSchema>
export type VehicleIdParams = z.infer<typeof vehicleIdParamsSchema>
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>
