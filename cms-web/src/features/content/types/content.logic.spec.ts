import { describe, expect, it } from 'vitest';
import { availableActions, displayStatus, docText, missingForPublish } from './content.logic';

describe('content UI logic', () => {
  it('derives the Scheduled display status', () => {
    expect(displayStatus({ status: 'draft', scheduledAt: '2026-06-01T00:00:00Z' })).toBe('scheduled');
    expect(displayStatus({ status: 'in_review', scheduledAt: '2026-06-01T00:00:00Z' })).toBe('scheduled');
    expect(displayStatus({ status: 'published', scheduledAt: '2026-06-01T00:00:00Z' })).toBe('published');
    expect(displayStatus({ status: 'draft', scheduledAt: null })).toBe('draft');
  });

  it.each([
    ['draft', false, true, ['submit']],
    ['draft', false, false, []],
    ['in_review', false, true, []],
    ['draft', true, false, ['submit', 'publish']],
    ['in_review', true, false, ['publish', 'reject']],
    ['published', true, false, ['unpublish']],
    ['unpublished', true, false, ['archive']],
    ['archived', true, true, []],
  ] as const)('%s (publisher=%s, owner=%s) → %j', (status, pub, owner, expected) => {
    expect(availableActions(status, pub, owner)).toEqual(expected);
  });

  it('explains missing publish requirements', () => {
    expect(missingForPublish({ title: ' ', bodyText: '', seoDescription: null })).toEqual(['title', 'body', 'meta description']);
    expect(missingForPublish({ title: 'T', bodyText: 'Body', seoDescription: '' })).toEqual([]);
    expect(missingForPublish({ title: 'T', bodyText: '', seoDescription: 'D' })).toEqual(['body']);
  });

  it('extracts text from a TipTap doc', () => {
    expect(
      docText({
        type: 'doc',
        content: [
          { type: 'heading', content: [{ type: 'text', text: 'Hi' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'there' }] },
          null,
        ],
      }),
    ).toBe('Hi there');
    expect(docText(undefined)).toBe('');
  });
});
