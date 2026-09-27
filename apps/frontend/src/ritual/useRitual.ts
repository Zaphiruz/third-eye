import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Step machine for the ritual. The last step is "the oracle speaks": it holds until `ready`,
 * then lingers for its own duration before `done`.
 *
 * Each timeout schedules the next one directly inside its own callback (via `scheduleFrom`),
 * rather than relying on a `useEffect` keyed on `index` to notice a state change and re-schedule.
 * That keeps the whole chain advancing correctly under `vi.advanceTimersByTime`, whose single
 * call can cover several steps before React gets a chance to re-render in between.
 */
export function useRitual(durations: number[], ready: boolean) {
  const last = durations.length - 1;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(index);
  indexRef.current = index;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleFrom(i: number) {
      if (cancelled) return;
      if (i < last) {
        timer = setTimeout(() => {
          if (cancelled) return;
          indexRef.current = i + 1;
          setIndex(i + 1);
          scheduleFrom(i + 1);
        }, durations[i]);
      } else if (i === last && readyRef.current) {
        timer = setTimeout(() => {
          if (cancelled) return;
          indexRef.current = last + 1;
          setIndex(last + 1);
        }, durations[last]);
      }
    }

    scheduleFrom(indexRef.current);
    return () => { cancelled = true; if (timer !== undefined) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Covers the case where we're already parked on the last step and `ready` flips true later.
  useEffect(() => {
    if (indexRef.current === last && ready) {
      const t = setTimeout(() => { indexRef.current = last + 1; setIndex(last + 1); }, durations[last]);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const skip = useCallback(() => {
    setIndex((i) => {
      const next = i < last ? i + 1 : i === last && readyRef.current ? last + 1 : i;
      indexRef.current = next;
      return next;
    });
  }, [last]);

  return { index: Math.min(index, last), done: index > last, skip };
}
