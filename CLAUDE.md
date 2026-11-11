# CLAUDE.md — Agent operating manual for the CMS MVP

You are working in a monorepo that implements the CMS specified by the documents at the repo root.
**The documents are the contract; the code is the implementation; the harness is the referee.**

## 1. Where the truth lives

| Need                                                                | Read                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| What & why (BR/UR IDs, scope, out-of-scope)                         | `01-Requirements-Specification.md`                    |
| Exact behaviour (FR/NFR/SEC IDs, API, data model, acceptance tests) | `02-Software-Requirements-Specification.md`           |
| Screens, MD3 tokens, components                                     | `03-DESIGN.md`                                        |
| Layers, ports, dependency rules, folder layout                      | `04-ARCH.md` (**read §4.8 and §5.8 before any edit**) |
| Coverage, gates, TDD metrics                                        | `05-METRICS.md`                                       |
| How to test each layer                                              | `06-TEST-STRATEGY.md`                                 |
| Docker Compose, env, deploy, backup, runbooks                       | `07-OPS-ARCH.md`                                      |
| Branches, commits, PRs, reviews                                     | `08-GIT-WORKFLOW.md`                                  |
| Setup, repo tour                                                    | `09-ONBOARDING.md` + `README.md`                      |
| Decisions already taken                                             | `cms-docs/adr/`                                       |
| Which requirement is tested where                                   | `cms-docs/TRACEABILITY.md` (generated)                |
| Where the last session stopped, evidence, next step                 | `cms-docs/progress.md` (head shown at session start)  |

If a request conflicts with these documents, stop and say so. Scope changes need human change control (RK-01).

## 2. Repository map

```
cms-api/     NestJS shell around a hexagonal core          → src/modules/<m>/{domain,application,adapters}
             composition root (only place that wires modules) → src/composition/container.ts
cms-web/     React + MUI (MD3) + TanStack Query + Zustand + RxJS → src/{app,features,shared,design-system}
cms-infra/   docker-compose (+prod/staging), nginx, scripts, runbooks, monitoring
cms-docs/    ADRs, waivers, traceability matrix, user guide
harness/     zero-dependency gate scripts (architecture, debt, TDD, traceability, commit messages)
.claude/     hooks (guards + instant feedback), subagents, slash commands
```

## 3. Non-negotiables (enforced by hooks and CI)

1. **TDD.** No production code without a failing test that needs it. Test titles cite requirement IDs
   (`it('FR-AUTH-06: …')`) — the traceability gate reads them.
2. **Hexagonal backend.** Domain imports only its own domain + `shared/kernel` (no npm packages).
   Application depends on ports, never adapters. Modules never import each other; wire them in
   `src/composition/`. Business rules live in entities / value objects / domain services.
3. **Reactive frontend.** Server state → TanStack Query; UI state → Zustand; cross-cutting flows → RxJS
   streams (pure, marble-tested). Features never import other features. Presentational components take
   props only. No `fetch`/`localStorage` outside `shared/api` and `shared/utils/storage.ts`.
4. **Quality bar.** 98% line/branch coverage, 100% on critical paths (05-METRICS §3.3); no `any`,
   no `@ts-ignore`, no unexplained `eslint-disable`, no skipped tests, complexity ≤ 10.
5. **Git.** Short-lived branch (`feature/<scope>-<short>`), Conventional Commits, PR to main, squash merge.
   Never commit on main, never force-push, never `--no-verify`.
6. **Safety.** Never read or write `.env` files. Never edit a committed migration (add a new one,
   backward compatible). Never weaken a gate/threshold/rule without a written waiver (`cms-docs/waivers/`).

## 4. Commands

```bash
node harness/gate.mjs quick          # G-01: arch + debt on changed files (zero deps, seconds)
node harness/gate.mjs full           # G-02/G-03 locally: all harness checks + typecheck/lint/tests/coverage
node harness/trace-requirements.mjs --write   # refresh cms-docs/TRACEABILITY.md

pnpm install                         # once, at the repo root (pnpm workspace)
pnpm --dir cms-api test:unit         # domain + application (fast)
pnpm --dir cms-api test:e2e          # full HTTP pipeline, in-memory adapters (no Docker)
pnpm --dir cms-api test:integration  # Prisma adapters vs real Postgres (Testcontainers, needs Docker)
pnpm --dir cms-api test:cov          # unit + e2e with 98% thresholds
pnpm --dir cms-web test:cov
pnpm --dir cms-web test:e2e          # Playwright; starts the API in PERSISTENCE=memory automatically
pnpm --dir cms-api dev:memory        # run the API without Docker (seeded admin)
```

## 5. How to add things (recipes)

- **New use case:** port in `application/ports/in` → failing spec using `createTestApp()` → class in
  `application/use-cases` → wire in `composition/container.ts` → controller + Zod DTO in
  `adapters/in/http` → register in `src/openapi/openapi.ts` → `pnpm openapi:generate`.
- **New business rule:** spec on the entity/value object first; keep the use case thin.
- **New outbound dependency:** declare a port (interface) in `application/ports/out` or `shared/ports`,
  add an in-memory fake (tests) and the real adapter (`adapters/out`), choose it in
  `composition/production-infrastructure.ts`.
- **Schema change:** `prisma/schema.prisma` → `pnpm --dir cms-api db:migrate --name <change>` (expand/contract,
  07-OPS-ARCH §12.3) → update persistence mapper + integration test.
- **New env var:** `cms-api/src/config/env.schema.ts` **and** `cms-infra/.env.example` (CI checks both),
  log it in `cms-infra/CHANGELOG.env.md`.
- **New screen:** feature folder `pages/ components/ hooks/ api/ streams/ types/`; strings in
  `shared/i18n/en.ts`; tokens from `design-system/` only.

## 6. Definition of done (02-SRS §11.1 + 05-METRICS)

Requirement IDs traced · acceptance tests from 02-SRS §11.2 pass · authorization verified at route **and**
use-case layer · audit events asserted · OpenAPI updated · docs/runbook updated if behaviour or ops changed ·
`node harness/gate.mjs full` green · reviewed by the subagents (`/review`).

## 7. Subagents & slash commands

`/feature <IDs>` runs the whole pipeline. Subagents: `spec-tracer` → `tdd-implementer` →
`architecture-reviewer` + `test-auditor` + `security-reviewer`. Other commands: `/tdd`, `/gate`, `/review`,
`/pr`, `/adr`, `/trace`.

## 8. Known gaps / decisions to respect

- SVG uploads are **rejected** when unsafe instead of stripped (ADR-0011) — keep it that way unless a
  sanitiser library is approved.
- Media variants are generated by the worker (BullMQ); in `PERSISTENCE=memory` they are skipped.
- Redis runs with `noeviction` (BullMQ requirement) — all cache keys must carry a TTL.
