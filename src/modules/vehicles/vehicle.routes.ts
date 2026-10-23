import { Router } from 'express'
import { withValidation } from '../../shared/middlewares/validate.js'
import * as vehicleController from './vehicle.controller.js'
import {
  listVehiclesQuerySchema,
  vehicleIdParamsSchema,
  vehicleInputSchema,
} from './vehicle.schemas.js'

export const vehicleRouter = Router()

vehicleRouter.get(
  '/',
  withValidation({ query: listVehiclesQuerySchema }, vehicleController.listVehicles),
)
vehicleRouter.get(
  '/:id',
  withValidation({ params: vehicleIdParamsSchema }, vehicleController.getVehicle),
)
vehicleRouter.post(
  '/',
  withValidation({ body: vehicleInputSchema }, vehicleController.createVehicle),
)
vehicleRouter.put(
  '/:id',
  withValidation(
    { params: vehicleIdParamsSchema, body: vehicleInputSchema },
    vehicleController.updateVehicle,
  ),
)
vehicleRouter.delete(
  '/:id',
  withValidation({ params: vehicleIdParamsSchema }, vehicleController.deleteVehicle),
)
