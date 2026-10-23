import { defineConfig } from 'vitest/config'

// CI provides its own; locally, the test database created by docker-compose.
// Set here (not in `test.env`) so the global setup, which runs migrations, sees it too.
process.env.DATABASE_URL ??=
  'postgresql://vehicle_tracker:vehicle_tracker@localhost:5432/vehicle_tracker_test'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Test files share one database and reset it between tests, so they must not run in parallel.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
    },
  },
})
