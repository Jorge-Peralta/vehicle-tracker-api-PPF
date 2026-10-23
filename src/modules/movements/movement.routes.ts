import { Router } from 'express'
import { withValidation } from '../../shared/middlewares/validate.js'
import * as movementController from './movement.controller.js'
import { listMovementsQuerySchema, registerMovementSchema } from './movement.schemas.js'

export const movementRouter = Router()

movementRouter.get(
  '/',
  withValidation({ query: listMovementsQuerySchema }, movementController.listMovements),
)
movementRouter.post(
  '/',
  withValidation({ body: registerMovementSchema }, movementController.registerMovement),
)
