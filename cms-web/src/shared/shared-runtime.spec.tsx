import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { server } from '../../test/mocks/server';
import { ApiError } from './api/api-error';
import { api } from './api/client';
import { createHttpClient } from './api/http-client';
import { createQueryClient } from './api/query-client';
import { refreshSession } from './api/session';
import { useObservable } from './hooks/useObservable';
import { useUnsavedChangesPrompt } from './hooks/useUnsavedChangesPrompt';
import { selectRole, useSessionStore } from './stores/session.store';
import { globalErrors$ } from './streams/global-errors.stream';
import { formatRelative } from './utils/format';
import { preferences } from './utils/storage';

const user = { id: 'u1', email: 'eve@example.com', name: 'Eve', role: 'editor' as const };

describe('session refresh (04-ARCH §6.3, SEC-11)', () => {
  afterEach(() => useSessionStore.setState({ accessToken: null, user: null, status: 'unknown', endReason: null }));

  it('stores the new session from the refresh cookie and sends the CSRF header', async () => {
    let csrf: string | null = null;
    server.use(
      http.post('/api/admin/auth/refresh', ({ request }) => {
        csrf = request.headers.get('X-CMS-CSRF');
        return HttpResponse.json({ accessToken: 'fresh', expiresIn: 900, user });
      }),
    );
    expect(await refreshSession()).toBe('fresh');
    expect(csrf).toBe('1');
    expect(useSessionStore.getState()).toMatchObject({ accessToken: 'fresh', status: 'authenticated', user });
    expect(selectRole(useSessionStore.getState())).toBe('editor');
  });

  it('clears the session when refresh is refused, and returns null on network failure', async () => {
    expect(await refreshSession()).toBeNull(); // default handler answers 401
    expect(useSessionStore.getState().status).toBe('anonymous');
    expect(selectRole(useSessionStore.getState())).toBeNull();
    const failing = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(await refreshSession(failing as unknown as typeof fetch)).toBeNull();
  });

  it('the singleton client sends the bearer token, expires the session after a failed refresh and publishes 5xx errors', async () => {
    useSessionStore.getState().setSession('tok', user);
    let auth: string | null = null;
    server.use(
      http.get('/api/admin/ping', ({ request }) => {
        auth = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
      http.get('/api/admin/expired', () => HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 })),
      http.get('/api/admin/boom', () => HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 })),
    );
    expect(await api.get('/admin/ping')).toEqual({ ok: true });
    expect(auth).toBe('Bearer tok');
    const published: ApiError[] = [];
    const sub = globalErrors$.subscribe((e) => published.push(e));
    await expect(api.get('/admin/boom')).rejects.toMatchObject({ status: 500 });
    expect(published.map((e) => e.status)).toEqual([500]);
    sub.unsubscribe();
    await expect(api.get('/admin/expired')).rejects.toMatchObject({ status: 401 });
    expect(useSessionStore.getState()).toMatchObject({ status: 'anonymous', endReason: 'expired' });
  });

  it('maps a non-JSON error body to an ApiError with the status text', async () => {
    const client = createHttpClient({
      baseUrl: '',
      getAccessToken: () => null,
      refresh: () => Promise.resolve(null),
      onSessionExpired: () => undefined,
      fetchImpl: () => Promise.resolve(new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' })),
    });
    await expect(client.get('/x')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR', message: 'Bad Gateway' });
  });
});

describe('query client defaults (ADR-0004)', () => {
  it('retries network/5xx errors up to twice but never 4xx', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
    expect(retry(0, new ApiError(500, 'INTERNAL_ERROR', 'x'))).toBe(true);
    expect(retry(1, ApiError.network())).toBe(true);
    expect(retry(2, new Error('x'))).toBe(false);
  });
});

describe('hooks', () => {
  it('useObservable follows the source and unsubscribes on unmount', () => {
    const source = new Subject<number>();
    const { result, unmount } = renderHook(() => useObservable(source, 0));
    expect(result.current).toBe(0);
    act(() => source.next(5));
    expect(result.current).toBe(5);
    unmount();
    expect(source.observed).toBe(false);
  });

  it('useUnsavedChangesPrompt asks before leaving a dirty form and guards tab close (02-SRS §4.1)', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    function Form({ dirty }: { dirty: boolean }) {
      useUnsavedChangesPrompt(dirty);
      return <Link to="/elsewhere">leave</Link>;
    }
    const router = createMemoryRouter(
      [
        { path: '/form', element: <Form dirty /> },
        { path: '/clean', element: <Form dirty={false} /> },
        { path: '/elsewhere', element: <p>left</p> },
      ],
      { initialEntries: ['/form'] },
    );
    render(<RouterProvider router={router} />);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    confirm.mockReturnValueOnce(false);
    act(() => screen.getByText('leave').click());
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe('/form');
    confirm.mockReturnValueOnce(true);
    act(() => screen.getByText('leave').click());
    expect(await screen.findByText('left')).toBeInTheDocument();
    confirm.mockRestore();
  });
});

describe('utilities', () => {
  afterEach(() => vi.restoreAllMocks());

  it('formatRelative says "now" for the current instant', () => {
    const now = new Date('2026-05-01T00:00:00Z');
    expect(formatRelative(now, now, 'en')).toBe('now');
  });

  it('preferences fail soft when storage is unavailable (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(preferences.get('theme')).toBeNull();
    expect(() => preferences.set('theme', 'dark')).not.toThrow();
  });

  it('ui store restores a remembered theme on start-up', async () => {
    window.localStorage.setItem('cms:theme', 'dark');
    vi.resetModules();
    const { useUiStore } = await import('./stores/ui.store');
    expect(useUiStore.getState().themeMode).toBe('dark');
    window.localStorage.removeItem('cms:theme');
  });
});
