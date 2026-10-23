import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma, resetDatabase } from './helpers/database.js'

const app = createApp()

const HOUR_IN_MS = 60 * 60 * 1000

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_IN_MS).toISOString()
}

async function createVehicle(data: { plate?: string; isActive?: boolean } = {}) {
  return prisma.vehicle.create({
    data: { brand: 'Toyota', model: 'Hilux', plate: 'HAA1234', ...data },
  })
}

function registerMovement(body: Record<string, unknown>) {
  return request(app).post('/api/movements').send(body)
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/movements', () => {
  it('registers a first movement of either type and creates the driver', async () => {
    const vehicle = await createVehicle()

    const response = await registerMovement({
      vehicleId: vehicle.id,
      driverName: '  Ana   López ',
      type: 'EXIT',
      occurredAt: '2026-03-10T08:30:00-06:00',
      mileage: 1500,
    })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      type: 'EXIT',
      occurredAt: '2026-03-10T14:30:00.000Z',
      mileage: 1500,
      vehicle: { id: vehicle.id, plate: 'HAA1234' },
      driver: { fullName: 'Ana López' },
    })
    expect(await prisma.driver.findMany()).toMatchObject([
      { fullName: 'Ana López', normalizedName: 'ana lópez' },
    ])
  })

  it('reuses an existing driver regardless of case and spacing', async () => {
    const vehicle = await createVehicle()
    const base = { vehicleId: vehicle.id, mileage: 100 }

    await registerMovement({
      ...base,
      driverName: 'Ana López',
      type: 'ENTRY',
      occurredAt: hoursAgo(2),
    })
    const second = await registerMovement({
      ...base,
      driverName: ' ana  LÓPEZ',
      type: 'EXIT',
      occurredAt: hoursAgo(1),
    })

    expect(second.status).toBe(201)
    expect(second.body.driver.fullName).toBe('Ana López')
    expect(await prisma.driver.count()).toBe(1)
  })

  it('responds 409 when the type repeats the last movement', async () => {
    const vehicle = await createVehicle()
    const base = { vehicleId: vehicle.id, driverName: 'Ana López', mileage: 100 }
    await registerMovement({ ...base, type: 'ENTRY', occurredAt: hoursAgo(2) })

    const response = await registerMovement({ ...base, type: 'ENTRY', occurredAt: hoursAgo(1) })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      message: 'El vehículo HAA 1234 ya está dentro; el siguiente movimiento debe ser una salida',
    })
    expect(await prisma.movement.count()).toBe(1)
  })

  it('responds 409 when mileage is lower than the last one, and accepts the same mileage', async () => {
    const vehicle = await createVehicle()
    const base = { vehicleId: vehicle.id, driverName: 'Ana López' }
    await registerMovement({ ...base, type: 'ENTRY', occurredAt: hoursAgo(3), mileage: 500 })

    const lower = await registerMovement({
      ...base,
      type: 'EXIT',
      occurredAt: hoursAgo(2),
      mileage: 499,
    })
    const same = await registerMovement({
      ...base,
      type: 'EXIT',
      occurredAt: hoursAgo(2),
      mileage: 500,
    })

    expect(lower.status).toBe(409)
    expect(lower.body).toEqual({
      message:
        'El kilometraje no puede ser menor que el último registrado para el vehículo (500 km)',
    })
    expect(same.status).toBe(201)
  })

  it('responds 409 when the date is not after the last movement', async () => {
    const vehicle = await createVehicle()
    const base = { vehicleId: vehicle.id, driverName: 'Ana López', mileage: 100 }
    await registerMovement({ ...base, type: 'ENTRY', occurredAt: '2026-03-10T10:00:00Z' })

    const earlier = await registerMovement({
      ...base,
      type: 'EXIT',
      occurredAt: '2026-03-10T09:00:00Z',
    })
    const sameTime = await registerMovement({
      ...base,
      type: 'EXIT',
      occurredAt: '2026-03-10T10:00:00Z',
    })

    expect(earlier.status).toBe(409)
    expect(earlier.body).toEqual({
      message: 'La fecha debe ser posterior al último movimiento del vehículo (10/03/2026 04:00)',
    })
    expect(sameTime.status).toBe(409)
  })

  it('responds 400 for a date in the future', async () => {
    const vehicle = await createVehicle()

    const response = await registerMovement({
      vehicleId: vehicle.id,
      driverName: 'Ana López',
      type: 'ENTRY',
      occurredAt: new Date(Date.now() + 2 * HOUR_IN_MS).toISOString(),
      mileage: 100,
    })

    expect(response.status).toBe(400)
    expect(response.body.errors.occurredAt).toEqual(['La fecha no puede estar en el futuro'])
  })

  it('responds 400 with field errors for missing or malformed fields', async () => {
    const missing = await registerMovement({})
    const malformed = await registerMovement({
      vehicleId: '1',
      driverName: 'A1',
      type: 'IN',
      occurredAt: '2026-03-10 08:30',
      mileage: -5,
    })

    expect(missing.status).toBe(400)
    expect(Object.keys(missing.body.errors).sort()).toEqual([
      'driverName',
      'mileage',
      'occurredAt',
      'type',
      'vehicleId',
    ])
    expect(malformed.status).toBe(400)
    expect(malformed.body.errors).toEqual({
      vehicleId: ['El id del vehículo debe ser un número'],
      driverName: [
        "El nombre del conductor solo puede contener letras, espacios y los caracteres . ' -",
      ],
      type: ['El tipo debe ser ENTRY (entrada) o EXIT (salida)'],
      occurredAt: ['La fecha debe estar en formato ISO 8601 con zona horaria'],
      mileage: ['El kilometraje no puede ser negativo'],
    })
  })

  it('responds 404 for a missing or deactivated vehicle', async () => {
    const inactive = await createVehicle({ isActive: false })
    const base = { driverName: 'Ana López', type: 'ENTRY', occurredAt: hoursAgo(1), mileage: 1 }

    const missing = await registerMovement({ ...base, vehicleId: 999 })
    const deactivated = await registerMovement({ ...base, vehicleId: inactive.id })

    expect(missing.status).toBe(404)
    expect(missing.body).toEqual({ message: 'No se encontró el vehículo con id 999' })
    expect(deactivated.status).toBe(404)
    expect(await prisma.driver.count()).toBe(0)
  })

  it('accepts only one of two simultaneous entries for the same vehicle', async () => {
    const vehicle = await createVehicle()
    const body = {
      vehicleId: vehicle.id,
      driverName: 'Ana López',
      type: 'ENTRY',
      occurredAt: hoursAgo(1),
      mileage: 100,
    }

    const responses = await Promise.all([registerMovement(body), registerMovement(body)])

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409])
    expect(await prisma.movement.count()).toBe(1)
  })
})

describe('GET /api/movements', () => {
  async function seedMovements() {
    const hilux = await createVehicle({ plate: 'HAA1111' })
    const frontier = await createVehicle({ plate: 'HBB2222' })
    const ana = await prisma.driver.create({
      data: { fullName: 'Ana López', normalizedName: 'ana lópez' },
    })
    const carlos = await prisma.driver.create({
      data: { fullName: 'Carlos Mejía', normalizedName: 'carlos mejía' },
    })
    const movements = [
      // 23:30 on March 9 in Honduras
      { vehicleId: hilux.id, driverId: ana.id, type: 'ENTRY', occurredAt: '2026-03-10T05:30:00Z' },
      // 08:00 on March 10
      {
        vehicleId: hilux.id,
        driverId: carlos.id,
        type: 'EXIT',
        occurredAt: '2026-03-10T14:00:00Z',
      },
      // 23:30 on March 10
      {
        vehicleId: frontier.id,
        driverId: ana.id,
        type: 'ENTRY',
        occurredAt: '2026-03-11T05:30:00Z',
      },
      // 08:00 on March 11
      {
        vehicleId: frontier.id,
        driverId: carlos.id,
        type: 'EXIT',
        occurredAt: '2026-03-11T14:00:00Z',
      },
    ] as const
    await prisma.movement.createMany({
      data: movements.map((movement, index) => ({
        ...movement,
        occurredAt: new Date(movement.occurredAt),
        mileage: 100 + index,
      })),
    })
    return { hilux, frontier, ana, carlos }
  }

  function occurredAtValues(body: { data: { occurredAt: string }[] }) {
    return body.data.map((movement) => movement.occurredAt)
  }

  it('returns a page of movements, newest first, with vehicle and driver', async () => {
    await seedMovements()

    const response = await request(app).get('/api/movements?page=1&pageSize=3')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ total: 4, page: 1, pageSize: 3 })
    expect(occurredAtValues(response.body)).toEqual([
      '2026-03-11T14:00:00.000Z',
      '2026-03-11T05:30:00.000Z',
      '2026-03-10T14:00:00.000Z',
    ])
    expect(response.body.data[0]).toMatchObject({
      type: 'EXIT',
      vehicle: { plate: 'HBB2222' },
      driver: { fullName: 'Carlos Mejía' },
    })

    const secondPage = await request(app).get('/api/movements?page=2&pageSize=3')
    expect(occurredAtValues(secondPage.body)).toEqual(['2026-03-10T05:30:00.000Z'])
  })

  it('filters by vehicle, driver, and type', async () => {
    const { hilux, ana } = await seedMovements()

    const byVehicle = await request(app).get(`/api/movements?vehicleId=${hilux.id}`)
    const byDriver = await request(app).get(`/api/movements?driverId=${ana.id}`)
    const byType = await request(app).get('/api/movements?type=EXIT')

    expect(byVehicle.body.total).toBe(2)
    expect(
      byVehicle.body.data.every((m: { vehicle: { id: number } }) => m.vehicle.id === hilux.id),
    ).toBe(true)
    expect(byDriver.body.total).toBe(2)
    expect(
      byDriver.body.data.every((m: { driver: { id: number } }) => m.driver.id === ana.id),
    ).toBe(true)
    expect(byType.body.total).toBe(2)
    expect(byType.body.data.every((m: { type: string }) => m.type === 'EXIT')).toBe(true)
  })

  it('filters by whole local days in Honduras time (UTC-6)', async () => {
    await seedMovements()

    const response = await request(app).get('/api/movements?from=2026-03-10&to=2026-03-10')

    expect(occurredAtValues(response.body)).toEqual([
      '2026-03-11T05:30:00.000Z',
      '2026-03-10T14:00:00.000Z',
    ])
  })

  it('responds 400 for invalid filters', async () => {
    const reversed = await request(app).get('/api/movements?from=2026-03-11&to=2026-03-10')
    const malformed = await request(app).get('/api/movements?from=10/03/2026&type=IN&pageSize=500')

    expect(reversed.status).toBe(400)
    expect(reversed.body.errors).toEqual({
      to: ['La fecha final debe ser igual o posterior a la fecha inicial'],
    })
    expect(malformed.status).toBe(400)
    expect(malformed.body.errors).toEqual({
      from: ['from debe ser una fecha (AAAA-MM-DD)'],
      type: ['El tipo debe ser ENTRY (entrada) o EXIT (salida)'],
      pageSize: ['pageSize debe ser como máximo 100'],
    })
  })
})
