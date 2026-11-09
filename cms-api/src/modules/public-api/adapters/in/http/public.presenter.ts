import { createHash } from 'node:crypto';
import type { PublicMediaRef, PublishedItem } from '../../../domain/published-content';
import { renderHtml } from '../../../domain/render-html';

/** UR-D03: structured, snake_case JSON for external consumers (no internal fields). */
export function presentMedia(m: PublicMediaRef | null) {
  if (!m) return null;
  return { id: m.id, url: m.url, alt: m.alt, width: m.width, height: m.height, variants: m.variants };
}

export function presentSummary(i: PublishedItem) {
  return {
    id: i.id,
    type: i.type,
    title: i.title,
    slug: i.slug,
    excerpt: i.seo.description,
    author: i.author,
    featured_image: presentMedia(i.featuredImage),
    tags: i.type === 'article' ? i.tags : undefined,
    category: i.type === 'article' ? i.category : undefined,
    parent_id: i.type === 'page' ? i.parentId : undefined,
    published_at: i.publishedAt,
    updated_at: i.updatedAt,
  };
}

export function presentDetail(i: PublishedItem) {
  return {
    ...presentSummary(i),
    body: i.body,
    body_html: renderHtml(i.body),
    seo: { title: i.seo.title, description: i.seo.description, social_image: presentMedia(i.socialImage) },
  };
}

/** FR-PUBAPI-04: strong ETag over the exact JSON we send. */
export function etagFor(payload: unknown): string {
  return `"${createHash('sha1').update(JSON.stringify(payload)).digest('base64url')}"`;
}

export function lastModified(items: readonly Pick<PublishedItem, 'updatedAt'>[]): Date | null {
  return items.reduce<Date | null>((max, i) => (max === null || i.updatedAt > max ? i.updatedAt : max), null);
}
