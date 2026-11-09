import { describe, expect, it } from 'vitest';
import { isPubliclyVisible } from './published-content';
import { renderHtml } from './render-html';

const NOW = new Date('2026-05-10T00:00:00Z');
const PAST = new Date('2026-05-01T00:00:00Z');
const FUTURE = new Date('2026-06-01T00:00:00Z');

describe('public visibility (FR-AUTHZ-06, RK-04) — critical path', () => {
  it('only published, not deleted, published_at <= now', () => {
    expect(isPubliclyVisible({ status: 'published', publishedAt: PAST, deletedAt: null }, NOW)).toBe(true);
    expect(isPubliclyVisible({ status: 'published', publishedAt: NOW, deletedAt: null }, NOW)).toBe(true);
    expect(isPubliclyVisible({ status: 'published', publishedAt: FUTURE, deletedAt: null }, NOW)).toBe(false);
    expect(isPubliclyVisible({ status: 'published', publishedAt: null, deletedAt: null }, NOW)).toBe(false);
    expect(isPubliclyVisible({ status: 'published', publishedAt: PAST, deletedAt: PAST }, NOW)).toBe(false);
    for (const status of ['draft', 'in_review', 'unpublished', 'archived']) {
      expect(isPubliclyVisible({ status, publishedAt: PAST, deletedAt: null }, NOW)).toBe(false);
    }
  });
});

describe('renderHtml (body_html)', () => {
  const t = (text: string, marks?: unknown[]) => ({ type: 'text', text, marks });
  it('renders every supported node and mark with escaping', () => {
    const html = renderHtml({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [t('H & <b>')] },
        { type: 'heading', content: [t('d')] },
        {
          type: 'paragraph',
          content: [
            t('b', [{ type: 'bold' }, { type: 'italic' }]),
            { type: 'hardBreak' },
            t('l', [{ type: 'link', attrs: { href: 'https://x.y/?a=1&b="2"', target: '_blank', rel: 'noopener' } }]),
            t('u', [{ type: 'underline' }, { type: 'strike' }, { type: 'code' }, { type: 'unknown' }]),
          ],
        },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [t('li')] }] }] },
        { type: 'orderedList', attrs: { start: 1 }, content: [] },
        { type: 'orderedList', attrs: { start: 4 }, content: [] },
        { type: 'blockquote', content: [] },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [t('a<b')] },
        { type: 'codeBlock', attrs: { language: null }, content: [] },
        { type: 'image', attrs: { src: '/a.png', alt: 'A"', title: null } },
        { type: 'image', attrs: { src: '/b.png' } },
        { type: 'horizontalRule' },
        { type: 'mystery', content: [t('dropped')] },
        { type: 'text' },
      ],
    });
    expect(html).toBe(
      '<h3>H &amp; &lt;b&gt;</h3><h2>d</h2>' +
        '<p><em><strong>b</strong></em><br><a href="https://x.y/?a=1&amp;b=&quot;2&quot;" target="_blank" rel="noopener">l</a><code><s><u>u</u></s></code></p>' +
        '<ul><li><p>li</p></li></ul><ol></ol><ol start="4"></ol><blockquote></blockquote>' +
        '<pre><code class="language-ts">a&lt;b</code></pre><pre><code></code></pre>' +
        '<img src="/a.png" alt="A&quot;"><img src="/b.png"><hr>',
    );
  });

  it('returns empty string for non-objects', () => {
    expect(renderHtml(null)).toBe('');
    expect(renderHtml('x')).toBe('');
  });
});
