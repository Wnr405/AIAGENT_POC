import { useSessionStore, type SessionUser } from '../stores/session.store';

export const API_BASE = import.meta.env.VITE_PUBLIC_API_URL ?? '/api';
/** SEC-11: custom header required by /refresh and /logout (CSRF defence for the cookie). */
export const CSRF_HEADERS = { 'X-CMS-CSRF': '1' } as const;

interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

let inFlight: Promise<string | null> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Null when there is no session.
 * Single-flight: concurrent callers share one request. The server rotates the refresh token and treats a
 * reused one as theft (401 + cleared cookie), so two parallel requests with the same cookie would log the
 * user out — e.g. StrictMode running AuthGate's effect twice on reload.
 */
export function refreshSession(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  inFlight ??= requestRefresh(fetchImpl).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function requestRefresh(fetchImpl: typeof fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(`${API_BASE}/admin/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...CSRF_HEADERS },
    });
    if (!res.ok) {
      useSessionStore.getState().clear();
      return null;
    }
    const body = (await res.json()) as SessionResponse;
    useSessionStore.getState().setSession(body.accessToken, body.user);
    return body.accessToken;
  } catch {
    return null;
  }
}
