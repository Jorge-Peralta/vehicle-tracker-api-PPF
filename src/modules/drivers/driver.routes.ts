import { Router } from 'express'
import { withValidation } from '../../shared/middlewares/validate.js'
import * as driverController from './driver.controller.js'
import { listDriversQuerySchema } from './driver.schemas.js'

export const driverRouter = Router()

driverRouter.get(
  '/',
  withValidation({ query: listDriversQuerySchema }, driverController.listDrivers),
)
