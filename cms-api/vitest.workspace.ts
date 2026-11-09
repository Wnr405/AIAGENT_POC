import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  { extends: './vitest.config.ts', test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
  { extends: './vitest.config.ts', test: { name: 'e2e', include: ['test/e2e/**/*.e2e.spec.ts'], testTimeout: 20_000 } },
]);
