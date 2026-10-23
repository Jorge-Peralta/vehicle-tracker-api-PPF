import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

const app = createApp()

describe('GET /api/docs.json', () => {
  it('returns an OpenAPI 3.1 document describing every endpoint', async () => {
    const response = await request(app).get('/api/docs.json')

    expect(response.status).toBe(200)
    expect(response.body.openapi).toBe('3.1.0')

    const operations = Object.entries(
      response.body.paths as Record<string, Record<string, unknown>>,
    ).flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path}`))
    expect(operations.sort()).toEqual(
      [
        'get /api/health',
        'get /api/vehicles',
        'post /api/vehicles',
        'get /api/vehicles/{id}',
        'put /api/vehicles/{id}',
        'delete /api/vehicles/{id}',
        'get /api/movements',
        'post /api/movements',
        'get /api/movements/daily-summary',
        'get /api/drivers',
      ].sort(),
    )
    expect(Object.keys(response.body.components.schemas).sort()).toEqual([
      'DailyMovementSummary',
      'DeleteVehicleResult',
      'Driver',
      'Error',
      'Movement',
      'MovementPage',
      'Vehicle',
      'VehicleDetail',
    ])
  })
})

describe('GET /api/docs', () => {
  it('serves the Swagger UI page', async () => {
    const response = await request(app).get('/api/docs/')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.text).toContain('swagger-ui')
  })
})
