import type { PageRequest, PagedResult } from '../../../../../shared/kernel/paged-result';
import type { MediaItem } from '../../../domain/media-item.entity';

export interface MediaSearchCriteria {
  readonly search?: string; // filename or alt text, case-insensitive partial
  readonly uploadedBy?: string;
  readonly kind?: 'image' | 'document';
  readonly from?: Date;
  readonly to?: Date;
}

export interface MediaRepository {
  save(item: MediaItem): Promise<void>;
  findById(id: string): Promise<MediaItem | null>;
  findByStorageKey(key: string): Promise<MediaItem | null>;
  findMany(criteria: MediaSearchCriteria, page: PageRequest): Promise<PagedResult<MediaItem>>;
  existingIds(ids: readonly string[]): Promise<Set<string>>;
  findDeletedBefore(cutoff: Date, limit: number): Promise<MediaItem[]>;
  hardDelete(id: string): Promise<void>;
}

export interface PresignedUpload {
  readonly url: string;
  readonly method: 'PUT';
  readonly headers: Record<string, string>;
  readonly expiresInSeconds: number;
}

/** S3-compatible object storage (NFR-PORT-02). */
export interface ObjectStorage {
  presignPut(key: string, contentType: string, sizeBytes: number, ttlSeconds: number): Promise<PresignedUpload>;
  head(key: string): Promise<{ sizeBytes: number; contentType: string | null } | null>;
  readRange(key: string, bytes: number): Promise<Uint8Array>;
  read(key: string): Promise<Uint8Array>;
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  delete(keys: readonly string[]): Promise<void>;
  /** Public/CDN or signed URL for delivery (SEC-06). */
  urlFor(key: string): Promise<string>;
}

export interface ImageProcessor {
  probe(data: Uint8Array): Promise<{ width: number; height: number }>;
  /** Fit inside maxWidth×maxWidth, never upscale; output WebP. */
  resize(data: Uint8Array, maxWidth: number): Promise<{ data: Uint8Array; width: number; height: number }>;
}

/** Implemented by the content module's ContentMediaUsage (wired in composition). */
export interface MediaUsageChecker {
  isReferenced(mediaId: string): Promise<boolean>;
}

export interface MediaSettings {
  readonly maxUploadBytes: number; // FR-MEDIA-02, default 20 MB
  readonly presignTtlSeconds: number;
  readonly variantsEnabled: boolean;
  readonly softDeleteRetentionDays: number;
}
