import { z } from 'zod'
import { cleanDriverName } from './driver-name.js'

/** Letters (any language), spaces, dots, apostrophes, and hyphens; must start with a letter. */
const DRIVER_NAME_PATTERN = /^\p{L}[\p{L}\s.'-]*$/u

export const driverNameSchema = z
  .string({ error: 'El nombre del conductor es obligatorio' })
  .transform(cleanDriverName)
  .pipe(
    z
      .string()
      .min(2, 'El nombre del conductor debe tener al menos 2 caracteres')
      .max(100, 'El nombre del conductor debe tener como máximo 100 caracteres')
      .regex(
        DRIVER_NAME_PATTERN,
        "El nombre del conductor solo puede contener letras, espacios y los caracteres . ' -",
      ),
  )

export const listDriversQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100, 'La búsqueda debe tener como máximo 100 caracteres')
    .optional(),
})

export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>
