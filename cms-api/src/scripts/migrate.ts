import { spawnSync } from 'node:child_process';

/**
 * Pre-deploy migration step (07-OPS-ARCH §11.2 / §12):
 *   docker compose run --rm cms-api node dist/scripts/migrate.js
 * Runs as the schema owner (MIGRATION_DATABASE_URL), not the restricted app role.
 */
const url = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL'];
if (!url) {
  process.stderr.write('MIGRATION_DATABASE_URL or DATABASE_URL is required\n');
  process.exit(1);
}
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
