# ADR-0010: Short-lived JWT + rotating opaque refresh token

## Status

Accepted — 2026-05-11

## Context

FR-AUTH-04/05/09, SEC-11/12.

## Decision

HS256 access token (15 min, `sub` + `role` only) held in memory by the SPA. Opaque refresh token (SHA-256 hashed at rest) in an httpOnly SameSite=Strict cookie scoped to `/api/admin/auth`; rotated on every use; reuse of a rotated token revokes the whole family; 30-min idle expiry. Refresh/logout require the `X-CMS-CSRF` header. Every request re-checks the account so deactivation/role changes apply immediately.

## Consequences

Stolen refresh tokens are detected; one extra DB read per request (fine at MVP scale).

## Alternatives Considered

Long-lived JWT only (no revocation); server sessions in Redis (stateful).
