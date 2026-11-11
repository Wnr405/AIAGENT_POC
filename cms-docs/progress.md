# Progress

> Session state for humans and agents. The head (above the marker) is printed by
> `.claude/hooks/session-start.mjs`; rewrite it at the end of every session (`/feature` step 8).
> Feature list and per-requirement status: [`TRACEABILITY.md`](TRACEABILITY.md).

- **Current:** harness hardening (G-01/G-02/G-03 tooling, no FR change) · branch `feature/harness-gate-strict-skip`
- **Status:** blocked: full gate red on 2 pre-existing cms-api failures (harness work itself is done)
- **Evidence:** `node harness/gate.mjs full` on 2026-11-11 (no `--allow-skip`) → exit 1
  - PASS: harness self-tests, architecture, tech debt, TDD discipline, traceability, env schema sync,
    cms-api typecheck/depcruise/tests+coverage/duplication, cms-web typecheck/lint/depcruise/tests+coverage/duplication
  - FAIL: `cms-api: lint` — `src/openapi/openapi.ts:95` `registerAdminRoutes` is 88 lines (max-lines-per-function 60)
  - FAIL: `cms-api: OpenAPI in sync` — `openapi.json is out of date`
  - Commits: `c4355d3` feat(harness) progress state + Windows node steps · `4388b10` docs spec 01–09 · `5b7cf56` fix(harness) skip = fail + env regex
- **Next:** split `registerAdminRoutes` in `cms-api/src/openapi/openapi.ts` below 60 lines, run
  `pnpm --dir cms-api openapi:generate`, re-run the full gate, then `/pr`.

<!-- progress:end-head -->

## Log

- 2026-11-11 · harness · committed spec docs 01–09; full gate fails on missing deps unless `--allow-skip`;
  env-sync regex fixed (0 → 52 keys); gate node steps fixed on Windows; added this file + `/feature` steps 0/8.
