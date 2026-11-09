import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Container } from '../../../../../composition/container';
import type { ActorContext } from '../../../../../shared/kernel/actor';
import { Actor, RateLimit } from '../../../../../shared/http/decorators';
import { listEnvelope } from '../../../../../shared/http/envelope';
import { CONTAINER } from '../../../../../shared/http/tokens';
import { parse } from '../../../../../shared/http/validation';
import type { TransitionAction } from '../../../application/ports/in/content.ports';
import { CreateContentRequest, ListContentQuery, ScheduleRequest, UpdateContentRequest } from './content.dto';

const optDate = (v: string | undefined): Date | undefined => (v === undefined ? undefined : new Date(v));

/**
 * 02-SRS §7.1 content endpoints. Role checks for each action happen in the
 * ContentAccessPolicy (data layer) because they depend on ownership.
 */
@Controller('api/admin/content')
export class ContentController {
  constructor(@Inject(CONTAINER) private readonly c: Container) {}

  @Get()
  async list(@Query() query: unknown, @Actor() actor: ActorContext) {
    const q = parse(ListContentQuery, query);
    const result = await this.c.content.list.execute(
      {
        type: q.type,
        status: q.status,
        authorId: q.author_id,
        tag: q.tag,
        search: q.search,
        updatedFrom: optDate(q.updated_from),
        updatedTo: optDate(q.updated_to),
        sort: q.sort,
        order: q.order,
        page: q.page,
        pageSize: q.page_size,
      },
      actor,
    );
    return listEnvelope(result, (c) => c);
  }

  @Get('categories')
  categories() {
    return { data: this.c.content.categories };
  }

  @Get('stats')
  stats(@Actor() actor: ActorContext) {
    return this.c.content.stats.execute(actor);
  }

  @Post()
  @RateLimit('admin_mutation')
  create(@Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.content.create.execute(parse(CreateContentRequest, body), actor);
  }

  @Get(':id')
  get(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.c.content.get.execute(id, actor);
  }

  @Patch(':id')
  @RateLimit('admin_mutation')
  update(@Param('id') id: string, @Body() body: unknown, @Actor() actor: ActorContext) {
    return this.c.content.update.execute(id, parse(UpdateContentRequest, body), actor);
  }

  private transition(id: string, action: TransitionAction, actor: ActorContext) {
    return this.c.content.transition.execute(id, action, actor);
  }

  @Post(':id/submit')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  submit(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.transition(id, 'submit', actor);
  }

  @Post(':id/reject')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  reject(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.transition(id, 'reject', actor);
  }

  @Post(':id/publish')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  publish(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.transition(id, 'publish', actor);
  }

  @Post(':id/unpublish')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  unpublish(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.transition(id, 'unpublish', actor);
  }

  @Post(':id/archive')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  archive(@Param('id') id: string, @Actor() actor: ActorContext) {
    return this.transition(id, 'archive', actor);
  }

  @Post(':id/schedule')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  schedule(@Param('id') id: string, @Body() body: unknown, @Actor() actor: ActorContext) {
    const { scheduledAt } = parse(ScheduleRequest, body);
    return this.c.content.schedule.execute(id, scheduledAt === null ? null : new Date(scheduledAt), actor);
  }

  @Delete(':id')
  @RateLimit('admin_mutation')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Actor() actor: ActorContext): Promise<void> {
    await this.c.content.delete.execute(id, actor);
  }

  @Get(':id/versions')
  async versions(@Param('id') id: string, @Actor() actor: ActorContext) {
    return { data: await this.c.content.listVersions.execute(id, actor) };
  }

  @Post(':id/revert/:version')
  @RateLimit('admin_mutation')
  @HttpCode(200)
  revert(@Param('id') id: string, @Param('version', ParseIntPipe) version: number, @Actor() actor: ActorContext) {
    return this.c.content.revert.execute(id, version, actor);
  }
}
