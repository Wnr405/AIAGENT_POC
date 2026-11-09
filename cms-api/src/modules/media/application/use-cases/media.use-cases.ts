import { requireCapability, type ActorContext, type AnyActor } from '../../../../shared/kernel/actor';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/kernel/errors';
import { pageRequest, type PagedResult } from '../../../../shared/kernel/paged-result';
import { can } from '../../../../shared/kernel/permissions';
import type { Clock } from '../../../../shared/ports/clock.port';
import type { DomainEventPublisher } from '../../../../shared/ports/event-publisher.port';
import type { IdGenerator } from '../../../../shared/ports/id-generator.port';
import type { JobScheduler } from '../../../../shared/ports/job-scheduler.port';
import {
  assertMagicMatches,
  assertSize,
  declaredKind,
  FILE_KINDS,
  MAGIC_SNIFF_BYTES,
} from '../../domain/file-type-policy';
import { MediaItem, VARIANT_SIZES, type MediaVariants } from '../../domain/media-item.entity';
import { assertSafeSvg } from '../../domain/svg-safety';
import type {
  FinalizeMediaCommand,
  MediaView,
  PresignUploadCommand,
  PresignUploadResult,
} from '../ports/in/media.ports';
import type {
  ImageProcessor,
  MediaRepository,
  MediaSearchCriteria,
  MediaSettings,
  MediaUsageChecker,
  ObjectStorage,
} from '../ports/out/media-ports';

export const GENERATE_VARIANTS_JOB = 'media.generate-variants';

export interface MediaDeps {
  readonly media: MediaRepository;
  readonly storage: ObjectStorage;
  readonly images: ImageProcessor;
  readonly usage: MediaUsageChecker;
  readonly jobs: JobScheduler;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly events: DomainEventPublisher;
  readonly settings: MediaSettings;
}

/** Keys are namespaced per uploader so nobody can finalize someone else's upload. */
const keyPrefixFor = (userId: string): string => `uploads/${userId}/`;

async function load(d: MediaDeps, id: string): Promise<MediaItem> {
  const item = await d.media.findById(id);
  if (!item || item.isDeleted) throw new NotFoundError('Media', id);
  return item;
}

export async function toMediaView(d: Pick<MediaDeps, 'storage'>, item: MediaItem): Promise<MediaView> {
  const p = item.toProps();
  const variants: MediaView['variants'] = {};
  for (const [name, v] of Object.entries(p.variants) as [
    keyof MediaVariants,
    NonNullable<MediaVariants['thumbnail']>,
  ][]) {
    variants[name] = { url: await d.storage.urlFor(v.key), width: v.width, height: v.height };
  }
  return {
    id: p.id,
    filename: p.filename,
    mimeType: p.mimeType,
    sizeBytes: p.sizeBytes,
    width: p.width,
    height: p.height,
    altText: p.altText,
    caption: p.caption,
    url: await d.storage.urlFor(p.storageKey),
    variants,
    uploadedBy: p.uploadedBy,
    createdAt: p.createdAt,
  };
}

/** FR-MEDIA-04: the browser uploads straight to object storage. */
export class PresignUpload {
  constructor(private readonly d: MediaDeps) {}

  async execute(cmd: PresignUploadCommand, actor: ActorContext): Promise<PresignUploadResult> {
    requireCapability(actor, 'media.upload');
    const kind = declaredKind(cmd.filename, cmd.mimeType);
    assertSize(cmd.sizeBytes, this.d.settings.maxUploadBytes);
    const storageKey = `${keyPrefixFor(actor.userId)}${this.d.ids.next()}.${FILE_KINDS[kind].extensions[0]}`;
    const upload = await this.d.storage.presignPut(
      storageKey,
      FILE_KINDS[kind].mime,
      cmd.sizeBytes,
      this.d.settings.presignTtlSeconds,
    );
    return { storageKey, upload };
  }
}

/** FR-MEDIA-03/05/06, SEC-05. CRITICAL PATH: type + magic-byte validation. */
export class FinalizeMedia {
  constructor(private readonly d: MediaDeps) {}

  async execute(cmd: FinalizeMediaCommand, actor: ActorContext): Promise<MediaView> {
    requireCapability(actor, 'media.upload');
    if (!cmd.storageKey.startsWith(keyPrefixFor(actor.userId)) || cmd.storageKey.includes('..')) {
      throw new ForbiddenError();
    }
    if (await this.d.media.findByStorageKey(cmd.storageKey)) {
      throw new ConflictError('This upload was already finalized');
    }
    const kind = declaredKind(cmd.filename, cmd.mimeType);
    const head = await this.d.storage.head(cmd.storageKey);
    if (!head) throw new ValidationError('Upload not found in storage', { field: 'storageKey' });

    try {
      assertSize(head.sizeBytes, this.d.settings.maxUploadBytes);
      if (kind === 'svg') {
        const bytes = await this.d.storage.read(cmd.storageKey);
        assertMagicMatches(kind, bytes);
        assertSafeSvg(new TextDecoder().decode(bytes));
      } else {
        assertMagicMatches(kind, await this.d.storage.readRange(cmd.storageKey, MAGIC_SNIFF_BYTES));
      }
    } catch (err) {
      await this.d.storage.delete([cmd.storageKey]); // never keep rejected payloads
      throw err;
    }

    const item = MediaItem.register(
      {
        id: this.d.ids.next(),
        storageKey: cmd.storageKey,
        filename: cmd.filename.slice(0, 255),
        mimeType: FILE_KINDS[kind].mime,
        kind,
        sizeBytes: head.sizeBytes,
        width: null,
        height: null,
        altText: cmd.altText,
        caption: cmd.caption,
        uploadedBy: actor.userId,
        createdAt: this.d.clock.now(),
      },
      actor,
    );
    await this.d.media.save(item);
    await this.d.events.publishAll(item.pullDomainEvents());
    if (item.needsVariants() && this.d.settings.variantsEnabled) {
      await this.d.jobs.enqueue(GENERATE_VARIANTS_JOB, { mediaId: item.id });
    }
    return toMediaView(this.d, item);
  }
}

/** Worker job: thumbnail ≤ 320px and medium ≤ 1024px (FR-MEDIA-05). */
export class GenerateVariants {
  constructor(private readonly d: MediaDeps) {}

  async execute(mediaId: string): Promise<void> {
    const item = await this.d.media.findById(mediaId);
    if (!item || item.isDeleted || !item.needsVariants()) return;
    const original = await this.d.storage.read(item.storageKey);
    const dims = await this.d.images.probe(original);
    const variants: MediaVariants = {};
    for (const [name, size] of Object.entries(VARIANT_SIZES) as [keyof MediaVariants, number][]) {
      const out = await this.d.images.resize(original, size);
      const key = `${item.storageKey.replace(/\.[a-z0-9]+$/, '')}_${name}.webp`;
      await this.d.storage.put(key, out.data, 'image/webp');
      variants[name] = { key, width: out.width, height: out.height };
    }
    item.attachVariants(dims, variants);
    await this.d.media.save(item);
  }
}

export class UpdateMediaMetadata {
  constructor(private readonly d: MediaDeps) {}

  async execute(
    id: string,
    patch: { altText?: string | null; caption?: string | null },
    actor: ActorContext,
  ): Promise<MediaView> {
    const item = await load(this.d, id);
    if (item.uploadedBy !== actor.userId && !can(actor.role, 'media.delete_any')) throw new ForbiddenError();
    item.updateMetadata(patch, this.d.clock.now(), actor);
    await this.d.media.save(item);
    await this.d.events.publishAll(item.pullDomainEvents());
    return toMediaView(this.d, item);
  }
}

/** FR-MEDIA-07: refuse while referenced unless an Admin forces it. */
export class DeleteMedia {
  constructor(private readonly d: MediaDeps) {}

  async execute(id: string, opts: { force: boolean }, actor: ActorContext): Promise<void> {
    const item = await load(this.d, id);
    const own = item.uploadedBy === actor.userId;
    if (!(can(actor.role, 'media.delete_any') || (own && can(actor.role, 'media.delete_own')))) {
      throw new ForbiddenError();
    }
    if (opts.force) requireCapability(actor, 'media.force_delete');
    if (!opts.force && (await this.d.usage.isReferenced(id))) {
      throw new ConflictError('Media is used by content and cannot be deleted', { referenced: true });
    }
    item.softDelete(this.d.clock.now(), actor, opts.force);
    await this.d.media.save(item);
    await this.d.events.publishAll(item.pullDomainEvents());
  }
}

/** FR-MEDIA-08 */
export class ListMedia {
  constructor(private readonly d: MediaDeps) {}

  async execute(
    q: MediaSearchCriteria & { page?: number; pageSize?: number },
    actor: ActorContext,
  ): Promise<PagedResult<MediaView>> {
    requireCapability(actor, 'media.upload'); // every role may browse the library
    const page = pageRequest(q.page, q.pageSize);
    const result = await this.d.media.findMany(
      { search: q.search, uploadedBy: q.uploadedBy, kind: q.kind, from: q.from, to: q.to },
      page,
    );
    const items = await Promise.all(result.items.map((i) => toMediaView(this.d, i)));
    return { ...result, items };
  }
}

export class GetMedia {
  constructor(private readonly d: MediaDeps) {}

  async execute(id: string, actor: ActorContext): Promise<MediaView & { referenced: boolean }> {
    requireCapability(actor, 'media.upload');
    const item = await load(this.d, id);
    return { ...(await toMediaView(this.d, item)), referenced: await this.d.usage.isReferenced(id) };
  }
}

/** Hard-deletes soft-deleted media and its stored objects after the retention window. */
export class PurgeDeletedMedia {
  constructor(private readonly d: MediaDeps) {}

  async execute(actor: AnyActor): Promise<number> {
    const now = this.d.clock.now();
    const cutoff = new Date(now.getTime() - this.d.settings.softDeleteRetentionDays * 86_400_000);
    const items = await this.d.media.findDeletedBefore(cutoff, 500);
    for (const item of items) {
      await this.d.storage.delete(item.allKeys());
      await this.d.media.hardDelete(item.id);
      await this.d.events.publishAll([
        {
          type: 'media.purge',
          occurredAt: now,
          actorId: actor.userId,
          actorIp: actor.ip,
          target: { type: 'media', id: item.id },
          summary: {},
        },
      ]);
    }
    return items.length;
  }
}

/** Read side for the public API (FR-PUBAPI /api/v1/media/{id}); wired via the composition root. */
export class MediaPublicQuery {
  constructor(private readonly d: Pick<MediaDeps, 'media' | 'storage'>) {}

  async get(id: string): Promise<{
    id: string;
    url: string;
    alt: string | null;
    width: number | null;
    height: number | null;
    variants: MediaView['variants'];
  } | null> {
    const item = await this.d.media.findById(id);
    if (!item || item.isDeleted) return null;
    const v = await toMediaView(this.d, item);
    return { id: v.id, url: v.url, alt: v.altText, width: v.width, height: v.height, variants: v.variants };
  }

  async existingIds(ids: readonly string[]): Promise<Set<string>> {
    return this.d.media.existingIds(ids);
  }
}
