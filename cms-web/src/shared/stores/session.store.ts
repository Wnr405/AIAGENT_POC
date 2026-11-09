import { create } from 'zustand';

export type Role = 'admin' | 'editor' | 'author';
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface SessionState {
  /** Access token lives in memory only (04-ARCH §6.3); the refresh token is an httpOnly cookie. */
  accessToken: string | null;
  user: SessionUser | null;
  status: 'unknown' | 'authenticated' | 'anonymous';
  endReason: 'logout' | 'expired' | 'idle' | null;
  setSession: (token: string, user: SessionUser) => void;
  clear: (reason?: 'logout' | 'expired' | 'idle') => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  accessToken: null,
  user: null,
  status: 'unknown',
  endReason: null,
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated', endReason: null }),
  clear: (reason = 'logout') => set({ accessToken: null, user: null, status: 'anonymous', endReason: reason }),
}));

/** Selectors (pure) — UI decides what to show, the API decides what is allowed. */
export const selectUser = (s: SessionState) => s.user;
export const selectRole = (s: SessionState) => s.user?.role ?? null;
export const canPublish = (role: Role | null) => role === 'admin' || role === 'editor';
export const isAdmin = (role: Role | null) => role === 'admin';
