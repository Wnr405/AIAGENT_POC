import { api } from '../../../shared/api/client';

export interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  url: string;
  variants: Partial<Record<'thumbnail' | 'medium', { url: string; width: number; height: number }>>;
  uploadedBy: string;
  createdAt: string;
  referenced?: boolean;
}

export interface Presigned {
  storageKey: string;
  upload: { url: string; method: 'PUT'; headers: Record<string, string>; expiresInSeconds: number };
}

export interface MediaFilter {
  search?: string;
  kind?: 'image' | 'document';
  page: number;
}

interface ListEnvelope<T> {
  data: T[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

export const mediaApi = {
  list: (f: MediaFilter) =>
    api.get<ListEnvelope<MediaItem>>('/admin/media', { search: f.search, kind: f.kind, page: f.page, page_size: 48 }),
  get: (id: string) => api.get<MediaItem>(`/admin/media/${id}`),
  presign: (file: { filename: string; mimeType: string; sizeBytes: number }) => api.post<Presigned>('/admin/media/presign', file),
  finalize: (body: { storageKey: string; filename: string; mimeType: string; altText?: string | null }) =>
    api.post<MediaItem>('/admin/media', body),
  update: (id: string, patch: { altText?: string | null; caption?: string | null }) => api.patch<MediaItem>(`/admin/media/${id}`, patch),
  remove: (id: string, force = false) => api.delete(`/admin/media/${id}`, { force: force ? 'true' : undefined }),
};
