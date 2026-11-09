/** FR-AUDIT-01: append-only record. There is deliberately no update/delete API. */
export interface AuditRecord {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorId: string | null;
  readonly actorIp: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly summary: Readonly<Record<string, unknown>>;
}

/** Keys that must never be persisted in an audit summary (SEC-14). */
const REDACTED_KEYS = /pass(word)?|token|secret|key$|authorization/i;

export function redactSummary(summary: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(summary)) out[k] = REDACTED_KEYS.test(k) ? '[redacted]' : v;
  return out;
}
