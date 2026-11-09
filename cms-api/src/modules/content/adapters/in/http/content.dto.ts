import { z } from 'zod';
import { CONTENT_STATUSES } from '../../../domain/value-objects/content-status';
import { CONTENT_TYPES } from '../../../domain/value-objects/content-type';

const uuidOrNull = z.string().uuid().nullable();

/** Shape validation only — business rules (lengths, slug format, sanitisation) live in the domain. */
export const ContentFieldsSchema = z.object({
  title: z.string().max(400).optional(),
  slug: z.string().max(200).optional(),
  body: z.unknown().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  category: z.string().max(100).nullable().optional(),
  parentId: uuidOrNull.optional(),
  featuredImageId: uuidOrNull.optional(),
  socialImageId: uuidOrNull.optional(),
});

export const CreateContentRequest = ContentFieldsSchema.extend({
  type: z.enum(CONTENT_TYPES),
  title: z.string().max(400),
});

export const UpdateContentRequest = ContentFieldsSchema;

export const ScheduleRequest = z.object({ scheduledAt: z.string().datetime({ offset: true }).nullable() });

export const ListContentQuery = z.object({
  type: z.enum(CONTENT_TYPES).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  author_id: z.string().uuid().optional(),
  tag: z.string().max(40).optional(),
  search: z.string().max(200).optional(),
  updated_from: z.string().datetime({ offset: true }).optional(),
  updated_to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['updatedAt', 'title', 'status', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().optional(),
  page_size: z.coerce.number().int().optional(),
});
