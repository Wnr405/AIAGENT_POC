import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, doc, type TestApp } from '../../../../../test/support/test-app';
import { NotFoundError } from '../../../../shared/kernel/errors';
import { PUBLIC_CACHE_TTL_SECONDS } from './public.use-cases';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

describe('public API (FR-PUBAPI-01/03/05, FR-AUTHZ-06) — critical path', () => {
  let t: TestApp;
  let editor: ReturnType<TestApp['seedUser']>;
  beforeEach(() => {
    t = createTestApp();
    editor = t.seedUser('editor', 'Eve');
  });

  const article = async (title: string, publish: boolean, extra: Record<string, unknown> = {}) => {
    const c = await t.app.content.create.execute(
      { type: 'article', title, body: doc(`${title} body`), ...extra } as never,
      editor,
    );
    if (publish) await t.app.content.transition.execute(c.id, 'publish', editor);
    return c;
  };

  it('FR-PUBAPI-03: an empty site lists nothing (no cache generation yet)', async () => {
    expect((await t.app.publicApi.list.execute('page', {})).items).toEqual([]);
  });

  it('FR-AUTHZ-06 acceptance: drafts never appear in list or detail', async () => {
    await article('Draft one', false);
    await article('Live one', true);
    const list = await t.app.publicApi.list.execute('article', {});
    expect(list.items.map((i) => i.slug)).toEqual(['live-one']);
    await expect(t.app.publicApi.getBySlug.execute('article', 'draft-one')).rejects.toThrow(NotFoundError);
    await expect(t.app.publicApi.getBySlug.execute('page', 'live-one')).rejects.toThrow('Page not found');
  });

  it('UR-D02 / UR-D03 / FR-SEO-03: detail by slug includes SEO, author (articles only), tags and media', async () => {
    const p = await t.app.media.presign.execute(
      { filename: 'h.png', mimeType: 'image/png', sizeBytes: PNG.byteLength },
      editor,
    );
    await t.infra.storage.put(p.storageKey, PNG, 'image/png');
    const m = await t.app.media.finalize.execute(
      { storageKey: p.storageKey, filename: 'h.png', mimeType: 'image/png', altText: 'Hero' },
      editor,
    );
    await article('With media', true, {
      featuredImageId: m.id,
      socialImageId: m.id,
      tags: ['news'],
      category: 'News',
      seoTitle: 'SEO T',
    });
    const item = await t.app.publicApi.getBySlug.execute('article', 'with-media');
    expect(item).toMatchObject({
      title: 'With media',
      author: { name: 'Eve' },
      seo: { title: 'SEO T', description: 'With media body' },
      tags: ['news'],
      category: 'News',
      featuredImage: { id: m.id, alt: 'Hero' },
    });
    expect(item.socialImage?.id).toBe(m.id);
    expect((await t.app.publicApi.getMedia.execute(m.id)).alt).toBe('Hero');
    await expect(t.app.publicApi.getMedia.execute('missing')).rejects.toThrow(NotFoundError);

    const page = await t.app.content.create.execute({ type: 'page', title: 'About', body: doc('x') }, editor);
    await t.app.content.transition.execute(page.id, 'publish', editor);
    expect((await t.app.publicApi.getBySlug.execute('page', 'about')).author).toBeNull();
  });

  it('FR-CONTENT-12 acceptance: unpublish removes the item immediately via cache invalidation', async () => {
    const c = await article('Going away', true);
    expect((await t.app.publicApi.list.execute('article', {})).total).toBe(1);
    expect((await t.app.publicApi.getBySlug.execute('article', 'going-away')).id).toBe(c.id);
    await t.app.content.transition.execute(c.id, 'unpublish', editor);
    expect((await t.app.publicApi.list.execute('article', {})).items).toEqual([]);
    await expect(t.app.publicApi.getBySlug.execute('article', 'going-away')).rejects.toThrow(NotFoundError);
  });

  it('serves repeated reads from cache until the TTL expires', async () => {
    await article('Cached', true);
    await t.app.publicApi.list.execute('article', {});
    await t.app.publicApi.getBySlug.execute('article', 'cached');
    const contents = t.infra.db.table<{ title: string }>('contents');
    for (const row of contents.values()) row.title = 'Changed behind the cache';
    expect((await t.app.publicApi.list.execute('article', {})).items[0]?.title).toBe('Cached');
    expect((await t.app.publicApi.getBySlug.execute('article', 'cached')).title).toBe('Cached');
    t.clock.advance(PUBLIC_CACHE_TTL_SECONDS * 1000);
    expect((await t.app.publicApi.list.execute('article', {})).items[0]?.title).toBe('Changed behind the cache');
  });

  it('defence in depth: cached items whose visibility lapsed are filtered on read', async () => {
    await article('Soon hidden', true);
    await t.app.publicApi.list.execute('article', {});
    await t.app.publicApi.getBySlug.execute('article', 'soon-hidden');
    for (const row of t.infra.db.table<{ publishedAt: Date }>('contents').values())
      row.publishedAt = new Date('2099-01-01');
    // Simulate a cache that still holds the old JSON (e.g. Redis), with publishedAt in the future:
    const key = [...(t.infra.cache as unknown as { store: Map<string, { value: unknown }> }).store.keys()].find((k) =>
      k.includes(':list:'),
    )!;
    const cached = await t.infra.cache.get<{ items: { publishedAt: string }[] }>(key);
    cached!.items[0]!.publishedAt = '2099-01-01T00:00:00.000Z';
    expect((await t.app.publicApi.list.execute('article', {})).items).toEqual([]);
  });

  it('UR-D01 / FR-PUBAPI-05: paginates newest first and filters by tag and category', async () => {
    await article('First', true, { tags: ['a'], category: 'News' });
    t.clock.advanceMinutes(1);
    await article('Second', true, { tags: ['b'] });
    t.clock.advanceMinutes(1);
    await article('Third', true);
    const p1 = await t.app.publicApi.list.execute('article', { page: 1, pageSize: 2 });
    expect([p1.items.map((i) => i.title), p1.total, p1.page, p1.pageSize]).toEqual([['Third', 'Second'], 3, 1, 2]);
    expect((await t.app.publicApi.list.execute('article', { tag: 'B' })).items.map((i) => i.title)).toEqual(['Second']);
    expect((await t.app.publicApi.list.execute('article', { category: 'News' })).items.map((i) => i.title)).toEqual([
      'First',
    ]);
  });
});
