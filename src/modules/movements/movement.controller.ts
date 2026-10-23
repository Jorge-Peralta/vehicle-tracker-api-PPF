import type { Response } from 'express'
import type {
  DailySummaryQuery,
  ListMovementsQuery,
  RegisterMovementInput,
} from './movement.schemas.js'
import * as movementService from './movement.service.js'

export async function registerMovement(
  { body }: { body: RegisterMovementInput },
  response: Response,
) {
  response.status(201).json(await movementService.registerMovement(body))
}

export async function listMovements({ query }: { query: ListMovementsQuery }, response: Response) {
  response.json(await movementService.listMovements(query))
}

export async function getDailySummary({ query }: { query: DailySummaryQuery }, response: Response) {
  response.json(await movementService.getDailySummary(query))
}
