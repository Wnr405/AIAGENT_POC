# ADR-0001: Use Hexagonal Architecture for the backend

## Status

Accepted — 2026-05-11

## Context

Business rules (lifecycle, RBAC, lockout, publish requirements) must be testable to 100% and survive framework/DB changes (BR-09, NFR-MAIN).

## Decision

Each module has domain / application (ports + use cases) / adapters. The domain is plain TypeScript. NestJS is only the HTTP shell; a framework-free composition root (`cms-api/src/composition/container.ts`) wires everything and is reused by the worker and the tests.

## Consequences

Unit tests run the real use cases against in-memory adapters in milliseconds. More files and explicit mapping code. Import rules are enforced by dependency-cruiser and `harness/check-architecture.mjs`.

## Alternatives Considered

Layered NestJS services with Prisma in services (fast to start, couples rules to the ORM); CQRS/event sourcing (overkill for MVP).
