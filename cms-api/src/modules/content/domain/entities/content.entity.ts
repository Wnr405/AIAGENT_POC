import type { AnyActor } from '../../../../shared/kernel/actor';
import { AggregateRoot } from '../../../../shared/kernel/domain-event';
import { ConflictError, NotFoundError, ValidationError } from '../../../../shared/kernel/errors';
import { InvalidTransitionError, PublishRequirementsError } from '../errors';
import { nextStatus, SCHEDULABLE, type LifecycleAction } from '../services/content-lifecycle';
import { unmetPublishRequirements } from '../services/publish-requirements';
import type { ContentStatus } from '../value-objects/content-status';
import type { ContentType } from '../value-objects/content-type';
import { RichTextBody, type RtNode } from '../value-objects/rich-text-body.vo';
import { defaultDescription, SeoMetadata } from '../value-objects/seo-metadata.vo';
import { Slug } from '../value-objects/slug.vo';
import { normalizeTags } from '../value-objects/tag.vo';

export const TITLE_MAX = 200;
export const CATEGORY_MAX = 60;

export interface ContentProps {
  id: string;
  type: ContentType;
  title: string;
  slug: Slug;
  body: RichTextBody;
  status: ContentStatus;
  authorId: string;
  featuredImageId: string | null;
  socialImageId: string | null;
  seo: SeoMetadata;
  tags: string[];
  category: string | null;
  parentId: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Editable fields. `undefined` = leave unchanged, `null` = clear. */
export interface ContentPatch {
  title?: string;
  slug?: Slug;
  body?: RichTextBody;
  seo?: SeoMetadata;
  tags?: string[];
  category?: string | null;
  parentId?: string | null;
  featuredImageId?: string | null;
  socialImageId?: string | null;
}

/** Full editable state stored in ContentVersion.snapshot (FR-CONTENT-08). */
export interface ContentSnapshot {
  title: string;
  slug: string;
  body: RtNode;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  category: string | null;
  parentId: string | null;
  featuredImageId: string | null;
  socialImageId: string | null;
  status: ContentStatus;
}

function validTitle(title: string): string {
  const t = title.trim();
  if (t.length === 0 || t.length > TITLE_MAX) {
    throw new ValidationError(`Title is required and must be at most ${TITLE_MAX} characters`, {
      field: 'title',
    });
  }
  return t;
}

/**
 * Content aggregate (Article | Page). Owns every lifecycle invariant;
 * authorization lives in the application policy.
 */
export class Content extends AggregateRoot {
  private constructor(private props: ContentProps) {
    super();
  }

  static create(
    input: { id: string; type: ContentType; title: string; slug: Slug; authorId: string; now: Date } & ContentPatch,
    actor: AnyActor,
  ): Content {
    const content = new Content({
      id: input.id,
      type: input.type,
      title: validTitle(input.title),
      slug: input.slug,
      body: RichTextBody.empty(),
      status: 'draft',
      authorId: input.authorId,
      featuredImageId: null,
      socialImageId: null,
      seo: SeoMetadata.empty(),
      tags: [],
      category: null,
      parentId: null,
      scheduledAt: null,
      publishedAt: null,
      deletedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    content.applyPatch(input);
    content.emit('content.create', input.now, actor, { type: input.type, slug: input.slug.value });
    return content;
  }

  static rehydrate(props: ContentProps): Content {
    return new Content({ ...props, tags: [...props.tags] });
  }

  // ── getters ────────────────────────────────────────────────────────────
  get id(): string {
    return this.props.id;
  }
  get type(): ContentType {
    return this.props.type;
  }
  get title(): string {
    return this.props.title;
  }
  get slug(): Slug {
    return this.props.slug;
  }
  get body(): RichTextBody {
    return this.props.body;
  }
  get status(): ContentStatus {
    return this.props.status;
  }
  get authorId(): string {
    return this.props.authorId;
  }
  get scheduledAt(): Date | null {
    return this.props.scheduledAt;
  }
  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /** FR-SEO-02: effective SEO with defaults applied. */
  effectiveSeo(): { title: string; description: string } {
    return {
      title: this.props.seo.title ?? this.props.title.slice(0, 70),
      description: this.props.seo.description ?? defaultDescription(this.props.body.plainText()),
    };
  }

  /** Media this item references (featured, social, inline). */
  referencedMediaIds(): string[] {
    const ids = new Set(this.props.body.referencedMediaIds());
    if (this.props.featuredImageId) ids.add(this.props.featuredImageId);
    if (this.props.socialImageId) ids.add(this.props.socialImageId);
    return [...ids];
  }

  // ── editing ────────────────────────────────────────────────────────────
  private applyPatch(patch: ContentPatch): string[] {
    const changed: string[] = [];
    const set = <K extends keyof ContentProps>(key: K, value: ContentProps[K]): void => {
      this.props[key] = value;
      changed.push(key);
    };
    if (patch.title !== undefined) set('title', validTitle(patch.title));
    if (patch.slug !== undefined) set('slug', patch.slug);
    if (patch.body !== undefined) set('body', patch.body);
    if (patch.seo !== undefined) set('seo', patch.seo);
    if (patch.featuredImageId !== undefined) set('featuredImageId', patch.featuredImageId);
    if (patch.socialImageId !== undefined) set('socialImageId', patch.socialImageId);
    if (patch.tags !== undefined) set('tags', this.validTags(patch.tags));
    if (patch.category !== undefined) set('category', this.validCategory(patch.category));
    if (patch.parentId !== undefined) set('parentId', this.validParentId(patch.parentId));
    return changed;
  }

  private validTags(tags: readonly string[]): string[] {
    if (this.props.type !== 'article' && tags.length > 0) {
      throw new ValidationError('Only articles can have tags', { field: 'tags' });
    }
    return normalizeTags(tags);
  }

  private validCategory(raw: string | null): string | null {
    const category = raw?.trim() || null;
    if (category === null) return null;
    if (this.props.type !== 'article') {
      throw new ValidationError('Only articles can have a category', { field: 'category' });
    }
    if (category.length > CATEGORY_MAX) {
      throw new ValidationError(`Category must be at most ${CATEGORY_MAX} characters`, { field: 'category' });
    }
    return category;
  }

  private validParentId(parentId: string | null): string | null {
    if (parentId !== null && this.props.type !== 'page') {
      throw new ValidationError('Only pages can have a parent page', { field: 'parentId' });
    }
    if (parentId === this.props.id) {
      throw new ValidationError('A page cannot be its own parent', { field: 'parentId' });
    }
    return parentId;
  }

  private assertEditable(): void {
    if (this.isDeleted) throw new NotFoundError('Content', this.id);
    if (this.props.status === 'archived') throw new InvalidTransitionError('archived', 'edit');
  }

  /** Edits content. Editing an Unpublished item moves it back to Draft (§5.4.1 "edit"). */
  update(patch: ContentPatch, now: Date, actor: AnyActor): void {
    this.assertEditable();
    const changed = this.applyPatch(patch);
    if (changed.length === 0) return;
    this.props.updatedAt = now;
    this.emit('content.update', now, actor, { fields: changed });
    if (this.props.status === 'unpublished') this.transition('edit_back_to_draft', now, actor);
  }

  /** FR-CONTENT-09: revert creates a new state from an old snapshot; status is kept. */
  revertTo(snapshot: ContentSnapshot, versionNo: number, now: Date, actor: AnyActor): void {
    this.assertEditable();
    this.applyPatch({
      title: snapshot.title,
      slug: Slug.create(snapshot.slug),
      body: RichTextBody.fromTrusted(snapshot.body),
      seo: SeoMetadata.create({ title: snapshot.seoTitle, description: snapshot.seoDescription }),
      tags: snapshot.tags,
      category: snapshot.category,
      parentId: snapshot.parentId,
      featuredImageId: snapshot.featuredImageId,
      socialImageId: snapshot.socialImageId,
    });
    this.props.updatedAt = now;
    this.emit('content.revert', now, actor, { toVersion: versionNo });
  }

  // ── lifecycle ──────────────────────────────────────────────────────────
  private transition(action: LifecycleAction, now: Date, actor: AnyActor): void {
    if (this.isDeleted) throw new NotFoundError('Content', this.id);
    const from = this.props.status;
    const to = nextStatus(from, action);
    if (to === null) throw new InvalidTransitionError(from, action.replace(/_/g, ' '));
    this.props.status = to;
    this.props.updatedAt = now;
    const type = action === 'edit_back_to_draft' ? 'content.state_change' : `content.${action}`;
    this.emit(type, now, actor, { from, to });
  }

  private assertPublishable(): void {
    const missing = unmetPublishRequirements({
      title: this.props.title,
      body: this.props.body,
      effectiveDescription: this.effectiveSeo().description,
    });
    if (missing.length > 0) throw new PublishRequirementsError(missing);
  }

  submitForReview(now: Date, actor: AnyActor): void {
    this.transition('submit', now, actor);
  }

  reject(now: Date, actor: AnyActor): void {
    this.transition('reject', now, actor);
  }

  publish(now: Date, actor: AnyActor): void {
    if (nextStatus(this.props.status, 'publish') !== null) this.assertPublishable();
    this.transition('publish', now, actor);
    this.props.publishedAt ??= now; // "set on first publish" (§6.2)
    this.props.scheduledAt = null;
  }

  unpublish(now: Date, actor: AnyActor): void {
    this.transition('unpublish', now, actor);
  }

  archive(now: Date, actor: AnyActor): void {
    this.transition('archive', now, actor);
  }

  /** FR-CONTENT-07 */
  schedule(at: Date, now: Date, actor: AnyActor): void {
    if (this.isDeleted) throw new NotFoundError('Content', this.id);
    if (!SCHEDULABLE.includes(this.props.status)) {
      throw new InvalidTransitionError(this.props.status, 'schedule');
    }
    if (at.getTime() <= now.getTime()) {
      throw new ValidationError('Scheduled time must be in the future', { field: 'scheduledAt' });
    }
    this.assertPublishable();
    this.props.scheduledAt = at;
    this.props.updatedAt = now;
    this.emit('content.schedule', now, actor, { scheduledAt: at.toISOString() });
  }

  unschedule(now: Date, actor: AnyActor): void {
    if (this.props.scheduledAt === null) throw new ConflictError('Content is not scheduled');
    this.props.scheduledAt = null;
    this.props.updatedAt = now;
    this.emit('content.unschedule', now, actor, {});
  }

  isDueForPublish(now: Date): boolean {
    return (
      !this.isDeleted &&
      this.props.scheduledAt !== null &&
      this.props.scheduledAt.getTime() <= now.getTime() &&
      SCHEDULABLE.includes(this.props.status)
    );
  }

  /** FR-CONTENT-13: soft delete. */
  softDelete(now: Date, actor: AnyActor): void {
    if (this.isDeleted) throw new NotFoundError('Content', this.id);
    this.props.deletedAt = now;
    this.props.scheduledAt = null;
    this.props.updatedAt = now;
    this.emit('content.delete', now, actor, { status: this.props.status });
  }

  // ── serialisation ──────────────────────────────────────────────────────
  toSnapshot(): ContentSnapshot {
    const p = this.props;
    return {
      title: p.title,
      slug: p.slug.value,
      body: p.body.doc,
      seoTitle: p.seo.title,
      seoDescription: p.seo.description,
      tags: [...p.tags],
      category: p.category,
      parentId: p.parentId,
      featuredImageId: p.featuredImageId,
      socialImageId: p.socialImageId,
      status: p.status,
    };
  }

  toProps(): Readonly<ContentProps> {
    return { ...this.props, tags: [...this.props.tags] };
  }

  private emit(type: string, now: Date, actor: AnyActor, summary: Record<string, unknown>): void {
    this.raise({
      type,
      occurredAt: now,
      actorId: actor.userId,
      actorIp: actor.ip,
      target: { type: 'content', id: this.props.id },
      summary: { contentType: this.props.type, ...summary },
    });
  }
}
