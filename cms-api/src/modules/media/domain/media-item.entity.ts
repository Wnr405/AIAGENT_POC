import type { AnyActor } from '../../../shared/kernel/actor';
import { AggregateRoot } from '../../../shared/kernel/domain-event';
import { NotFoundError, ValidationError } from '../../../shared/kernel/errors';
import type { FileKind } from './file-type-policy';

export interface MediaVariant {
  readonly key: string;
  readonly width: number;
  readonly height: number;
}
export type MediaVariants = Partial<Record<'thumbnail' | 'medium', MediaVariant>>;

/** FR-MEDIA-05 */
export const VARIANT_SIZES = { thumbnail: 320, medium: 1024 } as const;

export interface MediaItemProps {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  kind: FileKind;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  variants: MediaVariants;
  uploadedBy: string;
  createdAt: Date;
  deletedAt: Date | null;
}

const ALT_MAX = 500;
const CAPTION_MAX = 1000;

function clean(v: string | null | undefined, max: number, field: string): string | null {
  const t = v?.trim() || null;
  if (t !== null && t.length > max) throw new ValidationError(`${field} must be at most ${max} characters`, { field });
  return t;
}

export class MediaItem extends AggregateRoot {
  private constructor(private props: MediaItemProps) {
    super();
  }

  static register(
    input: Omit<MediaItemProps, 'variants' | 'deletedAt' | 'altText' | 'caption'> & {
      altText?: string | null;
      caption?: string | null;
    },
    actor: AnyActor,
  ): MediaItem {
    const item = new MediaItem({
      ...input,
      altText: clean(input.altText, ALT_MAX, 'altText'),
      caption: clean(input.caption, CAPTION_MAX, 'caption'),
      variants: {},
      deletedAt: null,
    });
    item.emit('media.upload', input.createdAt, actor, {
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });
    return item;
  }

  static rehydrate(props: MediaItemProps): MediaItem {
    return new MediaItem({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get kind(): FileKind {
    return this.props.kind;
  }
  get storageKey(): string {
    return this.props.storageKey;
  }
  get uploadedBy(): string {
    return this.props.uploadedBy;
  }
  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /** Raster images get resized variants; SVG scales natively, PDFs are not images. */
  needsVariants(): boolean {
    return ['png', 'jpeg', 'webp', 'gif'].includes(this.props.kind);
  }

  updateMetadata(patch: { altText?: string | null; caption?: string | null }, now: Date, actor: AnyActor): void {
    if (this.isDeleted) throw new NotFoundError('Media', this.id);
    if (patch.altText !== undefined) this.props.altText = clean(patch.altText, ALT_MAX, 'altText');
    if (patch.caption !== undefined) this.props.caption = clean(patch.caption, CAPTION_MAX, 'caption');
    this.emit('media.update', now, actor, { fields: Object.keys(patch) });
  }

  attachVariants(dimensions: { width: number; height: number }, variants: MediaVariants): void {
    this.props.width = dimensions.width;
    this.props.height = dimensions.height;
    this.props.variants = { ...variants };
  }

  softDelete(now: Date, actor: AnyActor, forced: boolean): void {
    if (this.isDeleted) throw new NotFoundError('Media', this.id);
    this.props.deletedAt = now;
    this.emit('media.delete', now, actor, { filename: this.props.filename, forced });
  }

  /** Every storage key owned by this item (original + variants). */
  allKeys(): string[] {
    return [this.props.storageKey, ...Object.values(this.props.variants).map((v) => v.key)];
  }

  toProps(): Readonly<MediaItemProps> {
    return { ...this.props, variants: { ...this.props.variants } };
  }

  private emit(type: string, now: Date, actor: AnyActor, summary: Record<string, unknown>): void {
    this.raise({
      type,
      occurredAt: now,
      actorId: actor.userId,
      actorIp: actor.ip,
      target: { type: 'media', id: this.props.id },
      summary,
    });
  }
}
