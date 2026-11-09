import { escapeHtml } from '../../../shared/kernel/html';

/**
 * Renders sanitised ProseMirror JSON to HTML for API consumers who prefer it
 * (`body_html`). Every text and attribute value is escaped; only the node and
 * mark types produced by the content sanitizer are recognised.
 */
interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const attr = (name: string, value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? ` ${name}="${escapeHtml(value)}"` : '';

const MARK_TAGS: Record<string, string> = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', code: 'code' };
const BLOCK_TAGS: Record<string, string> = {
  paragraph: 'p',
  blockquote: 'blockquote',
  bulletList: 'ul',
  listItem: 'li',
};

function renderText(n: Node): string {
  let html = escapeHtml(n.text ?? '');
  for (const m of n.marks ?? []) {
    if (m.type === 'link') {
      html = `<a${attr('href', m.attrs?.['href'])}${attr('target', m.attrs?.['target'])}${attr('rel', m.attrs?.['rel'])}>${html}</a>`;
    } else if (MARK_TAGS[m.type]) {
      const tag = MARK_TAGS[m.type];
      html = `<${tag}>${html}</${tag}>`;
    }
  }
  return html;
}

type Renderer = (n: Node, inner: string) => string;

const numberAttr = (n: Node, name: string, fallback: number): number => Number(n.attrs?.[name]) || fallback;

const RENDERERS: Record<string, Renderer> = {
  doc: (_n, inner) => inner,
  text: (n) => renderText(n),
  heading: (n, inner) => {
    const level = Math.min(4, Math.max(2, numberAttr(n, 'level', 2)));
    return `<h${level}>${inner}</h${level}>`;
  },
  orderedList: (n, inner) => {
    const start = numberAttr(n, 'start', 1);
    return start === 1 ? `<ol>${inner}</ol>` : `<ol start="${start}">${inner}</ol>`;
  },
  codeBlock: (n, inner) => {
    const lang = n.attrs?.['language'];
    const cls = typeof lang === 'string' ? ` class="language-${escapeHtml(lang)}"` : '';
    return `<pre><code${cls}>${inner}</code></pre>`;
  },
  image: (n) =>
    `<img${attr('src', n.attrs?.['src'])}${attr('alt', n.attrs?.['alt'] ?? '')}${attr('title', n.attrs?.['title'])}>`,
  horizontalRule: () => '<hr>',
  hardBreak: () => '<br>',
};

function render(n: Node): string {
  const inner = n.type === 'text' ? '' : (n.content ?? []).map(render).join('');
  if (Object.hasOwn(RENDERERS, n.type)) return (RENDERERS[n.type] as Renderer)(n, inner);
  const tag = Object.hasOwn(BLOCK_TAGS, n.type) ? BLOCK_TAGS[n.type] : undefined;
  return tag ? `<${tag}>${inner}</${tag}>` : '';
}

export function renderHtml(doc: unknown): string {
  if (typeof doc !== 'object' || doc === null) return '';
  return render(doc as Node);
}
