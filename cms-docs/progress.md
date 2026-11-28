# Progress

> Session state for humans and agents. The head (above the marker) is printed by
> `.claude/hooks/session-start.mjs`; rewrite it at the end of every session (`/feature` step 8).
> Feature list and per-requirement status: [`TRACEABILITY.md`](TRACEABILITY.md).

- **Current:** harness hardening + CI repair + dependency audit · branch `feature/harness-gate-strict-skip` · PR Wnr405/AIAGENT_POC#3 (open, ready for review)
- **Status:** audit remediation (`fix/deps-audit`, 7 commits) fast-forwarded into the PR at the user's request. Blockers before merge: PR title
  (manual edit on GitHub); waiver 0001 needs Tech Lead sign-off (exception to 05-METRICS §15.3); first CI run of testcontainers 11 + Stryker on vitest 3.
- **Evidence:** 2026-11-28, this checkout: `pnpm install --frozen-lockfile` ok · `pnpm audit --audit-level high` exit 0 (0 high; 2 critical = waived
  GHSA-q4fj-c24w-c5wm only) · `pnpm -r format:check` clean · 25 commits Conventional · `node harness/gate.mjs full` (no `--allow-skip`) exit 0, 17/17.
  - Audit commits: `4ccc5c2` waiver 0001 ignore · `4f6cbac` zod 4 (ADR-0013) · `8d67bf6`/`9f56758` nodemailer 10, sharp 0.35 · `47992ae` adapter tests ·
    `5e0b2ad` vitest 3 / vite 6 / testcontainers 11 · `dc400cc` @cms/ scope. CI repair: `e68723c` `efe0cf3` `0dbb5e4` `d122cd9`.
- **Next:** read CI on the pushed head; fix the PR title; get waiver 0001 approved. Behaviour change to note in review: zod 4 makes a malformed
  ID return 422 instead of 404. Follow-up PR: `feature/harness-review-followups` (RK-01 sign-off needed; ADR-0012 Proposed).

<!-- progress:end-head -->

## Log

- 2026-11-11 · harness · committed spec docs 01–09; full gate fails on missing deps unless `--allow-skip`;
  env-sync regex fixed (0 → 52 keys); gate node steps fixed on Windows; added this file + `/feature` steps 0/8.
- 2026-11-11 · api · openapi.json drift was Prettier reformatting a generated file (root ignore fixed); split `registerAdminRoutes` (88 → 3 functions < 60 lines) with an FR-PUBAPI-07 characterization spec; full gate green.
- 2026-11-11 · review · 3 reviewers, no blocking findings; fixed env-key regex crossing blank lines, broken Windows-path fixture, missing edge-case tests; harness self-tests now run in CI (pr-gate.yml, also unblocked Prettier on it).
- 2026-11-27 · external review of main @ `e3ee801`: findings 1–3 and 5 were already fixed on this branch; #4 ("message" commit) fixed going forward — CI now checks every PR commit (`--range main..HEAD`); `e3ee801` stays (no force-push).
- 2026-11-28 · CI repair: Node 20 pins (jscpd 4.2.4, jest-dom 6.9.1), lockfile out of Prettier, cms-web formatted, Stryker plugins listed; mutation now runs and passes.
- 2026-11-28 · audit: fix/deps-audit merged into the PR branch (scoped workspaces, dev-tool + runtime upgrades approved by the user, waiver 0001 pending Tech Lead); local CI-equivalent checks green.
