import { Content } from '../../src/modules/content/domain/entities/content.entity';
import { RichTextBody } from '../../src/modules/content/domain/value-objects/rich-text-body.vo';
import { SeoMetadata } from '../../src/modules/content/domain/value-objects/seo-metadata.vo';
import { Slug } from '../../src/modules/content/domain/value-objects/slug.vo';
import type { ContentProps } from '../../src/modules/content/domain/entities/content.entity';

export const AUTHOR_ID = '00000000-0000-4000-8000-0000000000a1';

/** Test data builder (06-TEST-STRATEGY §11.2). */
export function aContent(overrides: Partial<ContentProps> = {}): Content {
  return Content.rehydrate({
    id: '00000000-0000-4000-8000-0000000000c1',
    type: 'article',
    title: 'Default Test Title',
    slug: Slug.create('default-test-title'),
    body: RichTextBody.fromUntrusted({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Some body text for testing.' }] }],
    }),
    status: 'draft',
    authorId: AUTHOR_ID,
    featuredImageId: null,
    socialImageId: null,
    seo: SeoMetadata.create({ description: 'A default description for testing.' }),
    tags: [],
    category: null,
    parentId: null,
    scheduledAt: null,
    publishedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    ...overrides,
  });
}
