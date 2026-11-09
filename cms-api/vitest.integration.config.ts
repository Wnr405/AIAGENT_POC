import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Testcontainers suite: real PostgreSQL (and later Redis/MinIO). Needs Docker. */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'integration',
    include: ['test/integration/**/*.int.spec.ts'],
    environment: 'node',
    env: { TZ: 'UTC' },
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      provider: 'v8',
      include: ['src/**/prisma-*.ts', 'src/shared/adapters/prisma/**'],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
