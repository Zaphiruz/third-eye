import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FortuneSummaryDto } from '@third-eye/shared';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';

const item = (date: string): FortuneSummaryDto => ({
  id: `id-${date}`, date, status: 'READY', persona: 'CONFIDANT', excerpt: `Excerpt for ${date}.`,
  results: [{ method: 'RUNE', data: { id: 'fehu', reversed: false }, reading: null }],
});

describe('History', () => {
  it('lists past fortunes and loads more pages', async () => {
    installMockApi({
      'GET /me': ok(me()),
      'GET /fortunes': ({ url }) => url.searchParams.get('cursor') === '2026-09-25'
        ? ok({ items: [item('2026-09-24')], nextCursor: null })
        : ok({ items: [item('2026-09-26'), item('2026-09-25')], nextCursor: '2026-09-25' }),
    });
    renderApp(undefined, { route: '/history' });
    expect(await screen.findByText('Excerpt for 2026-09-26.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show older' }));
    expect(await screen.findByText('Excerpt for 2026-09-24.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Excerpt for 2026-09-25/ })).toHaveAttribute('href', '/history/id-2026-09-25');
  });

  it('has a friendly empty state', async () => {
    installMockApi({ 'GET /me': ok(me()), 'GET /fortunes': ok({ items: [], nextCursor: null }) });
    renderApp(undefined, { route: '/history' });
    expect(await screen.findByText(/no fortunes yet/i)).toBeInTheDocument();
  });
});
