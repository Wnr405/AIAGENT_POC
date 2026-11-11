// CI: every key in cms-infra/.env.example must be known to cms-api's env schema and vice versa
// (except infra-only keys). Prevents config drift (07-OPS-ARCH §7.4).
import { readFileSync } from 'node:fs';
import { schemaKeysOf } from './env-keys.mjs';

const INFRA_ONLY = new Set([
  'CMS_API_IMAGE', 'SERVER_NAME', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB',
  'POSTGRES_APP_USER', 'POSTGRES_APP_PASSWORD', 'MIGRATION_DATABASE_URL', 'REDIS_PASSWORD', 'MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD',
  'BACKUP_S3_BUCKET', 'BACKUP_S3_REGION', 'BACKUP_S3_ACCESS_KEY', 'BACKUP_S3_SECRET_KEY', 'BACKUP_RETENTION_HOURLY',
  'BACKUP_RETENTION_DAILY', 'BACKUP_RETENTION_WEEKLY', 'RESTIC_PASSWORD', 'SMOKE_API_KEY', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_NAME',
]);
const env = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
  .split('\n').map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1]).filter(Boolean);
const schema = readFileSync(new URL('../../cms-api/src/config/env.schema.ts', import.meta.url), 'utf8');
const schemaKeys = schemaKeysOf(schema);
const missingInSchema = env.filter((k) => !INFRA_ONLY.has(k) && !schemaKeys.includes(k));
const missingInEnv = schemaKeys.filter((k) => !env.includes(k) && !['PERSISTENCE', 'ROLE'].includes(k));
if (missingInSchema.length || missingInEnv.length) {
  console.error('Env drift detected', { missingInSchema, missingInEnv });
  process.exit(1);
}
console.log(`env schema in sync (${schemaKeys.length} keys)`);
