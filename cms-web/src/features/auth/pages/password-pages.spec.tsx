import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../../../test/utils/app';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { SetPasswordPage } from './SetPasswordPage';

describe('ForgotPasswordPage (FR-AUTH-07)', () => {
  it('always confirms (no account enumeration) and reports transport errors', async () => {
    const { user, api } = renderPage(<ForgotPasswordPage />, { path: '/forgot-password' });
    const button = screen.getByRole('button', { name: 'Send reset link' });
    expect(button).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'someone@example.com');
    await user.click(button);
    expect(await screen.findByText(/If that account exists/)).toBeInTheDocument();
    api.failNext('POST', /password\/forgot$/, 429, { error: { code: 'RATE_LIMITED', message: 'x' } });
    await user.click(button);
    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });
});

describe('SetPasswordPage (FR-AUTH-02/07/08, FR-USER-02)', () => {
  it('reset: validates the policy and confirmation, then sets the password with the link token', async () => {
    const { user, api } = renderPage(<SetPasswordPage mode="reset" />, { path: '/reset-password', route: '/reset-password?token=good' });
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'other');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.getAllByText('At least 12 characters, with a letter and a digit.').length).toBeGreaterThan(1);
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'correct-horse-42');
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-42');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Password saved. You can sign in now.')).toBeInTheDocument();
    expect(api.state.requests.at(-1)?.body).toEqual({ token: 'good', password: 'correct-horse-42' });
  });

  it('reset: shows the server message for an expired link', async () => {
    const { user } = renderPage(<SetPasswordPage mode="reset" />, { path: '/reset-password', route: '/reset-password?token=expired' });
    await user.type(screen.getByLabelText('New password'), 'correct-horse-42');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-42');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This link is invalid or has expired');
  });

  it('invite: accepts the invitation; a network failure shows a friendly error; no token disables submit', async () => {
    const { user, api } = renderPage(<SetPasswordPage mode="invite" />, { path: '/accept-invite', route: '/accept-invite?token=t1' });
    expect(screen.getByRole('heading', { name: 'Welcome! Choose a password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'correct-horse-42');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-42');
    api.failNext('POST', /invite\/accept$/, 500);
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    await user.click(screen.getByRole('button', { name: 'Set password' }));
    await waitFor(() => expect(screen.getByText('Password saved. You can sign in now.')).toBeInTheDocument());
  });

  it('disables submit without a token', () => {
    renderPage(<SetPasswordPage mode="invite" />, { path: '/accept-invite' });
    expect(screen.getByRole('button', { name: 'Set password' })).toBeDisabled();
  });
});
