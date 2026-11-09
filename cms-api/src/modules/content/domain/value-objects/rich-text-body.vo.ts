import { ValidationError } from '../../../../shared/kernel/errors';
import { isUuid } from '../../../../shared/kernel/uuid';

/**
 * Structured rich text (FR-CONTENT-14): a ProseMirror/TipTap JSON tree.
 * Sanitised server-side against an allow-list before storage (SEC-04).
 * Anything not on the list — unknown nodes, unknown marks, unknown attributes,
 * unsafe URLs — is dropped. Text is never interpreted as HTML.
 * CRITICAL PATH (05-METRICS §3.3).
 */
export interface RtMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
}
export interface RtNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly RtNode[];
  readonly text?: string;
  readonly marks?: readonly RtMark[];
}

const MAX_DEPTH = 16;
const MAX_NODES = 20_000;
const MAX_TEXT = 100_000;

/** FR-CONTENT-15 node set. */
const BLOCK_CONTAINERS = new Set(['paragraph', 'blockquote', 'bulletList', 'orderedList', 'listItem']);
const LEAVES = new Set(['horizontalRule', 'hardBreak']);
const SIMPLE_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code']);

/** http(s), mailto, same-site absolute paths and fragments. Rejects javascript:, data:, //host, etc. */
export function isSafeUrl(raw: unknown, allowMailto = true): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return false;
  // Remove whitespace and control characters that browsers ignore inside schemes.
  // eslint-disable-next-line no-control-regex -- intentional: strip C0 controls before scheme check
  const compact = raw.replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (compact.startsWith('#')) return true;
  if (compact.startsWith('/')) return !compact.startsWith('//') && !compact.startsWith('/\\');
  return isAbsoluteSafe(compact.toLowerCase(), allowMailto);
}

function isAbsoluteSafe(lower: string, allowMailto: boolean): boolean {
  if (lower.startsWith('https://') || lower.startsWith('http://')) return true;
  return allowMailto && lower.startsWith('mailto:');
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' ? v.slice(0, max) : null;
}

type Attrs = Record<string, unknown>;
type NodeHandler = (n: RtNode, attrs: Attrs, depth: number) => RtNode | null;

class Sanitizer {
  private count = 0;

  private readonly handlers: Readonly<Record<string, NodeHandler>> = {
    text: (n) => this.text(n),
    heading: (n, attrs, depth) => {
      const lvl = Number(attrs['level']);
      const level = Number.isInteger(lvl) ? Math.min(4, Math.max(2, lvl)) : 2;
      return { type: 'heading', attrs: { level }, content: this.children(n.content, depth + 1) };
    },
    orderedList: (n, attrs, depth) => {
      const s = Number(attrs['start']);
      const start = Number.isInteger(s) && s >= 1 ? s : 1;
      return { type: 'orderedList', attrs: { start }, content: this.children(n.content, depth + 1) };
    },
    codeBlock: (n, attrs, depth) => this.codeBlock(n, attrs, depth),
    image: (_n, attrs) => image(attrs),
    doc: () => null, // nested docs are not allowed
  };

  doc(input: unknown): RtNode {
    if (input === null || input === undefined) return { type: 'doc', content: [] };
    if (typeof input !== 'object' || (input as RtNode).type !== 'doc') {
      throw new ValidationError('Body must be a rich text document', { field: 'body' });
    }
    return { type: 'doc', content: this.children((input as RtNode).content, 1) };
  }

  private children(raw: unknown, depth: number): RtNode[] {
    if (!Array.isArray(raw)) return [];
    if (depth > MAX_DEPTH) throw new ValidationError('Body is nested too deeply', { field: 'body' });
    const out: RtNode[] = [];
    for (const child of raw) {
      const node = this.node(child, depth);
      if (node) out.push(node);
    }
    return out;
  }

  private node(raw: unknown, depth: number): RtNode | null {
    if (typeof raw !== 'object' || raw === null) return null;
    if (++this.count > MAX_NODES) throw new ValidationError('Body is too large', { field: 'body' });
    const n = raw as RtNode;
    const attrs: Attrs = n.attrs ?? {};
    if (Object.hasOwn(this.handlers, n.type)) return (this.handlers[n.type] as NodeHandler)(n, attrs, depth);
    if (BLOCK_CONTAINERS.has(n.type)) return { type: n.type, content: this.children(n.content, depth + 1) };
    if (LEAVES.has(n.type)) return { type: n.type };
    return null; // unknown node type: dropped with its subtree
  }

  private text(n: RtNode): RtNode | null {
    const text = str(n.text, MAX_TEXT);
    if (!text) return null;
    const marks = this.marks(n.marks);
    return marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text };
  }

  private codeBlock(n: RtNode, attrs: Attrs, depth: number): RtNode {
    const lang = attrs['language'];
    const language = typeof lang === 'string' && /^[a-z0-9+#-]{1,30}$/i.test(lang) ? lang : null;
    // Code blocks hold plain text only: marks are stripped.
    const content = this.children(n.content, depth + 1)
      .filter((c) => c.type === 'text')
      .map((c) => ({ type: 'text', text: c.text as string }));
    return { type: 'codeBlock', attrs: { language }, content };
  }

  private marks(raw: unknown): RtMark[] {
    if (!Array.isArray(raw)) return [];
    const out: RtMark[] = [];
    for (const item of raw as unknown[]) {
      const mark = sanitizeMark(item);
      if (mark && !(SIMPLE_MARKS.has(mark.type) && out.some((o) => o.type === mark.type))) out.push(mark);
    }
    return out;
  }
}

function image(attrs: Attrs): RtNode | null {
  const src = attrs['src'];
  if (!isSafeUrl(src, false) || src.startsWith('#')) return null;
  const mediaId = isUuid(attrs['mediaId']) ? attrs['mediaId'] : null;
  return {
    type: 'image',
    attrs: { src, alt: str(attrs['alt'], 500), title: str(attrs['title'], 500), mediaId },
  };
}

function sanitizeMark(item: unknown): RtMark | null {
  if (typeof item !== 'object' || item === null) return null;
  const m = item as RtMark;
  if (SIMPLE_MARKS.has(m.type)) return { type: m.type };
  const href = m.attrs?.['href'];
  if (m.type !== 'link' || !isSafeUrl(href)) return null;
  const blank = (m.attrs as Attrs)['target'] === '_blank';
  return {
    type: 'link',
    attrs: { href, target: blank ? '_blank' : null, rel: blank ? 'noopener noreferrer nofollow' : null },
  };
}

function collectText(node: RtNode, out: string[]): void {
  if (node.type === 'text') {
    out.push(node.text as string);
    return;
  }
  if (node.type === 'hardBreak') {
    out.push(' ');
    return;
  }
  for (const child of node.content ?? []) collectText(child, out);
  if (node.type !== 'doc' && node.type !== 'text') out.push(' ');
}

export class RichTextBody {
  private constructor(public readonly doc: RtNode) {}

  /** Sanitises arbitrary client JSON. Throws ValidationError only for structurally hopeless input. */
  static fromUntrusted(input: unknown): RichTextBody {
    return new RichTextBody(new Sanitizer().doc(input));
  }

  /** For data already sanitised at write time (persistence round-trip). */
  static fromTrusted(doc: RtNode): RichTextBody {
    return new RichTextBody(doc);
  }

  static empty(): RichTextBody {
    return new RichTextBody({ type: 'doc', content: [] });
  }

  plainText(): string {
    const out: string[] = [];
    collectText(this.doc, out);
    return out.join('').replace(/\s+/g, ' ').trim();
  }

  private walk(fn: (n: RtNode) => void, node: RtNode = this.doc): void {
    fn(node);
    for (const child of node.content ?? []) this.walk(fn, child);
  }

  hasImages(): boolean {
    let found = false;
    this.walk((n) => {
      if (n.type === 'image') found = true;
    });
    return found;
  }

  isEmpty(): boolean {
    return this.plainText().length === 0 && !this.hasImages();
  }

  /** Media ids embedded inline (feeds ContentMediaRef / FR-MEDIA-07). */
  referencedMediaIds(): string[] {
    const ids = new Set<string>();
    this.walk((n) => {
      const id = n.attrs?.['mediaId'];
      if (n.type === 'image' && typeof id === 'string') ids.add(id);
    });
    return [...ids];
  }
}
