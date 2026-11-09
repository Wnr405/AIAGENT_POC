import { fromEvent, merge, of, timer, type Observable, type SchedulerLike, asyncScheduler } from 'rxjs';
import { map, startWith, switchMap, throttleTime } from 'rxjs/operators';

export type IdleState = 'active' | 'warning' | 'idle';

/**
 * SEC-12: admin sessions idle-expire after 30 minutes. Emits 'warning' 2 minutes
 * before and 'idle' at the deadline; any activity resets the clock.
 * `activity$` is injectable so the stream is marble-testable.
 */
export function idleState$(
  activity$: Observable<unknown>,
  {
    idleMs = 30 * 60_000,
    warnMs = 2 * 60_000,
    scheduler = asyncScheduler,
  }: { idleMs?: number; warnMs?: number; scheduler?: SchedulerLike } = {},
): Observable<IdleState> {
  return activity$.pipe(
    throttleTime(1_000, scheduler),
    startWith(null),
    switchMap(() =>
      merge(
        of<IdleState>('active'),
        timer(idleMs - warnMs, scheduler).pipe(map((): IdleState => 'warning')),
        timer(idleMs, scheduler).pipe(map((): IdleState => 'idle')),
      ),
    ),
  );
}

/** Real browser activity source. */
export const domActivity$ = (): Observable<Event> =>
  merge(
    fromEvent(window, 'pointerdown'),
    fromEvent(window, 'keydown'),
    fromEvent(window, 'wheel', { passive: true }),
    fromEvent(document, 'visibilitychange'),
  );
