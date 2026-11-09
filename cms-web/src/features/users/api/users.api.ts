import { api } from '../../../shared/api/client';
import type { Role } from '../../../shared/stores/session.store';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'invited' | 'active' | 'deactivated';
  lastLoginAt: string | null;
  createdAt: string;
}

export const usersApi = {
  list: (page: number, search?: string) =>
    api.get<{ data: UserRow[]; pagination: { total_pages: number } }>('/admin/users', { page, page_size: 25, search }),
  invite: (body: { email: string; name: string; role: Role }) => api.post<UserRow>('/admin/users', body),
  update: (id: string, body: { name?: string; role?: Role }) => api.patch<UserRow>(`/admin/users/${id}`, body),
  deactivate: (id: string) => api.post<UserRow>(`/admin/users/${id}/deactivate`),
  resetPassword: (id: string) => api.post(`/admin/users/${id}/reset-password`),
};
