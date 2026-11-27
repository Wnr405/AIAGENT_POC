import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SharpImageProcessor } from '../../src/modules/media/adapters/out/image/sharp-image-processor';

/**
 * Outbound image adapter against the real libvips bundled with sharp (06-TEST-STRATEGY §7.5).
 * No container needed: sharp runs in-process on in-memory buffers.
 */
const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#3366ff' } })
    .png()
    .toBuffer();
const isWebp = (b: Uint8Array) =>
  Buffer.from(b.subarray(0, 4)).toString('ascii') === 'RIFF' &&
  Buffer.from(b.subarray(8, 12)).toString('ascii') === 'WEBP';

describe('SharpImageProcessor (integration)', () => {
  const images = new SharpImageProcessor();

  it('FR-MEDIA-05: probes the pixel size of an image', async () => {
    await expect(images.probe(await png(640, 480))).resolves.toEqual({ width: 640, height: 480 });
  });

  it('FR-MEDIA-05: resizes to fit inside the max width, keeps the aspect ratio and encodes WebP', async () => {
    const out = await images.resize(await png(2000, 1000), 320);
    expect(out).toMatchObject({ width: 320, height: 160 });
    expect(isWebp(out.data)).toBe(true);
    await expect(sharp(out.data).metadata()).resolves.toMatchObject({ format: 'webp', width: 320, height: 160 });
  });

  it('FR-MEDIA-05: never upscales a smaller image', async () => {
    await expect(images.resize(await png(100, 50), 1024)).resolves.toMatchObject({ width: 100, height: 50 });
  });

  it('FR-MEDIA-05: honours EXIF orientation, then strips the metadata', async () => {
    const rotated = await sharp(await png(200, 100))
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await images.resize(rotated, 1024);
    expect(out).toMatchObject({ width: 100, height: 200 });
    const meta = await sharp(out.data).metadata();
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  it('FR-MEDIA-05: rejects data that is not a decodable image', async () => {
    const garbage = new Uint8Array(Buffer.from('definitely not an image'));
    await expect(images.probe(garbage)).rejects.toThrow();
    await expect(images.resize(garbage, 320)).rejects.toThrow();
  });
});
