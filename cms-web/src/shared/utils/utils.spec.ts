import { describe, expect, it } from 'vitest';
import { formatBytes, formatDateTime, formatRelative, fromLocalInputValue, toLocalInputValue } from './format';
import { slugify, SLUG_PATTERN } from './slug';

describe('format', () => {
  it('formats bytes with sensible units', () => {
    expect([formatBytes(512), formatBytes(2048), formatBytes(5 * 1048576), formatBytes(20 * 1048576), formatBytes(3 * 1073741824)]).toEqual(
      ['512 B', '2.0 KB', '5.0 MB', '20 MB', '3.0 GB'],
    );
  });
  it('formats relative times', () => {
    const now = new Date('2026-05-01T12:00:00Z');
    expect(formatRelative('2026-05-01T11:58:00Z', now, 'en')).toBe('2 minutes ago');
    expect(formatRelative('2026-05-01T12:00:00Z', now, 'en')).toBe('now');
    expect(formatRelative('2026-05-03T12:00:00Z', now, 'en')).toBe('in 2 days');
  });
  it('renders missing dates as a dash and real ones in the given locale', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('2026-05-01T12:00:00Z', 'en-GB')).toMatch(/2026/);
  });
  it('round-trips datetime-local values', () => {
    const d = new Date(2026, 4, 1, 9, 30);
    expect(toLocalInputValue(d)).toBe('2026-05-01T09:30');
    expect(fromLocalInputValue('2026-05-01T09:30')).toBe(d.toISOString());
  });
});

describe('slugify (mirrors backend FR-CONTENT-02)', () => {
  it.each([
    ['My First Article!', 'my-first-article'],
    ['Crème Brûlée & Co', 'creme-brulee-co'],
    ['บทความ', ''],
  ])('%s → %s', (title: string, slug: string) => {
    expect(slugify(title)).toBe(slug);
  });
  it('produces valid slugs', () => {
    expect(SLUG_PATTERN.test(slugify('  Hello -- World  '))).toBe(true);
  });
});
