import { describe, expect, it } from 'vitest';
import { en } from './en';
import { t } from './t';

describe('t()', () => {
  it('looks up nested keys and interpolates variables', () => {
    expect(t('dashboard.greeting', { name: 'Ada' })).toBe('Hello, Ada');
    expect(t('common.pageOf', { page: 2, pages: 6 })).toBe('Page 2 of 6');
  });
  it('leaves unknown placeholders visible', () => {
    expect(t('dashboard.greeting')).toBe('Hello, {name}');
  });
  it('has no empty strings (NFR-I18N-03 resource file hygiene)', () => {
    const walk = (o: unknown): string[] => (typeof o === 'string' ? [o] : Object.values(o as object).flatMap(walk));
    expect(walk(en).filter((s) => s.trim() === '')).toEqual([]);
  });
});
