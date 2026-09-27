import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { FortuneDto } from '@third-eye/shared';
import { buildRitualSteps } from './steps';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const fortune: FortuneDto = {
  id: '11111111-1111-4111-8111-111111111111', date: '2026-09-26', status: 'READY', persona: 'CONFIDANT', summary: null,
  results: [
    { method: 'TAROT', data: { cards: [{ id: 'major-16', reversed: false, position: 'situation' }] }, reading: null },
  ],
};

describe('buildRitualSteps', () => {
  it('does not rotate or translate the tarot card under reduced motion', () => {
    const [tarot] = buildRitualSteps(fortune, true);
    const { container } = render(<>{tarot!.render()}</>);
    // Let the (fake-timer-driven) animation loop advance past the mount frame — a real rotation
    // would show up as a `transform` containing `rotate` on the animated wrapper by now.
    act(() => { vi.advanceTimersByTime(100); });
    const img = container.querySelector('svg[role="img"]');
    expect(img).toBeTruthy();
    const style = img!.parentElement!.getAttribute('style') ?? '';
    expect(style).not.toMatch(/rotate/i);
    expect(style).not.toMatch(/translate/i);
  });

  it('does rotate the tarot card when motion is not reduced', () => {
    const [tarot] = buildRitualSteps(fortune, false);
    const { container } = render(<>{tarot!.render()}</>);
    act(() => { vi.advanceTimersByTime(100); });
    const img = container.querySelector('svg[role="img"]');
    expect(img).toBeTruthy();
    const style = img!.parentElement!.getAttribute('style') ?? '';
    expect(style).toMatch(/rotate/i);
  });
});
