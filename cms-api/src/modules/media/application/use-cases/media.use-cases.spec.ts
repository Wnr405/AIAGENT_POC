import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, doc, type TestApp } from '../../../../../test/support/test-app';
import { SYSTEM_ACTOR } from '../../../../shared/kernel/actor';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/kernel/errors';
import { GENERATE_VARIANTS_JOB } from './media.use-cases';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]);

describe('media use cases (UR-U05, UR-E04, FR-MEDIA-*)', () => {
  let t: TestApp;
  let admin: ReturnType<TestApp['seedUser']>;
  let editor: ReturnType<TestApp['seedUser']>;
  let author: ReturnType<TestApp['seedUser']>;
  beforeEach(() => {
    t = createTestApp();
    admin = t.seedUser('admin');
    editor = t.seedUser('editor');
    author = t.seedUser('author');
  });

  /** presign → browser PUT (simulated) → finalize */
  async function upload(who = author, opts: { name?: string; mime?: string; data?: Uint8Array; alt?: string } = {}) {
    const name = opts.name ?? 'hero.png';
    const mime = opts.mime ?? 'image/png';
    const data = opts.data ?? PNG;
    const p = await t.app.media.presign.execute({ filename: name, mimeType: mime, sizeBytes: data.byteLength }, who);
    await t.infra.storage.put(p.storageKey, data, mime);
    return t.app.media.finalize.execute(
      { storageKey: p.storageKey, filename: name, mimeType: mime, altText: opts.alt },
      who,
    );
  }

  it('FR-MEDIA-04: presign returns a PUT URL under the uploader prefix', async () => {
    const p = await t.app.media.presign.execute({ filename: 'a.png', mimeType: 'image/png', sizeBytes: 10 }, author);
    expect(p.storageKey.startsWith(`uploads/${author.userId}/`)).toBe(true);
    expect(p.storageKey.endsWith('.png')).toBe(true);
    expect(p.upload).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/png' }, expiresInSeconds: 900 });
  });

  it('FR-MEDIA-01/02: presign rejects disallowed types and oversize files', async () => {
    await expect(
      t.app.media.presign.execute({ filename: 'a.exe', mimeType: 'application/octet-stream', sizeBytes: 1 }, author),
    ).rejects.toThrow(ValidationError);
    await expect(
      t.app.media.presign.execute({ filename: 'a.png', mimeType: 'image/png', sizeBytes: 20 * 1048576 + 1 }, author),
    ).rejects.toThrow('20 MB');
  });

  it('finalize registers the item, audits, and queues variant generation', async () => {
    const m = await upload(author, { alt: 'Hero' });
    expect(m).toMatchObject({
      filename: 'hero.png',
      mimeType: 'image/png',
      sizeBytes: PNG.byteLength,
      altText: 'Hero',
      uploadedBy: author.userId,
      variants: {},
    });
    expect(m.url).toContain('/api/dev/storage/');
    expect(t.jobs.jobs).toEqual([{ name: GENERATE_VARIANTS_JOB, payload: { mediaId: m.id } }]);
    expect(t.auditActions()).toEqual(['media.upload']);
  });

  it('FR-MEDIA-03: magic bytes must match; rejected payloads are deleted from storage', async () => {
    await expect(upload(author, { data: JPEG })).rejects.toThrow('does not match its declared type');
    expect(t.infra.storage.objects.size).toBe(0);
  });

  it('SEC-05: unsafe SVGs are rejected; safe SVGs accepted without variants', async () => {
    const bad = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    await expect(upload(author, { name: 'x.svg', mime: 'image/svg+xml', data: bad })).rejects.toThrow('SVG rejected');
    const ok = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    await upload(author, { name: 'logo.svg', mime: 'image/svg+xml', data: ok });
    expect(t.jobs.jobs).toEqual([]);
  });

  it('finalize enforces ownership of the storage key, existence, size and single use', async () => {
    const p = await t.app.media.presign.execute(
      { filename: 'a.png', mimeType: 'image/png', sizeBytes: PNG.byteLength },
      author,
    );
    await expect(
      t.app.media.finalize.execute({ storageKey: p.storageKey, filename: 'a.png', mimeType: 'image/png' }, editor),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      t.app.media.finalize.execute(
        { storageKey: `uploads/${author.userId}/../x.png`, filename: 'a.png', mimeType: 'image/png' },
        author,
      ),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      t.app.media.finalize.execute({ storageKey: p.storageKey, filename: 'a.png', mimeType: 'image/png' }, author),
    ).rejects.toThrow('not found in storage');
    await t.infra.storage.put(p.storageKey, new Uint8Array(21 * 1048576), 'image/png');
    await expect(
      t.app.media.finalize.execute({ storageKey: p.storageKey, filename: 'a.png', mimeType: 'image/png' }, author),
    ).rejects.toThrow('20 MB');
    const m = await upload(author);
    const key = t.infra.db.table<{ storageKey: string }>('media').get(m.id)?.storageKey as string;
    await t.infra.storage.put(key, PNG, 'image/png');
    await expect(
      t.app.media.finalize.execute({ storageKey: key, filename: 'a.png', mimeType: 'image/png' }, author),
    ).rejects.toThrow(ConflictError);
  });

  it('FR-MEDIA-05: the variant job stores thumbnail (≤320) and medium (≤1024)', async () => {
    const m = await upload();
    await t.app.media.generateVariants.execute(m.id);
    const v = await t.app.media.get.execute(m.id, author);
    expect([v.width, v.height]).toEqual([2000, 1000]);
    expect(Object.keys(v.variants)).toEqual(['thumbnail', 'medium']);
    expect(v.variants.thumbnail?.width).toBe(320);
    expect(v.variants.medium?.width).toBe(1024);
    expect(v.referenced).toBe(false);
    await t.app.media.generateVariants.execute('missing'); // no-op
  });

  it('variants are skipped when the feature flag is off', async () => {
    t = createTestApp({ variantsEnabled: false });
    author = t.seedUser('author');
    await upload(author);
    expect(t.jobs.jobs).toEqual([]);
  });

  it('FR-MEDIA-06: uploader or editors update alt text and caption; others may not', async () => {
    const m = await upload(author);
    expect((await t.app.media.update.execute(m.id, { altText: 'A', caption: 'C' }, author)).caption).toBe('C');
    expect((await t.app.media.update.execute(m.id, { altText: 'B' }, editor)).altText).toBe('B');
    const another = t.seedUser('author');
    await expect(t.app.media.update.execute(m.id, { altText: 'x' }, another)).rejects.toThrow(ForbiddenError);
  });

  it('FR-MEDIA-07 acceptance: referenced media cannot be deleted (409) unless an admin forces it', async () => {
    const m = await upload(author);
    const c = await t.app.content.create.execute(
      { type: 'article', title: 'Uses image', body: doc('x'), featuredImageId: m.id },
      editor,
    );
    await t.app.content.transition.execute(c.id, 'publish', editor);
    await expect(t.app.media.delete.execute(m.id, { force: false }, editor)).rejects.toThrow('used by content');
    await expect(t.app.media.delete.execute(m.id, { force: true }, editor)).rejects.toThrow(ForbiddenError);
    await t.app.media.delete.execute(m.id, { force: true }, admin);
    await expect(t.app.media.get.execute(m.id, admin)).rejects.toThrow(NotFoundError);
    expect(t.auditActions()).toContain('media.delete');
  });

  it('inline body images count as references', async () => {
    const m = await upload(author);
    await t.app.content.create.execute(
      {
        type: 'article',
        title: 'Inline',
        body: { type: 'doc', content: [{ type: 'image', attrs: { src: m.url, mediaId: m.id } }] },
      },
      author,
    );
    await expect(t.app.media.delete.execute(m.id, { force: false }, author)).rejects.toThrow(ConflictError);
  });

  it('authors delete only their own unreferenced media', async () => {
    const mine = await upload(author);
    const theirs = await upload(editor);
    await expect(t.app.media.delete.execute(theirs.id, { force: false }, author)).rejects.toThrow(ForbiddenError);
    await t.app.media.delete.execute(mine.id, { force: false }, author);
    await expect(t.app.media.delete.execute(mine.id, { force: false }, author)).rejects.toThrow(NotFoundError);
  });

  it('FR-MEDIA-08: lists with search, uploader, kind and date filters', async () => {
    await upload(author, { name: 'team.png', alt: 'Our team' });
    await upload(editor, { name: 'faq.pdf', mime: 'application/pdf', data: new TextEncoder().encode('%PDF-1.4 x') });
    const names = (q: Record<string, unknown>) =>
      t.app.media.list.execute(q, author).then((r) => r.items.map((i) => i.filename));
    expect((await names({})).sort()).toEqual(['faq.pdf', 'team.png']);
    expect(await names({ search: 'TEAM' })).toEqual(['team.png']);
    expect(await names({ search: 'our' })).toEqual(['team.png']);
    expect(await names({ uploadedBy: editor.userId })).toEqual(['faq.pdf']);
    expect(await names({ kind: 'document' })).toEqual(['faq.pdf']);
    expect(await names({ kind: 'image' })).toEqual(['team.png']);
    expect(await names({ from: new Date('2030-01-01') })).toEqual([]);
    expect(await names({ to: new Date('2000-01-01') })).toEqual([]);
  });

  it('purges soft-deleted media and its objects after retention', async () => {
    const m = await upload(author);
    await t.app.media.generateVariants.execute(m.id);
    await t.app.media.delete.execute(m.id, { force: false }, author);
    expect(await t.app.jobs.purgeMedia.execute(SYSTEM_ACTOR)).toBe(0);
    t.clock.advance(31 * 86400_000);
    expect(await t.app.jobs.purgeMedia.execute(SYSTEM_ACTOR)).toBe(1);
    expect(t.infra.storage.objects.size).toBe(0);
    expect(t.auditActions().at(-1)).toBe('media.purge');
  });
});
