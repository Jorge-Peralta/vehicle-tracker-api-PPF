import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      // CI provides its own; locally, the test database created by docker-compose.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://vehicle_tracker:vehicle_tracker@localhost:5432/vehicle_tracker_test',
    },
  },
})
