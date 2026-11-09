import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/mocks/server';
import { renderWithProviders } from '../../../../test/utils/render';
import { useSessionStore } from '../../../shared/stores/session.store';
import { LoginPage } from './LoginPage';

describe('LoginPage (FR-AUTH-01, 03-DESIGN §12.1)', () => {
  beforeEach(() => useSessionStore.setState({ accessToken: null, user: null, status: 'anonymous', endReason: null }));

  it('signs in and stores the session in memory', async () => {
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' });
    await userEvent.type(screen.getByLabelText(/email/i), 'eve@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'correct-horse-42');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    expect(useSessionStore.getState().user?.email).toBe('eve@example.com');
  });

  it('shows the generic server message on failure', async () => {
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' });
    await userEvent.type(screen.getByLabelText(/email/i), 'eve@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('validates required fields inline', async () => {
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('Required')).toHaveLength(2);
  });

  it('FR-AUTH-04: explains an expired or idle session, and hides that note once a new error appears', async () => {
    useSessionStore.setState({ status: 'anonymous', endReason: 'idle' });
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' });
    expect(screen.getByText('Your session expired. Please log in again.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/email/i), 'eve@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.queryByText('Your session expired. Please log in again.')).not.toBeInTheDocument();
  });

  it('SEC-07: other failures (rate limit) use the friendly message', async () => {
    server.use(
      http.post('/api/admin/auth/login', () =>
        HttpResponse.json({ error: { code: 'RATE_LIMITED', message: 'x' } }, { status: 429, headers: { 'Retry-After': '30' } }),
      ),
    );
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' });
    await userEvent.type(screen.getByLabelText(/email/i), 'eve@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'whatever-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Try again in 30 seconds.');
  });

  it('already signed-in users are sent on to where they came from', async () => {
    useSessionStore.setState({ status: 'authenticated' });
    renderWithProviders(<LoginPage />, { path: '/login', route: '/login' });
    expect(await screen.findByText('navigated')).toBeInTheDocument();
  });
});
