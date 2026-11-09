## What

<!-- One-paragraph summary. -->

## Why

<!-- Requirement IDs from 02-SRS (e.g. FR-CONTENT-07), issue link. -->

## How

<!-- Approach, layers touched (domain / application / adapters / composition), ADR if any. -->

## Test plan

- [ ] Unit tests added/updated (titles cite requirement IDs)
- [ ] Integration tests added/updated
- [ ] E2E test added/updated (if a user flow changed)
- [ ] Manual verification steps: 1. 2.

## Risk

- Blast radius (modules):
- Migration / data impact (expand/contract?):
- Rollback plan:

## Screenshots / recordings

<!-- UI changes only -->

## Checklist

- [ ] Title is a Conventional Commit
- [ ] < 400 LOC of production code (or split planned)
- [ ] TDD: a failing test existed for every behaviour change
- [ ] `node harness/gate.mjs full` is green locally
- [ ] No `any` / `@ts-ignore` / unexplained `eslint-disable`
- [ ] OpenAPI regenerated (if the API changed)
- [ ] `.env.example` + `env.schema.ts` + `cms-infra/CHANGELOG.env.md` updated (if config changed)
- [ ] Docs / runbooks updated (if operational change)
- [ ] Feature flag added (if incomplete work)
