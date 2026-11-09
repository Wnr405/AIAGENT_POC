import { Slug, SLUG_MAX_LENGTH } from '../value-objects/slug.vo';

/**
 * Generates a slug candidate from a title (FR-CONTENT-02). Latin diacritics are
 * folded; scripts without a Latin transliteration (e.g. Thai) fall back to
 * `fallbackSeed` so a valid slug always exists. Uniqueness is the caller's job.
 */
export function slugFromTitle(title: string, fallbackSeed: string): Slug {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  if (base.length > 0) return Slug.create(base);
  const seed = fallbackSeed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  return Slug.create(`content-${seed}`);
}
