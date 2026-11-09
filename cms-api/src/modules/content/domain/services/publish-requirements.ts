import type { RichTextBody } from '../value-objects/rich-text-body.vo';
import { SEO_DESCRIPTION_MAX } from '../value-objects/seo-metadata.vo';

/**
 * FR-CONTENT-06: non-empty title, non-empty body, valid slug and a non-empty
 * meta description ≤ 160 chars (the FR-SEO-02 default counts). CRITICAL PATH.
 * Slug validity is guaranteed by the Slug value object, so it is not re-checked.
 */
export function unmetPublishRequirements(input: {
  title: string;
  body: RichTextBody;
  effectiveDescription: string;
}): string[] {
  const missing: string[] = [];
  if (input.title.trim().length === 0) missing.push('title');
  if (input.body.isEmpty()) missing.push('body');
  const d = input.effectiveDescription.trim();
  if (d.length === 0 || d.length > SEO_DESCRIPTION_MAX) missing.push('seoDescription');
  return missing;
}
