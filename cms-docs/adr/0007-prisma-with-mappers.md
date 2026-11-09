# ADR-0007: Prisma behind persistence mappers

## Status

Accepted — 2026-05-11

## Context

Type-safe queries and migrations without leaking ORM types into the core.

## Decision

Prisma Client is used only in `adapters/out/persistence`. Mappers convert rows ⇄ aggregates. Transactions are joined through `PrismaContext` (AsyncLocalStorage).

## Consequences

Swapping the ORM touches adapters only. Migrations are forward-only and backward compatible.

## Alternatives Considered

TypeORM, Kysely, raw SQL.
