import type { Request, RequestHandler, Response } from 'express'
import { z } from 'zod'
import { ValidationError } from '../errors/app-error.js'

// Zod's built-in messages in Spanish, for any rule without a custom message.
z.config(z.locales.es())

type RequestSchemas = {
  params?: z.ZodType
  query?: z.ZodType
  body?: z.ZodType
}

type ParsedPart<
  TSchemas extends RequestSchemas,
  TKey extends keyof RequestSchemas,
> = TSchemas[TKey] extends z.ZodType ? z.output<TSchemas[TKey]> : undefined

/** The request's params, query, and body after Zod parsing (trimmed, coerced, defaulted). */
export type ValidatedInput<TSchemas extends RequestSchemas> = {
  params: ParsedPart<TSchemas, 'params'>
  query: ParsedPart<TSchemas, 'query'>
  body: ParsedPart<TSchemas, 'body'>
}

/**
 * Wraps a handler so it only runs with valid input. Params, query, and body are parsed
 * with the given Zod schemas and passed to the handler already typed.
 * On failure it responds 400 with field errors: `{ message, errors: { field: ["message"] } }`.
 */
export function withValidation<TSchemas extends RequestSchemas>(
  schemas: TSchemas,
  handler: (
    input: ValidatedInput<TSchemas>,
    response: Response,
    request: Request,
  ) => void | Promise<void>,
): RequestHandler {
  return async (request, response) => {
    const fieldErrors: Record<string, string[]> = {}
    const parsed: Record<string, unknown> = {}

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = schemas[location]
      if (!schema) continue

      const result = schema.safeParse(request[location] ?? {})
      if (result.success) {
        parsed[location] = result.data
      } else {
        Object.assign(fieldErrors, z.flattenError(result.error).fieldErrors)
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new ValidationError(fieldErrors)
    }

    await handler(parsed as ValidatedInput<TSchemas>, response, request)
  }
}
