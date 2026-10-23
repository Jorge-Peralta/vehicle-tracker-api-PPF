import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma, resetDatabase } from './helpers/database.js'

const app = createApp()

const validVehicle = { brand: 'Toyota', model: 'Hilux', plate: 'HAA1234', year: 2021 }

async function createVehicleInDb(data: Partial<typeof validVehicle> & { isActive?: boolean } = {}) {
  return prisma.vehicle.create({ data: { ...validVehicle, ...data } })
}

async function addMovement(
  vehicleId: number,
  movement: { type: 'ENTRY' | 'EXIT'; mileage: number; occurredAt: Date },
) {
  const driver = await prisma.driver.upsert({
    where: { normalizedName: 'test driver' },
    update: {},
    create: { fullName: 'Test Driver', normalizedName: 'test driver' },
  })
  return prisma.movement.create({ data: { vehicleId, driverId: driver.id, ...movement } })
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/vehicles', () => {
  it('creates a vehicle, normalizing the plate and trimming text', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .send({ brand: '  Toyota ', model: 'Hilux', plate: 'haa 1234', year: 2021 })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      brand: 'Toyota',
      model: 'Hilux',
      plate: 'HAA1234',
      year: 2021,
      isActive: true,
    })
    expect(await prisma.vehicle.count()).toBe(1)
  })

  it('accepts a vehicle without year', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .send({ brand: 'Toyota', model: 'Hilux', plate: 'HAA1234' })

    expect(response.status).toBe(201)
    expect(response.body.year).toBeNull()
  })

  it('responds 400 with field errors when required fields are missing', async () => {
    const response = await request(app).post('/api/vehicles').send({})

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Los datos enviados no son válidos')
    expect(Object.keys(response.body.errors).sort()).toEqual(['brand', 'model', 'plate'])
    expect(await prisma.vehicle.count()).toBe(0)
  })

  it('responds 400 for an invalid plate format', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .send({ ...validVehicle, plate: 'AB-123' })

    expect(response.status).toBe(400)
    expect(response.body.errors.plate).toEqual([
      'La placa debe tener 3 letras y 4 dígitos, por ejemplo HAA 1234',
    ])
  })

  it('responds 400 when year has the wrong type or is out of range', async () => {
    const wrongType = await request(app)
      .post('/api/vehicles')
      .send({ ...validVehicle, year: '2021' })
    const future = await request(app)
      .post('/api/vehicles')
      .send({ ...validVehicle, year: new Date().getFullYear() + 2 })

    expect(wrongType.status).toBe(400)
    expect(wrongType.body.errors.year).toEqual(['El año debe ser un número'])
    expect(future.status).toBe(400)
    expect(future.body.errors.year).toEqual(['El año no puede ser posterior al próximo año'])
  })

  it('responds 409 when an active vehicle already has the plate', async () => {
    await createVehicleInDb()

    const response = await request(app)
      .post('/api/vehicles')
      .send({ ...validVehicle, plate: 'HAA 1234' })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ message: 'Ya existe un vehículo con la placa HAA 1234' })
    expect(await prisma.vehicle.count()).toBe(1)
  })

  it('reactivates a soft-deleted vehicle with the same plate instead of failing', async () => {
    const inactive = await createVehicleInDb({ isActive: false, brand: 'Old', model: 'Old' })

    const response = await request(app)
      .post('/api/vehicles')
      .send({ brand: 'Nissan', model: 'Frontier', plate: 'HAA1234', year: 2019 })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: inactive.id,
      brand: 'Nissan',
      model: 'Frontier',
      year: 2019,
      isActive: true,
    })
    expect(await prisma.vehicle.count()).toBe(1)
  })
})

describe('GET /api/vehicles', () => {
  it('lists active vehicles ordered by plate, hiding inactive ones by default', async () => {
    await createVehicleInDb({ plate: 'HBB2222' })
    await createVehicleInDb({ plate: 'HAA1111' })
    await createVehicleInDb({ plate: 'HCC3333', isActive: false })

    const response = await request(app).get('/api/vehicles')

    expect(response.status).toBe(200)
    expect(response.body.map((vehicle: { plate: string }) => vehicle.plate)).toEqual([
      'HAA1111',
      'HBB2222',
    ])
  })

  it('includes inactive vehicles when includeInactive=true', async () => {
    await createVehicleInDb({ plate: 'HAA1111' })
    await createVehicleInDb({ plate: 'HCC3333', isActive: false })

    const response = await request(app).get('/api/vehicles?includeInactive=true')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(2)
  })

  it('filters by brand, model, or plate, case-insensitively', async () => {
    await createVehicleInDb({ brand: 'Toyota', model: 'Hilux', plate: 'HAA1111' })
    await createVehicleInDb({ brand: 'Nissan', model: 'Frontier', plate: 'HBB2222' })

    const byBrand = await request(app).get('/api/vehicles?search=toyo')
    const byModel = await request(app).get('/api/vehicles?search=FRONT')
    const byPlate = await request(app).get('/api/vehicles').query({ search: 'hbb 22' })

    expect(byBrand.body.map((vehicle: { plate: string }) => vehicle.plate)).toEqual(['HAA1111'])
    expect(byModel.body.map((vehicle: { plate: string }) => vehicle.plate)).toEqual(['HBB2222'])
    expect(byPlate.body.map((vehicle: { plate: string }) => vehicle.plate)).toEqual(['HBB2222'])
  })

  it('responds 400 for an invalid includeInactive value', async () => {
    const response = await request(app).get('/api/vehicles?includeInactive=maybe')

    expect(response.status).toBe(400)
    expect(response.body.errors.includeInactive).toEqual(['includeInactive debe ser true o false'])
  })
})

describe('GET /api/vehicles/:id', () => {
  it('returns the vehicle with no status when it has no movements', async () => {
    const vehicle = await createVehicleInDb()

    const response = await request(app).get(`/api/vehicles/${vehicle.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: vehicle.id,
      plate: 'HAA1234',
      currentStatus: null,
      lastMileage: null,
      lastMovementAt: null,
    })
  })

  it('returns the current status and mileage from the latest movement', async () => {
    const vehicle = await createVehicleInDb()
    await addMovement(vehicle.id, {
      type: 'ENTRY',
      mileage: 100,
      occurredAt: new Date('2026-01-01T10:00:00Z'),
    })
    await addMovement(vehicle.id, {
      type: 'EXIT',
      mileage: 150,
      occurredAt: new Date('2026-01-02T10:00:00Z'),
    })

    const response = await request(app).get(`/api/vehicles/${vehicle.id}`)

    expect(response.body).toMatchObject({
      currentStatus: 'OUTSIDE',
      lastMileage: 150,
      lastMovementAt: '2026-01-02T10:00:00.000Z',
    })
  })

  it('responds 404 when the vehicle does not exist', async () => {
    const response = await request(app).get('/api/vehicles/999')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ message: 'No se encontró el vehículo con id 999' })
  })

  it('responds 400 for a non-numeric id', async () => {
    const response = await request(app).get('/api/vehicles/abc')

    expect(response.status).toBe(400)
    expect(response.body.errors.id).toEqual(['El id debe ser un número'])
  })
})

describe('PUT /api/vehicles/:id', () => {
  it('updates the vehicle', async () => {
    const vehicle = await createVehicleInDb()

    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .send({ brand: 'Toyota', model: 'Hilux SR', plate: 'hzz 9999', year: null })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ model: 'Hilux SR', plate: 'HZZ9999', year: null })
    expect(await prisma.vehicle.findUnique({ where: { id: vehicle.id } })).toMatchObject({
      plate: 'HZZ9999',
    })
  })

  it('responds 409 when the new plate belongs to another vehicle', async () => {
    const vehicle = await createVehicleInDb({ plate: 'HAA1111' })
    await createVehicleInDb({ plate: 'HBB2222' })

    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .send({ ...validVehicle, plate: 'HBB2222' })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ message: 'Ya existe un vehículo con la placa HBB 2222' })
  })

  it('responds 404 for a missing or inactive vehicle', async () => {
    const inactive = await createVehicleInDb({ isActive: false })

    const missing = await request(app).put('/api/vehicles/999').send(validVehicle)
    const deactivated = await request(app).put(`/api/vehicles/${inactive.id}`).send(validVehicle)

    expect(missing.status).toBe(404)
    expect(deactivated.status).toBe(404)
  })

  it('responds 400 for an invalid body', async () => {
    const vehicle = await createVehicleInDb()

    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .send({ ...validVehicle, brand: '   ' })

    expect(response.status).toBe(400)
    expect(response.body.errors.brand).toEqual(['La marca es obligatoria'])
  })
})

describe('DELETE /api/vehicles/:id', () => {
  it('removes a vehicle without movements permanently', async () => {
    const vehicle = await createVehicleInDb()

    const response = await request(app).delete(`/api/vehicles/${vehicle.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ result: 'deleted' })
    expect(await prisma.vehicle.count()).toBe(0)
  })

  it('deactivates a vehicle with movements, keeping its history', async () => {
    const vehicle = await createVehicleInDb()
    await addMovement(vehicle.id, { type: 'ENTRY', mileage: 100, occurredAt: new Date() })

    const response = await request(app).delete(`/api/vehicles/${vehicle.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ result: 'deactivated' })
    expect(await prisma.vehicle.findUnique({ where: { id: vehicle.id } })).toMatchObject({
      isActive: false,
    })
    expect(await prisma.movement.count()).toBe(1)
  })

  it('responds 404 for a missing or already deleted vehicle', async () => {
    const inactive = await createVehicleInDb({ isActive: false })

    const missing = await request(app).delete('/api/vehicles/999')
    const deactivated = await request(app).delete(`/api/vehicles/${inactive.id}`)

    expect(missing.status).toBe(404)
    expect(deactivated.status).toBe(404)
  })
})
