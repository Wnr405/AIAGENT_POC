# ADR-0006: PostgreSQL with JSONB rich-text bodies

## Status

Accepted — 2026-05-11

## Context

RK-02 requires a portable structured body; FR-CONTENT-14 requires server-side sanitisation.

## Decision

Bodies are TipTap/ProseMirror JSON stored in JSONB, sanitised by an allow-list in `RichTextBody.fromUntrusted`. The public API also renders sanitised `body_html` server-side.

## Consequences

No HTML is ever stored; any channel can render the JSON. Denormalised `effective_seo_*` columns keep the public read path cheap.

## Alternatives Considered

Sanitised HTML (DOMPurify server-side, harder to reason about); Markdown (loses structure).
