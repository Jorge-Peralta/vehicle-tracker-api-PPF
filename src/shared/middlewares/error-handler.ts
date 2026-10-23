import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors/app-error.js'

/**
 * Centralized error handler. Express 5 forwards rejected promises from async
 * handlers here automatically, so routes don't need try/catch.
 */
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      message: error.message,
      ...(error.errors !== undefined && { errors: error.errors }),
    })
    return
  }

  // Malformed JSON body (thrown by express.json())
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ message: 'El cuerpo de la solicitud no es un JSON válido' })
    return
  }

  console.error(error)
  response.status(500).json({ message: 'Error interno del servidor' })
}
