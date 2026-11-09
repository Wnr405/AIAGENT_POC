# ADR-0004: TanStack Query for server state

## Status

Accepted — 2026-05-11

## Context

Lists, detail views and mutations need caching, refetch and invalidation.

## Decision

All admin API reads go through `useQuery`; mutations invalidate by query key prefix and seed detail caches.

## Consequences

No hand-written cache layer; 4xx are not retried (see `shared/api/query-client.ts`).

## Alternatives Considered

SWR; RTK Query.
