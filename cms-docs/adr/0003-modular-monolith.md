# ADR-0003: Single modular monolith, stateless API

## Status

Accepted — 2026-05-11

## Context

MVP scale (< 50 admins, 200 API consumers) on one VM (07-OPS-ARCH).

## Decision

One deployable (`cms-api`) with strict module boundaries; the worker is the same image with a different command. Sessions, cache and rate limits live in Postgres/Redis so the API is stateless (NFR-SCAL-01).

## Consequences

Simple ops; modules can be extracted later along their ports (04-ARCH §10.4).

## Alternatives Considered

Microservices (operational cost not justified).
