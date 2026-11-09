# CMS MVP — implementation + AI-agent harness

Implementation of the Content Management System specified in documents **01–09** (in this folder),
plus a **harness** that lets AI coding agents (and humans) keep building it to the same standard:
rules they cannot silently bypass, instant feedback on every edit, and gates that mirror CI.

> **สรุปภาษาไทย** — โฟลเดอร์นี้มี 2 ส่วน: (1) โค้ด CMS ตามสเปก — `cms-api` (NestJS แบบ Hexagonal),
> `cms-web` (React + MUI Material Design 3 แบบ Reactive), `cms-infra` (Docker Compose บน VM เดียว)
> และ (2) **Harness สำหรับ AI agent** — `CLAUDE.md`/`AGENTS.md`, `.claude/` (hooks, subagents, slash commands),
> `harness/` (สคริปต์ตรวจสถาปัตยกรรม/TDD/traceability ที่ไม่ต้องติดตั้งอะไร), Git hooks และ GitHub Actions
> ที่บังคับ quality gates G-01→G-10 ตาม 05-METRICS ดูหัวข้อ "สถานะการตรวจสอบ" ด้านล่างว่าอะไรรันผ่านจริงแล้ว
> และอะไรที่ต้องรันบนเครื่องคุณหลัง `pnpm install`

## What is here

| Path         | What                                                                                                                                                                                                | Spec          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `cms-api/`   | NestJS shell around a hexagonal core: modules `auth`, `users`, `content`, `media`, `audit`, `public-api`, `notifications`; Prisma/PostgreSQL, Redis/BullMQ worker, S3/MinIO, OpenAPI 3.1 at `/docs` | 02, 04 §4     |
| `cms-web/`   | Admin SPA: login/reset/invite, dashboard, content list + TipTap editor (autosave, schedule, versions), media library (presigned uploads), users, audit log (CSV), API keys, settings                | 03, 04 §5     |
| `cms-infra/` | `docker-compose.yml` (+prod/staging), nginx (TLS, headers, micro-cache), Postgres app role, deploy/rollback/backup/restore/smoke scripts, systemd timers, alerts, 10 runbooks                       | 07            |
| `cms-docs/`  | 11 ADRs, waiver process, user guide, generated traceability matrix                                                                                                                                  | 04 §8, 05 §15 |
| `harness/`   | Zero-dependency gate scripts: architecture rules, tech-debt markers, TDD ratio, requirement traceability, commit messages, local gate runner                                                        | 05, 06, 08    |
| `.claude/`   | Claude Code hooks (guards + instant feedback + stop gate), 5 subagents, 7 slash commands                                                                                                            | —             |
| `.github/`   | PR gate (G-03/G-04), main (G-05/G-06), nightly (G-09), release (G-07/G-10), PR template, CODEOWNERS                                                                                                 | 05 §12, 08    |
| `.husky/`    | pre-commit (G-01), commit-msg (Conventional Commits), pre-push (G-02)                                                                                                                               | 05 §11        |

## Verification status (honest)

The environment this was built in had **no access to the npm registry**, so framework packages
(NestJS, Prisma, MUI, Vitest, …) could not be installed there. What _was_ executed:

| Check                                                                                                                                                                                                        | Result                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Backend domain + application + in-memory adapters + composition: **387 tests** (incl. every 02-SRS §11.2 acceptance test except E2E-only ones), run with Node's test runner through a Vitest-compatible shim | ✅ all pass; 99.4 % line coverage of the measured core (Node V8) |
| Strict `tsc` typecheck of the framework-free core (`domain`, `application`, `shared`, composition, test support)                                                                                             | ✅ 0 errors                                                      |
| Frontend pure logic (HTTP client w/ refresh, i18n, formatting, content rules, WCAG contrast of all MD3 tokens): **62 tests**                                                                                 | ✅ all pass                                                      |
| Prisma migration SQL applied to real PostgreSQL 16; audit table UPDATE/DELETE/TRUNCATE blocked; app role cannot delete                                                                                       | ✅ verified                                                      |
| Harness: architecture + debt checks (also proven to catch planted violations), traceability **146/146 IDs** covered, env schema sync, all Claude hooks exercised with simulated events                       | ✅                                                               |

**Not yet executed** (written, needs `pnpm install` on your machine): NestJS E2E suite (`test/e2e`), Prisma
integration suite (Testcontainers), React component tests (RTL + MSW), RxJS marble tests, Playwright,
ESLint/dependency-cruiser/Stryker, Vitest coverage numbers, Docker builds. Expect a short round of
fixes the first time these run — that is exactly what `/gate` in Claude Code is for.

## Getting started (Windows, macOS or Linux)

Prerequisites: Node.js 20 LTS, Git, Docker Desktop (only for Postgres mode / integration tests).

```bash
corepack enable                       # provides pnpm 9
git init && git switch -c main        # if this folder is not a repo yet
pnpm install                          # creates pnpm-lock.yaml — commit it (CI uses --frozen-lockfile)
pnpm --dir cms-api prisma:generate
pnpm --dir cms-api openapi:generate   # writes cms-api/openapi.json — commit it

# Run everything without Docker (in-memory persistence, seeded admin):
cp cms-api/.env.example cms-api/.env  # local defaults; dev:memory overrides PERSISTENCE
pnpm --dir cms-api dev:memory         # API on :3000  (login admin@example.com / dev-password-123)
pnpm --dir cms-web dev                # SPA on :5173 (proxies /api)

# Or with real Postgres/Redis/MinIO:
docker compose -f cms-api/docker-compose.dev.yml up -d
pnpm --dir cms-api db:deploy && pnpm --dir cms-api dev

# Quality gates
node harness/gate.mjs quick           # seconds, no dependencies needed
node harness/gate.mjs full            # everything CI runs (tests, coverage 98 %, lint, arch, OpenAPI)
```

## Working with an AI agent (Claude Code)

Open this folder in Claude Code. On session start the agent is told the rules; `CLAUDE.md` is its manual.

- `/feature FR-CONTENT-07` — trace → branch → TDD → gate → parallel review → PR draft.
- `/tdd <behaviour>` · `/gate` · `/review` · `/pr` · `/adr <title>` · `/trace`
- **Guards** (PreToolUse): block `--no-verify`, force-push, pushing/committing to `main`, reading `.env`,
  editing committed migrations; ask a human before destructive DB commands or any change to the harness
  itself (thresholds, lint rules, workflows) — agents cannot quietly lower the bar.
- **Instant feedback** (PostToolUse): every edited `.ts/.tsx` file is checked against the hexagonal/reactive
  import rules and debt markers; violations are fed back to the agent immediately, plus a TDD reminder on
  business-logic files.
- **Stop gate**: the agent cannot finish a turn while the quick gate or the TDD check is red.

Other agents read `AGENTS.md` (same contract).

## Decisions worth knowing

- SVG uploads with active/external content are **rejected** rather than stripped (ADR-0011, needs Security sign-off vs SEC-05 wording).
- Redis uses `noeviction` (BullMQ), not `allkeys-lru` as sketched in 07 §9.2 — every cache key has a TTL.
- The API runs as a restricted DB role `cms_app` without UPDATE/DELETE on `audit_events`; migrations run as the owner.
- Open questions from 02 Appendix A were resolved as: TipTap (Q-1), MFA deferred (Q-2), CDN optional via `OBJECT_STORAGE_PUBLIC_URL` (Q-3). Q-4/Q-5 remain with the Product Owner/Sponsor.
