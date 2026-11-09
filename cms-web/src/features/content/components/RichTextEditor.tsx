import { Box, Divider, IconButton, Paper, Tooltip } from '@mui/material';
import FormatBold from '@mui/icons-material/FormatBoldRounded';
import FormatItalic from '@mui/icons-material/FormatItalicRounded';
import FormatUnderlined from '@mui/icons-material/FormatUnderlinedRounded';
import FormatListBulleted from '@mui/icons-material/FormatListBulletedRounded';
import FormatListNumbered from '@mui/icons-material/FormatListNumberedRounded';
import FormatQuote from '@mui/icons-material/FormatQuoteRounded';
import Code from '@mui/icons-material/CodeRounded';
import LinkIcon from '@mui/icons-material/LinkRounded';
import ImageIcon from '@mui/icons-material/ImageRounded';
import HorizontalRule from '@mui/icons-material/HorizontalRuleRounded';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState, type ReactNode } from 'react';
import { t, type MessageKey } from '../../../shared/i18n/t';
import type { RichTextDoc } from '../types/content.types';
import { MediaPickerDialog, type PickedImage } from './MediaPickerDialog';

/** Image node that remembers the media id (feeds FR-MEDIA-07 reference tracking). */
const CmsImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-media-id'),
        renderHTML: (attrs: { mediaId?: string | null }) => (attrs.mediaId ? { 'data-media-id': attrs.mediaId } : {}),
      },
    };
  },
});

/** RK-02 / FR-CONTENT-15: TipTap (ProseMirror) with exactly the allowed node set. */
export const editorExtensions = [
  StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
  CmsImage,
];

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: MessageKey;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip title={t(label)}>
      <IconButton size="small" aria-label={t(label)} aria-pressed={active} color={active ? 'primary' : 'default'} onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const chain = () => editor.chain().focus();
  const heading = (level: 2 | 3 | 4) => (
    <ToolButton
      label={`content.editor.h${level}`}
      active={editor.isActive('heading', { level })}
      onClick={() => chain().toggleHeading({ level }).run()}
    >
      <Box component="span" sx={{ fontWeight: 700, fontSize: 13, width: 24 }}>
        H{level}
      </Box>
    </ToolButton>
  );
  return (
    <Box
      role="toolbar"
      aria-label={t('content.editor.body')}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        p: 1,
        position: 'sticky',
        top: 64,
        zIndex: 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <ToolButton label="content.editor.bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
        <FormatBold />
      </ToolButton>
      <ToolButton label="content.editor.italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
        <FormatItalic />
      </ToolButton>
      <ToolButton label="content.editor.underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}>
        <FormatUnderlined />
      </ToolButton>
      <Divider orientation="vertical" flexItem />
      {heading(2)}
      {heading(3)}
      {heading(4)}
      <Divider orientation="vertical" flexItem />
      <ToolButton label="content.editor.bulletList" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>
        <FormatListBulleted />
      </ToolButton>
      <ToolButton
        label="content.editor.orderedList"
        active={editor.isActive('orderedList')}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <FormatListNumbered />
      </ToolButton>
      <ToolButton label="content.editor.quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>
        <FormatQuote />
      </ToolButton>
      <ToolButton label="content.editor.code" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()}>
        <Code />
      </ToolButton>
      <Divider orientation="vertical" flexItem />
      <ToolButton
        label="content.editor.link"
        active={editor.isActive('link')}
        onClick={() => {
          const previous = editor.getAttributes('link')['href'] as string | undefined;
          const url = window.prompt(t('content.editor.linkPrompt'), previous ?? 'https://');
          if (url === null) return;
          if (url === '') chain().unsetLink().run();
          else chain().extendMarkRange('link').setLink({ href: url }).run();
        }}
      >
        <LinkIcon />
      </ToolButton>
      <ToolButton label="content.editor.image" onClick={onImage}>
        <ImageIcon />
      </ToolButton>
      <ToolButton label="content.editor.rule" onClick={() => chain().setHorizontalRule().run()}>
        <HorizontalRule />
      </ToolButton>
    </Box>
  );
}

export interface RichTextEditorProps {
  value: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
  /** Bumps when the server replaces the document (e.g. revert) so the editor reloads it. */
  revision: string;
}

/** Feature component wrapping TipTap. Body text uses body-large (03-DESIGN §12.4). */
export function RichTextEditor({ value, onChange, revision }: RichTextEditorProps) {
  const [picking, setPicking] = useState(false);
  const editor = useEditor({
    extensions: editorExtensions,
    content: value as JSONContent,
    editorProps: { attributes: { 'aria-label': t('content.editor.body'), role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichTextDoc),
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(value as JSONContent, false);
    // Only when the server version changes, never on local typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` intentionally excluded (would reset the cursor on every keystroke)
  }, [editor, revision]);

  if (!editor) return null;
  const insert = (img: PickedImage) => {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: img.url, alt: img.alt ?? '', mediaId: img.id } })
      .run();
    setPicking(false);
  };
  return (
    <Paper variant="outlined" sx={{ overflow: 'visible' }}>
      <Toolbar editor={editor} onImage={() => setPicking(true)} />
      <Box
        sx={{
          p: 2,
          minHeight: 360,
          typography: 'body1',
          '& .ProseMirror': { outline: 'none', minHeight: 320 },
          '& img': { maxWidth: '100%' },
          '& blockquote': { borderLeft: 3, borderColor: 'divider', pl: 2, ml: 0 },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
      <MediaPickerDialog open={picking} onClose={() => setPicking(false)} onPick={insert} />
    </Paper>
  );
}
