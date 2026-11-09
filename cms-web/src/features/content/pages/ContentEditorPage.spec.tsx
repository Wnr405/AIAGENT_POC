import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aContent, aMedia, AUTHOR, EDITOR, doc } from '../../../../test/mocks/fake-api';
import { dialogsGone, renderPage } from '../../../../test/utils/app';
import { ContentEditorPage } from './ContentEditorPage';

const PATHS = ['/content/:type/new', '/content/:type/:id'];

describe('ContentEditorPage (UR-U01..U03, FR-CONTENT-*, 03-DESIGN §12.4)', () => {
  it('UR-U01: creates an article from a title, auto-slugs on blur and moves to the saved URL', async () => {
    const { user, api, toasts, router } = renderPage(<ContentEditorPage />, { path: PATHS, route: '/content/articles/new', user: AUTHOR });
    expect(screen.getByText('New article')).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, 'Launch Day');
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Slug' })).toHaveValue('launch-day');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.state.contents).toHaveLength(1));
    expect(api.state.requests.find((r) => r.method === 'POST')?.body).toMatchObject({
      type: 'article',
      title: 'Launch Day',
      slug: 'launch-day',
      tags: [],
      category: null,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/content/articles/${api.state.contents[0]?.id ?? ''}`));
    expect(toasts()).toContain('Created');
  });

  it('validates the title and slug inline before saving', async () => {
    const { user, api } = renderPage(<ContentEditorPage />, { path: PATHS, route: '/content/pages/new', user: AUTHOR });
    expect(screen.getByText('New page')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Slug' }), 'Bad Slug!');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Required')).toBeInTheDocument();
    expect(screen.getAllByText(/Lowercase letters, digits and hyphens/).length).toBeGreaterThan(0);
    expect(api.state.requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('FR-CONTENT-04: the owner edits and submits a draft; server field errors land on the form', async () => {
    const { user, api, toasts } = renderPage(<ContentEditorPage />, {
      path: PATHS,
      route: '/content/articles/c1',
      user: AUTHOR,
      seed: (a) => a.state.contents.push(aContent({ id: 'c1', title: 'My draft', author: { id: AUTHOR.id, name: 'Al' } })),
    });
    const title = await screen.findByDisplayValue('My draft');
    expect(screen.getByRole('link', { name: 'Version history' })).toHaveAttribute('href', '/content/articles/c1/versions');
    api.failNext('PATCH', /\/content\/c1$/, 422, {
      error: { code: 'VALIDATION_ERROR', message: 'Slug taken', details: { field: 'slug' } },
    });
    await user.type(title, ' v2');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Slug taken')).toBeInTheDocument();
    expect(toasts()).toContain('Slug taken');

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(api.state.contents[0]?.status).toBe('in_review'));
    expect(api.state.requests.filter((r) => r.method === 'PATCH').length).toBeGreaterThanOrEqual(2); // saved before submitting
    expect(toasts()).toContain('Submitted for review');
  });

  it('BR-02: an editor publishes, unpublishes (with confirmation) and archives', async () => {
    const { user, api } = renderPage(<ContentEditorPage />, {
      path: PATHS,
      route: '/content/articles/c2',
      user: EDITOR,
      seed: (a) =>
        a.state.contents.push(aContent({ id: 'c2', title: 'Ready', status: 'in_review', seo: { title: null, description: 'Desc' } })),
    });
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.state.contents[0]?.status).toBe('published'));
    await user.click(await screen.findByRole('button', { name: 'Unpublish' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await dialogsGone();
    await user.click(await screen.findByRole('button', { name: 'Unpublish' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(api.state.contents[0]?.status).toBe('unpublished'));
    await dialogsGone();
    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(api.state.contents[0]?.status).toBe('archived'));
  });

  it('FR-CONTENT-07: schedules and cancels a schedule; a failed transition shows a toast', async () => {
    const { user, api, toasts } = renderPage(<ContentEditorPage />, {
      path: PATHS,
      route: '/content/articles/c3',
      user: EDITOR,
      seed: (a) => a.state.contents.push(aContent({ id: 'c3', title: 'Later' })),
    });
    await user.click(await screen.findByRole('button', { name: 'Schedule…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Schedule publish' });
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(api.state.contents[0]?.scheduledAt).not.toBeNull());
    expect(await screen.findByText(/Scheduled for/)).toBeInTheDocument();
    await dialogsGone();
    await user.click(await screen.findByRole('button', { name: 'Cancel schedule' }));
    await waitFor(() => expect(api.state.contents[0]?.scheduledAt).toBeNull());

    api.failNext('POST', /\/content\/c3\/publish$/, 409, { error: { code: 'CONFLICT', message: 'Already published elsewhere' } });
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(toasts()).toContain('Already published elsewhere'));
    api.failNext('POST', /\/content\/c3\/schedule$/, 409, { error: { code: 'CONFLICT', message: 'Cannot schedule' } });
    await user.click(await screen.findByRole('button', { name: 'Schedule…' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Schedule publish' })).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(toasts()).toContain('Cannot schedule'));
    await user.click(within(screen.getByRole('dialog', { name: 'Schedule publish' })).getByRole('button', { name: 'Cancel' }));
  });

  it('FR-CONTENT-13: deletes after confirmation and returns to the list', async () => {
    const { user, api } = renderPage(<ContentEditorPage />, {
      path: PATHS,
      route: '/content/pages/p1',
      user: EDITOR,
      seed: (a) => a.state.contents.push(aContent({ id: 'p1', type: 'page', title: 'About' })),
    });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await dialogsGone();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/content/pages');
    expect(api.state.contents).toHaveLength(0);
  });

  it('FR-SEO-01/02, FR-MEDIA-07: SEO fields, category, tags and images are sent on save', async () => {
    const { user, api } = renderPage(<ContentEditorPage />, {
      path: PATHS,
      route: '/content/articles/c4',
      user: EDITOR,
      seed: (a) => {
        a.state.media.push(aMedia({ id: 'm1', filename: 'hero.png', altText: 'Hero' }));
        a.state.contents.push(
          aContent({ id: 'c4', title: 'Rich', body: doc('Some body text'), featuredImageId: 'm1', category: 'News', tags: ['old'] }),
        );
      },
    });
    await screen.findByDisplayValue('Rich');
    expect(await screen.findByRole('img', { name: 'Hero' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Meta title' }), 'SEO title');
    await user.type(screen.getByRole('textbox', { name: 'Meta description' }), 'SEO description');
    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'fresh{Enter}');
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Guides' }));
    const [removeFeatured] = screen.getAllByRole('button', { name: 'Remove image' });
    await user.click(removeFeatured as HTMLElement);
    const [selectSocial] = screen.getAllByRole('button', { name: 'Select image' });
    await user.click(selectSocial as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Hero' }));
    await dialogsGone();
    await user.click(await screen.findByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.state.requests.some((r) => r.method === 'PATCH')).toBe(true));
    expect(api.state.requests.find((r) => r.method === 'PATCH')?.body).toMatchObject({
      seoTitle: 'SEO title',
      seoDescription: 'SEO description',
      tags: ['old', 'fresh'],
      category: 'Guides',
      featuredImageId: null,
      socialImageId: 'm1',
    });
  });

  it('shows an error when the item cannot be loaded', async () => {
    renderPage(<ContentEditorPage />, { path: PATHS, route: '/content/articles/missing', user: EDITOR });
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found.');
  });

  it('a page saved without a slug lets the server generate one; SEO field errors from the server are shown', async () => {
    const { user, api } = renderPage(<ContentEditorPage />, { path: PATHS, route: '/content/pages/new', user: EDITOR });
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, 'No slug');
    fireEvent.submit(title.closest('form') as HTMLFormElement); // submit without blurring the title
    await waitFor(() => expect(api.state.contents).toHaveLength(1));
    const body = api.state.requests.find((r) => r.method === 'POST')?.body as Record<string, unknown>;
    expect(body['slug']).toBeUndefined();
    expect(body).not.toHaveProperty('tags');
    api.failNext('PATCH', /\/content\//, 422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Too long',
        details: {
          fields: [
            { field: 'seoTitle', message: 'Meta title too long' },
            { field: 'unknown', message: 'ignored' },
          ],
        },
      },
    });
    await user.type(await screen.findByRole('textbox', { name: 'Meta title' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Meta title too long')).toBeInTheDocument();
  });

  it('renders for a signed-out visitor without lifecycle rights', async () => {
    renderPage(<ContentEditorPage />, { path: '/editor', route: '/editor' });
    expect(await screen.findByText('New article')).toBeInTheDocument();
  });
});
