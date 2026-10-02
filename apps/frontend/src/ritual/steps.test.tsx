import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { SkyData } from '@third-eye/divination';
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

const sky: SkyData = { moon: { phase: 'full', illumination: 1, waxing: false }, bodies: [
  { body: 'sun', sign: 'libra', degree: 3, retrograde: false }, { body: 'moon', sign: 'aries', degree: 3, retrograde: false },
  { body: 'mercury', sign: 'libra', degree: 24, retrograde: false }, { body: 'venus', sign: 'scorpio', degree: 7, retrograde: false },
  { body: 'mars', sign: 'cancer', degree: 29, retrograde: false }, { body: 'jupiter', sign: 'leo', degree: 18, retrograde: false },
  { body: 'saturn', sign: 'aries', degree: 11, retrograde: true },
] };

describe('sky step', () => {
  const withSky: FortuneDto = { ...fortune, results: [
    ...fortune.results,
    { method: 'ICHING', data: { lines: [7, 7, 7, 8, 8, 8], primary: 11, changingLines: [], relating: null }, reading: null },
    { method: 'SKY', data: sky, reading: null },
  ] };

  it('comes right after the I Ching', () => {
    const steps = buildRitualSteps(withSky, false);
    expect(steps.map((s) => s.key)).toEqual(['tarot', 'iching', 'sky', 'oracle']);
    expect(steps[2]!.caption).toBe('The heavens turn');
  });

  it('shows the moon and lights the bodies one by one', () => {
    const step = buildRitualSteps(withSky, true).find((s) => s.key === 'sky')!;
    const { container } = render(<>{step.render()}</>);
    expect(screen.getByRole('img', { name: 'Moon: full moon, 100% lit' })).toBeInTheDocument();
    // useTicker schedules the next tick only after each re-render, so advance in separate act() calls.
    for (let i = 0; i < 10; i++) act(() => { vi.advanceTimersByTime(100); });
    expect(container.querySelectorAll('li[data-body].opacity-100')).toHaveLength(7);
  });
});
