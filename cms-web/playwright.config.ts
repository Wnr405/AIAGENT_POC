import { defineConfig, devices } from '@playwright/test';

/**
 * 06-TEST-STRATEGY §9.2. Locally and in CI (gate G-04) both servers start
 * automatically: the API in PERSISTENCE=memory mode, the SPA via Vite.
 * Against staging: E2E_BASE_URL=https://staging… pnpm test:e2e (no webServer).
 */
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: external ?? 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: external
    ? undefined
    : [
        {
          command: 'pnpm --dir ../cms-api dev:memory',
          url: 'http://localhost:3000/healthz',
          reuseExistingServer: !process.env.CI,
          env: {
            NODE_ENV: 'development',
            PERSISTENCE: 'memory',
            SEED_ADMIN_PASSWORD: 'dev-password-123',
            RATE_LIMIT_LOGIN_PER_MIN: '1000',
          },
          timeout: 60_000,
        },
        { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
      ],
});
