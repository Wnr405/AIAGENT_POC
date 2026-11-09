import { ValidationError } from '../../../shared/kernel/errors';

/**
 * FR-MEDIA-01/03: allow-list of upload types. A file is accepted only when
 * declared MIME type, filename extension and detected magic bytes all agree.
 * CRITICAL PATH.
 */
export type FileKind = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg' | 'pdf';

export const FILE_KINDS: Record<FileKind, { mime: string; extensions: readonly string[]; image: boolean }> = {
  png: { mime: 'image/png', extensions: ['png'], image: true },
  jpeg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], image: true },
  webp: { mime: 'image/webp', extensions: ['webp'], image: true },
  gif: { mime: 'image/gif', extensions: ['gif'], image: true },
  svg: { mime: 'image/svg+xml', extensions: ['svg'], image: true },
  pdf: { mime: 'application/pdf', extensions: ['pdf'], image: false },
};

/** Bytes needed by `detectKind` (SVG sniffing looks further than binary signatures). */
export const MAGIC_SNIFF_BYTES = 1024;

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

/** Kind implied by the declared MIME + filename; throws if not on the allow-list or inconsistent. */
export function declaredKind(filename: string, mimeType: string): FileKind {
  const ext = extensionOf(filename);
  const mime = mimeType.toLowerCase().replace(/;.*$/s, '').trim(); // drop parameters such as '; charset=utf-8'
  const kind = (Object.keys(FILE_KINDS) as FileKind[]).find((k) => FILE_KINDS[k].mime === mime);
  if (!kind) {
    throw new ValidationError('Unsupported file type', { field: 'mimeType', allowed: allowedMimeTypes() });
  }
  if (!FILE_KINDS[kind].extensions.includes(ext)) {
    throw new ValidationError('File extension does not match its type', { field: 'filename' });
  }
  return kind;
}

const startsWith = (b: Uint8Array, sig: readonly number[], offset = 0): boolean =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);

/** Detects the real kind from leading bytes; null if unknown. */
export function detectKind(bytes: Uint8Array): FileKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  )
    return 'gif';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, MAGIC_SNIFF_BYTES))
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .trimStart();
  return /^<svg[\s>]/i.test(head) ? 'svg' : null;
}

export function assertMagicMatches(declared: FileKind, bytes: Uint8Array): void {
  if (detectKind(bytes) !== declared) {
    throw new ValidationError('File content does not match its declared type', { field: 'file' });
  }
}

export function allowedMimeTypes(): string[] {
  return Object.values(FILE_KINDS).map((k) => k.mime);
}

export function assertSize(sizeBytes: number, maxBytes: number): void {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new ValidationError('File is empty', { field: 'size' });
  }
  if (sizeBytes > maxBytes) {
    throw new ValidationError(`File exceeds the ${Math.round(maxBytes / 1048576)} MB limit`, {
      field: 'size',
      maxBytes,
    });
  }
}
