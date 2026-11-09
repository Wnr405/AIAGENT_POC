import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { ActorContext } from '../kernel/actor';
import { UnauthorizedError } from '../kernel/errors';
import type { Role } from '../kernel/role';
import type { CmsRequest } from './request';

export const ROLES_KEY = 'cms:roles';
export const PUBLIC_KEY = 'cms:public';
export const RATE_LIMIT_KEY = 'cms:rate-limit';

/** Route-layer RBAC (FR-AUTHZ-01). Use cases enforce it again at the data layer. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Opt out of the JWT guard (login, refresh, password reset, public API, health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export type RateLimitBucket = 'login' | 'password_reset' | 'public_api' | 'admin_mutation';
export const RateLimit = (bucket: RateLimitBucket) => SetMetadata(RATE_LIMIT_KEY, bucket);

/** The authenticated actor set by JwtAuthGuard; 401 if a route forgot to require authentication. */
export function actorOf(req: CmsRequest): ActorContext {
  if (!req.actor) throw new UnauthorizedError();
  return req.actor;
}

export const Actor = createParamDecorator((_: unknown, ctx: ExecutionContext): ActorContext =>
  actorOf(ctx.switchToHttp().getRequest<CmsRequest>()),
);
