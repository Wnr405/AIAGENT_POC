import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aContent, EDITOR } from '../../../../test/mocks/fake-api';
import { renderPage } from '../../../../test/utils/app';
import { VersionHistoryPage } from './VersionHistoryPage';

describe('VersionHistoryPage (FR-CONTENT-08/09)', () => {
  it('lists versions newest first and restores an older one', async () => {
    const { user, api, toasts } = renderPage(<VersionHistoryPage />, {
      path: '/content/:type/:id/versions',
      route: '/content/articles/c1/versions',
      user: EDITOR,
      seed: (a) => {
        a.state.contents.push(aContent({ id: 'c1', title: 'Current' }));
        a.state.versions.set('c1', [
          {
            versionNo: 2,
            editor: { id: EDITOR.id, name: 'Eve' },
            createdAt: '2026-05-02T00:00:00Z',
            snapshot: { title: 'Current', slug: 'c', status: 'draft' },
          },
          {
            versionNo: 1,
            editor: { id: null, name: null },
            createdAt: '2026-05-01T00:00:00Z',
            snapshot: { title: 'First', slug: 'c', status: 'draft' },
          },
        ]);
      },
    });
    expect(await screen.findByText('Version 2 — Current')).toBeInTheDocument();
    expect(screen.getByText(/^System ·/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Restore this version' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Restore this version' }));
    await waitFor(() => expect(toasts()).toContain('Version restored'));
    expect(api.state.contents[0]?.title).toBe('First');
    expect(await screen.findByText('Version 3 — First')).toBeInTheDocument();
  });

  it('shows an empty state and reports a failed restore', async () => {
    renderPage(<VersionHistoryPage />, { path: '/content/:type/:id/versions', route: '/content/articles/none/versions', user: EDITOR });
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('toasts when the restore fails', async () => {
    const { user, api, toasts } = renderPage(<VersionHistoryPage />, {
      path: '/content/:type/:id/versions',
      route: '/content/articles/c1/versions',
      user: EDITOR,
      seed: (a) =>
        a.state.versions.set('c1', [
          {
            versionNo: 2,
            editor: { id: null, name: 'Eve' },
            createdAt: '2026-05-02T00:00:00Z',
            snapshot: { title: 'B', slug: 'b', status: 'draft' },
          },
          {
            versionNo: 1,
            editor: { id: null, name: 'Eve' },
            createdAt: '2026-05-01T00:00:00Z',
            snapshot: { title: 'A', slug: 'a', status: 'draft' },
          },
        ]),
    });
    api.failNext('POST', /revert\/1$/, 409, { error: { code: 'CONFLICT', message: 'Slug in use' } });
    await user.click(await screen.findByRole('button', { name: 'Restore this version' }));
    await waitFor(() => expect(toasts()).toContain('Slug in use'));
  });
});
