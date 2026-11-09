import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ADMIN, aMedia, AUTHOR, EDITOR } from '../../../../test/mocks/fake-api';
import { dialogsGone, renderPage } from '../../../../test/utils/app';
import { MediaLibraryPage } from './MediaLibraryPage';

const png = (name: string) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });

describe('MediaLibraryPage (UR-U05, UR-E04, FR-MEDIA-*)', () => {
  it('FR-MEDIA-03: shows the grid (images and PDFs), searches and filters by type', async () => {
    const { user, api } = renderPage(<MediaLibraryPage />, {
      user: EDITOR,
      seed: (a) => a.state.media.push(aMedia({ filename: 'hero.png', altText: 'Hero' }), aMedia({ filename: 'report.pdf', mimeType: 'application/pdf', altText: null, variants: {} })),
    });
    expect(await screen.findByRole('button', { name: 'Hero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'report.pdf' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'hero');
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes('search=hero'))).toBe(true));
    await user.click(screen.getByRole('combobox', { name: 'All types' }));
    await user.click(await screen.findByRole('option', { name: 'Documents' }));
    await waitFor(() => expect(api.state.requests.some((r) => r.url.includes('kind=document'))).toBe(true));
    expect(await screen.findByText('No media yet')).toBeInTheDocument();
  });

  it('paginates large libraries', async () => {
    const { user, api } = renderPage(<MediaLibraryPage />, {
      user: EDITOR,
      seed: (a) => {
        for (let i = 0; i < 50; i++) a.state.media.push(aMedia({ filename: `f${i}.png`, altText: `Image ${i}` }));
      },
    });
    await screen.findByRole('button', { name: 'Image 0' });
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(await screen.findByRole('button', { name: 'Image 49' })).toBeInTheDocument();
    expect(api.state.requests.some((r) => r.url.includes('page=2'))).toBe(true);
  });

  it('FR-MEDIA-06: edits alt text and caption in the details drawer and copies the URL', async () => {
    const { user, api, toasts } = renderPage(<MediaLibraryPage />, {
      user: AUTHOR,
      seed: (a) => a.state.media.push(aMedia({ id: 'm1', filename: 'hero.png', altText: 'Hero', uploadedBy: AUTHOR.id })),
    });
    await user.click(await screen.findByRole('button', { name: 'Hero' }));
    const alt = await screen.findByRole('textbox', { name: 'Alt text' });
    expect(screen.getByText(/Dimensions: 800×600/)).toBeInTheDocument();
    await user.clear(alt);
    await user.type(alt, 'New alt');
    await user.type(screen.getByRole('textbox', { name: 'Caption' }), 'A caption');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.state.media[0]).toMatchObject({ altText: 'New alt', caption: 'A caption' }));
    expect(toasts()).toContain('Saved');
    await user.click(screen.getByRole('button', { name: 'Copy URL' }));
    expect(await navigator.clipboard.readText()).toBe(api.state.media[0]?.url); // user-event's clipboard stub
    // the uploader may delete their own file
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete this file?' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.state.media).toHaveLength(0));
  });

  it('FR-MEDIA-07: referenced files cannot be deleted except by an Admin (force)', async () => {
    const seed = (a: Parameters<NonNullable<Parameters<typeof renderPage>[1]>['seed'] & object>[0]) =>
      a.state.media.push(aMedia({ id: 'm2', filename: 'used.pdf', mimeType: 'application/pdf', altText: 'Used', referenced: true, width: null, height: null }));
    const editor = renderPage(<MediaLibraryPage />, { user: EDITOR, seed });
    await editor.user.click(await screen.findByRole('button', { name: 'Used' }));
    expect(await screen.findByText('Used by content — it cannot be deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    editor.unmount();

    const admin = renderPage(<MediaLibraryPage />, { user: ADMIN, seed });
    await admin.user.click(await screen.findByRole('button', { name: 'Used' }));
    await admin.user.click(await screen.findByRole('button', { name: 'Delete anyway (Admin)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this file?' });
    await admin.user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await admin.user.click(await screen.findByRole('button', { name: 'Delete anyway (Admin)' }));
    await admin.user.click(within(await screen.findByRole('dialog', { name: 'Delete this file?' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(admin.api.state.requests.some((r) => r.method === 'DELETE' && r.url.includes('force=true'))).toBe(true));
  });

  it('shows a toast when saving metadata fails, and closes the drawer', async () => {
    const { user, api, toasts } = renderPage(<MediaLibraryPage />, {
      user: EDITOR,
      seed: (a) => a.state.media.push(aMedia({ id: 'm3', altText: 'Pic' })),
    });
    await user.click(await screen.findByRole('button', { name: 'Pic' }));
    api.failNext('PATCH', /\/media\/m3$/, 403);
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(toasts()).toContain("You don't have permission to do that."));
    api.failNext('DELETE', /\/media\/m3$/, 409, { error: { code: 'CONFLICT', message: 'In use' } });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete this file?' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(toasts()).toContain('In use'));
    await dialogsGone();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Alt text' })).not.toBeInTheDocument());
  });

  it('FR-MEDIA-04: uploads picked and dropped files with progress, then refreshes the grid', async () => {
    const { user, api, toasts } = renderPage(<MediaLibraryPage />, { user: EDITOR });
    expect(await screen.findByText('No media yet')).toBeInTheDocument();
    const input = screen.getByTestId('media-file-input');
    const click = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(click).toHaveBeenCalled();
    await user.upload(input, png('picked.png'));
    await waitFor(() => expect(toasts()).toContain('Uploaded picked.png'));
    expect(await screen.findByRole('button', { name: 'A photo' })).toBeInTheDocument();

    const zone = screen.getByTestId('media-dropzone');
    fireEvent.dragOver(zone);
    expect(screen.getByText('Drop files to upload')).toBeInTheDocument();
    fireEvent.dragLeave(zone);
    expect(screen.queryByText('Drop files to upload')).not.toBeInTheDocument();
    api.failNext('POST', /\/media\/presign$/, 422, { error: { code: 'VALIDATION_ERROR', message: 'Unsupported file type' } });
    fireEvent.drop(zone, { dataTransfer: { files: [png('dropped.png')] } });
    await waitFor(() => expect(toasts()).toContain('dropped.png: Unsupported file type'));
  });

  it('renders nothing in the grid area when the list fails, and works signed out', async () => {
    const { api } = renderPage(<MediaLibraryPage />, { seed: (a) => a.failNext('GET', /\/media$/, 500) });
    await waitFor(() => expect(api.state.requests.length).toBeGreaterThan(0));
    expect(screen.queryByText('No media yet')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Media library' })).toBeInTheDocument();
  });
});

