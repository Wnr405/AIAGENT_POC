import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ADMIN } from '../../../../test/mocks/fake-api';
import { dialogsGone, renderPage } from '../../../../test/utils/app';
import { ApiKeysPage } from './ApiKeysPage';

describe('ApiKeysPage (FR-PUBAPI-02, 03-DESIGN §12.8)', () => {
  it('creates a key, shows it once with a copy button, then lists it', async () => {
    const { user, api, toasts } = renderPage(<ApiKeysPage />, { user: ADMIN });
    expect(await screen.findByText('No API keys yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New key' }));
    let dialog = await screen.findByRole('dialog', { name: 'New key' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await dialogsGone();
    await user.click(screen.getByRole('button', { name: 'New key' }));
    await screen.findByRole('dialog', { name: 'New key' });
    await user.keyboard('{Escape}');
    await dialogsGone();
    await user.click(screen.getByRole('button', { name: 'New key' }));
    dialog = await screen.findByRole('dialog', { name: 'New key' });
    expect(within(dialog).getByRole('button', { name: 'New key' })).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Website');
    await user.click(within(dialog).getByRole('button', { name: 'New key' }));
    const created = await screen.findByRole('dialog', { name: 'Copy your new API key' });
    expect(within(created).getByText('cms_live_abcdef0123456789')).toBeInTheDocument();
    await user.click(within(created).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe('cms_live_abcdef0123456789');
    expect(toasts()).toContain('Copied to clipboard');
    await user.click(within(created).getByRole('button', { name: 'Close' }));
    await dialogsGone();
    const row = (await screen.findByText('Website')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Never')).toBeInTheDocument();
    expect(api.state.keys).toHaveLength(1);
  });

  it('revokes a key after confirming; revoked keys have no action; errors toast', async () => {
    const { user, api, toasts } = renderPage(<ApiKeysPage />, {
      user: ADMIN,
      seed: (a) =>
        a.state.keys.push(
          {
            id: 'k1',
            name: 'Live',
            prefix: 'cms_live_aa',
            lastUsedAt: new Date().toISOString(),
            revokedAt: null,
            createdAt: '2026-05-01T00:00:00Z',
          },
          {
            id: 'k2',
            name: 'Old',
            prefix: 'cms_live_bb',
            lastUsedAt: null,
            revokedAt: '2026-05-02T00:00:00Z',
            createdAt: '2026-05-01T00:00:00Z',
          },
        ),
    });
    const old = (await screen.findByText('Old')).closest('tr') as HTMLElement;
    expect(within(old).getByText('Revoked')).toBeInTheDocument();
    expect(within(old).queryByRole('button')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Revoke this key?' })).getByRole('button', { name: 'Cancel' }));
    await dialogsGone();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Revoke this key?' })).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(api.state.keys[0]?.revokedAt).not.toBeNull());

    api.failNext('POST', /\/api-keys$/, 429, { error: { code: 'RATE_LIMITED', message: 'Slow down' } });
    await dialogsGone();
    await user.click(screen.getByRole('button', { name: 'New key' }));
    const dialog = await screen.findByRole('dialog', { name: 'New key' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'X');
    await user.click(within(dialog).getByRole('button', { name: 'New key' }));
    await waitFor(() => expect(toasts()).toContain('Too many requests. Try again in 60 seconds.'));
  });

  it('shows a toast when revoking fails', async () => {
    const { user, api, toasts } = renderPage(<ApiKeysPage />, {
      user: ADMIN,
      seed: (a) =>
        a.state.keys.push({ id: 'k1', name: 'Live', prefix: 'p', lastUsedAt: null, revokedAt: null, createdAt: '2026-05-01T00:00:00Z' }),
    });
    api.failNext('DELETE', /\/api-keys\/k1$/, 404);
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Revoke this key?' })).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(toasts()).toContain('Not found.'));
  });
});
