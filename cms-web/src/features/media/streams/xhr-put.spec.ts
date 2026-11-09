import { afterEach, describe, expect, it, vi } from 'vitest';
import { xhrPut } from './upload.stream';

/** Minimal scriptable XMLHttpRequest double. */
class FakeXhr {
  static last: FakeXhr;
  static DONE = 4;
  readonly headers: Record<string, string> = {};
  readonly upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 0;
  readyState = 1;
  method = '';
  url = '';
  body: unknown;
  abort = vi.fn();
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send(body: unknown) {
    this.body = body;
  }
}

const target = { url: 'https://storage.example.com/k', method: 'PUT' as const, headers: { 'Content-Type': 'image/png' }, expiresInSeconds: 60 };
const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });

describe('xhrPut (FR-MEDIA-04 direct upload with progress)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('PUTs with the presigned headers, reports computable progress and completes at 100', () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const seen: number[] = [];
    let done = false;
    xhrPut(target, file).subscribe({ next: (p) => seen.push(p), complete: () => (done = true) });
    const xhr = FakeXhr.last;
    expect([xhr.method, xhr.url, xhr.headers, xhr.body]).toEqual(['PUT', target.url, target.headers, file]);
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 0 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    xhr.status = 200;
    xhr.onload?.();
    expect([seen, done]).toEqual([[25, 100], true]);
  });

  it('errors on a non-2xx response and on network failure', () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const errors: string[] = [];
    xhrPut(target, file).subscribe({ error: (e: Error) => errors.push(e.message) });
    FakeXhr.last.status = 403;
    FakeXhr.last.onload?.();
    xhrPut(target, file).subscribe({ error: (e: Error) => errors.push(e.message) });
    FakeXhr.last.onerror?.();
    expect(errors).toEqual(['Upload failed (403)', 'Upload failed']);
  });

  it('aborts an unfinished upload on unsubscribe, but not a finished one', () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    xhrPut(target, file).subscribe().unsubscribe();
    expect(FakeXhr.last.abort).toHaveBeenCalledTimes(1);
    const sub = xhrPut(target, file).subscribe();
    FakeXhr.last.readyState = FakeXhr.DONE;
    sub.unsubscribe();
    expect(FakeXhr.last.abort).not.toHaveBeenCalled();
  });
});
