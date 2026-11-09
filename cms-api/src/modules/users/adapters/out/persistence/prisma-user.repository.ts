import type { Prisma, User as UserRow } from '@prisma/client';
import { Email } from '../../../../../shared/kernel/email.vo';
import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { PrismaContext } from '../../../../../shared/adapters/prisma/prisma-context';
import { User } from '../../../domain/user.entity';
import type { UserRepository, UserSearchCriteria } from '../../../application/ports/out/user-repository.port';

export const UserPersistenceMapper = {
  toDomain(r: UserRow): User {
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
  },
};

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly ctx: PrismaContext) {}

  async save(user: User): Promise<void> {
    const p = user.toProps();
    const profile = { email: p.email.value, name: p.name, role: p.role, status: p.status, updatedAt: p.updatedAt };
    await this.ctx.db.user.upsert({
      where: { id: p.id },
      create: { id: p.id, ...profile, lastLoginAt: p.lastLoginAt, createdAt: p.createdAt },
      update: profile, // credential columns are owned by the auth module
    });
  }

  async findById(id: string): Promise<User | null> {
    const r = await this.ctx.db.user.findUnique({ where: { id } });
    return r ? UserPersistenceMapper.toDomain(r) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const r = await this.ctx.db.user.findUnique({ where: { email: email.toLowerCase() } });
    return r ? UserPersistenceMapper.toDomain(r) : null;
  }

  async findMany(c: UserSearchCriteria, page: PageRequest): Promise<PagedResult<User>> {
    const where: Prisma.UserWhereInput = {
      role: c.role,
      status: c.status,
      ...(c.search
        ? {
            OR: [
              { name: { contains: c.search, mode: 'insensitive' } },
              { email: { contains: c.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.ctx.db.user.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.ctx.db.user.count({ where }),
    ]);
    return {
      items: rows.map((row) => UserPersistenceMapper.toDomain(row)),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  countActiveAdmins(): Promise<number> {
    return this.ctx.db.user.count({ where: { role: 'admin', status: 'active' } });
  }

  async namesByIds(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.ctx.db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
