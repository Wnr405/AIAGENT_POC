/** Read model served by the public API (UR-D03). Independent of the content module's internals. */
export interface PublicMediaRef {
  readonly id: string;
  readonly url: string;
  readonly alt: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly variants: Partial<Record<'thumbnail' | 'medium', { url: string; width: number; height: number }>>;
}

export interface PublishedItem {
  readonly id: string;
  readonly type: 'article' | 'page';
  readonly status: string;
  readonly title: string;
  readonly slug: string;
  readonly body: unknown; // sanitised ProseMirror JSON
  readonly author: { name: string } | null;
  readonly featuredImage: PublicMediaRef | null;
  readonly socialImage: PublicMediaRef | null;
  readonly seo: { title: string; description: string };
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * FR-AUTHZ-06 / FR-PUBAPI-03 / RK-04. The repository already filters on this;
 * the use case re-checks every row (defence in depth). CRITICAL PATH.
 */
export function isPubliclyVisible(
  item: Pick<PublishedItem, 'status' | 'publishedAt' | 'deletedAt'>,
  now: Date,
): boolean {
  return (
    item.status === 'published' &&
    item.deletedAt === null &&
    item.publishedAt !== null &&
    item.publishedAt.getTime() <= now.getTime()
  );
}
