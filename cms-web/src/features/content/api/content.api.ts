import { api } from '../../../shared/api/client';
import type {
  Content,
  ContentFields,
  ContentFilter,
  ContentSummary,
  ContentType,
  ContentVersion,
  ListEnvelope,
  TransitionAction,
} from '../types/content.types';

/** Pure HTTP functions for the content feature (04-ARCH §5.9). */
export const contentApi = {
  list: (f: ContentFilter) =>
    api.get<ListEnvelope<ContentSummary>>('/admin/content', {
      type: f.type,
      status: f.status,
      search: f.search,
      author_id: f.authorId,
      page: f.page,
      page_size: 25,
      sort: f.sort,
      order: f.order,
    }),
  get: (id: string) => api.get<Content>(`/admin/content/${id}`),
  create: (type: ContentType, fields: ContentFields & { title: string }) => api.post<Content>('/admin/content', { type, ...fields }),
  update: (id: string, fields: ContentFields) => api.patch<Content>(`/admin/content/${id}`, fields),
  transition: (id: string, action: TransitionAction) => api.post<Content>(`/admin/content/${id}/${action}`),
  schedule: (id: string, scheduledAt: string | null) => api.post<Content>(`/admin/content/${id}/schedule`, { scheduledAt }),
  remove: (id: string) => api.delete(`/admin/content/${id}`),
  versions: (id: string) => api.get<{ data: ContentVersion[] }>(`/admin/content/${id}/versions`).then((r) => r.data),
  revert: (id: string, version: number) => api.post<Content>(`/admin/content/${id}/revert/${version}`),
  categories: () => api.get<{ data: string[] }>('/admin/content/categories').then((r) => r.data),
  mediaItem: (id: string) =>
    api.get<{ id: string; filename: string; url: string; altText: string | null; variants: { thumbnail?: { url: string } } }>(
      `/admin/media/${id}`,
    ),
  /** Minimal media lookup for the picker (feature-local; no import from features/media). */
  images: (search: string) =>
    api.get<ListEnvelope<{ id: string; filename: string; url: string; altText: string | null; variants: { thumbnail?: { url: string } } }>>(
      '/admin/media',
      { kind: 'image', search, page_size: 48 },
    ),
};
