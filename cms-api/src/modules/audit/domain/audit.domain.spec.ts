import { describe, expect, it } from 'vitest';
import { redactSummary } from './audit-event';
import { AUDIT_CSV_HEADER, auditCsvRow, csvCell } from './csv';

describe('audit summary redaction (SEC-14)', () => {
  it('redacts secrets by key name and keeps everything else', () => {
    expect(
      redactSummary({ password: 'x', refreshToken: 'y', apiKey: 'z', secret: 's', role: 'admin', fields: ['title'] }),
    ).toEqual({
      password: '[redacted]',
      refreshToken: '[redacted]',
      apiKey: '[redacted]',
      secret: '[redacted]',
      role: 'admin',
      fields: ['title'],
    });
  });
});

describe('CSV export (FR-AUDIT-06)', () => {
  it('quotes RFC 4180 special characters', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('plain')).toBe('plain');
  });

  it.each(['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx'])('neutralises formula injection in %s', (v: string) => {
    expect(csvCell(v).replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('formats null, undefined and dates', () => {
    expect([csvCell(null), csvCell(undefined), csvCell(new Date('2026-05-01T00:00:00Z')), csvCell(5)]).toEqual([
      '',
      '',
      '2026-05-01T00:00:00.000Z',
      '5',
    ]);
  });

  it('renders a full row in header order', () => {
    const row = auditCsvRow(
      {
        id: 'e1',
        occurredAt: new Date('2026-05-01T00:00:00Z'),
        actorId: 'u1',
        actorIp: '1.2.3.4',
        action: 'content.publish',
        targetType: 'content',
        targetId: 'c1',
        summary: { from: 'draft' },
      },
      'Alice',
    );
    expect(AUDIT_CSV_HEADER).toHaveLength(9);
    expect(row).toBe('e1,2026-05-01T00:00:00.000Z,u1,Alice,1.2.3.4,content.publish,content,c1,"{""from"":""draft""}"');
  });
});
