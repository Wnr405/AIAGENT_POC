import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../../shared/kernel/errors';
import { isContentStatus } from './content-status';
import { isContentType } from './content-type';
import { defaultDescription, SeoMetadata } from './seo-metadata.vo';
import { Slug } from './slug.vo';
import { MAX_TAGS, normalizeTags } from './tag.vo';

describe('Slug (FR-CONTENT-02)', () => {
  it('normalises to lower case', () => {
    expect(Slug.create(' My-First-Article ').value).toBe('my-first-article');
  });
  it.each(['', 'a b', 'a--b', '-a', 'a-', 'ü', 'a_b', 'x'.repeat(121)])('rejects %s', (s: string) => {
    expect(() => Slug.create(s)).toThrow(ValidationError);
  });
  it('appends numeric suffixes within the max length', () => {
    expect(Slug.create('hello').withSuffix(2).value).toBe('hello-2');
    const long = Slug.create(`${'a'.repeat(118)}-b`);
    expect(long.withSuffix(12).value).toHaveLength(120);
    expect(long.withSuffix(12).value.endsWith('-12')).toBe(true);
  });
});

describe('SeoMetadata (FR-SEO-01/02)', () => {
  it('normalises blanks to null', () => {
    const s = SeoMetadata.create({ title: '  ', description: '' });
    expect([s.title, s.description]).toEqual([null, null]);
    const e = SeoMetadata.empty();
    expect([e.title, e.description]).toEqual([null, null]);
    expect(SeoMetadata.create()).toEqual(e);
  });
  it('enforces 70 / 160 character limits (boundaries)', () => {
    expect(SeoMetadata.create({ title: 't'.repeat(70) }).title).toHaveLength(70);
    expect(() => SeoMetadata.create({ title: 't'.repeat(71) })).toThrow('at most 70');
    expect(SeoMetadata.create({ description: 'd'.repeat(160) }).description).toHaveLength(160);
    expect(() => SeoMetadata.create({ description: 'd'.repeat(161) })).toThrow('at most 160');
  });
  it('default description keeps short text and cuts long text on a word boundary', () => {
    expect(defaultDescription('  short\n text ')).toBe('short text');
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const d = defaultDescription(words);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith('…')).toBe(true);
    expect(d).toMatch(/ word\d+…$/); // ends on a whole word
    expect(defaultDescription('x'.repeat(300))).toBe(`${'x'.repeat(159)}…`);
  });
});

describe('tags', () => {
  it('lower-cases, trims, collapses spaces and de-duplicates', () => {
    expect(normalizeTags([' Finance ', 'finance', 'Q2  Results'])).toEqual(['finance', 'q2 results']);
  });
  it('rejects empty, too long and too many tags', () => {
    expect(() => normalizeTags([' '])).toThrow(ValidationError);
    expect(() => normalizeTags(['x'.repeat(41)])).toThrow(ValidationError);
    expect(() => normalizeTags(Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`))).toThrow('At most 20');
  });
});

describe('enum guards', () => {
  it('recognise valid values only', () => {
    expect([
      isContentType('page'),
      isContentType('blog'),
      isContentStatus('archived'),
      isContentStatus('live'),
    ]).toEqual([true, false, true, false]);
  });
});
