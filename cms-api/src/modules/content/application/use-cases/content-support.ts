import type { AnyActor } from '../../../../shared/kernel/actor';
import { NotFoundError, ValidationError } from '../../../../shared/kernel/errors';
import type { Clock } from '../../../../shared/ports/clock.port';
import type { DomainEventPublisher } from '../../../../shared/ports/event-publisher.port';
import type { IdGenerator } from '../../../../shared/ports/id-generator.port';
import type { TransactionRunner } from '../../../../shared/ports/transaction-runner.port';
import { MAX_VERSIONS_PER_CONTENT } from '../../domain/entities/content-version.entity';
import type { Content, ContentPatch } from '../../domain/entities/content.entity';
import { SlugConflictError } from '../../domain/errors';
import { RichTextBody } from '../../domain/value-objects/rich-text-body.vo';
import { SeoMetadata } from '../../domain/value-objects/seo-metadata.vo';
import { Slug } from '../../domain/value-objects/slug.vo';
import type { ContentType } from '../../domain/value-objects/content-type';
import type { ContentFields, ContentSummaryView, ContentView } from '../ports/in/content.ports';
import type {
  ContentRepository,
  ContentSettings,
  ContentVersionRepository,
  MediaLookup,
  UserDirectory,
} from '../ports/out/content-ports';

export interface ContentDeps {
  readonly contents: ContentRepository;
  readonly versions: ContentVersionRepository;
  readonly users: UserDirectory;
  readonly media: MediaLookup;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly events: DomainEventPublisher;
  readonly tx: TransactionRunner;
  readonly settings: ContentSettings;
}

export async function loadContent(d: ContentDeps, id: string): Promise<Content> {
  const content = await d.contents.findById(id);
  if (!content || content.isDeleted) throw new NotFoundError('Content', id);
  return content;
}

/** FR-CONTENT-03 */
export async function assertSlugAvailable(
  d: ContentDeps,
  type: ContentType,
  slug: Slug,
  excludeId?: string,
): Promise<void> {
  const existing = await d.contents.findBySlug(type, slug.value);
  if (existing && existing.id !== excludeId) throw new SlugConflictError(slug.value);
}

/** Picks the first free `slug`, `slug-2`, `slug-3`, … for auto-generated slugs. */
export async function firstFreeSlug(d: ContentDeps, type: ContentType, base: Slug): Promise<Slug> {
  let candidate = base;
  for (let n = 2; await d.contents.findBySlug(type, candidate.value); n++) {
    candidate = base.withSuffix(n);
  }
  return candidate;
}

function assertKnownCategory(d: ContentDeps, category: string | null): void {
  if (category === null || category.trim() === '') return;
  if (!d.settings.categories.includes(category.trim())) {
    throw new ValidationError('Unknown category', { field: 'category', allowed: d.settings.categories });
  }
}

async function assertValidParent(d: ContentDeps, parentId: string | null, selfId?: string): Promise<void> {
  if (parentId === null || parentId === selfId) return; // self-parenting is rejected by the entity
  const parent = await d.contents.findById(parentId);
  if (!parent || parent.isDeleted || parent.type !== 'page') {
    throw new ValidationError('Parent page not found', { field: 'parentId' });
  }
  if (parent.toProps().parentId !== null) {
    throw new ValidationError('Only one level of page nesting is supported', { field: 'parentId' });
  }
}

async function assertMediaExists(d: ContentDeps, patch: ContentPatch): Promise<void> {
  const mediaIds = [patch.featuredImageId, patch.socialImageId].filter((x): x is string => typeof x === 'string');
  if (mediaIds.length === 0) return;
  const existing = await d.media.existingIds(mediaIds);
  const missing = mediaIds.find((id) => !existing.has(id));
  if (missing) throw new ValidationError('Referenced media not found', { field: 'media', id: missing });
}

function seoPatch(f: ContentFields): SeoMetadata | undefined {
  if (f.seoTitle === undefined && f.seoDescription === undefined) return undefined;
  return SeoMetadata.create({ title: f.seoTitle, description: f.seoDescription });
}

/** Field-by-field conversion of plain values (no I/O). */
function plainPatch(f: ContentFields): ContentPatch {
  const patch: ContentPatch = {};
  if (f.title !== undefined) patch.title = f.title;
  if (f.slug !== undefined) patch.slug = Slug.create(f.slug);
  if (f.body !== undefined) patch.body = RichTextBody.fromUntrusted(f.body);
  const seo = seoPatch(f);
  if (seo) patch.seo = seo;
  if (f.tags !== undefined) patch.tags = f.tags;
  if (f.category !== undefined) patch.category = f.category;
  if (f.parentId !== undefined) patch.parentId = f.parentId;
  if (f.featuredImageId !== undefined) patch.featuredImageId = f.featuredImageId;
  if (f.socialImageId !== undefined) patch.socialImageId = f.socialImageId;
  return patch;
}

/**
 * Converts untrusted request fields to a domain patch, validating references
 * (category list, parent page, media ids). Slug uniqueness is checked by callers.
 */
export async function toPatch(d: ContentDeps, f: ContentFields, selfId?: string): Promise<ContentPatch> {
  const patch = plainPatch(f);
  if (f.category !== undefined) assertKnownCategory(d, f.category);
  if (f.parentId !== undefined) await assertValidParent(d, f.parentId, selfId);
  await assertMediaExists(d, patch);
  return patch;
}

/** Saves the aggregate, snapshots a version (FR-CONTENT-08) and publishes events after commit. */
export async function persist(
  d: ContentDeps,
  content: Content,
  actor: AnyActor,
  options: { snapshot: boolean },
): Promise<void> {
  await d.tx.run(async () => {
    await d.contents.save(content);
    if (options.snapshot) {
      const versionNo = (await d.versions.latestVersionNo(content.id)) + 1;
      await d.versions.append({
        id: d.ids.next(),
        contentId: content.id,
        versionNo,
        snapshot: content.toSnapshot(),
        editorId: actor.userId,
        createdAt: d.clock.now(),
      });
      await d.versions.prune(content.id, MAX_VERSIONS_PER_CONTENT);
    }
  });
  await d.events.publishAll(content.pullDomainEvents());
}

export function toSummaryView(c: Content, names: Map<string, string>): ContentSummaryView {
  const p = c.toProps();
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    slug: p.slug.value,
    status: p.status,
    author: { id: p.authorId, name: names.get(p.authorId) ?? null },
    featuredImageId: p.featuredImageId,
    socialImageId: p.socialImageId,
    seo: { title: p.seo.title, description: p.seo.description },
    effectiveSeo: c.effectiveSeo(),
    tags: p.tags,
    category: p.category,
    parentId: p.parentId,
    scheduledAt: p.scheduledAt,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function toView(d: ContentDeps, c: Content): Promise<ContentView> {
  const names = await d.users.namesByIds([c.authorId]);
  return { ...toSummaryView(c, names), body: c.body.doc };
}
