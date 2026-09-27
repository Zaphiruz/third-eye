import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRitual } from './useRitual';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const durations = [1000, 1000, 500];

describe('useRitual', () => {
  it('advances on timers and holds on the last step until ready', () => {
    const { result, rerender } = renderHook(({ ready }) => useRitual(durations, ready), { initialProps: { ready: false } });
    expect(result.current.index).toBe(0);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.index).toBe(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.index).toBe(2);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.done).toBe(false);
    rerender({ ready: true });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.done).toBe(true);
  });

  it('skip jumps ahead but cannot pass the oracle before ready', () => {
    const { result, rerender } = renderHook(({ ready }) => useRitual(durations, ready), { initialProps: { ready: false } });
    act(() => { result.current.skip(); });
    act(() => { result.current.skip(); });
    expect(result.current.index).toBe(2);
    act(() => { result.current.skip(); });
    expect(result.current.done).toBe(false);
    rerender({ ready: true });
    act(() => { result.current.skip(); });
    expect(result.current.done).toBe(true);
  });

  it('finishes quickly when the reading is already ready', () => {
    const { result } = renderHook(() => useRitual(durations, true));
    act(() => { vi.advanceTimersByTime(2500); });
    expect(result.current.done).toBe(true);
  });

  it('skip cancels the stale timer instead of leaving it to fire later', () => {
    const { result } = renderHook(() => useRitual(durations, false));
    act(() => { result.current.skip(); });
    act(() => { result.current.skip(); });
    expect(result.current.index).toBe(2);
    // The original step-0 timer (due at 1000ms) must not still be pending after two skips.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.index).toBe(2);
  });

  it('skip restarts the next step\'s timer from the moment of the skip', () => {
    const { result } = renderHook(() => useRitual(durations, false));
    act(() => { vi.advanceTimersByTime(500); });
    act(() => { result.current.skip(); });
    expect(result.current.index).toBe(1);
    act(() => { vi.advanceTimersByTime(999); });
    expect(result.current.index).toBe(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.index).toBe(2);
  });

  it('stays done after skipping through to the end, even if timers keep advancing', () => {
    const { result } = renderHook(() => useRitual(durations, true));
    act(() => { result.current.skip(); });
    act(() => { result.current.skip(); });
    act(() => { result.current.skip(); });
    expect(result.current.done).toBe(true);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.done).toBe(true);
  });

  it('readiness flipping mid-step does not restart that step\'s timer', () => {
    // The server reading often finishes while an earlier step (e.g. the tarot draw) is still
    // animating; that must not reset the in-flight timer for that step.
    const { result, rerender } = renderHook(({ ready }) => useRitual(durations, ready), { initialProps: { ready: false } });
    act(() => { vi.advanceTimersByTime(700); });
    rerender({ ready: true });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.index).toBe(1);
  });
});
