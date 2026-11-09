# Architecture Decision Records

| ADR                                      | Title                                      | Status                                                             |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| [0001](0001-hexagonal-backend.md)        | Hexagonal architecture for the backend     | Accepted                                                           |
| [0002](0002-reactive-frontend.md)        | Composed reactive architecture for the SPA | Accepted                                                           |
| [0003](0003-modular-monolith.md)         | Single modular monolith, stateless API     | Accepted                                                           |
| [0004](0004-tanstack-query.md)           | TanStack Query for server state            | Accepted                                                           |
| [0005](0005-zustand-rxjs.md)             | Zustand for UI state, RxJS for streams     | Accepted                                                           |
| [0006](0006-postgres-jsonb-body.md)      | PostgreSQL + JSONB rich-text bodies        | Accepted                                                           |
| [0007](0007-prisma-with-mappers.md)      | Prisma behind persistence mappers          | Accepted                                                           |
| [0008](0008-openapi-from-zod.md)         | OpenAPI generated from Zod schemas         | Accepted                                                           |
| [0009](0009-in-process-events.md)        | Domain events dispatched in-process        | Accepted                                                           |
| [0010](0010-jwt-and-rotating-refresh.md) | Short-lived JWT + rotating refresh token   | Accepted                                                           |
| [0011](0011-svg-rejection.md)            | Reject unsafe SVGs instead of sanitising   | Accepted (deviation from SEC-05 wording — needs Security sign-off) |

New ADRs: `/adr <title>` in Claude Code, or copy the template from 04-ARCH §8.2.
