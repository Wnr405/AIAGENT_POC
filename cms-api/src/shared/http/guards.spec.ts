import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/support/test-app';
import { UnauthorizedError } from '../kernel/errors';
import { actorOf } from './decorators';
import { RateLimitGuard, RolesGuard } from './guards';
import type { CmsRequest } from './request';
import type { HttpRuntime } from './runtime';

const runtime = {
  rateLimits: {
    login: { limit: 1, windowSeconds: 60 },
    password_reset: { limit: 1, windowSeconds: 60 },
    public_api: { limit: 1, windowSeconds: 60 },
    admin_mutation: { limit: 1, windowSeconds: 60 },
  },
} as unknown as HttpRuntime;

const reflectorReturning = (value: unknown) => ({ getAllAndOverride: () => value }) as unknown as Reflector;
const contextFor = (req: Partial<CmsRequest>) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('HTTP guards (FR-AUTHZ-01, SEC-07)', () => {
  it('actorOf returns the authenticated actor and is a 401 without one', () => {
    const actor = { userId: 'u1', role: 'admin' as const, ip: '203.0.113.1' };
    expect(actorOf({ actor } as CmsRequest)).toBe(actor);
    expect(() => actorOf({} as CmsRequest)).toThrow(UnauthorizedError);
  });

  it('RolesGuard refuses a role-restricted route when no actor was authenticated', () => {
    const guard = new RolesGuard(reflectorReturning(['admin']));
    expect(() => guard.canActivate(contextFor({}))).toThrow(UnauthorizedError);
  });

  it('RateLimitGuard keys admin mutations by user, falling back to the client IP', async () => {
    const t = createTestApp();
    const guard = new RateLimitGuard(reflectorReturning('admin_mutation'), t.app, runtime);
    const anonymous = { ip: '198.51.100.7', socket: {} } as unknown as CmsRequest;
    expect(await guard.canActivate(contextFor(anonymous))).toBe(true);
    await expect(guard.canActivate(contextFor(anonymous))).rejects.toThrow('Too many requests');
    const signedIn = {
      ...anonymous,
      actor: { userId: 'u1', role: 'editor' as const, ip: '198.51.100.7' },
    } as CmsRequest;
    expect(await guard.canActivate(contextFor(signedIn))).toBe(true);
  });
});
