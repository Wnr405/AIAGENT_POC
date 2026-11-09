import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { buildQuery, createHttpClient, type HttpClientOptions } from './http-client';
import { errorMessage } from './error-message';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function client(responses: Response[], over: Partial<HttpClientOptions> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    return next ? Promise.resolve(next) : Promise.reject(new TypeError('offline'));
  });
  let token: string | null = 'tok-1';
  const opts: HttpClientOptions = {
    baseUrl: '/api',
    getAccessToken: () => token,
    refresh: vi.fn(() => {
      token = 'tok-2';
      return Promise.resolve('tok-2');
    }),
    onSessionExpired: vi.fn(),
    onServerError: vi.fn(),
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...over,
  };
  return { http: createHttpClient(opts), calls, opts };
}

describe('http client (04-ARCH §5.5.2, §6.3)', () => {
  it('sends the bearer token, JSON body and credentials', async () => {
    const { http, calls } = client([json(200, { ok: true })]);
    expect(await http.post('/admin/content', { title: 'x' })).toEqual({ ok: true });
    expect(calls[0]?.url).toBe('/api/admin/content');
    expect(calls[0]?.init.credentials).toBe('include');
    expect((calls[0]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-1');
    expect(calls[0]?.init.body).toBe('{"title":"x"}');
  });

  it('builds query strings without empty values', () => {
    expect(buildQuery({ a: 1, b: '', c: undefined, d: null, e: 'x y' })).toBe('?a=1&e=x+y');
    expect(buildQuery()).toBe('');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const { http, calls, opts } = client([json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }), json(200, [1])]);
    expect(await http.get('/admin/users')).toEqual([1]);
    expect(opts.refresh).toHaveBeenCalledTimes(1);
    expect((calls[1]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-2');
  });

  it('shares one refresh between concurrent 401s', async () => {
    const unauthorized = () => json(401, {});
    const { http, opts } = client([unauthorized(), unauthorized(), json(200, 1), json(200, 2)]);
    await Promise.all([http.get('/a'), http.get('/b')]);
    expect(opts.refresh).toHaveBeenCalledTimes(1);
  });

  it('ends the session when refresh fails', async () => {
    const { http, opts } = client([json(401, { error: { code: 'UNAUTHORIZED', message: 'Session expired' } })], {
      refresh: vi.fn(() => Promise.resolve(null)),
    });
    await expect(http.get('/admin/users')).rejects.toMatchObject({ status: 401 });
    expect(opts.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('never tries to refresh for auth endpoints', async () => {
    const { http, opts } = client([json(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } })]);
    await expect(http.post('/admin/auth/login', {})).rejects.toMatchObject({ message: 'Invalid email or password' });
    expect(opts.refresh).not.toHaveBeenCalled();
  });

  it('maps error envelopes, Retry-After and 5xx reporting', async () => {
    const { http, opts } = client([
      json(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { 'Retry-After': '12' }),
      json(500, {}),
    ]);
    const err = (await http.get('/x').catch((e: unknown) => e)) as ApiError;
    expect([err.status, err.code, err.retryAfterSeconds]).toEqual([429, 'RATE_LIMITED', 12]);
    expect(errorMessage(err)).toBe('Too many requests. Try again in 12 seconds.');
    await expect(http.get('/y')).rejects.toMatchObject({ status: 500, code: 'HTTP_ERROR' });
    expect(opts.onServerError).toHaveBeenCalledTimes(1);
  });

  it('reports network failures as status 0', async () => {
    const { http, opts } = client([]);
    await expect(http.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(opts.onServerError).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for 204 and empty bodies; download returns a blob', async () => {
    const { http } = client([new Response(null, { status: 204 }), new Response('', { status: 202 }), new Response('a,b', { status: 200 })]);
    await expect(http.delete('/x')).resolves.toBeUndefined();
    expect(await http.post('/y')).toBeUndefined();
    expect(await (await http.download('/z.csv')).text()).toBe('a,b');
  });
});

describe('ApiError.fieldErrors (04-ARCH §6.4)', () => {
  it('merges single-field and schema errors, first message wins', () => {
    const e = new ApiError(422, 'VALIDATION_ERROR', 'Slug taken', {
      field: 'slug',
      fields: [{ field: 'slug', message: 'x' }, { field: 'title', message: 'Required' }, { bad: 1 }],
    });
    expect(e.fieldErrors()).toEqual({ slug: 'Slug taken', title: 'Required' });
    expect(new ApiError(400, 'X', 'y').fieldErrors()).toEqual({});
  });
  it('errorMessage maps statuses to friendly text', () => {
    expect(errorMessage(new Error('x'))).toBe('Something went wrong.');
    expect(errorMessage(ApiError.network())).toBe("Couldn't reach the server.");
    expect(errorMessage(new ApiError(403, 'F', 'x'))).toBe("You don't have permission to do that.");
    expect(errorMessage(new ApiError(404, 'N', 'x'))).toBe('Not found.');
    expect(errorMessage(new ApiError(409, 'C', 'Cannot publish content in status "archived"'))).toBe(
      'Cannot publish content in status "archived"',
    );
    expect(errorMessage(new ApiError(429, 'R', 'x'))).toBe('Too many requests. Try again in 60 seconds.');
    expect(errorMessage(new ApiError(500, 'I', 'x'))).toBe('Something went wrong.');
  });
});
