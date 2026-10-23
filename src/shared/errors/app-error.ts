/**
 * Base class for expected (operational) errors.
 * The error handler turns these into `{ message, errors? }` responses with their status code;
 * anything else is treated as an unexpected 500.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errors?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class ValidationError extends AppError {
  constructor(errors: unknown, message = 'Los datos enviados no son válidos') {
    super(message, 400, errors)
  }
}
