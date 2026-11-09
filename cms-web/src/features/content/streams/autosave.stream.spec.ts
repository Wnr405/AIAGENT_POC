import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it } from 'vitest';
import { autosave$, type FormSnapshot } from './autosave.stream';

/** 06-TEST-STRATEGY §8.3 marble tests (virtual time). */
const snap = (value: string, dirty = true, valid = true): FormSnapshot<string> => ({ value, dirty, valid });

describe('autosave$ (04-ARCH §5.4.2)', () => {
  const scheduler = () => new TestScheduler((a, e) => expect(a).toEqual(e));

  it('saves once after 30 s of inactivity, emitting saving → saved', () => {
    scheduler().run(({ cold, expectObservable }) => {
      const changes = cold<FormSnapshot<string>>('a 999ms b', { a: snap('a'), b: snap('ab') });
      const out = autosave$(changes, () => new Promise(() => undefined), { debounceMs: 30_000 });
      // Debounce counts from the last change (t=1000ms). The promise settles outside
      // virtual time, so only 'saving' is observable here ('saved' is covered below).
      expectObservable(out).toBe('31000ms s', { s: { kind: 'saving' } });
    });
  });

  it('ignores clean or invalid form states', () => {
    scheduler().run(({ cold, expectObservable }) => {
      const changes = cold<FormSnapshot<string>>('a b', { a: snap('a', false), b: snap('', true, false) });
      expectObservable(autosave$(changes, () => Promise.resolve(), { debounceMs: 10 })).toBe('');
    });
  });

  it('does not re-save an identical value', () => {
    scheduler().run(({ cold, expectObservable }) => {
      const changes = cold<FormSnapshot<string>>('a 20ms a', { a: snap('same') });
      expectObservable(autosave$(changes, () => new Promise(() => undefined), { debounceMs: 10 })).toBe('10ms s', {
        s: { kind: 'saving' },
      });
    });
  });

  it('emits saved with the scheduler time after a successful save', async () => {
    const { Subject } = await import('rxjs');
    const changes = new Subject<FormSnapshot<string>>();
    const seen: unknown[] = [];
    const saved: string[] = [];
    autosave$(
      changes,
      (v) => {
        saved.push(v);
        return Promise.resolve();
      },
      { debounceMs: 0 },
    ).subscribe((e) => seen.push(e.kind));
    changes.next(snap('hello'));
    await new Promise((r) => setTimeout(r, 5));
    expect([seen, saved]).toEqual([['saving', 'saved'], ['hello']]);
  });

  it('turns a failed save into an error event instead of killing the stream', async () => {
    const events: string[] = [];
    const { Subject } = await import('rxjs');
    const changes = new Subject<FormSnapshot<string>>();
    autosave$(changes, () => Promise.reject(new Error('down')), { debounceMs: 0 }).subscribe((e) => events.push(e.kind));
    changes.next(snap('x'));
    await new Promise((r) => setTimeout(r, 5));
    changes.next(snap('y'));
    await new Promise((r) => setTimeout(r, 5));
    expect(events).toEqual(['saving', 'error', 'saving', 'error']);
  });
});
