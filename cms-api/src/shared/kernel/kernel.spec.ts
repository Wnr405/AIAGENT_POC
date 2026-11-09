import { describe, expect, it } from 'vitest';
import { requireCapability, SYSTEM_ACTOR } from './actor';
import { assertNever } from './assert-never';
import { AggregateRoot, type DomainEvent } from './domain-event';
import { Email } from './email.vo';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from './errors';
import { escapeHtml } from './html';
import { can, CAPABILITIES, type Capability } from './permissions';
import { isRole, ROLES } from './role';
import { isUuid } from './uuid';

describe('error taxonomy', () => {
  it('carries a stable code, message, details and class name', () => {
    const e = new ValidationError('bad', { field: 'x' });
    expect([e.code, e.message, e.details, e.name]).toEqual([
      'VALIDATION_ERROR',
      'bad',
      { field: 'x' },
      'ValidationError',
    ]);
  });

  it('NotFoundError includes resource and id details only when an id is given', () => {
    expect(new NotFoundError('User', 'u1').details).toEqual({ resource: 'User', id: 'u1' });
    expect(new NotFoundError('User').details).toBeUndefined();
    expect(new NotFoundError('User').message).toBe('User not found');
  });

  it('Forbidden and Unauthorized default to generic messages (FR-AUTHZ-05)', () => {
    expect(new ForbiddenError().message).toBe('You do not have permission to perform this action');
    expect(new ForbiddenError().code).toBe('FORBIDDEN');
    expect(new UnauthorizedError().message).toBe('Authentication required');
    expect(new UnauthorizedError('x').code).toBe('UNAUTHORIZED');
  });

  it('Conflict and RateLimited expose their codes', () => {
    expect(new ConflictError('c').code).toBe('CONFLICT');
    const r = new RateLimitedError(42);
    expect([r.code, r.retryAfterSeconds, r.details]).toEqual(['RATE_LIMITED', 42, { retryAfterSeconds: 42 }]);
  });
});

describe('permission matrix (02-SRS §5.3.1, BR-05, FR-USER-03, FR-AUTHZ-03/04) — critical path', () => {
  const expected: Record<Capability, string[]> = {
    'content.create': ['admin', 'editor', 'author'],
    'content.edit_own': ['admin', 'editor', 'author'],
    'content.edit_any': ['admin', 'editor'],
    'content.submit': ['admin', 'editor', 'author'],
    'content.publish': ['admin', 'editor'],
    'content.schedule': ['admin', 'editor'],
    'content.delete': ['admin', 'editor'],
    'content.read_drafts_any': ['admin', 'editor'],
    'media.upload': ['admin', 'editor', 'author'],
    'media.delete_own': ['admin', 'editor', 'author'],
    'media.delete_any': ['admin', 'editor'],
    'media.force_delete': ['admin'],
    'users.manage': ['admin'],
    'audit.read': ['admin'],
    'api_keys.manage': ['admin'],
  };

  it('defines exactly the expected capabilities', () => {
    expect(Object.keys(CAPABILITIES).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [cap, roles] of Object.entries(expected)) {
    for (const role of ROLES) {
      it(`${role} ${roles.includes(role) ? 'can' : 'cannot'} ${cap}`, () => {
        expect(can(role, cap as Capability)).toBe(roles.includes(role));
      });
    }
  }

  it('requireCapability throws ForbiddenError when missing and passes otherwise', () => {
    expect(() => requireCapability({ userId: 'u', role: 'author', ip: '1' }, 'users.manage')).toThrow(ForbiddenError);
    expect(() => requireCapability({ userId: 'u', role: 'admin', ip: '1' }, 'users.manage')).not.toThrow();
  });

  it('system actor has no user id', () => {
    expect(SYSTEM_ACTOR).toEqual({ userId: null, role: 'system', ip: '127.0.0.1' });
  });
});

describe('Email value object (FR-USER-07)', () => {
  it('normalises case and whitespace', () => {
    expect(Email.create('  Alice@Example.COM ').value).toBe('alice@example.com');
  });

  it.each([
    'a@b',
    'no-at-sign',
    'a@@b.com',
    '.a@b.com',
    'a..b@c.com',
    'a@-b.com',
    `${'x'.repeat(65)}@b.com`,
    `a@${'b'.repeat(250)}.com`,
    '',
  ])('rejects %s', (bad: string) => {
    expect(() => Email.create(bad)).toThrow(ValidationError);
  });

  it.each(["o'brien+tag@sub.example.co.uk", 'x_y.z@a-b.io'])('accepts %s', (good: string) => {
    expect(Email.create(good).value).toBe(good);
  });

  it('compares by value', () => {
    expect(Email.create('a@b.co').equals(Email.create('A@B.CO'))).toBe(true);
    expect(Email.create('a@b.co').equals(Email.create('c@b.co'))).toBe(false);
  });
});

describe('AggregateRoot', () => {
  class Agg extends AggregateRoot {
    touch(e: DomainEvent): void {
      this.raise(e);
    }
  }
  it('collects events and empties the buffer on pull', () => {
    const a = new Agg();
    const e: DomainEvent = {
      type: 't',
      occurredAt: new Date(0),
      actorId: null,
      actorIp: null,
      target: { type: 'x', id: null },
      summary: {},
    };
    a.touch(e);
    expect(a.pullDomainEvents()).toEqual([e]);
    expect(a.pullDomainEvents()).toEqual([]);
  });
});

describe('small helpers', () => {
  it('isRole', () => {
    expect(isRole('editor')).toBe(true);
    expect(isRole('root')).toBe(false);
    expect(isRole(1)).toBe(false);
  });
  it('isUuid', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
  it('escapeHtml escapes the five significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
  it('assertNever throws', () => {
    expect(() => assertNever('x' as never)).toThrow('Unexpected value: x');
  });
});
