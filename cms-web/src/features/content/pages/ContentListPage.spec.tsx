import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aContent, AUTHOR, EDITOR } from '../../../../test/mocks/fake-api';
import { renderPage } from '../../../../test/utils/app';
import { ContentListPage } from './ContentListPage';

const PATH = '/content/:type';

describe('ContentListPage (UR-E05, FR-CONTENT-10/11, 03-DESIGN §12.3)', () => {
  it('FR-CONTENT-10: lists items with status chips and opens one on click', async () => {
    const { user } = renderPage(<ContentListPage />, {
      path: PATH,
      route: '/content/articles',
      user: EDITOR,
      seed: (api) =>
        api.state.contents.push(
          aContent({ id: 'c1', title: 'First post', status: 'published' }),
          aContent({ title: 'Scheduled post', scheduledAt: '2030-01-01T00:00:00Z' }),
        ),
    });
    expect(await screen.findByText('First post')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Articles' })).toBeInTheDocument();
    const row = screen.getByText('First post').closest('tr') as HTMLElement;
    expect(within(row).getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    await user.click(screen.getByText('First post'));
    expect(await screen.findByTestId('location')).toHaveTextContent('/content/articles/c1');
  });

  it('shows the empty state, and the filtered empty state once a filter is applied', async () => {
    const { user, api } = renderPage(<ContentListPage />, { path: PATH, route: '/content/pages', user: EDITOR });
    expect(await screen.findByText('No content yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pages' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    expect(await screen.findByText('Nothing matches these filters.')).toBeInTheDocument();
    expect(api.state.requests.some((r) => r.url.includes('status=draft'))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Mine' }));
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes(`author_id=${EDITOR.id}`))).toBe(true));
  });

  it('FR-CONTENT-11: debounced title search, sorting and pagination drive the query', async () => {
    const { user, api } = renderPage(<ContentListPage />, {
      path: PATH,
      route: '/content/articles',
      user: EDITOR,
      seed: (a) => {
        for (let i = 1; i <= 30; i++) a.state.contents.push(aContent({ title: `Post ${i}` }));
      },
    });
    expect(await screen.findByText('Post 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(await screen.findByText('Post 26')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Title' }));
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes('sort=title') && r.url.includes('order=asc'))).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Title' }));
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes('sort=title') && r.url.includes('order=desc'))).toBe(true));
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'Post 3');
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes('search=Post+3'))).toBe(true));
    expect(await screen.findByText('Post 30')).toBeInTheDocument();
  });

  it('UR-E03: editors can delete from the row menu after confirming; edit opens the item', async () => {
    const { user, api } = renderPage(<ContentListPage />, {
      path: PATH,
      route: '/content/articles',
      user: EDITOR,
      seed: (a) =>
        a.state.contents.push(aContent({ id: 'c9', title: 'Doomed' }), aContent({ title: 'Other', author: { id: AUTHOR.id, name: null } })),
    });
    await user.click(await screen.findByRole('button', { name: 'Actions: Doomed' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Actions: Doomed' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.state.contents.map((c) => c.title)).toEqual(['Other']));
    await user.click(await screen.findByRole('button', { name: 'Actions: Other' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(await screen.findByTestId('location')).toHaveTextContent(/\/content\/articles\/.+/);
  });

  it('authors see no delete menu and no "Mine" filter; the new button opens the editor', async () => {
    const { user } = renderPage(<ContentListPage />, {
      path: PATH,
      route: '/content/articles',
      user: AUTHOR,
      seed: (a) => a.state.contents.push(aContent({ title: 'Mine only' })),
    });
    expect(await screen.findByText('Mine only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mine' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New article' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/content/articles/new');
  });

  it('defaults to articles without a type in the URL and works signed out', async () => {
    renderPage(<ContentListPage />, { path: '/content' });
    expect(await screen.findByRole('heading', { name: 'Articles' })).toBeInTheDocument();
  });
});
