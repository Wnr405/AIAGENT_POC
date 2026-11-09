import { useSessionStore } from '../stores/session.store';
import { globalErrors$ } from '../streams/global-errors.stream';
import { createHttpClient } from './http-client';
import { API_BASE, refreshSession } from './session';

/** Singleton API client used by every feature's api/*.ts module. */
export const api = createHttpClient({
  baseUrl: API_BASE,
  getAccessToken: () => useSessionStore.getState().accessToken,
  refresh: () => refreshSession(),
  onSessionExpired: () => useSessionStore.getState().clear('expired'),
  onServerError: (err) => globalErrors$.next(err),
});
