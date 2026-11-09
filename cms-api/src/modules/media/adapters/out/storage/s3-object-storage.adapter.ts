import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage, PresignedUpload } from '../../../application/ports/out/media-ports';

export interface S3Config {
  readonly endpoint?: string; // internal endpoint, e.g. http://minio:9000
  readonly presignEndpoint?: string; // browser-reachable endpoint for presigned PUTs
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly publicUrl?: string; // CDN / public base URL; when absent, signed GET URLs are issued
  readonly forcePathStyle: boolean;
}

/** NFR-PORT-02: S3 API only, so AWS S3, MinIO and compatible stores all work. */
export class S3ObjectStorageAdapter implements ObjectStorage {
  private readonly client: S3Client;
  private readonly presigner: S3Client;

  constructor(private readonly cfg: S3Config) {
    const base = {
      region: cfg.region,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      forcePathStyle: cfg.forcePathStyle,
    };
    this.client = new S3Client({ ...base, endpoint: cfg.endpoint });
    this.presigner = new S3Client({ ...base, endpoint: cfg.presignEndpoint ?? cfg.endpoint });
  }

  async presignPut(key: string, contentType: string, sizeBytes: number, ttlSeconds: number): Promise<PresignedUpload> {
    const url = await getSignedUrl(
      this.presigner,
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes }),
      { expiresIn: ttlSeconds },
    );
    return { url, method: 'PUT', headers: { 'Content-Type': contentType }, expiresInSeconds: ttlSeconds };
  }

  async head(key: string): Promise<{ sizeBytes: number; contentType: string | null } | null> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return { sizeBytes: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
    } catch (err) {
      if ((err as { name?: string }).name === 'NotFound') return null;
      throw err;
    }
  }

  async readRange(key: string, bytes: number): Promise<Uint8Array> {
    const r = await this.client.send(
      new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }),
    );
    return r.Body ? await r.Body.transformToByteArray() : new Uint8Array();
  }

  async read(key: string): Promise<Uint8Array> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    return r.Body ? await r.Body.transformToByteArray() : new Uint8Array();
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async delete(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.cfg.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  /** SEC-06: public listing is denied; delivery is via CDN origin or short-lived signed URLs. */
  async urlFor(key: string): Promise<string> {
    if (this.cfg.publicUrl) return `${this.cfg.publicUrl.replace(/\/+$/, '')}/${key}`;
    return getSignedUrl(this.presigner, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), {
      expiresIn: 3600,
    });
  }
}
