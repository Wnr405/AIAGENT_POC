import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '../../../shared/kernel/errors';
import { User } from './user.entity';
import { EmailTakenError, LastAdminError } from './user-errors';

const admin = { userId: 'admin-1', role: 'admin' as const, ip: '10.0.0.1' };
const NOW = new Date('2026-05-01T00:00:00Z');
const LATER = new Date('2026-05-02T00:00:00Z');

const invite = (name = 'Bob') =>
  User.invite({ id: 'u1', email: 'Bob@Example.com', name, role: 'author', now: NOW }, admin);

describe('User aggregate (users module)', () => {
  it('invite creates an invited user and raises user.invite', () => {
    const u = invite();
    expect([u.id, u.email.value, u.name, u.role, u.status, u.lastLoginAt, u.createdAt, u.updatedAt]).toEqual([
      'u1',
      'bob@example.com',
      'Bob',
      'author',
      'invited',
      null,
      NOW,
      NOW,
    ]);
    expect(u.pullDomainEvents()).toEqual([
      {
        type: 'user.invite',
        occurredAt: NOW,
        actorId: 'admin-1',
        actorIp: '10.0.0.1',
        target: { type: 'user', id: 'u1' },
        summary: { role: 'author' },
      },
    ]);
  });

  it.each(['', '   ', 'x'.repeat(121)])('rejects invalid name %#', (name: string) => {
    expect(() => invite(name)).toThrow(ValidationError);
  });

  it('update changes name and role and records what changed', () => {
    const u = invite();
    u.pullDomainEvents();
    u.update({ name: 'Robert', role: 'editor' }, LATER, admin);
    expect([u.name, u.role, u.updatedAt]).toEqual(['Robert', 'editor', LATER]);
    expect(u.pullDomainEvents()[0]?.summary).toEqual({ name: true, role: { from: 'author', to: 'editor' } });
  });

  it('update with no effective change raises nothing', () => {
    const u = invite();
    u.pullDomainEvents();
    u.update({ name: ' Bob ', role: 'author' }, LATER, admin);
    u.update({}, LATER, admin);
    expect(u.pullDomainEvents()).toEqual([]);
    expect(u.updatedAt).toEqual(NOW);
  });

  it('deactivate is one-way and blocks further edits (FR-USER-05)', () => {
    const u = invite();
    u.deactivate(LATER, admin);
    expect(u.status).toBe('deactivated');
    expect(() => u.deactivate(LATER, admin)).toThrow(ConflictError);
    expect(() => u.update({ name: 'x' }, LATER, admin)).toThrow(ConflictError);
  });

  it('isActiveAdmin only for active admins', () => {
    const p = invite().toProps();
    expect(User.rehydrate({ ...p, role: 'admin', status: 'active' }).isActiveAdmin()).toBe(true);
    expect(User.rehydrate({ ...p, role: 'admin', status: 'invited' }).isActiveAdmin()).toBe(false);
    expect(User.rehydrate({ ...p, role: 'editor', status: 'active' }).isActiveAdmin()).toBe(false);
  });

  it('domain errors carry conflict semantics', () => {
    expect(new LastAdminError().code).toBe('CONFLICT');
    expect(new EmailTakenError().details).toEqual({ field: 'email' });
  });
});
