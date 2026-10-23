import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { vehicleRouter } from './modules/vehicles/vehicle.routes.js'
import { errorHandler } from './shared/middlewares/error-handler.js'
import { notFoundHandler } from './shared/middlewares/not-found.js'

/**
 * Builds the Express application without starting the HTTP server,
 * so tests can exercise it directly with Supertest.
 */
export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.use('/api/vehicles', vehicleRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
