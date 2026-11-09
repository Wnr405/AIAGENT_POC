import { create } from 'zustand';
import { preferences } from '../utils/storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export interface Toast {
  id: number;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  action?: { label: string; onClick: () => void };
}

interface UiState {
  themeMode: ThemeMode;
  toasts: Toast[];
  setThemeMode: (m: ThemeMode) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const storedMode = preferences.get('theme');

/** ADR-0005: Zustand for global UI state only. */
export const useUiStore = create<UiState>()((set) => ({
  themeMode: storedMode === 'light' || storedMode === 'dark' ? storedMode : 'system',
  toasts: [],
  setThemeMode: (themeMode) => {
    preferences.set('theme', themeMode);
    set({ themeMode });
  },
  toast: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for effects (mutations' onSuccess / onError). */
export const notify = {
  success: (message: string) => useUiStore.getState().toast({ message, severity: 'success' }),
  error: (message: string, action?: Toast['action']) => useUiStore.getState().toast({ message, severity: 'error', action }),
  info: (message: string) => useUiStore.getState().toast({ message, severity: 'info' }),
};
