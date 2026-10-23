import { execSync } from 'node:child_process'

/** Applies pending migrations to the test database once, before any test file runs. */
export default function setup() {
  const databaseUrl = process.env.DATABASE_URL ?? ''

  // Tests wipe every table, so never let them touch a non-test database.
  if (!new URL(databaseUrl).pathname.endsWith('_test')) {
    throw new Error(`Refusing to run tests: database name must end with "_test" (${databaseUrl})`)
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    // DIRECT_URL takes precedence in prisma.config.ts, so point it at the test database as well
    // (otherwise a value from .env would migrate the development database).
    env: { ...process.env, DIRECT_URL: databaseUrl },
  })
}
