import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateCommand } from './migrate-command';

describe('migrateCommand (07-OPS-ARCH §11.2)', () => {
  it('NFR-MAIN-03: runs the installed prisma CLI with node, not npx (the runtime image ships no npm — SEC-03)', () => {
    const cmd = migrateCommand({ MIGRATION_DATABASE_URL: 'postgres://owner@db/cms' });
    if ('error' in cmd) throw new Error(cmd.error);
    expect(cmd.file).toBe(process.execPath);
    expect(cmd.args.slice(1)).toEqual(['migrate', 'deploy']);
    expect(cmd.args[0]).toMatch(/[\\/]prisma[\\/]build[\\/]index\.js$/);
    expect(existsSync(cmd.args[0] ?? '')).toBe(true);
  });

  it('NFR-MAIN-03: migrates as the schema owner, falling back to DATABASE_URL', () => {
    const owner = migrateCommand({
      MIGRATION_DATABASE_URL: 'postgres://owner@db/cms',
      DATABASE_URL: 'postgres://app@db/cms',
    });
    expect('env' in owner && owner.env['DATABASE_URL']).toBe('postgres://owner@db/cms');
    const app = migrateCommand({ DATABASE_URL: 'postgres://app@db/cms' });
    expect('env' in app && app.env['DATABASE_URL']).toBe('postgres://app@db/cms');
  });

  it('NFR-MAIN-03: refuses to run without a database URL', () => {
    expect(migrateCommand({})).toEqual({ error: 'MIGRATION_DATABASE_URL or DATABASE_URL is required' });
  });
});
