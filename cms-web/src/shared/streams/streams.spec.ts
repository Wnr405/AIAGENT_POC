import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectivity$ } from './connectivity.stream';
import { domActivity$ } from './idle-session.stream';

describe('browser event streams (04-ARCH §5.5.1)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('connectivity$ starts with navigator.onLine and follows online/offline events without repeats', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const seen: boolean[] = [];
    const sub = connectivity$().subscribe((v) => seen.push(v));
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    sub.unsubscribe();
    expect(seen).toEqual([true, false, true]);
  });

  it('domActivity$ (SEC-12) emits on pointer, keyboard, wheel and visibility changes', () => {
    const seen: string[] = [];
    const sub = domActivity$().subscribe((e) => seen.push(e.type));
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    window.dispatchEvent(new Event('wheel'));
    document.dispatchEvent(new Event('visibilitychange'));
    sub.unsubscribe();
    window.dispatchEvent(new Event('keydown'));
    expect(seen).toEqual(['pointerdown', 'keydown', 'wheel', 'visibilitychange']);
  });
});
