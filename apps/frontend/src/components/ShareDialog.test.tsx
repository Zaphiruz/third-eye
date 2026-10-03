import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShareDto } from '@third-eye/shared';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';
import { ShareButton } from './ShareDialog';

const FID = '11111111-1111-4111-8111-111111111111';
const share = (over: Partial<ShareDto> = {}): ShareDto => ({
  id: 'a1b2c3d4-0000-4000-8000-000000000001', url: 'https://third-eye.example/s/AAAAAAAAAAAAAAAAAAAAAA',
  sharedByName: 'Ada Lovelace', includeBirthSigns: false, createdAt: '2026-09-29T12:00:00.000Z', ...over,
});

describe('ShareButton', () => {
  it('pre-fills the name from the profile, defaults signs off, and creates a link', async () => {
    let shares: ShareDto[] = [];
    const calls = installMockApi({
      'GET /me': ok(me({ profile: { ...me().profile, fullName: 'Ada Lovelace' } })),
      [`GET /fortunes/${FID}/shares`]: () => ok(shares),
      [`POST /fortunes/${FID}/shares`]: ({ body }) => { shares = [share(body as Partial<ShareDto>)]; return ok(shares[0], 201); },
    });
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    // /me may still be loading when the dialog opens; the name follows it until the user types.
    await waitFor(() => expect(within(dialog).getByLabelText('Shared by')).toHaveValue('Ada Lovelace'));
    expect(within(dialog).getByLabelText(/include birth-based signs/i)).not.toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }));
    // The new link shows once: the top row is hidden as soon as the refreshed "Active links" list contains it.
    await within(dialog).findByText(/Ada Lovelace · without signs/);
    expect(within(dialog).getAllByDisplayValue('https://third-eye.example/s/AAAAAAAAAAAAAAAAAAAAAA')).toHaveLength(1);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ sharedByName: 'Ada Lovelace', includeBirthSigns: false });
  });

  it('falls back to the account name and lists existing links, which can be revoked', async () => {
    let shares = [share({ sharedByName: 'Dad', includeBirthSigns: true })];
    installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: () => ok(shares),
      // The mock can't build a 204 Response with a body, so answer 200 {} — RTK treats both as success.
      [`DELETE /shares/${shares[0]!.id}`]: () => { shares = []; return { status: 200, body: {} }; },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Shared by')).toHaveValue('Ada'));
    expect(await within(dialog).findByText(/Dad · with signs/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(within(dialog).queryByText(/Dad · with signs/)).not.toBeInTheDocument());
  });

  it('shows the server error inline', async () => {
    installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: ok([]),
      [`POST /fortunes/${FID}/shares`]: { status: 409, body: { error: { code: 'not_ready', message: 'x' } } },
    });
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText("This reading isn't finished yet.")).toBeInTheDocument();
  });

  it('focuses the name input on open, closes on Escape and returns focus to the Share button', async () => {
    installMockApi({ 'GET /me': ok(me()), [`GET /fortunes/${FID}/shares`]: ok([]) });
    renderApp(<ShareButton fortuneId={FID} />);
    const button = await screen.findByRole('button', { name: 'Share' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Shared by')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('does not close when the backdrop is clicked', async () => {
    installMockApi({ 'GET /me': ok(me()), [`GET /fortunes/${FID}/shares`]: ok([]) });
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(dialog.parentElement!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('rejects an empty name and sends includeBirthSigns when checked', async () => {
    const calls = installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: ok([]),
      [`POST /fortunes/${FID}/shares`]: ({ body }) => ok(share(body as Partial<ShareDto>), 201),
    });
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Shared by');
    await waitFor(() => expect(input).toHaveValue('Ada')); // /me must have loaded, or clear() is a no-op
    await userEvent.clear(input);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }));
    expect(await within(dialog).findByText('Enter a name of 1–60 characters.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.type(input, 'Dad');
    await userEvent.click(within(dialog).getByLabelText(/include birth-based signs/i));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ sharedByName: 'Dad', includeBirthSigns: true }));
  });

  it('removes the just-created link row when it is revoked', async () => {
    let shares: ShareDto[] = [];
    installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: () => ok(shares),
      [`POST /fortunes/${FID}/shares`]: () => { shares = [share()]; return ok(shares[0], 201); },
      [`DELETE /shares/${share().id}`]: () => { shares = []; return { status: 200, body: {} }; },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Shared by')).toHaveValue('Ada')); // /me must have loaded, or the name is empty
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }));
    await within(dialog).findByRole('button', { name: 'Stop sharing' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(within(dialog).queryAllByLabelText('Share link')).toHaveLength(0));
  });

  it('shows an error and keeps the link when revoking fails', async () => {
    installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: ok([share({ sharedByName: 'Dad' })]),
      [`DELETE /shares/${share().id}`]: { status: 500, body: { error: { code: 'boom', message: 'x' } } },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Stop sharing' }));
    expect(await within(dialog).findByText('Could not stop sharing. Please try again.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Dad · without signs/)).toBeInTheDocument();
  });

  it('still shows the new link when the follow-up list fetch fails', async () => {
    installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: { status: 500, body: { error: { code: 'boom', message: 'x' } } },
      [`POST /fortunes/${FID}/shares`]: () => ok(share(), 201),
    });
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Shared by')).toHaveValue('Ada')); // /me must have loaded, or the name is empty
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }));
    expect(await within(dialog).findByDisplayValue('https://third-eye.example/s/AAAAAAAAAAAAAAAAAAAAAA')).toBeInTheDocument();
  });
});
