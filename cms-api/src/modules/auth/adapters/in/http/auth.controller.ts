import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Container } from '../../../../../composition/container';
import type { ActorContext } from '../../../../../shared/kernel/actor';
import { UnauthorizedError } from '../../../../../shared/kernel/errors';
import { Actor, Public, RateLimit, Roles } from '../../../../../shared/http/decorators';
import { clientIp, type CmsRequest } from '../../../../../shared/http/request';
import type { HttpRuntime } from '../../../../../shared/http/runtime';
import { CONTAINER, RUNTIME } from '../../../../../shared/http/tokens';
import { parse } from '../../../../../shared/http/validation';
import type { SessionTokens } from '../../../application/ports/in/auth.ports';
import {
  ChangePasswordRequest,
  CreateApiKeyRequest,
  ForgotPasswordRequest,
  LoginRequest,
  SetPasswordWithTokenRequest,
} from './auth.dto';

/**
 * SEC-11: the refresh cookie is SameSite=Strict AND refresh/logout require a
 * custom header, which a cross-site form or image cannot send.
 */
export const CSRF_HEADER = 'x-cms-csrf';

@Controller('api/admin/auth')
export class AuthController {
  constructor(
    @Inject(CONTAINER) private readonly c: Container,
    @Inject(RUNTIME) private readonly runtime: HttpRuntime,
  ) {}

  private setRefreshCookie(res: Response, s: SessionTokens): void {
    const { name, secure, path } = this.runtime.refreshCookie;
    res.cookie(name, s.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path,
      expires: s.refreshTokenExpiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    const { name, secure, path } = this.runtime.refreshCookie;
    res.clearCookie(name, { httpOnly: true, secure, sameSite: 'strict', path });
  }

  private sessionBody(s: SessionTokens) {
    return { accessToken: s.accessToken, expiresIn: s.accessTokenExpiresIn, user: s.user };
  }

  private requireCsrfHeader(req: CmsRequest): void {
    if (req.headers[CSRF_HEADER] !== '1') throw new UnauthorizedError('Missing CSRF header');
  }

  /** FR-AUTH-01/04, SEC-07 (10/min/IP) */
  @Post('login')
  @Public()
  @RateLimit('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: CmsRequest, @Res({ passthrough: true }) res: Response) {
    const cmd = parse(LoginRequest, body);
    const session = await this.c.auth.login.execute(cmd, { ip: clientIp(req) });
    this.setRefreshCookie(res, session);
    return this.sessionBody(session);
  }

  @Post('refresh')
  @Public()
  @RateLimit('login')
  @HttpCode(200)
  async refresh(@Req() req: CmsRequest, @Res({ passthrough: true }) res: Response) {
    this.requireCsrfHeader(req);
    const token = req.cookies[this.runtime.refreshCookie.name] as string | undefined;
    if (!token) throw new UnauthorizedError('Session expired');
    try {
      const session = await this.c.auth.refresh.execute(token, { ip: clientIp(req) });
      this.setRefreshCookie(res, session);
      return this.sessionBody(session);
    } catch (err) {
      this.clearRefreshCookie(res);
      throw err;
    }
  }

  /** FR-AUTH-09 */
  @Post('logout')
  @Public()
  @HttpCode(204)
  async logout(@Req() req: CmsRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.requireCsrfHeader(req);
    await this.c.auth.logout.execute(req.cookies[this.runtime.refreshCookie.name] as string | undefined, {
      ip: clientIp(req),
    });
    this.clearRefreshCookie(res);
  }

  /** FR-AUTH-07, SEC-07 (5/hour/IP). Always 202 — no account enumeration. */
  @Post('password/forgot')
  @Public()
  @RateLimit('password_reset')
  @HttpCode(202)
  async forgot(@Body() body: unknown, @Req() req: CmsRequest): Promise<{ status: 'accepted' }> {
    await this.c.auth.requestPasswordReset.execute(parse(ForgotPasswordRequest, body).email, { ip: clientIp(req) });
    return { status: 'accepted' };
  }

  @Post('password/reset')
  @Public()
  @RateLimit('password_reset')
  @HttpCode(204)
  async reset(@Body() body: unknown, @Req() req: CmsRequest): Promise<void> {
    await this.c.auth.completePasswordReset.execute(parse(SetPasswordWithTokenRequest, body), { ip: clientIp(req) });
  }

  /** FR-USER-02 */
  @Post('invite/accept')
  @Public()
  @RateLimit('password_reset')
  @HttpCode(204)
  async acceptInvite(@Body() body: unknown, @Req() req: CmsRequest): Promise<void> {
    await this.c.auth.acceptInvite.execute(parse(SetPasswordWithTokenRequest, body), { ip: clientIp(req) });
  }

  @Get('me')
  me(@Actor() actor: ActorContext) {
    return this.c.users.get.execute(actor.userId, actor);
  }

  @Post('me/password')
  @HttpCode(204)
  async changePassword(
    @Body() body: unknown,
    @Actor() actor: ActorContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.c.auth.changeOwnPassword.execute(parse(ChangePasswordRequest, body), actor);
    this.clearRefreshCookie(res);
  }
}

/** FR-PUBAPI-02: API key administration (Admin only). */
@Controller('api/admin/api-keys')
@Roles('admin')
export class ApiKeysController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get()
  async list(@Actor() actor: ActorContext) {
    return { data: await this.c.auth.listApiKeys.execute(actor) };
  }

  /** The raw key is in this response only — it is never retrievable again. */
  @Post()
  @RateLimit('admin_mutation')
  create(@Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.auth.createApiKey.execute(parse(CreateApiKeyRequest, body).name, actor);
  }

  @Delete(':id')
  @RateLimit('admin_mutation')
  @HttpCode(204)
  async revoke(@Param('id') id: string, @Actor() actor: ActorContext): Promise<void> {
    await this.c.auth.revokeApiKey.execute(id, actor);
  }
}
