import { concat, defer, from, Observable, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap } from 'rxjs/operators';
import type { MediaItem, Presigned } from '../api/media.api';

export type UploadEvent =
  | { kind: 'progress'; file: string; percent: number }
  | { kind: 'done'; file: string; item: MediaItem }
  | { kind: 'error'; file: string; error: unknown };

export interface UploadDeps {
  presign: (f: { filename: string; mimeType: string; sizeBytes: number }) => Promise<Presigned>;
  /** PUT straight to object storage (FR-MEDIA-04); emits 0–100. */
  put: (target: Presigned['upload'], file: File) => Observable<number>;
  finalize: (b: { storageKey: string; filename: string; mimeType: string }) => Promise<MediaItem>;
}

/** XHR-based PUT so we get upload progress events; aborting on unsubscribe. */
export function xhrPut(target: Presigned['upload'], file: File): Observable<number> {
  return new Observable<number>((sub) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && sub.next(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        sub.next(100);
        sub.complete();
      } else sub.error(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => sub.error(new Error('Upload failed'));
    xhr.send(file);
    return () => xhr.readyState !== XMLHttpRequest.DONE && xhr.abort();
  });
}

/** One file: presign → direct PUT (progress) → finalize. Errors become events, never stream errors. */
export function uploadFile$(file: File, deps: UploadDeps): Observable<UploadEvent> {
  const meta = { filename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size };
  return defer(() => from(deps.presign(meta))).pipe(
    switchMap((p) =>
      concat(
        deps.put(p.upload, file).pipe(map((percent): UploadEvent => ({ kind: 'progress', file: file.name, percent }))),
        defer(() => from(deps.finalize({ storageKey: p.storageKey, filename: meta.filename, mimeType: meta.mimeType }))).pipe(
          map((item): UploadEvent => ({ kind: 'done', file: file.name, item })),
        ),
      ),
    ),
    catchError((error: unknown) => of<UploadEvent>({ kind: 'error', file: file.name, error })),
  );
}

/** Concurrent uploads (max 3 in flight) — 04-ARCH §5.5.1 uploadProgress$. */
export function uploadAll$(files: readonly File[], deps: UploadDeps, concurrency = 3): Observable<UploadEvent> {
  return from(files).pipe(mergeMap((f) => uploadFile$(f, deps), concurrency));
}
