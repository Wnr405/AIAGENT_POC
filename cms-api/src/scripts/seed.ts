import 'reflect-metadata';
import { buildContainer } from '../composition/container';
import { buildRuntime } from '../composition/production-infrastructure';
import { loadEnv } from '../config/env.schema';
import { settingsFromEnv } from '../config/settings';
import { seedFirstAdmin } from './seed-first-admin';

/** `pnpm db:seed` — creates the first Admin (as an invite) if no users exist. */
async function main(): Promise<void> {
  const env = loadEnv();
  const runtime = buildRuntime(env);
  const c = buildContainer(runtime.infra, settingsFromEnv(env));
  await seedFirstAdmin(c, runtime.infra.logger);
  await runtime.shutdown();
}

void main();
