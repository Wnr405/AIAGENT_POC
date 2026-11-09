import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../../shared/kernel/errors';
import { isSafeUrl, RichTextBody, type RtNode } from './rich-text-body.vo';

const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: unknown[]) => (marks ? { type: 'text', text, marks } : { type: 'text', text });
const sanitize = (...content: unknown[]): RtNode[] =>
  RichTextBody.fromUntrusted({ type: 'doc', content }).doc.content as RtNode[];

describe('isSafeUrl (SEC-04) — critical path', () => {
  it.each(['https://example.com', 'http://x.io/a?b=1', 'mailto:a@b.co', '/about', '#top', 'HTTPS://EXAMPLE.COM'])(
    'allows %s',
    (u: string) => {
      expect(isSafeUrl(u)).toBe(true);
    },
  );
  it.each([
    'javascript:alert(1)',
    ' java\nscript:alert(1)',
    'JaVaScRiPt:x',
    'data:text/html,<script>',
    'vbscript:x',
    '//evil.com',
    '/\\evil.com',
    '',
    42,
    null,
    `https://${'a'.repeat(2050)}`,
  ])('rejects %s', (u: unknown) => {
    expect(isSafeUrl(u)).toBe(false);
  });
  it('mailto can be disallowed (images)', () => {
    expect(isSafeUrl('mailto:a@b.co', false)).toBe(false);
  });
});

describe('RichTextBody sanitiser (FR-CONTENT-14/15, SEC-04) — critical path', () => {
  it('treats null / undefined as an empty document', () => {
    expect(RichTextBody.fromUntrusted(null).doc).toEqual({ type: 'doc', content: [] });
    expect(RichTextBody.fromUntrusted(undefined).isEmpty()).toBe(true);
    expect(RichTextBody.empty().doc).toEqual({ type: 'doc', content: [] });
  });

  it.each([['<p>html</p>'], [{ type: 'paragraph' }], [42]])('rejects a non-doc root %#', (input: unknown) => {
    expect(() => RichTextBody.fromUntrusted(input)).toThrow(ValidationError);
  });

  it('keeps every allowed node type from FR-CONTENT-15', () => {
    const out = sanitize(
      { type: 'heading', attrs: { level: 3 }, content: [t('H')] },
      p(t('a'), { type: 'hardBreak' }, t('b')),
      { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('li'))] }] },
      { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('n'))] }] },
      { type: 'blockquote', content: [p(t('q'))] },
      { type: 'codeBlock', attrs: { language: 'ts' }, content: [t('const a = 1;')] },
      { type: 'horizontalRule' },
      {
        type: 'image',
        attrs: { src: 'https://cdn/x.png', alt: 'A', title: 'T', mediaId: '00000000-0000-4000-8000-000000000001' },
      },
    );
    expect(out.map((n) => n.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'orderedList',
      'blockquote',
      'codeBlock',
      'horizontalRule',
      'image',
    ]);
    expect(out[0]?.attrs).toEqual({ level: 3 });
    expect(out[3]?.attrs).toEqual({ start: 3 });
    expect(out[5]?.attrs).toEqual({ language: 'ts' });
  });

  it('clamps heading levels to H2–H4 and defaults bad levels', () => {
    const levels = sanitize(
      { type: 'heading', attrs: { level: 1 } },
      { type: 'heading', attrs: { level: 6 } },
      { type: 'heading', attrs: { level: 'x' } },
      { type: 'heading' },
    ).map((n) => n.attrs?.['level']);
    expect(levels).toEqual([2, 4, 2, 2]);
  });

  it('drops unknown nodes with their subtrees, nested docs and non-objects', () => {
    const out = sanitize(
      { type: 'script', content: [t('alert(1)')] },
      { type: 'doc', content: [] },
      'str',
      null,
      p(t('ok')),
    );
    expect(out).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }]);
  });

  it('strips unknown attributes and keeps text verbatim (no HTML interpretation)', () => {
    const out = sanitize({
      type: 'paragraph',
      attrs: { onclick: 'x', style: 'y' },
      content: [t('<script>alert(1)</script>')],
    });
    expect(out[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] });
  });

  it('drops empty / non-string text nodes', () => {
    expect(sanitize(p({ type: 'text', text: '' }, { type: 'text', text: 5 }, { type: 'text' }))[0]?.content).toEqual(
      [],
    );
  });

  it('keeps allowed marks once, drops unknown marks and unsafe links', () => {
    const out = sanitize(
      p(
        t('x', [
          { type: 'bold' },
          { type: 'bold' },
          { type: 'italic' },
          { type: 'font', attrs: { face: 'x' } },
          null,
          'bad',
        ]),
        t('y', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
        t('z', [{ type: 'link', attrs: { href: 'https://a.b', target: '_blank', onclick: 'x' } }]),
        t('w', [{ type: 'link', attrs: { href: '/about', target: '_self' } }]),
        t('v', 'notarray' as unknown as unknown[]),
      ),
    )[0]?.content;
    expect(out).toEqual([
      { type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'italic' }] },
      { type: 'text', text: 'y' },
      {
        type: 'text',
        text: 'z',
        marks: [
          { type: 'link', attrs: { href: 'https://a.b', target: '_blank', rel: 'noopener noreferrer nofollow' } },
        ],
      },
      { type: 'text', text: 'w', marks: [{ type: 'link', attrs: { href: '/about', target: null, rel: null } }] },
      { type: 'text', text: 'v' },
    ]);
  });

  it('drops images with unsafe or fragment src, and invalid mediaId', () => {
    const out = sanitize(
      { type: 'image', attrs: { src: 'javascript:x' } },
      { type: 'image', attrs: { src: '#frag' } },
      { type: 'image', attrs: { src: 'mailto:a@b.c' } },
      { type: 'image', attrs: { src: '/media/a.png', mediaId: 'nope', alt: 5 } },
    );
    expect(out).toEqual([{ type: 'image', attrs: { src: '/media/a.png', alt: null, title: null, mediaId: null } }]);
  });

  it('code blocks keep plain text only and reject odd languages', () => {
    const out = sanitize({
      type: 'codeBlock',
      attrs: { language: 'js"><script>' },
      content: [t('a', [{ type: 'bold' }]), { type: 'hardBreak' }],
    });
    expect(out[0]).toEqual({ type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'a' }] });
  });

  it('defaults invalid ordered list start to 1', () => {
    expect(
      sanitize({ type: 'orderedList', attrs: { start: 0 } }, { type: 'orderedList', attrs: { start: 'x' } }).map(
        (n) => n.attrs?.['start'],
      ),
    ).toEqual([1, 1]);
  });

  it('limits depth and size', () => {
    let deep: Record<string, unknown> = p(t('x'));
    for (let i = 0; i < 20; i++) deep = { type: 'blockquote', content: [deep] };
    expect(() => sanitize(deep)).toThrow('nested too deeply');
    const many = Array.from({ length: 20_001 }, () => ({ type: 'horizontalRule' }));
    expect(() => sanitize(...many)).toThrow('too large');
  });

  it('extracts plain text, emptiness and referenced media', () => {
    const body = RichTextBody.fromUntrusted({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [t('Title')] },
        p(t('Hello'), { type: 'hardBreak' }, t('world')),
        { type: 'image', attrs: { src: 'https://x/a.png', mediaId: '00000000-0000-4000-8000-000000000009' } },
        { type: 'image', attrs: { src: 'https://x/b.png', mediaId: '00000000-0000-4000-8000-000000000009' } },
        { type: 'image', attrs: { src: 'https://x/c.png' } },
      ],
    });
    expect(body.plainText()).toBe('Title Hello world');
    expect(body.isEmpty()).toBe(false);
    expect(body.hasImages()).toBe(true);
    expect(body.referencedMediaIds()).toEqual(['00000000-0000-4000-8000-000000000009']);
    const imageOnly = RichTextBody.fromUntrusted({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/a.png' } }],
    });
    expect([imageOnly.plainText(), imageOnly.isEmpty()]).toEqual(['', false]);
    expect(RichTextBody.fromTrusted({ type: 'doc', content: [p()] as RtNode[] }).isEmpty()).toBe(true);
  });
});
