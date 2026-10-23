import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

const app = createApp()

describe('GET /api/health', () => {
  it('responds 200 with status ok', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})

describe('unknown routes', () => {
  it('respond 404 with the standard error shape', async () => {
    const response = await request(app).get('/api/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ message: 'Route GET /api/does-not-exist not found' })
  })
})

describe('malformed JSON body', () => {
  it('responds 400 instead of 500', async () => {
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"invalid"')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ message: 'Malformed JSON body' })
  })
})
