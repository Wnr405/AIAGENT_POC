import { http, HttpResponse, type JsonBodyType } from 'msw';
import type { Content, ContentStatus, ContentVersion } from '../../src/features/content/types/content.types';
import type { MediaItem } from '../../src/features/media/api/media.api';
import type { UserRow } from '../../src/features/users/api/users.api';

/**
 * Stateful in-memory stand-in for the admin API (06-TEST-STRATEGY §8.5), so
 * container components can be exercised end-to-end through TanStack Query.
 * Mirrors the response shapes of 02-SRS §7 — not the business rules.
 */
const API = '/api/admin';
const now = '2026-05-01T09:00:00.000Z';
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

export const EDITOR = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com', name: 'Eve', role: 'editor' as const };
export const ADMIN = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com', name: 'Ada', role: 'admin' as const };
export const AUTHOR = { id: '00000000-0000-4000-8000-0000000000b1', email: 'al@example.com', name: 'Al', role: 'author' as const };

export const doc = (text: string) => ({ type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

export function aContent(over: Partial<Content> = {}): Content {
  const id = over.id ?? uuid();
  return {
    id,
    type: 'article',
    title: 'Hello World',
    slug: 'hello-world',
    status: 'draft',
    author: { id: AUTHOR.id, name: AUTHOR.name },
    featuredImageId: null,
    socialImageId: null,
    seo: { title: null, description: null },
    effectiveSeo: { title: 'Hello World', description: 'Body' },
    tags: [],
    category: null,
    parentId: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    body: doc('Body'),
    ...over,
  };
}

export function aMedia(over: Partial<MediaItem> = {}): MediaItem {
  const id = over.id ?? uuid();
  return {
    id,
    filename: 'photo.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    width: 800,
    height: 600,
    altText: 'A photo',
    caption: null,
    url: `https://cdn.example.com/${id}.png`,
    variants: { thumbnail: { url: `https://cdn.example.com/${id}-t.png`, width: 160, height: 120 } },
    uploadedBy: EDITOR.id,
    createdAt: now,
    referenced: false,
    ...over,
  };
}

export function aUser(over: Partial<UserRow> = {}): UserRow {
  return {
    id: uuid(),
    email: 'user@example.com',
    name: 'User',
    role: 'author',
    status: 'active',
    lastLoginAt: null,
    createdAt: now,
    ...over,
  };
}

const page = <T>(items: T[], pageNo: number, size: number) => ({
  data: items.slice((pageNo - 1) * size, pageNo * size),
  pagination: { page: pageNo, page_size: size, total: items.length, total_pages: Math.max(1, Math.ceil(items.length / size)) },
});

const err = (status: number, code: string, message: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: details ? { code, message, details } : { code, message } }, { status });

interface Failure {
  method: string;
  path: RegExp;
  status: number;
  body: JsonBodyType;
}

export function createFakeApi() {
  const state = {
    contents: [] as Content[],
    versions: new Map<string, ContentVersion[]>(),
    media: [] as MediaItem[],
    users: [] as UserRow[],
    audit: [] as {
      id: string;
      occurredAt: string;
      actorName: string | null;
      actorId: string | null;
      action: string;
      targetType: string;
      targetId: string | null;
      summary: Record<string, unknown>;
    }[],
    keys: [] as { id: string; name: string; prefix: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string }[],
    categories: ['News', 'Guides'],
    requests: [] as { method: string; url: string; body?: unknown }[],
    failures: [] as Failure[],
  };

  /** The next matching request fails with `status` (one-shot). */
  const failNext = (
    method: string,
    path: RegExp,
    status: number,
    body: JsonBodyType = { error: { code: 'HTTP_ERROR', message: 'Nope' } },
  ) => {
    state.failures.push({ method, path, status, body });
  };

  const record = async (request: Request) => {
    let body: unknown;
    try {
      body = request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.clone().json();
    } catch {
      body = undefined;
    }
    state.requests.push({ method: request.method, url: request.url, body });
    const i = state.failures.findIndex((f) => f.method === request.method && f.path.test(new URL(request.url).pathname));
    if (i >= 0) {
      const [f] = state.failures.splice(i, 1);
      return f ? HttpResponse.json(f.body, { status: f.status }) : undefined;
    }
    return undefined;
  };

  const findContent = (id: string) => state.contents.find((c) => c.id === id);
  const snapshot = (c: Content, editor: { id: string; name: string } = EDITOR) => {
    const list = state.versions.get(c.id) ?? [];
    list.unshift({ versionNo: list.length + 1, editor, createdAt: now, snapshot: { title: c.title, slug: c.slug, status: c.status } });
    state.versions.set(c.id, list);
  };
  const touch = (c: Content, patch: Partial<Content>) => {
    Object.assign(c, patch, { updatedAt: new Date(Date.parse(c.updatedAt) + 1000).toISOString() });
    return c;
  };

  const NEXT: Record<string, ContentStatus> = {
    submit: 'in_review',
    reject: 'draft',
    publish: 'published',
    unpublish: 'unpublished',
    archive: 'archived',
  };

  const handlers = [
    // ── content ───────────────────────────────────────────────────────────
    http.get(`${API}/content/stats`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const count = (s: ContentStatus) => state.contents.filter((c) => c.status === s).length;
      return HttpResponse.json({
        draft: count('draft'),
        in_review: count('in_review'),
        published: count('published'),
        unpublished: count('unpublished'),
        archived: count('archived'),
        scheduled: 0,
        total: state.contents.length,
      });
    }),
    http.get(`${API}/content/categories`, async ({ request }) => (await record(request)) ?? HttpResponse.json({ data: state.categories })),
    http.get(`${API}/content`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const q = new URL(request.url).searchParams;
      let items = state.contents.filter(
        (c) => (!q.get('type') || c.type === q.get('type')) && (!q.get('status') || c.status === q.get('status')),
      );
      const search = q.get('search');
      if (search) items = items.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
      const author = q.get('author_id');
      if (author) items = items.filter((c) => c.author.id === author);
      return HttpResponse.json(page(items, Number(q.get('page') ?? 1), Number(q.get('page_size') ?? 25)));
    }),
    http.post(`${API}/content`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const body = (await request.json()) as Partial<Content> & { type: 'article' | 'page'; title: string };
      const c = aContent({
        ...body,
        slug: body.slug ?? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        author: { id: EDITOR.id, name: EDITOR.name },
      });
      state.contents.push(c);
      snapshot(c);
      return HttpResponse.json(c, { status: 201 });
    }),
    http.get(
      `${API}/content/:id/versions`,
      async ({ request, params }) => (await record(request)) ?? HttpResponse.json({ data: state.versions.get(String(params['id'])) ?? [] }),
    ),
    http.post(`${API}/content/:id/revert/:n`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const c = findContent(String(params['id']));
      if (!c) return err(404, 'NOT_FOUND', 'Content not found');
      const v = state.versions.get(c.id)?.find((x) => x.versionNo === Number(params['n']));
      touch(c, { title: v?.snapshot.title ?? c.title });
      snapshot(c);
      return HttpResponse.json(c);
    }),
    http.post(`${API}/content/:id/schedule`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const c = findContent(String(params['id']));
      if (!c) return err(404, 'NOT_FOUND', 'Content not found');
      const { scheduledAt } = (await request.json()) as { scheduledAt: string | null };
      return HttpResponse.json(touch(c, { scheduledAt }));
    }),
    http.post(`${API}/content/:id/:action`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const c = findContent(String(params['id']));
      const next = NEXT[String(params['action'])];
      if (!c || !next) return err(404, 'NOT_FOUND', 'Not found');
      return HttpResponse.json(touch(c, { status: next, publishedAt: next === 'published' ? now : c.publishedAt }));
    }),
    http.get(`${API}/content/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const c = findContent(String(params['id']));
      return c ? HttpResponse.json(c) : err(404, 'NOT_FOUND', 'Content not found');
    }),
    http.patch(`${API}/content/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const c = findContent(String(params['id']));
      if (!c) return err(404, 'NOT_FOUND', 'Content not found');
      const body = (await request.json()) as Record<string, unknown>;
      const { seoTitle, seoDescription, ...rest } = body;
      touch(c, {
        ...(rest as Partial<Content>),
        seo: {
          title: (seoTitle as string | null | undefined) ?? c.seo.title,
          description: (seoDescription as string | null | undefined) ?? c.seo.description,
        },
      });
      snapshot(c);
      return HttpResponse.json(c);
    }),
    http.delete(`${API}/content/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      state.contents = state.contents.filter((c) => c.id !== params['id']);
      return new HttpResponse(null, { status: 204 });
    }),

    // ── media ─────────────────────────────────────────────────────────────
    http.post(`${API}/media/presign`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const body = (await request.json()) as { filename: string };
      const key = `uploads/${body.filename}`;
      return HttpResponse.json({
        storageKey: key,
        upload: {
          url: `https://storage.example.com/${key}`,
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          expiresInSeconds: 900,
        },
      });
    }),
    http.put('https://storage.example.com/*', () => new HttpResponse(null, { status: 200 })),
    http.get(`${API}/media`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const q = new URL(request.url).searchParams;
      let items = state.media;
      const search = q.get('search');
      if (search) items = items.filter((m) => m.filename.includes(search));
      if (q.get('kind') === 'document') items = items.filter((m) => m.mimeType === 'application/pdf');
      if (q.get('kind') === 'image') items = items.filter((m) => m.mimeType !== 'application/pdf');
      return HttpResponse.json(page(items, Number(q.get('page') ?? 1), Number(q.get('page_size') ?? 48)));
    }),
    http.post(`${API}/media`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const body = (await request.json()) as { filename: string; mimeType: string };
      const m = aMedia({ filename: body.filename, mimeType: body.mimeType });
      state.media.push(m);
      return HttpResponse.json(m, { status: 201 });
    }),
    http.get(`${API}/media/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const m = state.media.find((x) => x.id === params['id']);
      return m ? HttpResponse.json(m) : err(404, 'NOT_FOUND', 'Media not found');
    }),
    http.patch(`${API}/media/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const m = state.media.find((x) => x.id === params['id']);
      if (!m) return err(404, 'NOT_FOUND', 'Media not found');
      Object.assign(m, await request.json());
      return HttpResponse.json(m);
    }),
    http.delete(`${API}/media/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      state.media = state.media.filter((x) => x.id !== params['id']);
      return new HttpResponse(null, { status: 204 });
    }),

    // ── users ─────────────────────────────────────────────────────────────
    http.get(`${API}/users`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const q = new URL(request.url).searchParams;
      return HttpResponse.json(page(state.users, Number(q.get('page') ?? 1), Number(q.get('page_size') ?? 25)));
    }),
    http.post(`${API}/users`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const body = (await request.json()) as { email: string; name: string; role: UserRow['role'] };
      if (state.users.some((u) => u.email === body.email)) {
        return err(422, 'VALIDATION_ERROR', 'Request validation failed', {
          fields: [{ field: 'email', message: 'Email is already in use' }],
        });
      }
      const u = aUser({ ...body, status: 'invited' });
      state.users.push(u);
      return HttpResponse.json(u, { status: 201 });
    }),
    http.patch(`${API}/users/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const u = state.users.find((x) => x.id === params['id']);
      if (!u) return err(404, 'NOT_FOUND', 'User not found');
      Object.assign(u, await request.json());
      return HttpResponse.json(u);
    }),
    http.post(`${API}/users/:id/deactivate`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const u = state.users.find((x) => x.id === params['id']);
      if (!u) return err(404, 'NOT_FOUND', 'User not found');
      u.status = 'deactivated';
      return HttpResponse.json(u);
    }),
    http.post(
      `${API}/users/:id/reset-password`,
      async ({ request }) => (await record(request)) ?? HttpResponse.json({ status: 'accepted' }, { status: 202 }),
    ),

    // ── audit ─────────────────────────────────────────────────────────────
    http.get(
      `${API}/audit/export.csv`,
      async ({ request }) =>
        (await record(request)) ?? new HttpResponse('id,action\r\n1,content.create\r\n', { headers: { 'Content-Type': 'text/csv' } }),
    ),
    http.get(`${API}/audit`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const q = new URL(request.url).searchParams;
      const action = q.get('action');
      const rows = action ? state.audit.filter((a) => a.action.startsWith(action)) : state.audit;
      return HttpResponse.json(page(rows, Number(q.get('page') ?? 1), Number(q.get('page_size') ?? 50)));
    }),

    // ── API keys ──────────────────────────────────────────────────────────
    http.get(`${API}/api-keys`, async ({ request }) => (await record(request)) ?? HttpResponse.json({ data: state.keys })),
    http.post(`${API}/api-keys`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const { name } = (await request.json()) as { name: string };
      const k = { id: uuid(), name, prefix: 'cms_live_ab', lastUsedAt: null, revokedAt: null, createdAt: now };
      state.keys.push(k);
      return HttpResponse.json({ ...k, key: 'cms_live_abcdef0123456789' });
    }),
    http.delete(`${API}/api-keys/:id`, async ({ request, params }) => {
      const fail = await record(request);
      if (fail) return fail;
      const k = state.keys.find((x) => x.id === params['id']);
      if (k) k.revokedAt = now;
      return new HttpResponse(null, { status: 204 });
    }),

    // ── auth self-service ────────────────────────────────────────────────
    http.post(`${API}/auth/me/password`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const body = (await request.json()) as { currentPassword: string };
      if (body.currentPassword !== 'correct-horse-42') {
        return err(422, 'VALIDATION_ERROR', 'Current password is incorrect', { field: 'currentPassword' });
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(
      `${API}/auth/password/forgot`,
      async ({ request }) => (await record(request)) ?? HttpResponse.json({ status: 'accepted' }, { status: 202 }),
    ),
    http.post(`${API}/auth/password/reset`, async ({ request }) => {
      const fail = await record(request);
      if (fail) return fail;
      const body = (await request.json()) as { token: string };
      return body.token === 'good'
        ? new HttpResponse(null, { status: 204 })
        : err(422, 'VALIDATION_ERROR', 'This link is invalid or has expired', { field: 'token' });
    }),
    http.post(`${API}/auth/invite/accept`, async ({ request }) => (await record(request)) ?? new HttpResponse(null, { status: 204 })),
    http.post(`${API}/auth/logout`, async ({ request }) => (await record(request)) ?? new HttpResponse(null, { status: 204 })),
  ];

  return { state, handlers, failNext };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
