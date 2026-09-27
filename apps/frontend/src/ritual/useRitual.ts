import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Step machine for the ritual. The last step is "the oracle speaks": it holds until `ready`,
 * then lingers for its own duration before `done`.
 *
 * Each timeout schedules the next one directly inside its own callback (via `scheduleFrom`),
 * rather than relying on a `useEffect` keyed on `index` to notice a state change and re-schedule.
 * That keeps the whole chain advancing correctly under `vi.advanceTimersByTime`, whose single
 * call can cover several steps before React gets a chance to re-render in between.
 *
 * `gen` is bumped whenever `skip()` moves the index: it's a dependency of the scheduling effect
 * purely to force that effect to tear down the in-flight timer and restart the chain from the
 * post-skip index, so a skip actually cancels/replaces the running timer instead of leaving a
 * stale one that later fires with a step number computed before the skip.
 *
 * `ready` is deliberately NOT a dependency of that same effect: readiness must never interrupt an
 * earlier step (index < last) that's mid-timer — e.g. the server reading often finishes while the
 * tarot step is still animating, and that must not reset the tarot timer. A separate effect below
 * watches `ready` and only acts (by bumping `gen`, which restarts the chain) when we're actually
 * parked on the last step waiting for it.
 */
export function useRitual(durations: number[], ready: boolean) {
  const last = durations.length - 1;
  const [index, setIndexState] = useState(0);
  const indexRef = useRef(index);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const [gen, setGen] = useState(0);

  const setIndex = useCallback((i: number) => {
    indexRef.current = i;
    setIndexState(i);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleFrom(i: number) {
      if (cancelled) return;
      if (i < last) {
        timer = setTimeout(() => {
          if (cancelled) return;
          setIndex(i + 1);
          scheduleFrom(i + 1);
        }, durations[i]);
      } else if (i === last && readyRef.current) {
        timer = setTimeout(() => {
          if (cancelled) return;
          setIndex(last + 1);
        }, durations[last]);
      }
    }

    scheduleFrom(indexRef.current);
    return () => { cancelled = true; if (timer !== undefined) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen]);

  // Only relevant once we're parked on the last step: kicks off its timer once `ready` flips true.
  useEffect(() => {
    if (ready && indexRef.current === last) setGen((g) => g + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const skip = useCallback(() => {
    const i = indexRef.current;
    const next = i < last ? i + 1 : i === last && readyRef.current ? last + 1 : i;
    if (next === i) return; // already at the end of what skip can do right now
    setIndex(next);
    setGen((g) => g + 1); // forces the effect above to clear the pending timer and restart from `next`
  }, [last, setIndex]);

  return { index: Math.min(index, last), done: index > last, skip };
}
