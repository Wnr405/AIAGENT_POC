# ADR-0005: Zustand for UI state, RxJS for streams

## Status

Accepted — 2026-05-11

## Context

Session token must live in memory only; toasts/theme are global UI state; some flows are time-based.

## Decision

`session.store` (access token in memory), `ui.store` (theme, toasts); RxJS only where time/concurrency matter.

## Consequences

Small, explicit global state; streams are isolated in `streams/` folders.

## Alternatives Considered

Context + useReducer (re-render cost), Redux Toolkit.
