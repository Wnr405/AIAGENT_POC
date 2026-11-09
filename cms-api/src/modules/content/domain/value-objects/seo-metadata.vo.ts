import { ValidationError } from '../../../../shared/kernel/errors';

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;

/** FR-SEO-01. Empty strings are normalised to null ("use the default"). */
export class SeoMetadata {
  private constructor(
    public readonly title: string | null,
    public readonly description: string | null,
  ) {}

  static create(input: { title?: string | null; description?: string | null } = {}): SeoMetadata {
    const title = input.title?.trim() || null;
    const description = input.description?.trim() || null;
    if (title !== null && title.length > SEO_TITLE_MAX) {
      throw new ValidationError(`SEO title must be at most ${SEO_TITLE_MAX} characters`, { field: 'seoTitle' });
    }
    if (description !== null && description.length > SEO_DESCRIPTION_MAX) {
      throw new ValidationError(`Meta description must be at most ${SEO_DESCRIPTION_MAX} characters`, {
        field: 'seoDescription',
      });
    }
    return new SeoMetadata(title, description);
  }

  static empty(): SeoMetadata {
    return new SeoMetadata(null, null);
  }
}

/** FR-SEO-02: default description = first 160 chars of body text (word-boundary aware). */
export function defaultDescription(plainText: string): string {
  const text = plainText.replace(/\s+/g, ' ').trim();
  if (text.length <= SEO_DESCRIPTION_MAX) return text;
  const cut = text.slice(0, SEO_DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
