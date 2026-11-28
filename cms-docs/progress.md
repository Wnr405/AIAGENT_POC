# Progress

> Session state for humans and agents. The head (above the marker) is printed by
> `.claude/hooks/session-start.mjs`; rewrite it at the end of every session (`/feature` step 8).
> Feature list and per-requirement status: [`TRACEABILITY.md`](TRACEABILITY.md).

- **Current:** harness hardening + CI repair + dependency audit + E2E fixes · branch `feature/harness-gate-strict-skip` · PR Wnr405/AIAGENT_POC#3
- **Status:** ready to merge on CI — all 10 PR Gate jobs green on `62015ef` (incl. E2E on chromium/firefox/webkit, security, mutation); GitHub
  mergeable_state "clean". Not merged. Open before merge: waiver 0001 Tech Lead sign-off; PR description lacks the audit/zod 4/E2E sections.
- **Evidence:** CI run on `62015ef` (2026-11-28): every job success. Local: `node harness/gate.mjs full` (no `--allow-skip`) 17/17;
  Playwright chromium `--retries=0 --repeat-each=3` 6/6; `pnpm audit --audit-level high` exit 0 (only waived GHSA-q4fj-c24w-c5wm).
  - Latest commits: `62015ef` E2E slug isolation · `df19323` Vite proxy `/api/` · `59fecc5` single-flight token refresh (logout-on-reload bug) ·
    `ae5d519` E2E dialog race + exact Title · `fa04764` E2E API without .env · `cec72bb` PR gate re-runs on title edit · `4ccc5c2`…`dc400cc` audit.
- **Next:** Tech Lead approves waiver 0001 (exception to 05-METRICS §15.3); add the missing PR description sections; squash-merge (user).
  Behaviour change to call out: zod 4 returns 422 (not 404) for a malformed ID. Follow-up PR: `feature/harness-review-followups` (RK-01; ADR-0012).

<!-- progress:end-head -->

## Log

- 2026-11-11 · harness · committed spec docs 01–09; full gate fails on missing deps unless `--allow-skip`;
  env-sync regex fixed (0 → 52 keys); gate node steps fixed on Windows; added this file + `/feature` steps 0/8.
- 2026-11-11 · api · openapi.json drift was Prettier reformatting a generated file (root ignore fixed); split `registerAdminRoutes` (88 → 3 functions < 60 lines) with an FR-PUBAPI-07 characterization spec; full gate green.
- 2026-11-11 · review · 3 reviewers, no blocking findings; fixed env-key regex crossing blank lines, broken Windows-path fixture, missing edge-case tests; harness self-tests now run in CI (pr-gate.yml, also unblocked Prettier on it).
- 2026-11-27 · external review of main @ `e3ee801`: findings 1–3 and 5 were already fixed on this branch; #4 ("message" commit) fixed going forward — CI now checks every PR commit (`--range main..HEAD`); `e3ee801` stays (no force-push).
- 2026-11-28 · CI repair: Node 20 pins (jscpd 4.2.4, jest-dom 6.9.1), lockfile out of Prettier, cms-web formatted, Stryker plugins listed; mutation now runs and passes.
- 2026-11-28 · audit: fix/deps-audit merged into the PR branch (scoped workspaces, dev-tool + runtime upgrades approved by the user, waiver 0001 pending Tech Lead); local CI-equivalent checks green.
- 2026-11-28 · E2E: first full Playwright pass; fixed logout on reload (concurrent refresh vs token rotation), Vite proxy matching /api-keys, and test races; PR gate now re-runs on title edits.
