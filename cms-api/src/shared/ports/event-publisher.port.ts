import type { DomainEvent } from '../kernel/domain-event';

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

export interface DomainEventPublisher {
  publishAll(events: readonly DomainEvent[]): Promise<void>;
}

export interface DomainEventSubscriber {
  /** `type` may be '*' to receive every event. */
  subscribe(type: string, handler: DomainEventHandler): void;
}
