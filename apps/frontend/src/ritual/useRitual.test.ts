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
});
