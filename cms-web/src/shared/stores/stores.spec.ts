import { beforeEach, describe, expect, it } from 'vitest';
import { canPublish, isAdmin, selectRole, useSessionStore } from './session.store';
import { notify, useUiStore } from './ui.store';

describe('session store', () => {
  beforeEach(() => useSessionStore.setState({ accessToken: null, user: null, status: 'unknown', endReason: null }));

  it('keeps the access token in memory and clears with a reason', () => {
    useSessionStore.getState().setSession('tok', { id: 'u', email: 'a@b.c', name: 'A', role: 'editor' });
    expect(useSessionStore.getState()).toMatchObject({ accessToken: 'tok', status: 'authenticated' });
    expect(selectRole(useSessionStore.getState())).toBe('editor');
    useSessionStore.getState().clear('idle');
    expect(useSessionStore.getState()).toMatchObject({ accessToken: null, user: null, status: 'anonymous', endReason: 'idle' });
  });

  it('role helpers mirror the permission matrix', () => {
    expect([canPublish('admin'), canPublish('editor'), canPublish('author'), canPublish(null)]).toEqual([true, true, false, false]);
    expect([isAdmin('admin'), isAdmin('editor')]).toEqual([true, false]);
  });
});

describe('ui store', () => {
  it('queues and dismisses toasts', () => {
    useUiStore.setState({ toasts: [] });
    notify.success('a');
    notify.error('b');
    notify.info('c');
    const [first, second, third] = useUiStore.getState().toasts;
    expect([first?.severity, second?.severity, third?.severity]).toEqual(['success', 'error', 'info']);
    useUiStore.getState().dismiss(first!.id);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['b', 'c']);
  });

  it('persists the theme preference', () => {
    useUiStore.getState().setThemeMode('dark');
    expect(window.localStorage.getItem('cms:theme')).toBe('dark');
  });
});
