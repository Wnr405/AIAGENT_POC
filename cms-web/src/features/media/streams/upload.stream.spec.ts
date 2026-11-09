import { lastValueFrom, of, throwError } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../api/media.api';
import { uploadAll$, uploadFile$, type UploadDeps } from './upload.stream';

const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
const item = (id: string) => ({ id, filename: `${id}.png` }) as MediaItem;

function deps(over: Partial<UploadDeps> = {}): UploadDeps {
  return {
    presign: (f) => Promise.resolve({ storageKey: `uploads/u/${f.filename}`, upload: { url: 'https://s3/x', method: 'PUT', headers: {}, expiresInSeconds: 60 } }),
    put: () => of(50, 100),
    finalize: (b) => Promise.resolve(item(b.filename.replace('.png', ''))),
    ...over,
  };
}

describe('upload streams (FR-MEDIA-04)', () => {
  it('presign → progress → finalize', async () => {
    const events = await lastValueFrom(uploadFile$(file('a.png'), deps()).pipe(toArray()));
    expect(events).toEqual([
      { kind: 'progress', file: 'a.png', percent: 50 },
      { kind: 'progress', file: 'a.png', percent: 100 },
      { kind: 'done', file: 'a.png', item: item('a') },
    ]);
  });

  it('reports failures per file without failing the batch', async () => {
    const d = deps({ put: (_t, f) => (f.name === 'bad.png' ? throwError(() => new Error('403')) : of(100)) });
    const events = await lastValueFrom(uploadAll$([file('ok.png'), file('bad.png')], d).pipe(toArray()));
    expect(events.filter((e) => e.kind !== 'progress').map((e) => [e.kind, e.file]).sort()).toEqual([
      ['done', 'ok.png'],
      ['error', 'bad.png'],
    ]);
  });

  it('a rejected presign (e.g. disallowed type) becomes an error event', async () => {
    const events = await lastValueFrom(uploadFile$(file('x.exe'), deps({ presign: () => Promise.reject(new Error('Unsupported file type')) })).pipe(toArray()));
    expect(events).toEqual([{ kind: 'error', file: 'x.exe', error: new Error('Unsupported file type') }]);
  });

  it('FR-MEDIA-01: files without a browser MIME type are declared as octet-stream (server decides)', async () => {
    const seen: string[] = [];
    const untyped = new File([new Uint8Array([1])], 'blob.bin');
    await lastValueFrom(uploadFile$(untyped, deps({
          presign: (f) => {
            seen.push(f.mimeType);
            return Promise.reject(new Error('Unsupported'));
          },
        })).pipe(toArray()));
    expect(seen).toEqual(['application/octet-stream']);
  });
});

