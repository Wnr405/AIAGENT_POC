export const CONTENT_TYPES = ['article', 'page'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export function isContentType(v: unknown): v is ContentType {
  return typeof v === 'string' && (CONTENT_TYPES as readonly string[]).includes(v);
}
