# ADR-0002: Composed reactive architecture for the admin SPA

## Status

Accepted — 2026-05-11

## Context

Autosave, concurrent uploads, idle timeout and cache invalidation are asynchronous flows (04-ARCH §5.1.1).

## Decision

TanStack Query for server state, Zustand for UI state, React Hook Form for forms, RxJS for cross-cutting streams (`autosave$`, `idleState$`, `uploadAll$`, `globalErrors$`). Streams are pure functions of their inputs so they are marble-testable.

## Consequences

Each kind of state lives in the tool best at it; contributors must learn RxJS basics.

## Alternatives Considered

Single Redux store (ceremony without payoff for a two-person team); plain hooks (races in autosave/uploads).
