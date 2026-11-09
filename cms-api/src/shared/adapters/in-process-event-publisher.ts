import type { DomainEvent } from '../kernel/domain-event';
import type { DomainEventHandler, DomainEventPublisher, DomainEventSubscriber } from '../ports/event-publisher.port';
import type { Logger } from '../ports/logger.port';

/**
 * ADR-0009: events are dispatched in-process, sequentially, after the use case
 * has persisted state. A failing handler is logged and does not fail the
 * originating use case (at-most-once; acceptable for MVP).
 */
export class InProcessEventPublisher implements DomainEventPublisher, DomainEventSubscriber {
  private readonly handlers = new Map<string, DomainEventHandler[]>();

  constructor(private readonly logger: Logger) {}

  subscribe(type: string, handler: DomainEventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = [...(this.handlers.get(event.type) ?? []), ...(this.handlers.get('*') ?? [])];
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          this.logger.error('domain event handler failed', {
            eventType: event.type,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }
}
