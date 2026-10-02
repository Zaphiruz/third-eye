import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { installMockApi, ok } from './test/mockApi';
import { me, renderApp } from './test/render';

describe('App gate', () => {
  it('sends users who have not onboarded to the welcome screen', async () => {
    installMockApi({ 'GET /me': ok(me({ onboarded: false, profile: { ...me().profile, birthDate: null } })) });
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How readings work' })).toHaveAttribute('href', '/how-it-works');
  });

  it('shows the app shell with navigation for onboarded users', async () => {
    installMockApi({ 'GET /me': ok(me()) });
    renderApp();
    expect(await screen.findByRole('link', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('offers a retry when /me fails', async () => {
    installMockApi({ 'GET /me': { status: 500, body: { error: { code: 'internal', message: 'x' } } } });
    renderApp();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
