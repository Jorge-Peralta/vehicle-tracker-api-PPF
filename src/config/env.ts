import { z } from 'zod'

/**
 * Environment variables, validated once at startup.
 * The process exits early with a readable message if anything is missing or malformed.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Comma-separated list of allowed origins, e.g. "http://localhost:5173,https://app.vercel.app"
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('Invalid environment variables:\n', z.prettifyError(result.error))
    process.exit(1)
  }

  return result.data
}

export const env = loadEnv()
