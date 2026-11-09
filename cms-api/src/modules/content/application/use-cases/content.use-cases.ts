import { requireCapability, type ActorContext, type AnyActor } from '../../../../shared/kernel/actor';
import { NotFoundError } from '../../../../shared/kernel/errors';
import { mapPaged, pageRequest, type PagedResult } from '../../../../shared/kernel/paged-result';
import { Content } from '../../domain/entities/content.entity';
import { slugFromTitle } from '../../domain/services/slug-generator';
import { Slug } from '../../domain/value-objects/slug.vo';
import type { ContentType } from '../../domain/value-objects/content-type';
import type {
  ContentFields,
  ContentJobs,
  ContentMediaUsageQuery,
  ContentStats,
  ContentSummaryView,
  ContentView,
  CreateContentCommand,
  ListContentQuery,
  PublishedContentProjection,
  PublishedContentQuery,
  TransitionAction,
  VersionView,
} from '../ports/in/content.ports';
import { ContentAccessPolicy as Policy } from '../policies/content-access.policy';
import {
  assertSlugAvailable,
  firstFreeSlug,
  loadContent,
  persist,
  toPatch,
  toSummaryView,
  toView,
  type ContentDeps,
} from './content-support';

/** UR-U01, FR-CONTENT-01/02/05 */
export class CreateContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(cmd: CreateContentCommand, actor: ActorContext): Promise<ContentView> {
    requireCapability(actor, 'content.create');
    const id = this.d.ids.next();
    const patch = await toPatch(this.d, cmd);
    let slug: Slug;
    if (patch.slug) {
      await assertSlugAvailable(this.d, cmd.type, patch.slug);
      slug = patch.slug;
    } else {
      slug = await firstFreeSlug(this.d, cmd.type, slugFromTitle(cmd.title, id));
    }
    const content = Content.create(
      { ...patch, id, type: cmd.type, title: cmd.title, slug, authorId: actor.userId, now: this.d.clock.now() },
      actor,
    );
    await persist(this.d, content, actor, { snapshot: true });
    return toView(this.d, content);
  }
}

/** UR-U01/E03, FR-CONTENT-02/03 */
export class UpdateContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(id: string, fields: ContentFields, actor: ActorContext): Promise<ContentView> {
    const content = await loadContent(this.d, id);
    Policy.assertCanEdit(actor, content);
    const patch = await toPatch(this.d, fields, content.id);
    if (patch.slug && patch.slug.value !== content.slug.value) {
      await assertSlugAvailable(this.d, content.type, patch.slug, content.id);
    }
    content.update(patch, this.d.clock.now(), actor);
    await persist(this.d, content, actor, { snapshot: true });
    return toView(this.d, content);
  }
}

export class GetContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(id: string, actor: ActorContext): Promise<ContentView> {
    const content = await loadContent(this.d, id);
    Policy.assertCanView(actor, content);
    return toView(this.d, content);
  }
}

/** FR-CONTENT-10/11, FR-AUTHZ-02 */
export class ListContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(q: ListContentQuery, actor: ActorContext): Promise<PagedResult<ContentSummaryView>> {
    const page = pageRequest(q.page, q.pageSize);
    const result = await this.d.contents.findMany(
      {
        type: q.type,
        status: q.status,
        authorId: Policy.listScope(actor, q.authorId),
        tag: q.tag,
        search: q.search,
        updatedFrom: q.updatedFrom,
        updatedTo: q.updatedTo,
        sort: q.sort,
        order: q.order,
      },
      page,
    );
    const names = await this.d.users.namesByIds([...new Set(result.items.map((c) => c.authorId))]);
    return mapPaged(result, (c) => toSummaryView(c, names));
  }
}

/** Each lifecycle action maps to exactly one aggregate method (exhaustive by type). */
const TRANSITIONS: Readonly<Record<TransitionAction, (c: Content, now: Date, actor: ActorContext) => void>> = {
  submit: (c, now, actor) => c.submitForReview(now, actor),
  reject: (c, now, actor) => c.reject(now, actor),
  publish: (c, now, actor) => c.publish(now, actor),
  unpublish: (c, now, actor) => c.unpublish(now, actor),
  archive: (c, now, actor) => c.archive(now, actor),
};

/** FR-CONTENT-04 — submit / reject / publish / unpublish / archive */
export class TransitionContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(id: string, action: TransitionAction, actor: ActorContext): Promise<ContentView> {
    const content = await loadContent(this.d, id);
    Policy.assertCanTransition(actor, content, action);
    const now = this.d.clock.now();
    TRANSITIONS[action](content, now, actor);
    await persist(this.d, content, actor, { snapshot: false });
    return toView(this.d, content);
  }
}

/** FR-CONTENT-07 — `at = null` cancels a schedule. */
export class ScheduleContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(id: string, at: Date | null, actor: ActorContext): Promise<ContentView> {
    Policy.assertCanSchedule(actor);
    const content = await loadContent(this.d, id);
    const now = this.d.clock.now();
    if (at === null) content.unschedule(now, actor);
    else content.schedule(at, now, actor);
    await persist(this.d, content, actor, { snapshot: false });
    return toView(this.d, content);
  }
}

/** FR-CONTENT-13 (soft delete) */
export class DeleteContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(id: string, actor: ActorContext): Promise<void> {
    Policy.assertCanDelete(actor);
    const content = await loadContent(this.d, id);
    content.softDelete(this.d.clock.now(), actor);
    await persist(this.d, content, actor, { snapshot: false });
  }
}

/** FR-CONTENT-08 */
export class ListVersions {
  constructor(private readonly d: ContentDeps) {}

  async execute(id: string, actor: ActorContext): Promise<VersionView[]> {
    const content = await loadContent(this.d, id);
    Policy.assertCanView(actor, content);
    const versions = await this.d.versions.list(id);
    const editorIds = versions.map((v) => v.editorId).filter((x): x is string => x !== null);
    const names = await this.d.users.namesByIds([...new Set(editorIds)]);
    return versions.map((v) => ({
      versionNo: v.versionNo,
      editor: { id: v.editorId, name: v.editorId === null ? null : (names.get(v.editorId) ?? null) },
      createdAt: v.createdAt,
      snapshot: v.snapshot,
    }));
  }
}

/** FR-CONTENT-09 */
export class RevertContent {
  constructor(private readonly d: ContentDeps) {}

  async execute(id: string, versionNo: number, actor: ActorContext): Promise<ContentView> {
    const content = await loadContent(this.d, id);
    Policy.assertCanEdit(actor, content);
    const version = await this.d.versions.find(id, versionNo);
    if (!version) throw new NotFoundError('Version', String(versionNo));
    const slug = Slug.create(version.snapshot.slug);
    if (slug.value !== content.slug.value) await assertSlugAvailable(this.d, content.type, slug, content.id);
    content.revertTo(version.snapshot, versionNo, this.d.clock.now(), actor);
    await persist(this.d, content, actor, { snapshot: true });
    return toView(this.d, content);
  }
}

/** Dashboard counts (03-DESIGN §12.2). Authors see their own numbers. */
export class GetContentStats {
  constructor(private readonly d: ContentDeps) {}

  async execute(actor: ActorContext): Promise<ContentStats> {
    const counts = await this.d.contents.countByStatus(Policy.listScope(actor, undefined));
    const total = counts.draft + counts.in_review + counts.published + counts.unpublished + counts.archived;
    return { ...counts, total };
  }
}

/** Background jobs driven by the worker (ScheduledPublishJob, PurgeJob). */
export class ContentJobsImpl implements ContentJobs {
  constructor(private readonly d: ContentDeps) {}

  async publishDue(actor: AnyActor): Promise<number> {
    const now = this.d.clock.now();
    const due = await this.d.contents.findDueForPublish(now, 100);
    let published = 0;
    for (const content of due) {
      if (!content.isDueForPublish(now)) continue;
      content.publish(now, actor);
      await persist(this.d, content, actor, { snapshot: false });
      published++;
    }
    return published;
  }

  async purgeDeleted(actor: AnyActor): Promise<number> {
    const now = this.d.clock.now();
    const cutoff = new Date(now.getTime() - this.d.settings.softDeleteRetentionDays * 86_400_000);
    const expired = await this.d.contents.findDeletedBefore(cutoff, 500);
    for (const content of expired) {
      await this.d.tx.run(async () => {
        await this.d.versions.deleteAll(content.id);
        await this.d.contents.hardDelete(content.id);
      });
      await this.d.events.publishAll([
        {
          type: 'content.purge',
          occurredAt: now,
          actorId: actor.userId,
          actorIp: actor.ip,
          target: { type: 'content', id: content.id },
          summary: { contentType: content.type },
        },
      ]);
    }
    return expired.length;
  }
}

/** Exposed to the media module through the composition root (FR-MEDIA-07). */
export class ContentMediaUsage implements ContentMediaUsageQuery {
  constructor(private readonly d: Pick<ContentDeps, 'contents'>) {}

  isMediaReferenced(mediaId: string): Promise<boolean> {
    return this.d.contents.isMediaReferenced(mediaId);
  }
}

function toProjection(c: Content): PublishedContentProjection {
  const p = c.toProps();
  return {
    id: p.id,
    type: p.type,
    status: p.status,
    title: p.title,
    slug: p.slug.value,
    body: p.body.doc,
    authorId: p.authorId,
    featuredImageId: p.featuredImageId,
    socialImageId: p.socialImageId,
    seo: c.effectiveSeo(),
    tags: p.tags,
    category: p.category,
    parentId: p.parentId,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    deletedAt: p.deletedAt,
  };
}

/** Read side for the public API; visibility is filtered by the repository. */
export class PublishedContentQueryImpl implements PublishedContentQuery {
  constructor(private readonly d: Pick<ContentDeps, 'contents'>) {}

  async list(
    type: ContentType,
    filter: { tag?: string; category?: string },
    page: { page: number; pageSize: number },
    now: Date,
  ): Promise<PagedResult<PublishedContentProjection>> {
    return mapPaged(await this.d.contents.findPublished(type, filter, page, now), toProjection);
  }

  async bySlug(type: ContentType, slug: string, now: Date): Promise<PublishedContentProjection | null> {
    const c = await this.d.contents.findPublishedBySlug(type, slug, now);
    return c ? toProjection(c) : null;
  }
}
