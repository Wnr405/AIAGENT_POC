import { ValidationError } from '../../../../shared/kernel/errors';

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 120;

/** URL-safe identifier, unique per content type (FR-CONTENT-02). */
export class Slug {
  private constructor(public readonly value: string) {}

  static create(input: string): Slug {
    const normalized = input.trim().toLowerCase();
    if (normalized.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(normalized)) {
      throw new ValidationError('Slug may contain only lowercase letters, digits and single hyphens (max 120)', {
        field: 'slug',
      });
    }
    return new Slug(normalized);
  }

  /** Appends -2, -3 … for de-duplication of auto-generated slugs. */
  withSuffix(n: number): Slug {
    const suffix = `-${n}`;
    return Slug.create(`${this.value.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`);
  }
}
