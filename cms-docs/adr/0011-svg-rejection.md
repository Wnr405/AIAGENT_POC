# ADR-0011: Reject unsafe SVGs instead of sanitising them

## Status

Accepted — 2026-05-11

## Context

SEC-05 asks to sanitise SVGs (strip scripts and external references). A regex-based sanitiser is easy to bypass; a DOM-based one adds a heavy dependency.

## Decision

Uploads are checked for MIME + extension + magic bytes; SVGs containing any active or external content (script, foreignObject, on* handlers, javascript:/data:text/html URLs, external href/url(), entities) are **rejected** with a clear message and deleted from storage.

## Consequences

Strictly safer than stripping; occasionally a designer must clean an SVG before upload. Revisit if users complain (requires Security sign-off).

## Alternatives Considered

DOMPurify + jsdom in the API; server-side rasterisation of SVGs.
