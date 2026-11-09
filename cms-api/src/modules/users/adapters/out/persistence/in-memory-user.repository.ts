import { Email } from '../../../../../shared/kernel/email.vo';
import { paginate, type PageRequest, type PagedResult } from '../../../../../shared/kernel/paged-result';
import { containsCI, type MemoryDb, type UserRow } from '../../../../../shared/adapters/memory/memory-db';
import { User } from '../../../domain/user.entity';
import type { UserRepository, UserSearchCriteria } from '../../../application/ports/out/user-repository.port';

function toDomain(r: UserRow): User {
  return User.rehydrate({
    id: r.id,
    email: Email.create(r.email),
    name: r.name,
    role: r.role,
    status: r.status,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });
}

export class InMemoryUserRepository implements UserRepository {
  constructor(private readonly db: MemoryDb) {}

  save(user: User): Promise<void> {
    const p = user.toProps();
    const existing = this.db.users.get(p.id);
    this.db.users.set(p.id, {
      passwordHash: null,
      failedLoginCount: 0,
      failedWindowStartedAt: null,
      lockedUntil: null,
      ...existing,
      id: p.id,
      email: p.email.value,
      name: p.name,
      role: p.role,
      status: p.status,
      lastLoginAt: p.lastLoginAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
    return Promise.resolve();
  }

  findById(id: string): Promise<User | null> {
    const r = this.db.users.get(id);
    return Promise.resolve(r ? toDomain(r) : null);
  }

  findByEmail(email: string): Promise<User | null> {
    const r = [...this.db.users.values()].find((u) => u.email === email.toLowerCase());
    return Promise.resolve(r ? toDomain(r) : null);
  }

  findMany(c: UserSearchCriteria, page: PageRequest): Promise<PagedResult<User>> {
    const rows = [...this.db.users.values()]
      .filter((u) => !c.role || u.role === c.role)
      .filter((u) => !c.status || u.status === c.status)
      .filter((u) => !c.search || containsCI(u.name, c.search) || containsCI(u.email, c.search))
      .sort((a, b) => a.name.localeCompare(b.name));
    return Promise.resolve(paginate(rows.map(toDomain), page));
  }

  countActiveAdmins(): Promise<number> {
    return Promise.resolve(
      [...this.db.users.values()].filter((u) => u.role === 'admin' && u.status === 'active').length,
    );
  }

  namesByIds(ids: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const id of ids) {
      const r = this.db.users.get(id);
      if (r) out.set(id, r.name);
    }
    return Promise.resolve(out);
  }
}
