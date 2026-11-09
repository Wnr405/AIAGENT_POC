import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { aMedia, EDITOR } from '../../../../test/mocks/fake-api';
import { renderPage } from '../../../../test/utils/app';
import type { RichTextDoc } from '../types/content.types';
import { Editor } from '@tiptap/react';
import { editorExtensions, RichTextEditor } from './RichTextEditor';

const initial: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] };

function setup(onChange = vi.fn(), revision = 'r1') {
  const page = renderPage(<RichTextEditor value={initial} revision={revision} onChange={onChange} />, {
    user: EDITOR,
    seed: (api) => api.state.media.push(aMedia({ id: 'm1', altText: 'Chart' })),
  });
  return { ...page, onChange };
}

const lastDoc = (fn: ReturnType<typeof vi.fn>) => JSON.stringify(fn.mock.calls.at(-1)?.[0] ?? null);

/** Select the whole document through ProseMirror's own Mod-a keymap. */
async function selectAll(user: ReturnType<typeof setup>['user']) {
  await user.click(screen.getByText('Hello'));
  await user.keyboard('{Control>}a{/Control}');
}

describe('RichTextEditor (FR-CONTENT-14/15, RK-02)', () => {
  it('renders the document and a labelled formatting toolbar', async () => {
    setup();
    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Body' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Body' })).toBeInTheDocument();
  });

  it('FR-CONTENT-15: every toolbar command changes the document', async () => {
    const { user, onChange } = setup();
    await screen.findByText('Hello');
    await selectAll(user);
    const commands = [
      ['Bold', '"bold"'],
      ['Italic', '"italic"'],
      ['Underline', '"underline"'],
      ['Heading 2', '"heading"'],
      ['Heading 3', '"level":3'],
      ['Heading 4', '"level":4'],
      ['Bulleted list', '"bulletList"'],
      ['Numbered list', '"orderedList"'],
      ['Quote', '"blockquote"'],
      ['Code block', '"codeBlock"'],
      ['Divider', '"horizontalRule"'],
    ] as const;
    for (const [label, marker] of commands) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(lastDoc(onChange)).toContain(marker);
    }
  });

  it('links: prompts for a URL, sets it, removes it with an empty answer and ignores cancel', async () => {
    const { user, onChange } = setup();
    await screen.findByText('Hello');
    await selectAll(user);
    const prompt = vi.spyOn(window, 'prompt');
    prompt.mockReturnValueOnce('https://example.com');
    await user.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(lastDoc(onChange)).toContain('https://example.com'));
    prompt.mockReturnValueOnce('');
    await selectAll(user);
    await user.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(lastDoc(onChange)).not.toContain('https://example.com'));
    const calls = onChange.mock.calls.length;
    prompt.mockReturnValueOnce(null);
    await user.click(screen.getByRole('button', { name: 'Link' }));
    expect(onChange.mock.calls.length).toBe(calls);
    expect(prompt).toHaveBeenCalledWith('Link URL (https://…)', expect.any(String));
  });

  it('FR-MEDIA-07: inserts an image from the media library with its media id', async () => {
    const { user, onChange } = setup();
    await screen.findByText('Hello');
    await user.click(screen.getByRole('button', { name: 'Insert image' }));
    await user.click(await screen.findByRole('button', { name: 'Chart' }));
    await waitFor(() => expect(lastDoc(onChange)).toContain('"mediaId":"m1"'));
    expect(document.querySelector('img[data-media-id="m1"]')).not.toBeNull();
  });

  it('closes the picker without inserting', async () => {
    const { user, onChange } = setup();
    await screen.findByText('Hello');
    await user.click(screen.getByRole('button', { name: 'Insert image' }));
    await screen.findByRole('dialog', { name: 'Choose an image' });
    await act(async () => {
      await user.keyboard('{Escape}');
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps images without a media id and inserts library images without alt text', async () => {
    const withImage: RichTextDoc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'https://x.example/a.png', alt: 'external' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    };
    const onChange = vi.fn();
    const page = renderPage(<RichTextEditor value={withImage} revision="r2" onChange={onChange} />, {
      user: EDITOR,
      seed: (api) => api.state.media.push(aMedia({ id: 'm9', altText: null, filename: 'noalt.png' })),
    });
    const external = await screen.findByAltText('external');
    expect(external).not.toHaveAttribute('data-media-id');
    await page.user.click(screen.getByRole('button', { name: 'Insert image' }));
    await page.user.click(await screen.findByRole('button', { name: 'noalt.png' }));
    await waitFor(() => expect(lastDoc(onChange)).toContain('"mediaId":"m9"'));
  });

  it('parses the media id back from pasted/loaded HTML', () => {
    const editor = new Editor({ extensions: editorExtensions, content: '<p>x</p><img src="https://x.example/a.png" data-media-id="m7">' });
    expect(JSON.stringify(editor.getJSON())).toContain('"mediaId":"m7"');
    editor.destroy();
  });
});
