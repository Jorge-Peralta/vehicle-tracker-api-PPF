import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma, resetDatabase } from './helpers/database.js'

const app = createApp()

beforeEach(async () => {
  await resetDatabase()
  await prisma.driver.createMany({
    data: [
      { fullName: 'María López', identityNumber: '0801199012345' },
      { fullName: 'Ana Martínez', identityNumber: '0501198501234' },
      { fullName: 'Carlos Mejía', identityNumber: '1804200000111' },
    ],
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/drivers', () => {
  it('lists drivers alphabetically with id, name, and identity number', async () => {
    const response = await request(app).get('/api/drivers')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      { id: expect.any(Number), fullName: 'Ana Martínez', identityNumber: '0501198501234' },
      { id: expect.any(Number), fullName: 'Carlos Mejía', identityNumber: '1804200000111' },
      { id: expect.any(Number), fullName: 'María López', identityNumber: '0801199012345' },
    ])
  })

  it('filters by name, case-insensitively', async () => {
    const response = await request(app).get('/api/drivers').query({ search: 'LÓP' })

    expect(response.body.map((driver: { fullName: string }) => driver.fullName)).toEqual([
      'María López',
    ])
  })

  it('filters by identity number, with or without dashes', async () => {
    const plain = await request(app).get('/api/drivers').query({ search: '08011990' })
    const dashed = await request(app).get('/api/drivers').query({ search: '0801-1990-12' })

    expect(plain.body.map((driver: { fullName: string }) => driver.fullName)).toEqual([
      'María López',
    ])
    expect(dashed.body).toEqual(plain.body)
  })
})

describe('Driver identity number', () => {
  it('is unique', async () => {
    await expect(
      prisma.driver.create({ data: { fullName: 'Otra Persona', identityNumber: '0801199012345' } }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})
