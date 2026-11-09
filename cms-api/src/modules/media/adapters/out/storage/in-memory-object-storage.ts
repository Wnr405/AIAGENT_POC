import type { ObjectStorage, PresignedUpload } from '../../../application/ports/out/media-ports';

/**
 * Object storage held in memory. In `PERSISTENCE=memory` mode the API itself
 * accepts the PUT at /api/dev/storage/:key (dev only) so the upload flow works
 * end-to-end without MinIO.
 */
export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { data: Uint8Array; contentType: string }>();

  constructor(private readonly baseUrl: string) {}

  presignPut(key: string, contentType: string, _size: number, ttlSeconds: number): Promise<PresignedUpload> {
    return Promise.resolve({
      url: `${this.baseUrl}/api/dev/storage/${encodeURIComponent(key)}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresInSeconds: ttlSeconds,
    });
  }

  head(key: string): Promise<{ sizeBytes: number; contentType: string | null } | null> {
    const o = this.objects.get(key);
    return Promise.resolve(o ? { sizeBytes: o.data.byteLength, contentType: o.contentType } : null);
  }

  readRange(key: string, bytes: number): Promise<Uint8Array> {
    return Promise.resolve((this.objects.get(key)?.data ?? new Uint8Array()).subarray(0, bytes));
  }

  read(key: string): Promise<Uint8Array> {
    return Promise.resolve(this.objects.get(key)?.data ?? new Uint8Array());
  }

  put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { data, contentType });
    return Promise.resolve();
  }

  delete(keys: readonly string[]): Promise<void> {
    for (const k of keys) this.objects.delete(k);
    return Promise.resolve();
  }

  urlFor(key: string): Promise<string> {
    return Promise.resolve(`${this.baseUrl}/api/dev/storage/${encodeURIComponent(key)}`);
  }
}
