import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EDITOR } from '../../../../test/mocks/fake-api';
import { renderPage } from '../../../../test/utils/app';
import { useSessionStore } from '../../../shared/stores/session.store';
import { useUiStore } from '../../../shared/stores/ui.store';
import { ProfilePage } from './ProfilePage';

describe('ProfilePage (03-DESIGN §12.9, FR-AUTH-05)', () => {
  it('shows the account and switches the theme', async () => {
    const { user } = renderPage(<ProfilePage />, { user: EDITOR });
    expect(screen.getByText('Eve')).toBeInTheDocument();
    expect(screen.getByText(/eve@example.com · Editor/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(useUiStore.getState().themeMode).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Dark' })); // deselecting keeps the current mode
    expect(useUiStore.getState().themeMode).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'System' }));
    expect(useUiStore.getState().themeMode).toBe('system');
  });

  it('FR-AUTH-05: changing the password ends the session; a wrong current password is shown on the field', async () => {
    const { user, toasts } = renderPage(<ProfilePage />, { user: EDITOR });
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findAllByText('Required')).toHaveLength(2);
    await user.type(screen.getByLabelText('Current password'), 'wrong-password-1');
    await user.type(screen.getByLabelText('New password'), 'brand-new-pass-42');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Current password'));
    await user.type(screen.getByLabelText('Current password'), 'correct-horse-42');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(useSessionStore.getState().status).toBe('anonymous'));
    expect(toasts()).toContain('Password changed. Please sign in again.');
  });

  it('maps a server password-policy error onto the new password field', async () => {
    const { user, api } = renderPage(<ProfilePage />, { user: EDITOR });
    api.failNext('POST', /me\/password$/, 422, { error: { code: 'VALIDATION_ERROR', message: 'Password too weak', details: { field: 'password' } } });
    await user.type(screen.getByLabelText('Current password'), 'correct-horse-42');
    await user.type(screen.getByLabelText('New password'), 'weak');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Password too weak', { selector: 'p' })).toBeInTheDocument();
  });

  it('renders without a signed-in user', () => {
    renderPage(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
