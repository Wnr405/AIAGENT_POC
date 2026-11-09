/** Frontend view of the admin content API (02-SRS §7.1). */
export type ContentType = 'article' | 'page';
export type ContentStatus = 'draft' | 'in_review' | 'published' | 'unpublished' | 'archived';
export type RouteType = 'articles' | 'pages';

export const routeToType = (r: RouteType): ContentType => (r === 'articles' ? 'article' : 'page');
export const typeToRoute = (t: ContentType): RouteType => (t === 'article' ? 'articles' : 'pages');

export interface RichTextDoc {
  type: 'doc';
  content?: unknown[];
}

export interface ContentSummary {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  status: ContentStatus;
  author: { id: string; name: string | null };
  featuredImageId: string | null;
  socialImageId: string | null;
  seo: { title: string | null; description: string | null };
  effectiveSeo: { title: string; description: string };
  tags: string[];
  category: string | null;
  parentId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Content extends ContentSummary {
  body: RichTextDoc;
}

export interface ContentFields {
  title?: string;
  slug?: string;
  body?: RichTextDoc;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: string[];
  category?: string | null;
  parentId?: string | null;
  featuredImageId?: string | null;
  socialImageId?: string | null;
}

export interface ContentVersion {
  versionNo: number;
  editor: { id: string | null; name: string | null };
  createdAt: string;
  snapshot: { title: string; slug: string; status: ContentStatus };
}

export interface ContentStats {
  draft: number;
  in_review: number;
  published: number;
  unpublished: number;
  archived: number;
  scheduled: number;
  total: number;
}

export interface ListEnvelope<T> {
  data: T[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}

export interface ContentFilter {
  type: ContentType;
  status?: ContentStatus;
  search?: string;
  authorId?: string;
  page: number;
  sort?: 'updatedAt' | 'title' | 'status';
  order?: 'asc' | 'desc';
}

export type TransitionAction = 'submit' | 'reject' | 'publish' | 'unpublish' | 'archive';
