/**
 * Domain events (04-ARCH §4.5.4). Every event carries enough context to be
 * written to the audit log generically (FR-AUDIT-01) without the audit module
 * knowing the emitting module.
 */
export interface DomainEvent {
  readonly type: string; // e.g. 'content.publish' — doubles as audit action
  readonly occurredAt: Date;
  readonly actorId: string | null;
  readonly actorIp: string | null;
  readonly target: { readonly type: string; readonly id: string | null };
  readonly summary: Record<string, unknown>;
  /** false for events that must not land in the audit log. Default true. */
  readonly audited?: boolean;
}

export abstract class AggregateRoot {
  private pending: DomainEvent[] = [];

  protected raise(event: DomainEvent): void {
    this.pending.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }
}
