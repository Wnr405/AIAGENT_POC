import { api } from '../../../shared/api/client';
import { API_BASE, CSRF_HEADERS } from '../../../shared/api/session';
import type { SessionUser } from '../../../shared/stores/session.store';

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

export const authApi = {
  login: (email: string, password: string) => api.post<SessionResponse>('/admin/auth/login', { email, password }),
  logout: () =>
    fetch(`${API_BASE}/admin/auth/logout`, { method: 'POST', credentials: 'include', headers: { ...CSRF_HEADERS } }).then(() => undefined),
  forgot: (email: string) => api.post('/admin/auth/password/forgot', { email }),
  reset: (token: string, password: string) => api.post('/admin/auth/password/reset', { token, password }),
  acceptInvite: (token: string, password: string) => api.post('/admin/auth/invite/accept', { token, password }),
};
