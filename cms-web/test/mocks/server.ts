import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** 06-TEST-STRATEGY §8.5: MSW mocks the admin API for component/integration tests. */
export const user = { id: '00000000-0000-4000-8000-000000000001', email: 'eve@example.com', name: 'Eve', role: 'editor' as const };

export const handlers = [
  http.post('/api/admin/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.password !== 'correct-horse-42') {
      return HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, { status: 401 });
    }
    return HttpResponse.json({ accessToken: 'tok', expiresIn: 900, user });
  }),
  http.post('/api/admin/auth/refresh', () =>
    HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } }, { status: 401 }),
  ),
];

export const server = setupServer(...handlers);
