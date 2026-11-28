import { spawnSync } from 'node:child_process';
import { migrateCommand } from './migrate-command';

/**
 * Pre-deploy migration step (07-OPS-ARCH §11.2 / §12):
 *   docker compose run --rm cms-api node dist/scripts/migrate.js
 * Runs as the schema owner (MIGRATION_DATABASE_URL), not the restricted app role.
 */
const cmd = migrateCommand(process.env);
if ('error' in cmd) {
  process.stderr.write(`${cmd.error}\n`);
  process.exit(1);
}
const result = spawnSync(cmd.file, cmd.args, { stdio: 'inherit', env: cmd.env });
process.exit(result.status ?? 1);
