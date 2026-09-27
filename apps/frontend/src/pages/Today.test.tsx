import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FortuneDto } from '@third-eye/shared';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';

const fortune = (over: Partial<FortuneDto> = {}): FortuneDto => ({
  id: '11111111-1111-4111-8111-111111111111', date: '2026-09-26', status: 'READY', persona: 'CONFIDANT',
  summary: 'A gentle day with a sharp turn in the afternoon.',
  results: [
    { method: 'TAROT', data: { cards: [
      { id: 'major-16', reversed: true, position: 'situation' },
      { id: 'cups-01', reversed: false, position: 'challenge' },
      { id: 'swords-12', reversed: false, position: 'advice' },
    ] }, reading: 'The Tower asks you to let go.' },
    { method: 'WESTERN', data: { sign: 'gemini' }, reading: 'Gemini curiosity serves you.' },
  ],
  ...over,
});

describe('Today', () => {
  it('shows a returning visitor the finished fortune with a replay button', async () => {
    installMockApi({
      'GET /me': ok(me()),
      'POST /fortunes/today': ok({ fortune: fortune(), fresh: false }),
      [`GET /fortunes/${fortune().id}`]: ok(fortune()),
    });
    renderApp();
    expect(await screen.findByText('A gentle day with a sharp turn in the afternoon.')).toBeInTheDocument();
    expect(screen.getByText('The Tower asks you to let go.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay the ritual' })).toBeInTheDocument();
  });

  it('plays the ritual for a fresh fortune', async () => {
    const pending = fortune({ status: 'PENDING', summary: null, results: fortune().results.map((r) => ({ ...r, reading: null })) });
    installMockApi({
      'GET /me': ok(me()),
      'POST /fortunes/today': ok({ fortune: pending, fresh: true }, 201),
      [`GET /fortunes/${pending.id}`]: ok(pending),
    });
    renderApp();
    expect(await screen.findByRole('button', { name: 'Continue the ritual' })).toBeInTheDocument();
    expect(screen.getByText('The cards are drawn')).toBeInTheDocument();
  });

  it('offers a retry when the reading failed, and asks the server again', async () => {
    const failed = fortune({ status: 'FAILED', summary: null });
    const calls = installMockApi({
      'GET /me': ok(me()),
      'POST /fortunes/today': ok({ fortune: failed, fresh: false }),
      [`GET /fortunes/${failed.id}`]: ok(failed),
    });
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/fortunes/today')).toHaveLength(2);
  });

  describe('recovering an orphaned PENDING reading', () => {
    beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
    afterEach(() => { vi.useRealTimers(); });

    it('re-opens the fortune ~130s after a restart leaves it stuck PENDING, and stops once ready', async () => {
      let status: 'PENDING' | 'READY' = 'PENDING';
      const pending = fortune({ status: 'PENDING', summary: null, results: fortune().results.map((r) => ({ ...r, reading: null })) });
      const ready = fortune({ status: 'READY' });
      const calls = installMockApi({
        'GET /me': ok(me()),
        'POST /fortunes/today': () => ok({ fortune: status === 'PENDING' ? pending : ready, fresh: false }),
        [`GET /fortunes/${pending.id}`]: () => ok(status === 'PENDING' ? pending : ready),
      });
      const postCount = () => calls.filter((c) => c.method === 'POST' && c.path === '/fortunes/today').length;

      renderApp();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(await screen.findByText('The oracle is still speaking…')).toBeInTheDocument();
      expect(postCount()).toBe(1);

      // Still PENDING after ~130s: the page should have re-opened (re-claimed) the fortune, not just polled GET.
      await act(async () => { await vi.advanceTimersByTimeAsync(130_000); });
      expect(postCount()).toBe(2);

      // Now the reading completes; further time passing must not trigger more re-opens.
      status = 'READY';
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000); }); // let the 2s GET poll pick up READY
      await act(async () => { await vi.advanceTimersByTimeAsync(260_000); });
      expect(postCount()).toBe(2);
    });
  });
});
