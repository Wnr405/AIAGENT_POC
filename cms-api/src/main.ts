import './tracing';
import 'reflect-metadata';
import { buildContainer } from './composition/container';
import { createHttpApp } from './composition/http-app';
import { buildRuntime } from './composition/production-infrastructure';
import { loadEnv } from './config/env.schema';
import { settingsFromEnv } from './config/settings';
import type { HttpRuntime } from './shared/http/runtime';
import { initSentry } from './shared/http/sentry';
import { seedFirstAdmin } from './scripts/seed-first-admin';

async function bootstrap(): Promise<void> {
  const env = loadEnv(); // fails fast before anything else (07-OPS-ARCH §7.3)
  initSentry(env.SENTRY_DSN, env.SENTRY_ENV ?? env.NODE_ENV, env.APP_VERSION, env.SENTRY_SAMPLE_RATE);
  const runtime = buildRuntime(env);
  const container = buildContainer(runtime.infra, settingsFromEnv(env));
  if (env.PERSISTENCE === 'memory') await seedFirstAdmin(container, runtime.infra.logger);

  const http: HttpRuntime = {
    persistence: env.PERSISTENCE,
    version: env.APP_VERSION,
    readinessChecks: runtime.readinessChecks,
    refreshCookie: {
      name: 'cms_rt',
      secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
      path: '/api/admin/auth',
    },
    rateLimits: {
      login: { limit: env.RATE_LIMIT_LOGIN_PER_MIN, windowSeconds: 60 },
      password_reset: { limit: env.RATE_LIMIT_PASSWORD_RESET_PER_HOUR, windowSeconds: 3600 },
      public_api: { limit: env.RATE_LIMIT_PUBLIC_API_PER_MIN, windowSeconds: 60 },
      admin_mutation: { limit: env.RATE_LIMIT_ADMIN_MUTATION_PER_MIN, windowSeconds: 60 },
    },
  };

  const app = await createHttpApp(container, http, {
    corsOrigins: env.CORS_ALLOWED_ORIGINS,
    bodyLimitMb: env.HTTP_BODY_LIMIT_MB,
    trustProxy: env.TRUST_PROXY,
    devUploadLimitMb: env.MEDIA_MAX_UPLOAD_MB + 1,
  });
  app.enableShutdownHooks();
  process.on('SIGTERM', () => void runtime.shutdown());

  await app.listen(env.HTTP_PORT, '0.0.0.0');
  runtime.infra.logger.info('cms-api listening', { port: env.HTTP_PORT, persistence: env.PERSISTENCE });
}

void bootstrap();
