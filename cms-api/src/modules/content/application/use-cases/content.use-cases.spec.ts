import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, doc, type TestApp } from '../../../../../test/support/test-app';
import { SYSTEM_ACTOR } from '../../../../shared/kernel/actor';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../shared/kernel/errors';
import { InvalidTransitionError, PublishRequirementsError, SlugConflictError } from '../../domain/errors';

describe('content use cases', () => {
  let t: TestApp;
  let admin: ReturnType<TestApp['seedUser']>;
  let editor: ReturnType<TestApp['seedUser']>;
  let author: ReturnType<TestApp['seedUser']>;
  let other: ReturnType<TestApp['seedUser']>;

  beforeEach(() => {
    t = createTestApp();
    admin = t.seedUser('admin', 'Ada');
    editor = t.seedUser('editor', 'Eve');
    author = t.seedUser('author', 'Al');
    other = t.seedUser('author', 'Olga');
  });

  const create = (who = author, extra: Record<string, unknown> = {}) =>
    t.app.content.create.execute(
      { type: 'article', title: 'Hello World', body: doc('Body text'), ...extra } as never,
      who,
    );

  describe('create (UR-U01, UR-U06, FR-CONTENT-01/02/05)', () => {
    it('saves a draft with only a title, auto-slugs, versions and audits', async () => {
      const v = await t.app.content.create.execute({ type: 'page', title: 'About Us' }, author);
      expect(v).toMatchObject({
        type: 'page',
        title: 'About Us',
        slug: 'about-us',
        status: 'draft',
        author: { id: author.userId, name: 'Al' },
      });
      expect((await t.app.content.listVersions.execute(v.id, author)).map((x) => x.versionNo)).toEqual([1]);
      expect(t.auditActions()).toEqual(['content.create']);
    });

    it('de-duplicates auto slugs per type, but the same slug may exist in another type', async () => {
      expect((await create()).slug).toBe('hello-world');
      expect((await create()).slug).toBe('hello-world-2');
      expect((await create()).slug).toBe('hello-world-3');
      expect((await t.app.content.create.execute({ type: 'page', title: 'Hello World' }, author)).slug).toBe(
        'hello-world',
      );
    });

    it('FR-CONTENT-03: an explicit duplicate slug is a 409 conflict', async () => {
      await create(author, { slug: 'taken' });
      await expect(create(author, { slug: 'taken' })).rejects.toThrow(SlugConflictError);
      await expect(create(author, { slug: 'Bad Slug' })).rejects.toThrow(ValidationError);
    });

    it('validates category, parent page and media references', async () => {
      await expect(create(author, { category: 'Gossip' })).rejects.toThrow('Unknown category');
      expect((await create(author, { category: 'News' })).category).toBe('News');
      expect((await create(author, { category: '' })).category).toBeNull();
      await expect(
        t.app.content.create.execute({ type: 'page', title: 'Child', parentId: 'nope' }, author),
      ).rejects.toThrow('Parent page not found');
      const parent = await t.app.content.create.execute({ type: 'page', title: 'Parent' }, author);
      const child = await t.app.content.create.execute({ type: 'page', title: 'Child', parentId: parent.id }, author);
      expect(child.parentId).toBe(parent.id);
      await expect(
        t.app.content.create.execute({ type: 'page', title: 'Grandchild', parentId: child.id }, author),
      ).rejects.toThrow('one level');
      const article = await create();
      await expect(
        t.app.content.create.execute({ type: 'page', title: 'X', parentId: article.id }, author),
      ).rejects.toThrow('Parent page not found');
      await expect(create(author, { featuredImageId: '00000000-0000-4000-8000-0000000000ff' })).rejects.toThrow(
        'Referenced media not found',
      );
    });

    it('SEC-04 acceptance: script in the body is stored inert', async () => {
      const v = await create(author, {
        body: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
            { type: 'script', content: [] },
          ],
        },
      });
      expect(v.body).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }],
      });
    });
  });

  describe('authorization (FR-AUTHZ-02/03) — critical path', () => {
    it('FR-AUTHZ-02 acceptance: authors list only their own content regardless of query params', async () => {
      await create(author);
      await create(other);
      await create(editor);
      const mine = await t.app.content.list.execute({ authorId: other.userId }, author);
      expect(mine.items.map((c) => c.author.id)).toEqual([author.userId]);
      const all = await t.app.content.list.execute({}, editor);
      expect(all.total).toBe(3);
      const filtered = await t.app.content.list.execute({ authorId: other.userId }, editor);
      expect(filtered.items.map((c) => c.author.name)).toEqual(['Olga']);
    });

    it("authors cannot view or edit others' drafts but can view others' published items", async () => {
      const draft = await create(other);
      await expect(t.app.content.get.execute(draft.id, author)).rejects.toThrow(ForbiddenError);
      await expect(t.app.content.update.execute(draft.id, { title: 'x' }, author)).rejects.toThrow(ForbiddenError);
      await expect(t.app.content.listVersions.execute(draft.id, author)).rejects.toThrow(ForbiddenError);
      await t.app.content.transition.execute(draft.id, 'publish', editor);
      expect((await t.app.content.get.execute(draft.id, author)).status).toBe('published');
    });

    it('UR-E03: editors edit anyone’s content', async () => {
      const c = await create(author);
      expect((await t.app.content.update.execute(c.id, { title: 'Fixed' }, editor)).title).toBe('Fixed');
    });

    it('FR-CONTENT-04 acceptance: draft → publish allowed for editors, denied for authors', async () => {
      const c = await create(author);
      await expect(t.app.content.transition.execute(c.id, 'publish', author)).rejects.toThrow(ForbiddenError);
      expect((await t.app.content.transition.execute(c.id, 'publish', editor)).status).toBe('published');
      await expect(t.app.content.transition.execute(c.id, 'submit', editor)).rejects.toThrow(InvalidTransitionError);
    });

    it("authors may only submit their own items; editors may submit anyone's", async () => {
      const c = await create(other);
      await expect(t.app.content.transition.execute(c.id, 'submit', author)).rejects.toThrow(ForbiddenError);
      expect((await t.app.content.transition.execute(c.id, 'submit', editor)).status).toBe('in_review');
    });

    it('authors cannot schedule, delete, reject, unpublish or archive', async () => {
      const c = await create(author);
      await expect(t.app.content.schedule.execute(c.id, new Date('2027-01-01'), author)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(t.app.content.delete.execute(c.id, author)).rejects.toThrow(ForbiddenError);
      for (const action of ['reject', 'unpublish', 'archive'] as const) {
        await expect(t.app.content.transition.execute(c.id, action, author)).rejects.toThrow(ForbiddenError);
      }
    });
  });

  describe('workflow (BR-02)', () => {
    it('UR-U03 / UR-E01 / UR-E02: submit → reject → submit → publish → unpublish → archive, all audited (FR-CONTENT-16)', async () => {
      const c = await create(author);
      await t.app.content.transition.execute(c.id, 'submit', author);
      await t.app.content.transition.execute(c.id, 'reject', editor);
      await t.app.content.transition.execute(c.id, 'submit', author);
      await t.app.content.transition.execute(c.id, 'publish', editor);
      await t.app.content.transition.execute(c.id, 'unpublish', admin);
      const v = await t.app.content.transition.execute(c.id, 'archive', admin);
      expect(v.status).toBe('archived');
      expect(t.auditActions()).toEqual([
        'content.create',
        'content.submit',
        'content.reject',
        'content.submit',
        'content.publish',
        'content.unpublish',
        'content.archive',
      ]);
    });

    it('FR-CONTENT-06: publishing incomplete content lists what is missing', async () => {
      const c = await t.app.content.create.execute({ type: 'article', title: 'Empty' }, editor);
      await expect(t.app.content.transition.execute(c.id, 'publish', editor)).rejects.toThrow(PublishRequirementsError);
    });

    it('editing unpublished content returns it to draft', async () => {
      const c = await create(author);
      await t.app.content.transition.execute(c.id, 'publish', editor);
      await t.app.content.transition.execute(c.id, 'unpublish', editor);
      expect((await t.app.content.update.execute(c.id, { title: 'Again' }, author)).status).toBe('draft');
    });

    it('update validates slug uniqueness only when it changes', async () => {
      await create(author, { slug: 'one' });
      const two = await create(author, { slug: 'two' });
      await expect(t.app.content.update.execute(two.id, { slug: 'one' }, author)).rejects.toThrow(SlugConflictError);
      expect(
        (
          await t.app.content.update.execute(
            two.id,
            { slug: 'two', seoTitle: 'S', seoDescription: 'D', tags: ['A'] },
            author,
          )
        ).seo,
      ).toEqual({ title: 'S', description: 'D' });
    });

    it('unknown and deleted items are 404', async () => {
      await expect(t.app.content.get.execute('missing', editor)).rejects.toThrow(NotFoundError);
      const c = await create(author);
      await t.app.content.delete.execute(c.id, editor);
      await expect(t.app.content.get.execute(c.id, editor)).rejects.toThrow(NotFoundError);
      expect((await t.app.content.list.execute({}, editor)).total).toBe(0);
    });
  });

  describe('scheduled publish (FR-CONTENT-07)', () => {
    it('acceptance: an in-review item scheduled +5 min is published by the job once due', async () => {
      const c = await create(author);
      await t.app.content.transition.execute(c.id, 'submit', author);
      const at = new Date(t.clock.now().getTime() + 5 * 60_000);
      expect((await t.app.content.schedule.execute(c.id, at, editor)).scheduledAt).toEqual(at);
      expect(await t.app.jobs.publishDue.publishDue(SYSTEM_ACTOR)).toBe(0);
      t.clock.advanceMinutes(5);
      expect(await t.app.jobs.publishDue.publishDue(SYSTEM_ACTOR)).toBe(1);
      const v = await t.app.content.get.execute(c.id, editor);
      expect([v.status, v.scheduledAt, v.publishedAt]).toEqual(['published', null, t.clock.now()]);
      const publish = [...t.infra.db.table<{ action: string; actorId: string | null }>('audit_events').values()].find(
        (e) => e.action === 'content.publish',
      );
      expect(publish?.actorId).toBeNull(); // system actor
    });

    it('can be cancelled', async () => {
      const c = await create(author);
      await t.app.content.schedule.execute(c.id, new Date('2027-01-01'), editor);
      expect((await t.app.content.schedule.execute(c.id, null, editor)).scheduledAt).toBeNull();
      await expect(t.app.content.schedule.execute(c.id, null, editor)).rejects.toThrow(ConflictError);
    });

    it('stats count scheduled items and scope authors to their own', async () => {
      const c = await create(author);
      await create(other);
      await t.app.content.schedule.execute(c.id, new Date('2027-01-01'), editor);
      expect(await t.app.content.stats.execute(editor)).toEqual({
        draft: 2,
        in_review: 0,
        published: 0,
        unpublished: 0,
        archived: 0,
        scheduled: 1,
        total: 2,
      });
      expect((await t.app.content.stats.execute(author)).total).toBe(1);
    });
  });

  describe('versions (FR-CONTENT-08/09)', () => {
    it('records a version per save and reverts by creating a new version', async () => {
      const c = await create(author);
      await t.app.content.update.execute(c.id, { title: 'Second' }, author);
      await t.app.content.update.execute(c.id, { title: 'Third', slug: 'third' }, editor);
      const versions = await t.app.content.listVersions.execute(c.id, author);
      expect(versions.map((v) => [v.versionNo, v.snapshot.title, v.editor.name])).toEqual([
        [3, 'Third', 'Eve'],
        [2, 'Second', 'Al'],
        [1, 'Hello World', 'Al'],
      ]);
      const reverted = await t.app.content.revert.execute(c.id, 1, author);
      expect([reverted.title, reverted.slug]).toEqual(['Hello World', 'hello-world']);
      expect((await t.app.content.listVersions.execute(c.id, author))[0]?.versionNo).toBe(4);
      await expect(t.app.content.revert.execute(c.id, 99, author)).rejects.toThrow(NotFoundError);
    });

    it('revert refuses a slug that another item has taken since', async () => {
      const c = await create(author, { slug: 'orig' });
      await t.app.content.update.execute(c.id, { slug: 'moved' }, author);
      await create(author, { slug: 'orig' });
      await expect(t.app.content.revert.execute(c.id, 1, author)).rejects.toThrow(SlugConflictError);
    });

    it('keeps only the last 50 versions (§6.4)', async () => {
      const c = await create(author);
      for (let i = 0; i < 55; i++) await t.app.content.update.execute(c.id, { title: `v${i}` }, author);
      const versions = await t.app.content.listVersions.execute(c.id, author);
      expect([versions.length, versions[0]?.versionNo, versions.at(-1)?.versionNo]).toEqual([50, 56, 7]);
    });
  });

  describe('list filters (UR-E05, UR-U04, FR-CONTENT-10/11)', () => {
    it('filters by type, status, tag, title search and date; sorts', async () => {
      await create(author, { title: 'Alpha report', tags: ['finance'] });
      await create(author, { title: 'beta notes' });
      await t.app.content.create.execute({ type: 'page', title: 'Gamma page' }, author);
      const q = (x: Record<string, unknown>) =>
        t.app.content.list.execute(x, editor).then((r) => r.items.map((i) => i.title));
      expect(await q({ type: 'article', sort: 'title' })).toEqual(['Alpha report', 'beta notes']);
      expect(await q({ type: 'article', sort: 'title', order: 'desc' })).toEqual(['beta notes', 'Alpha report']);
      expect(await q({ search: 'REPORT' })).toEqual(['Alpha report']);
      expect(await q({ tag: 'Finance' })).toEqual(['Alpha report']);
      expect(await q({ status: 'published' })).toEqual([]);
      expect(await q({ updatedFrom: new Date('2030-01-01') })).toEqual([]);
      expect((await q({ updatedTo: new Date('2030-01-01'), sort: 'status' })).length).toBe(3);
      expect((await t.app.content.list.execute({ page: 2, pageSize: 2 }, editor)).items).toHaveLength(1);
    });
  });

  describe('soft delete & purge (FR-CONTENT-13)', () => {
    it('hard-deletes 30 days after soft delete, removing versions', async () => {
      const c = await create(author);
      await t.app.content.delete.execute(c.id, editor);
      t.clock.advance(29 * 86400_000);
      expect(await t.app.jobs.purgeContent.purgeDeleted(SYSTEM_ACTOR)).toBe(0);
      t.clock.advance(2 * 86400_000);
      expect(await t.app.jobs.purgeContent.purgeDeleted(SYSTEM_ACTOR)).toBe(1);
      expect(t.infra.db.table('contents').size).toBe(0);
      expect(t.infra.db.table('content_versions').size).toBe(0);
      expect(t.auditActions().at(-1)).toBe('content.purge');
    });

    it('a soft-deleted slug stays reserved until purge', async () => {
      const c = await create(author, { slug: 'keep' });
      await t.app.content.delete.execute(c.id, editor);
      await expect(create(author, { slug: 'keep' })).rejects.toThrow(SlugConflictError);
    });
  });

  describe('edge cases', () => {
    it('FR-CONTENT-08: versions and views survive a removed user (name shown as null)', async () => {
      const c = await create(author);
      t.infra.db.users.delete(author.userId);
      expect((await t.app.content.listVersions.execute(c.id, editor))[0]?.editor).toEqual({
        id: author.userId,
        name: null,
      });
      expect((await t.app.content.get.execute(c.id, editor)).author).toEqual({ id: author.userId, name: null });
    });

    it('FR-CONTENT-07: the job re-checks each candidate and skips items that are no longer due', async () => {
      const c = await create(author);
      await t.app.content.schedule.execute(c.id, new Date(t.clock.now().getTime() + 60_000), editor);
      const repo = t.infra.repos.contents;
      const stale = await repo.findById(c.id);
      repo.findDueForPublish = () => Promise.resolve(stale ? [stale] : []);
      expect(await t.app.jobs.publishDue.publishDue(SYSTEM_ACTOR)).toBe(0);
    });

    it('a page cannot become its own parent', async () => {
      const page = await t.app.content.create.execute({ type: 'page', title: 'Root' }, editor);
      await expect(t.app.content.update.execute(page.id, { parentId: page.id }, editor)).rejects.toThrow(
        ValidationError,
      );
    });
  });
});
