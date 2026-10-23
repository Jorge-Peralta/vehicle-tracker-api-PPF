import { Prisma } from '../../generated/prisma/client.js'

/** P2002: a unique constraint (e.g. vehicle plate) was violated. */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/** P2003: a foreign key constraint was violated (e.g. deleting a row that is still referenced). */
export function isForeignKeyConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
}
