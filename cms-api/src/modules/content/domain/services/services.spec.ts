import { describe, expect, it } from 'vitest';
import { CONTENT_STATUSES, type ContentStatus } from '../value-objects/content-status';
import { RichTextBody } from '../value-objects/rich-text-body.vo';
import { nextStatus, type LifecycleAction } from './content-lifecycle';
import { unmetPublishRequirements } from './publish-requirements';
import { slugFromTitle } from './slug-generator';

describe('lifecycle state machine (§5.4.1, FR-CONTENT-04) — critical path', () => {
  const allowed: Record<LifecycleAction, Partial<Record<ContentStatus, ContentStatus>>> = {
    submit: { draft: 'in_review' },
    reject: { in_review: 'draft' },
    publish: { draft: 'published', in_review: 'published' },
    unpublish: { published: 'unpublished' },
    archive: { unpublished: 'archived' },
    edit_back_to_draft: { unpublished: 'draft' },
  };
  for (const [action, map] of Object.entries(allowed) as [
    LifecycleAction,
    Partial<Record<ContentStatus, ContentStatus>>,
  ][]) {
    for (const from of CONTENT_STATUSES) {
      const to = map[from] ?? null;
      it(`${action} from ${from} → ${to ?? 'not allowed'}`, () => {
        expect(nextStatus(from, action)).toBe(to);
      });
    }
  }
});

describe('publish requirements (FR-CONTENT-06) — critical path', () => {
  const body = RichTextBody.fromUntrusted({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
  });
  it('passes when everything is present', () => {
    expect(unmetPublishRequirements({ title: 'T', body, effectiveDescription: 'd' })).toEqual([]);
  });
  it('lists every missing requirement', () => {
    expect(unmetPublishRequirements({ title: ' ', body: RichTextBody.empty(), effectiveDescription: ' ' })).toEqual([
      'title',
      'body',
      'seoDescription',
    ]);
  });
  it('accepts exactly 160 chars and rejects 161', () => {
    expect(unmetPublishRequirements({ title: 'T', body, effectiveDescription: 'd'.repeat(160) })).toEqual([]);
    expect(unmetPublishRequirements({ title: 'T', body, effectiveDescription: 'd'.repeat(161) })).toEqual([
      'seoDescription',
    ]);
  });
});

describe('slugFromTitle (FR-CONTENT-02)', () => {
  it.each([
    ['My First Article!', 'my-first-article'],
    ['  Crème Brûlée  & Co ', 'creme-brulee-co'],
    ['Q2 — 2026 Report', 'q2-2026-report'],
  ])('%s → %s', (title: string, slug: string) => {
    expect(slugFromTitle(title, 'seed').value).toBe(slug);
  });
  it('falls back to a seed for titles without Latin characters', () => {
    expect(slugFromTitle('บทความภาษาไทย', '7F3A-91bc-xyz').value).toBe('content-7f3a91bc');
  });
  it('truncates to 120 chars without a trailing hyphen', () => {
    const s = slugFromTitle(`${'a'.repeat(119)} b`, 's').value;
    expect(s).toBe('a'.repeat(119));
  });
});
