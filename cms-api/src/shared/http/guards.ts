import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Container } from '../../composition/container';
import { ForbiddenError, RateLimitedError, UnauthorizedError } from '../kernel/errors';
import type { Role } from '../kernel/role';
import { actorOf, PUBLIC_KEY, RATE_LIMIT_KEY, ROLES_KEY, type RateLimitBucket } from './decorators';
import { clientIp, type CmsRequest } from './request';
import { CONTAINER, RUNTIME } from './tokens';
import type { HttpRuntime } from './runtime';

/** Bearer JWT on every admin route unless marked @Public (02-SRS §7.1). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CONTAINER) private readonly c: Container,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<CmsRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError();
    const principal = await this.c.auth.authenticateAccessToken.execute(token);
    req.actor = { userId: principal.userId, role: principal.role, ip: clientIp(req) };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;
    const actor = actorOf(ctx.switchToHttp().getRequest<CmsRequest>());
    if (!roles.includes(actor.role)) throw new ForbiddenError();
    return true;
  }
}

/**
 * UR-D04: `X-API-Key` for /api/v1/*, then the per-key rate limit (SEC-07,
 * default 60/min/key). Applied per controller, so it runs after global guards.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(CONTAINER) private readonly c: Container,
    @Inject(RUNTIME) private readonly runtime: HttpRuntime,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<CmsRequest>();
    const { apiKeyId } = await this.c.auth.authenticateApiKey.execute(req.header('x-api-key'));
    req.apiKeyId = apiKeyId;
    const { limit, windowSeconds } = this.runtime.rateLimits.public_api;
    const decision = await this.c.infra.rateLimiter.hit(`public_api:${apiKeyId}`, limit, windowSeconds);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
    return true;
  }
}

/** SEC-07 rate limits. Keys: client IP for auth endpoints, user id for admin mutations. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CONTAINER) private readonly c: Container,
    @Inject(RUNTIME) private readonly runtime: HttpRuntime,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const bucket = this.reflector.getAllAndOverride<RateLimitBucket | undefined>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!bucket || bucket === 'public_api') return true; // public_api is enforced by ApiKeyGuard
    const req = ctx.switchToHttp().getRequest<CmsRequest>();
    const { limit, windowSeconds } = this.runtime.rateLimits[bucket];
    const who = bucket === 'admin_mutation' ? (req.actor?.userId ?? clientIp(req)) : clientIp(req);
    const decision = await this.c.infra.rateLimiter.hit(`${bucket}:${who}`, limit, windowSeconds);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
    return true;
  }
}
