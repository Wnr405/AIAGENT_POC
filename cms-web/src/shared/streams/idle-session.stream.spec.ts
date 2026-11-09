import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it } from 'vitest';
import { idleState$ } from './idle-session.stream';

describe('idleState$ (SEC-12)', () => {
  it('warns 2 min before and expires at 30 min without activity', () => {
    new TestScheduler((a, e) => expect(a).toEqual(e)).run(({ cold, expectObservable }) => {
      const activity = cold('');
      const out = idleState$(activity, { idleMs: 30 * 60_000, warnMs: 2 * 60_000 });
      expectObservable(out, '^ 31m !').toBe('a 27m 59999ms w 119999ms i', { a: 'active', w: 'warning', i: 'idle' });
    });
  });

  it('activity resets the timer', () => {
    new TestScheduler((a, e) => expect(a).toEqual(e)).run(({ cold, expectObservable }) => {
      const activity = cold('5ms x');
      const out = idleState$(activity, { idleMs: 20, warnMs: 5 });
      expectObservable(out, '^ 40ms !').toBe('a 4ms a 14ms w 4ms i', { a: 'active', w: 'warning', i: 'idle' });
    });
  });
});
