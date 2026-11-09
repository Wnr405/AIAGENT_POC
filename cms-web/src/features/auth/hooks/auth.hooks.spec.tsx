import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { useSessionStore } from '../../../shared/stores/session.store';
import { useLogout } from './auth.hooks';

describe('useLogout (FR-AUTH-09)', () => {
  it('revokes the refresh cookie with the CSRF header, clears the session and caches, and goes to sign in', async () => {
    let csrf: string | null = null;
    server.use(
      http.post('/api/admin/auth/logout', ({ request }) => {
        csrf = request.headers.get('X-CMS-CSRF');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    useSessionStore.getState().setSession('tok', { id: 'u', email: 'e@x.com', name: 'E', role: 'editor' });
    const qc = new QueryClient();
    qc.setQueryData(['secret'], 1);
    let logout: ReturnType<typeof useLogout> | undefined;
    function Probe() {
      logout = useLogout();
      return null;
    }
    const router = createMemoryRouter([
      { path: '/', element: <Probe /> },
      { path: '/login', element: <p>login</p> },
    ]);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    renderHook(() => null, { wrapper: () => wrapper({ children: <RouterProvider router={router} /> }) });
    await act(async () => {
      await logout?.('idle');
    });
    expect(csrf).toBe('1');
    expect(useSessionStore.getState()).toMatchObject({ status: 'anonymous', endReason: 'idle' });
    expect(qc.getQueryData(['secret'])).toBeUndefined();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
