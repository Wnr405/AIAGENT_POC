import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

/** Subscribes for the component's lifetime; re-subscribes when `source$` identity changes. */
export function useObservable<T>(source$: Observable<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = source$.subscribe(setValue);
    return () => sub.unsubscribe();
  }, [source$]);
  return value;
}
