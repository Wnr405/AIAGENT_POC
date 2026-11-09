import { fromEvent, merge, of, type Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

/** 04-ARCH §5.5.1 connectivity$: true when the browser reports being online. */
export const connectivity$ = (): Observable<boolean> =>
  merge(of(navigator.onLine), fromEvent(window, 'online').pipe(map(() => true)), fromEvent(window, 'offline').pipe(map(() => false))).pipe(
    distinctUntilChanged(),
  );
