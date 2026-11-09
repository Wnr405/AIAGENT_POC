import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, doc, type TestApp } from '../../../../../test/support/test-app';
import { ForbiddenError } from '../../../../shared/kernel/errors';

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of it) out += chunk;
  return out;
}

describe('audit (BR-03, FR-AUDIT-*)', () => {
  let t: TestApp;
  let admin: ReturnType<TestApp['seedUser']>;
  let editor: ReturnType<TestApp['seedUser']>;
  beforeEach(async () => {
    t = createTestApp();
    admin = t.seedUser('admin', 'Ada');
    editor = t.seedUser('editor', 'Eve');
    const c = await t.app.content.create.execute({ type: 'article', title: 'A', body: doc('x') }, editor);
    t.clock.advanceMinutes(1);
    await t.app.content.transition.execute(c.id, 'publish', editor);
    t.clock.advanceMinutes(1);
    await t.app.auth.login
      .execute({ email: 'nobody@example.com', password: 'x' }, { ip: '9.9.9.9' })
      .catch(() => undefined);
  });

  it('FR-AUDIT-01/02 (FR-CONTENT-16, FR-USER-08): records id, UTC time, actor, ip, action, target and summary', async () => {
    const page = await t.app.audit.list.execute({}, admin);
    expect(page.items.map((e) => e.action)).toEqual(['auth.login_failed', 'content.publish', 'content.create']);
    expect(page.items[1]).toMatchObject({
      actorId: editor.userId,
      actorName: 'Eve',
      actorIp: '203.0.113.7',
      targetType: 'content',
      summary: { from: 'draft', to: 'published' },
    });
    expect(page.items[0]).toMatchObject({ actorId: null, actorName: null, actorIp: '9.9.9.9' });
  });

  it('UR-A04 / FR-AUDIT-05: filters by actor, action (exact or prefix), target and date', async () => {
    const actions = (q: Record<string, unknown>) =>
      t.app.audit.list.execute(q, admin).then((r) => r.items.map((e) => e.action));
    expect(await actions({ actorId: editor.userId })).toEqual(['content.publish', 'content.create']);
    expect(await actions({ action: 'content.' })).toEqual(['content.publish', 'content.create']);
    expect(await actions({ action: 'content.create' })).toEqual(['content.create']);
    expect(await actions({ targetType: 'user' })).toEqual(['auth.login_failed']);
    const first = (await t.app.audit.list.execute({ action: 'content.create' }, admin)).items[0];
    expect(await actions({ targetId: first?.targetId })).toEqual(['content.publish', 'content.create']);
    const start = new Date('2026-05-01T09:00:30Z');
    expect(await actions({ from: start })).toEqual(['auth.login_failed', 'content.publish']);
    expect(await actions({ to: start })).toEqual(['content.create']);
  });

  it('FR-AUDIT-04: events outlive their actor — an unknown actor id shows no name in the list or the CSV', async () => {
    t.infra.db.users.delete(editor.userId);
    const page = await t.app.audit.list.execute({ actorId: editor.userId }, admin);
    expect(page.items.map((e) => e.actorName)).toEqual([null, null]);
    const csv = await collect(t.app.audit.exportCsv.execute({ actorId: editor.userId }, admin));
    expect(csv.split('\r\n')[1]).toContain(`,${editor.userId},,203.0.113.7,`);
  });

  it('FR-AUDIT-05/06: admin only', async () => {
    await expect(t.app.audit.list.execute({}, editor)).rejects.toThrow(ForbiddenError);
    expect(() => t.app.audit.exportCsv.execute({}, editor)).toThrow(ForbiddenError);
  });

  it('FR-AUDIT-06: exports CSV with header and one line per event', async () => {
    const csv = await collect(t.app.audit.exportCsv.execute({}, admin));
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('id,occurred_at,actor_id,actor_name,actor_ip,action,target_type,target_id,summary');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain(',Eve,203.0.113.7,content.publish,content,');
  });

  it('FR-AUDIT-03: records are append-only (no update or delete port, duplicate ids rejected)', async () => {
    const repo = t.infra.repos.audit as unknown as Record<string, unknown>;
    expect(['update', 'delete', 'remove'].filter((m) => typeof repo[m] === 'function')).toEqual([]);
    const existing = (await t.app.audit.list.execute({}, admin)).items[0];
    await expect(t.infra.repos.audit.append({ ...existing!, summary: {} })).rejects.toThrow('append-only');
  });

  it('events marked audited:false are skipped', async () => {
    const before = (await t.app.audit.list.execute({}, admin)).total;
    await t.infra.events.publishAll([
      {
        type: 'x.internal',
        occurredAt: t.clock.now(),
        actorId: null,
        actorIp: null,
        target: { type: 'x', id: null },
        summary: {},
        audited: false,
      },
    ]);
    expect((await t.app.audit.list.execute({}, admin)).total).toBe(before);
  });
});
