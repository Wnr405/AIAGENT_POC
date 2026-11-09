import sharp from 'sharp';
import type { ImageProcessor } from '../../../application/ports/out/media-ports';

/** FR-MEDIA-05 responsive variants, encoded as WebP. Never upscales. */
export class SharpImageProcessor implements ImageProcessor {
  async probe(data: Uint8Array): Promise<{ width: number; height: number }> {
    const meta = await sharp(data, { failOn: 'error' }).metadata();
    return { width: meta.width ?? 0, height: meta.height ?? 0 };
  }

  async resize(data: Uint8Array, maxWidth: number): Promise<{ data: Uint8Array; width: number; height: number }> {
    const { data: out, info } = await sharp(data, { failOn: 'error' })
      .rotate() // honour EXIF orientation, then strip metadata
      .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(out), width: info.width, height: info.height };
  }
}
