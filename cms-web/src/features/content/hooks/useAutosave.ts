import { useEffect, useMemo, useState } from 'react';
import { Subject } from 'rxjs';
import { autosave$, type AutosaveEvent, type FormSnapshot } from '../streams/autosave.stream';

/** Bridges form → autosave$ → indicator state (04-ARCH §5.9 useAutosave). */
export function useAutosave<T>(enabled: boolean, save: (value: T) => Promise<unknown>, debounceMs = 30_000) {
  const changes = useMemo(() => new Subject<FormSnapshot<T>>(), []);
  const [state, setState] = useState<AutosaveEvent | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const sub = autosave$(changes, save, { debounceMs }).subscribe(setState);
    return () => sub.unsubscribe();
    // `save` is a stable mutateAsync wrapper supplied by the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-subscribing on every render would drop the debounce window
  }, [enabled, changes, debounceMs]);

  return { push: (s: FormSnapshot<T>) => changes.next(s), state };
}
