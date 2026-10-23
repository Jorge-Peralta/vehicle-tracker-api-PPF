import type { RequestHandler } from 'express'
import { NotFoundError } from '../errors/app-error.js'

/** Catches requests that no route matched. */
export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new NotFoundError(`No existe la ruta ${request.method} ${request.originalUrl}`))
}
