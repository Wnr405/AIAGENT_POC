import { describe, expect, it } from 'vitest';
import { aContent, AUTHOR_ID } from '../../../../../test/builders/a-content';
import { SYSTEM_ACTOR } from '../../../../shared/kernel/actor';
import { ConflictError, NotFoundError, ValidationError } from '../../../../shared/kernel/errors';
import { InvalidTransitionError, PublishRequirementsError, SlugConflictError } from '../errors';
import { RichTextBody } from '../value-objects/rich-text-body.vo';
import { SeoMetadata } from '../value-objects/seo-metadata.vo';
import { Slug } from '../value-objects/slug.vo';
import { Content } from './content.entity';

const editor = { userId: 'ed-1', role: 'editor' as const, ip: '10.0.0.2' };
const T1 = new Date('2026-05-02T00:00:00Z');
const T2 = new Date('2026-05-03T00:00:00Z');
const MEDIA = '00000000-0000-4000-8000-0000000000m1'.replace('m', 'a');

describe('Content.create (FR-CONTENT-01/05)', () => {
  it('creates a draft with only a title and raises content.create', () => {
    const c = Content.create(
      { id: 'c1', type: 'article', title: '  Hello ', slug: Slug.create('hello'), authorId: 'a1', now: T1 },
      editor,
    );
    expect([
      c.id,
      c.type,
      c.title,
      c.slug.value,
      c.status,
      c.authorId,
      c.body.isEmpty(),
      c.publishedAt,
      c.scheduledAt,
      c.deletedAt,
    ]).toEqual(['c1', 'article', 'Hello', 'hello', 'draft', 'a1', true, null, null, null]);
    expect(c.pullDomainEvents()).toEqual([
      {
        type: 'content.create',
        occurredAt: T1,
        actorId: 'ed-1',
        actorIp: '10.0.0.2',
        target: { type: 'content', id: 'c1' },
        summary: { contentType: 'article', type: 'article', slug: 'hello' },
      },
    ]);
  });

  it.each(['', '   ', 'x'.repeat(201)])('rejects invalid title %#', (title: string) => {
    expect(() =>
      Content.create({ id: 'c', type: 'page', title, slug: Slug.create('s'), authorId: 'a', now: T1 }, editor),
    ).toThrow(ValidationError);
  });

  it('applies optional fields at creation', () => {
    const c = Content.create(
      {
        id: 'c',
        type: 'article',
        title: 'T',
        slug: Slug.create('t'),
        authorId: 'a',
        now: T1,
        tags: ['A'],
        category: ' News ',
        featuredImageId: MEDIA,
      },
      editor,
    );
    expect(c.toProps()).toMatchObject({ tags: ['a'], category: 'News', featuredImageId: MEDIA });
  });
});

describe('type-specific fields (§6.2)', () => {
  it('only articles take tags and categories', () => {
    const page = aContent({ type: 'page' });
    expect(() => page.update({ tags: ['x'] }, T1, editor)).toThrow('Only articles can have tags');
    expect(() => page.update({ category: 'News' }, T1, editor)).toThrow('Only articles can have a category');
    page.update({ tags: [], category: '  ' }, T1, editor); // clearing is fine
    expect(page.toProps()).toMatchObject({ tags: [], category: null });
  });

  it('limits category length', () => {
    expect(() => aContent().update({ category: 'c'.repeat(61) }, T1, editor)).toThrow('at most 60');
  });

  it('only pages take a parent, never themselves', () => {
    expect(() => aContent().update({ parentId: 'p1' }, T1, editor)).toThrow('Only pages');
    const page = aContent({ type: 'page', id: 'pg' });
    expect(() => page.update({ parentId: 'pg' }, T1, editor)).toThrow('own parent');
    page.update({ parentId: 'p1' }, T1, editor);
    page.update({ parentId: null }, T1, editor);
    expect(page.toProps().parentId).toBeNull();
  });
});

describe('update', () => {
  it('records changed fields and bumps updatedAt', () => {
    const c = aContent();
    c.update(
      {
        title: 'New',
        body: RichTextBody.empty(),
        seo: SeoMetadata.empty(),
        socialImageId: MEDIA,
        slug: Slug.create('new'),
      },
      T1,
      editor,
    );
    const [e] = c.pullDomainEvents();
    expect(e?.type).toBe('content.update');
    expect(e?.summary['fields']).toEqual(['title', 'slug', 'body', 'seo', 'socialImageId']);
    expect(c.toProps().updatedAt).toEqual(T1);
  });

  it('is a no-op for an empty patch', () => {
    const c = aContent();
    c.update({}, T1, editor);
    expect(c.pullDomainEvents()).toEqual([]);
  });

  it('editing unpublished content moves it back to draft (§5.4.1 edit)', () => {
    const c = aContent({ status: 'unpublished' });
    c.update({ title: 'Edited' }, T1, editor);
    expect(c.status).toBe('draft');
    expect(c.pullDomainEvents().map((e) => [e.type, e.summary['to']])).toEqual([
      ['content.update', undefined],
      ['content.state_change', 'draft'],
    ]);
  });

  it('archived and deleted content cannot be edited', () => {
    expect(() => aContent({ status: 'archived' }).update({ title: 'x' }, T1, editor)).toThrow(InvalidTransitionError);
    expect(() => aContent({ deletedAt: T1 }).update({ title: 'x' }, T1, editor)).toThrow(NotFoundError);
  });
});

describe('lifecycle (FR-CONTENT-04/06) — critical path', () => {
  it('draft → in_review → draft (reject) → in_review → published', () => {
    const c = aContent();
    c.submitForReview(T1, editor);
    c.reject(T1, editor);
    c.submitForReview(T1, editor);
    c.publish(T2, editor);
    expect([c.status, c.publishedAt]).toEqual(['published', T2]);
    expect(c.pullDomainEvents().map((e) => e.type)).toEqual([
      'content.submit',
      'content.reject',
      'content.submit',
      'content.publish',
    ]);
  });

  it('publishedAt is set on first publish only', () => {
    const c = aContent({ status: 'in_review', publishedAt: T1 });
    c.publish(T2, editor);
    expect(c.publishedAt).toEqual(T1);
  });

  it('published → unpublished → archived', () => {
    const c = aContent({ status: 'published', publishedAt: T1 });
    c.unpublish(T2, editor);
    c.archive(T2, editor);
    expect(c.status).toBe('archived');
  });

  it('invalid transitions are 409 conflicts', () => {
    expect(() => aContent({ status: 'published' }).submitForReview(T1, editor)).toThrow(InvalidTransitionError);
    expect(() => aContent({ status: 'archived' }).publish(T1, editor)).toThrow(
      'Cannot publish content in status "archived"',
    );
    expect(() => aContent().unpublish(T1, editor)).toThrow(ConflictError);
    expect(() => aContent().archive(T1, editor)).toThrow(ConflictError);
    expect(() => aContent({ deletedAt: T1 }).submitForReview(T1, editor)).toThrow(NotFoundError);
  });

  it('publishing enforces requirements and lists what is missing', () => {
    const c = aContent({ body: RichTextBody.empty(), seo: SeoMetadata.empty() });
    try {
      c.publish(T1, editor);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PublishRequirementsError);
      expect((e as PublishRequirementsError).details).toEqual({ missing: ['body', 'seoDescription'] });
    }
  });

  it('the default description (FR-SEO-02) satisfies the requirement', () => {
    const c = aContent({ seo: SeoMetadata.empty() });
    c.publish(T1, editor);
    expect(c.status).toBe('published');
  });
});

describe('scheduling (FR-CONTENT-07)', () => {
  it('schedules in the future from draft or in_review and is due once the time passes', () => {
    const c = aContent({ status: 'in_review' });
    c.schedule(T2, T1, editor);
    expect(c.scheduledAt).toEqual(T2);
    expect(c.isDueForPublish(T1)).toBe(false);
    expect(c.isDueForPublish(T2)).toBe(true);
    c.publish(T2, SYSTEM_ACTOR);
    expect([c.status, c.scheduledAt]).toEqual(['published', null]);
    expect(c.isDueForPublish(T2)).toBe(false);
  });

  it('rejects past times, wrong states, unready content and deleted content', () => {
    expect(() => aContent().schedule(T1, T1, editor)).toThrow('must be in the future');
    expect(() => aContent({ status: 'published' }).schedule(T2, T1, editor)).toThrow(InvalidTransitionError);
    expect(() => aContent({ body: RichTextBody.empty() }).schedule(T2, T1, editor)).toThrow(PublishRequirementsError);
    expect(() => aContent({ deletedAt: T1 }).schedule(T2, T1, editor)).toThrow(NotFoundError);
  });

  it('can be unscheduled, but only when scheduled', () => {
    const c = aContent({ scheduledAt: T2 });
    c.unschedule(T1, editor);
    expect(c.scheduledAt).toBeNull();
    expect(() => c.unschedule(T1, editor)).toThrow('not scheduled');
  });

  it('deleted content is never due', () => {
    expect(aContent({ scheduledAt: T1, deletedAt: T1 }).isDueForPublish(T2)).toBe(false);
  });
});

describe('soft delete (FR-CONTENT-13)', () => {
  it('marks deleted, clears schedule, raises content.delete; second delete is 404', () => {
    const c = aContent({ scheduledAt: T2 });
    c.softDelete(T1, editor);
    expect([c.isDeleted, c.deletedAt, c.scheduledAt]).toEqual([true, T1, null]);
    expect(c.pullDomainEvents()[0]?.type).toBe('content.delete');
    expect(() => c.softDelete(T1, editor)).toThrow(NotFoundError);
  });
});

describe('versions & revert (FR-CONTENT-08/09)', () => {
  it('snapshot round-trips through revertTo, keeping the current status', () => {
    const original = aContent({ tags: ['a'], status: 'published', publishedAt: T1 });
    const snap = original.toSnapshot();
    const c = aContent({ status: 'published', publishedAt: T1 });
    c.update({ title: 'Changed', slug: Slug.create('changed'), tags: [] }, T1, editor);
    c.pullDomainEvents();
    c.revertTo(snap, 3, T2, editor);
    expect([c.title, c.slug.value, c.toProps().tags, c.status]).toEqual([
      'Default Test Title',
      'default-test-title',
      ['a'],
      'published',
    ]);
    expect(c.pullDomainEvents().at(-1)).toMatchObject({ type: 'content.revert', summary: { toVersion: 3 } });
  });

  it('cannot revert archived content', () => {
    expect(() => aContent({ status: 'archived' }).revertTo(aContent().toSnapshot(), 1, T1, editor)).toThrow(
      InvalidTransitionError,
    );
  });
});

describe('derived data', () => {
  it('effective SEO falls back to title (≤70) and body text', () => {
    const c = aContent({ title: 'T'.repeat(80), seo: SeoMetadata.empty() });
    expect(c.effectiveSeo()).toEqual({ title: 'T'.repeat(70), description: 'Some body text for testing.' });
    const d = aContent({ seo: SeoMetadata.create({ title: 'S', description: 'D' }) });
    expect(d.effectiveSeo()).toEqual({ title: 'S', description: 'D' });
  });

  it('collects featured, social and inline media ids without duplicates', () => {
    const body = RichTextBody.fromUntrusted({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/a', mediaId: MEDIA } }],
    });
    const other = '00000000-0000-4000-8000-0000000000b2';
    expect(aContent({ body, featuredImageId: MEDIA, socialImageId: other }).referencedMediaIds()).toEqual([
      MEDIA,
      other,
    ]);
    expect(aContent().referencedMediaIds()).toEqual([]);
  });

  it('rehydrate copies tags defensively', () => {
    const tags = ['x'];
    const c = aContent({ tags });
    tags.push('y');
    expect(c.toProps().tags).toEqual(['x']);
    expect(c.authorId).toBe(AUTHOR_ID);
  });

  it('error types expose details', () => {
    expect(new SlugConflictError('a').details).toEqual({ field: 'slug', slug: 'a' });
  });
});
