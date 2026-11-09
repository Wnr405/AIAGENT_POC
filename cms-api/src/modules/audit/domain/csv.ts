import type { AuditRecord } from './audit-event';

/**
 * FR-AUDIT-06 CSV export. Cells are RFC 4180-quoted and neutralised against
 * spreadsheet formula injection (cells starting with = + - @ tab CR get a ' prefix).
 */
export type CsvValue = string | number | Date | null | undefined;

function cellText(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

export function csvCell(value: CsvValue): string {
  let s = cellText(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const AUDIT_CSV_HEADER = [
  'id',
  'occurred_at',
  'actor_id',
  'actor_name',
  'actor_ip',
  'action',
  'target_type',
  'target_id',
  'summary',
];

export function auditCsvRow(r: AuditRecord, actorName: string | null): string {
  return [
    r.id,
    r.occurredAt,
    r.actorId,
    actorName,
    r.actorIp,
    r.action,
    r.targetType,
    r.targetId,
    JSON.stringify(r.summary),
  ]
    .map(csvCell)
    .join(',');
}
