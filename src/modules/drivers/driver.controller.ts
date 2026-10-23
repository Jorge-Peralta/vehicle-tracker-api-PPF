import type { Response } from 'express'
import type { ListDriversQuery } from './driver.schemas.js'
import * as driverService from './driver.service.js'

export async function listDrivers({ query }: { query: ListDriversQuery }, response: Response) {
  response.json(await driverService.listDrivers(query))
}
