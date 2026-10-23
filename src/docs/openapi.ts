import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { listDriversQuerySchema } from '../modules/drivers/driver.schemas.js'
import {
  dailySummaryQuerySchema,
  listMovementsQuerySchema,
  MAX_SUMMARY_DAYS,
  registerMovementSchema,
} from '../modules/movements/movement.schemas.js'
import {
  listVehiclesQuerySchema,
  vehicleIdParamsSchema,
  vehicleInputSchema,
} from '../modules/vehicles/vehicle.schemas.js'
// (imports above are evaluated before extendZodWithOpenApi runs, so the validation schemas
// never call `.openapi()` themselves; metadata is only added in this file.)

/**
 * OpenAPI 3.1 document for the API, served at /api/docs (Swagger UI) and /api/docs.json.
 * Requests are described with the same Zod schemas that validate them, so docs and
 * validation can't drift apart. Response shapes are declared here.
 */

extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

// ---------- Response schemas ----------

const dateTime = z.iso.datetime()

const errorSchema = registry.register(
  'Error',
  z
    .object({
      message: z.string(),
      errors: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .openapi({ description: 'Solo en errores de validación: mensajes por campo' }),
    })
    .openapi({
      example: {
        message: 'Los datos enviados no son válidos',
        errors: { plate: ['La placa debe tener 3 letras y 4 dígitos, por ejemplo HAA 1234'] },
      },
    }),
)

const vehicleSchema = registry.register(
  'Vehicle',
  z.object({
    id: z.number().int(),
    brand: z.string().openapi({ example: 'Toyota' }),
    model: z.string().openapi({ example: 'Hilux' }),
    plate: z.string().openapi({ example: 'HAA1234', description: 'Mayúsculas y sin espacios' }),
    year: z.number().int().nullable().openapi({ example: 2021 }),
    isActive: z.boolean().openapi({ description: 'false si fue eliminado lógicamente' }),
    createdAt: dateTime,
    updatedAt: dateTime,
  }),
)

const vehicleDetailSchema = registry.register(
  'VehicleDetail',
  vehicleSchema.extend({
    currentStatus: z.enum(['INSIDE', 'OUTSIDE']).nullable().openapi({
      description:
        'Según el último movimiento: INSIDE (dentro) u OUTSIDE (fuera); null sin movimientos',
    }),
    lastMileage: z.number().int().nullable(),
    lastMovementAt: dateTime.nullable(),
  }),
)

const driverSchema = registry.register(
  'Driver',
  z.object({
    id: z.number().int(),
    fullName: z.string().openapi({ example: 'Ana López' }),
    identityNumber: z
      .string()
      .regex(/^\d{13}$/)
      .openapi({
        example: '0801199012345',
        description: 'Número de Identidad hondureño: 13 dígitos, sin guiones (único)',
      }),
  }),
)

const movementSchema = registry.register(
  'Movement',
  z.object({
    id: z.number().int(),
    type: z.enum(['ENTRY', 'EXIT']),
    occurredAt: dateTime.openapi({ description: 'En UTC' }),
    mileage: z.number().int(),
    createdAt: dateTime,
    vehicle: vehicleSchema.pick({
      id: true,
      plate: true,
      brand: true,
      model: true,
      isActive: true,
    }),
    driver: driverSchema,
  }),
)

const movementPageSchema = registry.register(
  'MovementPage',
  z.object({
    data: z.array(movementSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
)

const dailyMovementSummarySchema = registry.register(
  'DailyMovementSummary',
  z.object({
    date: z.string().openapi({ example: '2026-03-10', description: 'Día en hora de Honduras' }),
    entries: z.number().int(),
    exits: z.number().int(),
  }),
)

const deleteVehicleResultSchema = registry.register(
  'DeleteVehicleResult',
  z.object({
    result: z.enum(['deleted', 'deactivated']).openapi({
      description:
        'deleted: eliminado definitivamente; deactivated: desactivado por tener movimientos',
    }),
  }),
)

// ---------- Request schemas ----------
// The validation schemas are used as they are, except for fields whose transforms hide
// what the API accepts; those are re-described here for the docs only.

const vehicleBodySchema = vehicleInputSchema.extend({
  plate: z.string().openapi({
    example: 'HAA 1234',
    description:
      'Formato hondureño: 3 letras y 4 dígitos. Acepta minúsculas y un espacio opcional; se guarda en mayúsculas sin espacios.',
  }),
})

const listVehiclesQueryDocSchema = listVehiclesQuerySchema.extend({
  includeInactive: z.boolean().optional().openapi({
    description: 'Incluye los vehículos desactivados (por defecto false)',
  }),
})

const registerMovementBodySchema = registerMovementSchema.extend({
  driverId: z.number().int().positive().openapi({
    example: 1,
    description:
      'Id de un conductor existente (ver GET /api/drivers). Este endpoint no crea conductores.',
  }),
  occurredAt: z.iso.datetime({ offset: true }).openapi({
    example: '2026-03-10T08:30:00-06:00',
    description: 'ISO 8601 con zona horaria. No puede estar en el futuro.',
  }),
})

// ---------- Helpers ----------

function json(schema: z.ZodType, description: string) {
  return { description, content: { 'application/json': { schema } } }
}

const validationError = json(errorSchema, 'Datos inválidos')
const notFound = json(errorSchema, 'No encontrado')

// ---------- Paths ----------

registry.registerPath({
  method: 'get',
  path: '/api/health',
  tags: ['Salud'],
  summary: 'Verificación de estado',
  responses: {
    200: json(z.object({ status: z.literal('ok') }), 'El servidor está disponible'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/vehicles',
  tags: ['Vehículos'],
  summary: 'Lista los vehículos',
  description:
    'Ordenados por placa. Los vehículos desactivados se omiten salvo con includeInactive=true.',
  request: { query: listVehiclesQueryDocSchema },
  responses: {
    200: json(z.array(vehicleSchema), 'Lista de vehículos'),
    400: validationError,
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/vehicles/{id}',
  tags: ['Vehículos'],
  summary: 'Obtiene un vehículo',
  description: 'Incluye su estado actual y el último kilometraje registrado.',
  request: { params: vehicleIdParamsSchema },
  responses: {
    200: json(vehicleDetailSchema, 'Vehículo'),
    400: validationError,
    404: notFound,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/vehicles',
  tags: ['Vehículos'],
  summary: 'Crea un vehículo',
  description:
    'La placa se normaliza a mayúsculas sin espacios. Si pertenece a un vehículo desactivado, ese vehículo se reactiva con los nuevos datos (200).',
  request: { body: { content: { 'application/json': { schema: vehicleBodySchema } } } },
  responses: {
    201: json(vehicleSchema, 'Vehículo creado'),
    200: json(vehicleSchema, 'Vehículo desactivado reactivado'),
    400: validationError,
    409: json(errorSchema, 'Ya existe un vehículo activo con esa placa'),
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/vehicles/{id}',
  tags: ['Vehículos'],
  summary: 'Actualiza un vehículo activo',
  request: {
    params: vehicleIdParamsSchema,
    body: { content: { 'application/json': { schema: vehicleBodySchema } } },
  },
  responses: {
    200: json(vehicleSchema, 'Vehículo actualizado'),
    400: validationError,
    404: notFound,
    409: json(errorSchema, 'Otro vehículo ya usa esa placa'),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/vehicles/{id}',
  tags: ['Vehículos'],
  summary: 'Elimina un vehículo',
  description:
    'Sin movimientos se elimina definitivamente; con movimientos se desactiva para conservar el historial.',
  request: { params: vehicleIdParamsSchema },
  responses: {
    200: json(deleteVehicleResultSchema, 'Resultado de la eliminación'),
    400: validationError,
    404: notFound,
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/movements',
  tags: ['Movimientos'],
  summary: 'Lista entradas y salidas',
  description:
    'De la más reciente a la más antigua. from y to son días completos en hora de Honduras (UTC-6), ambos inclusive.',
  request: { query: listMovementsQuerySchema },
  responses: {
    200: json(movementPageSchema, 'Página de movimientos'),
    400: validationError,
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/movements/daily-summary',
  tags: ['Movimientos'],
  summary: 'Cuenta entradas y salidas por día',
  description: `Un elemento por día del rango, incluidos los días sin movimientos. from y to son obligatorios, días en hora de Honduras (UTC-6), ambos inclusive; máximo ${MAX_SUMMARY_DAYS} días.`,
  request: { query: dailySummaryQuerySchema },
  responses: {
    200: json(z.array(dailyMovementSummarySchema), 'Conteo diario'),
    400: validationError,
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/movements',
  tags: ['Movimientos'],
  summary: 'Registra una entrada o salida',
  description:
    'Reglas: los tipos se alternan (el primero puede ser cualquiera), la fecha no puede estar en el futuro y debe ser posterior al último movimiento, y el kilometraje no puede ser menor que el último. El conductor debe existir: los conductores solo se crean con los datos de ejemplo (seed).',
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerMovementBodySchema,
          example: {
            vehicleId: 1,
            driverId: 1,
            type: 'ENTRY',
            occurredAt: '2026-03-10T08:30:00-06:00',
            mileage: 15230,
          },
        },
      },
    },
  },
  responses: {
    201: json(movementSchema, 'Movimiento registrado'),
    400: validationError,
    404: json(errorSchema, 'Vehículo no encontrado o desactivado, o conductor no encontrado'),
    409: json(errorSchema, 'Se viola una regla de alternancia, fecha o kilometraje'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/drivers',
  tags: ['Conductores'],
  summary: 'Lista los conductores',
  description:
    'En orden alfabético. `search` busca por nombre o por Número de Identidad (se ignoran los guiones).',
  request: { query: listDriversQuerySchema },
  responses: {
    200: json(z.array(driverSchema), 'Lista de conductores'),
    400: validationError,
  },
})

export function generateOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Vehicle Tracker API',
      version: '1.0.0',
      description: 'API para registrar vehículos y sus entradas y salidas.',
    },
  })
}
