export const CONTENT_STATUSES = ['draft', 'in_review', 'published', 'unpublished', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(v: unknown): v is ContentStatus {
  return typeof v === 'string' && (CONTENT_STATUSES as readonly string[]).includes(v);
}
