import type { Response } from 'express'
import type { ListVehiclesQuery, VehicleIdParams, VehicleInput } from './vehicle.schemas.js'
import * as vehicleService from './vehicle.service.js'

// Controllers only translate HTTP <-> service calls. Inputs arrive already parsed by `withValidation`.

export async function listVehicles({ query }: { query: ListVehiclesQuery }, response: Response) {
  response.json(await vehicleService.listVehicles(query))
}

export async function getVehicle({ params }: { params: VehicleIdParams }, response: Response) {
  response.json(await vehicleService.getVehicleById(params.id))
}

export async function createVehicle({ body }: { body: VehicleInput }, response: Response) {
  const { vehicle, reactivated } = await vehicleService.createVehicle(body)
  // 200 when an existing (soft-deleted) vehicle was reactivated, 201 when a new one was created.
  response.status(reactivated ? 200 : 201).json(vehicle)
}

export async function updateVehicle(
  { params, body }: { params: VehicleIdParams; body: VehicleInput },
  response: Response,
) {
  response.json(await vehicleService.updateVehicle(params.id, body))
}

export async function deleteVehicle({ params }: { params: VehicleIdParams }, response: Response) {
  const result = await vehicleService.deleteVehicle(params.id)
  response.json({ result })
}
