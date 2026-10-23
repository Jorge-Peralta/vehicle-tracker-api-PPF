import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma, resetDatabase } from './helpers/database.js'

const app = createApp()

beforeEach(async () => {
  await resetDatabase()
  await prisma.driver.createMany({
    data: [
      { fullName: 'María López', normalizedName: 'maría lópez' },
      { fullName: 'Ana Martínez', normalizedName: 'ana martínez' },
      { fullName: 'Carlos Mejía', normalizedName: 'carlos mejía' },
    ],
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/drivers', () => {
  it('lists drivers alphabetically with id and name only', async () => {
    const response = await request(app).get('/api/drivers')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { id: expect.any(Number), fullName: 'Ana Martínez' },
      { id: expect.any(Number), fullName: 'Carlos Mejía' },
      { id: expect.any(Number), fullName: 'María López' },
    ])
  })

  it('filters by name, case-insensitively', async () => {
    const response = await request(app).get('/api/drivers').query({ search: 'LÓP' })

    expect(response.body.map((driver: { fullName: string }) => driver.fullName)).toEqual([
      'María López',
    ])
  })
})
