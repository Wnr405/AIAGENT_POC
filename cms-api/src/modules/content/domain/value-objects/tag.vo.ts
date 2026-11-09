import { ValidationError } from '../../../../shared/kernel/errors';

export const TAG_MAX_LENGTH = 40;
export const MAX_TAGS = 20;

/** Non-empty, lowercase, ≤ 40 chars (04-ARCH §4.5.2). Duplicates removed, order kept. */
export function normalizeTags(input: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (tag.length === 0 || tag.length > TAG_MAX_LENGTH) {
      throw new ValidationError(`Tags must be 1–${TAG_MAX_LENGTH} characters`, { field: 'tags' });
    }
    if (!out.includes(tag)) out.push(tag);
  }
  if (out.length > MAX_TAGS) {
    throw new ValidationError(`At most ${MAX_TAGS} tags are allowed`, { field: 'tags' });
  }
  return out;
}
