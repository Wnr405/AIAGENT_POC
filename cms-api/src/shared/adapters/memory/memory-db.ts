import type { Role } from '../../kernel/role';

/**
 * In-process "database" shared by every in-memory repository. Used by unit
 * tests and by `PERSISTENCE=memory` (local demo / E2E without Postgres).
 * Rows mirror the Prisma schema so both adapters behave alike.
 */
export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'invited' | 'active' | 'deactivated';
  passwordHash: string | null;
  failedLoginCount: number;
  failedWindowStartedAt: Date | null;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MemoryDb {
  readonly users = new Map<string, UserRow>();
  readonly tables = new Map<string, Map<string, unknown>>();

  table<T>(name: string): Map<string, T> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t as Map<string, T>;
  }
}

export const containsCI = (haystack: string | null | undefined, needle: string): boolean =>
  (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
