# ADR-0008: OpenAPI generated from the Zod schemas

## Status

Accepted — 2026-05-11

## Context

FR-PUBAPI-07 requires a published, always-in-sync OpenAPI 3.1 spec.

## Decision

Controllers validate with Zod schemas; `src/openapi/openapi.ts` registers the same schemas via zod-to-openapi. `pnpm openapi:check` fails CI when `openapi.json` is stale. Redoc is served at `/api/docs` (nginx redirects `/docs`).

## Consequences

Single source of truth for validation and documentation.

## Alternatives Considered

Nest Swagger decorators (duplicate the validation rules).
