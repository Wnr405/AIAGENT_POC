import { asyncScheduler, from, of, type Observable, type SchedulerLike } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, startWith, switchMap } from 'rxjs/operators';

export interface FormSnapshot<T> {
  value: T;
  dirty: boolean;
  valid: boolean;
}

export type AutosaveEvent = { kind: 'saving' } | { kind: 'saved'; at: number } | { kind: 'error'; error: unknown };

/**
 * 04-ARCH §5.4.2 autosave pipeline: after `debounceMs` of inactivity, save the
 * latest dirty+valid value; identical values are not re-saved; a newer save
 * cancels an in-flight one (switchMap). Pure function of its inputs → marble-testable.
 */
export function autosave$<T>(
  changes$: Observable<FormSnapshot<T>>,
  save: (value: T) => Promise<unknown>,
  { debounceMs = 30_000, scheduler = asyncScheduler }: { debounceMs?: number; scheduler?: SchedulerLike } = {},
): Observable<AutosaveEvent> {
  return changes$.pipe(
    filter((s) => s.dirty && s.valid),
    map((s) => s.value),
    debounceTime(debounceMs, scheduler),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    switchMap((value) =>
      from(save(value)).pipe(
        map((): AutosaveEvent => ({ kind: 'saved', at: scheduler.now() })),
        catchError((error: unknown) => of<AutosaveEvent>({ kind: 'error', error })),
        startWith<AutosaveEvent>({ kind: 'saving' }),
      ),
    ),
  );
}
