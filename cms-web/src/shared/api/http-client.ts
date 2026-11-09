import { ApiError, type ErrorBody } from './api-error';

export interface HttpClientOptions {
  baseUrl: string;
  getAccessToken: () => string | null;
  /** Single attempt to obtain a new access token (refresh cookie). Null → session is over. */
  refresh: () => Promise<string | null>;
  onSessionExpired: () => void;
  onServerError?: (err: ApiError) => void;
  fetchImpl?: typeof fetch;
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export interface HttpClient {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T = void>(path: string, query?: Query): Promise<T>;
  download(path: string, query?: Query): Promise<Blob>;
}

export function buildQuery(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<ErrorBody> = {};
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    /* non-JSON error body */
  }
  const retry = res.headers.get('Retry-After');
  return new ApiError(
    res.status,
    body.error?.code ?? 'HTTP_ERROR',
    body.error?.message ?? res.statusText,
    body.error?.details ?? {},
    retry ? Number(retry) : undefined,
  );
}

/**
 * 04-ARCH §5.5.2 API gateway: the only place that calls fetch for the admin API.
 * Adds the bearer token, maps errors to ApiError, and on a 401 refreshes once
 * (single-flight across concurrent requests) and retries (§6.3).
 */
export function createHttpClient(o: HttpClientOptions): HttpClient {
  const doFetch = o.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let refreshing: Promise<string | null> | null = null;

  const refreshOnce = (): Promise<string | null> => {
    refreshing ??= o.refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  /** fetch with auth/JSON headers; network failures become ApiError.network(). */
  async function rawFetch(method: string, path: string, body: unknown): Promise<Response> {
    const token = o.getAccessToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      return await doFetch(`${o.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'include',
      });
    } catch {
      const err = ApiError.network();
      o.onServerError?.(err);
      throw err;
    }
  }

  async function send(method: string, path: string, body: unknown, retried: boolean): Promise<Response> {
    const res = await rawFetch(method, path, body);
    if (res.status === 401 && !retried && !path.startsWith('/admin/auth/')) {
      const fresh = await refreshOnce();
      if (fresh) return send(method, path, body, true);
      o.onSessionExpired();
    }
    if (!res.ok) {
      const err = await toApiError(res);
      if (err.status >= 500) o.onServerError?.(err);
      throw err;
    }
    return res;
  }

  async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await send(method, path, body, false);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    get: (path, query) => json('GET', `${path}${buildQuery(query)}`),
    post: (path, body) => json('POST', path, body),
    patch: (path, body) => json('PATCH', path, body),
    delete: (path, query) => json('DELETE', `${path}${buildQuery(query)}`),
    download: async (path, query) => (await send('GET', `${path}${buildQuery(query)}`, undefined, false)).blob(),
  };
}
