import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const CRITICAL = { lines: 100, branches: 100, functions: 100, statements: 100 };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin in dev so the SameSite=Strict refresh cookie works (prod: nginx serves both).
    proxy: { '/api': { target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:3000', changeOrigin: false } },
  },
  build: {
    sourcemap: true,
    // 05-METRICS §5.3 bundle budget: split vendor chunks so the initial load stays small (NFR-PERF-01).
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          editor: [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-link',
            '@tiptap/extension-image',
            '@tiptap/extension-underline',
          ],
          data: ['@tanstack/react-query', 'zustand', 'rxjs', 'react-hook-form'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    env: { TZ: 'UTC' },
    // Page-level integration tests (MSW + TipTap) are slower on Windows CI agents.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov', 'cobertura'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        // App shell / providers → verified by E2E (05-METRICS §3.2)
        'src/main.tsx',
        'src/app/**',
        'src/vite-env.d.ts',
        'src/**/*.types.ts',
      ],
      thresholds: {
        lines: 98,
        branches: 98,
        functions: 98,
        statements: 98,
        'src/features/*/streams/**': CRITICAL,
        'src/shared/streams/**': CRITICAL,
        'src/**/*.logic.ts': CRITICAL,
        'src/shared/api/http-client.ts': CRITICAL,
      },
    },
  },
});
