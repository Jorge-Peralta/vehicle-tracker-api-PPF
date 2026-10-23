import { z } from 'zod'

export const listDriversQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100, 'La búsqueda debe tener como máximo 100 caracteres')
    .optional(),
})

export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>
