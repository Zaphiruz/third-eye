import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';

describe('Settings', () => {
  it('links to how readings work', async () => {
    installMockApi({ 'GET /me': ok(me()) });
    renderApp(undefined, { route: '/settings' });
    expect(await screen.findByRole('link', { name: 'How readings work' })).toHaveAttribute('href', '/how-it-works');
  });

  it('prefills the profile and saves changes', async () => {
    const calls = installMockApi({
      'GET /me': ok(me({ profile: { ...me().profile, bloodType: 'O' } })),
      'PATCH /me': ({ body }) => ok(me({ profile: { ...me().profile, ...(body as object) } })),
    });
    renderApp(undefined, { route: '/settings' });
    expect(await screen.findByLabelText('Birth date')).toHaveValue('1990-06-15');
    expect(screen.getByLabelText('Blood type')).toHaveValue('O');
    await userEvent.click(screen.getByRole('radio', { name: /The Mystic/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toMatchObject({ persona: 'MYSTIC', bloodType: 'O' });
  });
});
