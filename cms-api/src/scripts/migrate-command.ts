import { dirname, join } from 'node:path';

export type MigrateCommand =
  { file: string; args: string[]; env: Record<string, string | undefined> } | { error: string };

/**
 * `prisma migrate deploy` as the schema owner (MIGRATION_DATABASE_URL, else DATABASE_URL).
 * Runs the installed CLI with the current node binary: the runtime image has no npm/npx (07-OPS-ARCH §10.2),
 * and `npx` would otherwise download whatever prisma version is latest.
 */
export function migrateCommand(env: Record<string, string | undefined>): MigrateCommand {
  const url = env['MIGRATION_DATABASE_URL'] ?? env['DATABASE_URL'];
  if (!url) return { error: 'MIGRATION_DATABASE_URL or DATABASE_URL is required' };
  const cli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
  return { file: process.execPath, args: [cli, 'migrate', 'deploy'], env: { ...env, DATABASE_URL: url } };
}
