import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import type { Container } from '../../../../../composition/container';
import type { ActorContext } from '../../../../../shared/kernel/actor';
import { ROLES } from '../../../../../shared/kernel/role';
import { Actor, RateLimit, Roles } from '../../../../../shared/http/decorators';
import { listEnvelope } from '../../../../../shared/http/envelope';
import { CONTAINER } from '../../../../../shared/http/tokens';
import { parse } from '../../../../../shared/http/validation';
import { USER_STATUSES } from '../../../domain/user.entity';

export const InviteUserRequest = z.object({
  email: z.string().min(3).max(254),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
});
export const UpdateUserRequest = z
  .object({ name: z.string().min(1).max(120).optional(), role: z.enum(ROLES).optional() })
  .refine((v) => v.name !== undefined || v.role !== undefined, 'Provide name and/or role');
export const ListUsersQuery = z.object({
  search: z.string().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  page: z.coerce.number().int().optional(),
  page_size: z.coerce.number().int().optional(),
});

/** UR-A01..A05, FR-USER-*. Route-level Admin check + use-case check (FR-AUTHZ-01). */
@Controller('api/admin/users')
@Roles('admin')
export class UsersController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get()
  async list(@Query() query: unknown, @Actor() actor: ActorContext) {
    const q = parse(ListUsersQuery, query);
    const result = await this.c.users.list.execute({ ...q, pageSize: q.page_size }, actor);
    return listEnvelope(result, (u) => u);
  }

  @Post()
  @RateLimit('admin_mutation')
  invite(@Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.users.invite.execute(parse(InviteUserRequest, body), actor);
  }

  @Patch(':id')
  @RateLimit('admin_mutation')
  update(@Param('id') id: string, @Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.users.update.execute({ userId: id, ...parse(UpdateUserRequest, body) }, actor);
  }

  @Post(':id/deactivate')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  deactivate(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.c.users.deactivate.execute(id, actor);
  }

  /** UR-A05 — also used for "Resend invite". */
  @Post(':id/reset-password')
  @RateLimit('admin_mutation')
  @HttpCode(202)
  async resetPassword(@Param('id') id: string, @Actor() actor: ActorContext): Promise<{ status: 'accepted' }> {
    await this.c.users.adminResetPassword.execute(id, actor);
    return { status: 'accepted' };
  }
}
