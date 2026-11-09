# ADR-0009: Domain events dispatched in-process

## Status

Accepted — 2026-05-11

## Context

Audit logging, session revocation and public-cache invalidation react to domain events.

## Decision

`InProcessEventPublisher` dispatches after the use case persists. The audit module subscribes to `*` and records every event generically from its actor/target/summary. Failures are logged, not propagated.

## Consequences

At-most-once delivery; acceptable for MVP. Redis pub/sub or an outbox when webhooks arrive (Phase 2).

## Alternatives Considered

Transactional outbox now (more moving parts).
