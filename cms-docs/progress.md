# Progress

> Session state for humans and agents. The head (above the marker) is printed by
> `.claude/hooks/session-start.mjs`; rewrite it at the end of every session (`/feature` step 8).
> Feature list and per-requirement status: [`TRACEABILITY.md`](TRACEABILITY.md).

- **Current:** none in flight. `main` @ `fd4c11e`: PR #3 (harness, CI repair, audit, E2E) and the Main-workflow fixes #4–#8 are merged.
- **Status:** PR Gate (11 jobs, incl. image build + Trivy) and Main workflow both green. First green Main run 46150300147 on `fd4c11e`
  (2026-11-28): verify ✓, images ✓ (build, push to ghcr.io/wnr405, Trivy 0 critical/high, SBOM, cosign), deploy-staging skipped (not enabled).
- **Evidence:** #4 trivy-action pinned to v0.36.0 SHA · #5 lowercase GHCR owner · #6 workspace-root Docker builds + PR image job ·
  #7 Debian `apt-get upgrade`, no npm/npx/corepack/yarn at runtime, `migrateCommand()` runs prisma with node (NFR-MAIN-03 spec), Trivy on PRs ·
  #8 deploy-staging opt-in via repo variable `STAGING_DEPLOY_ENABLED`.
- **Next:** (user) Tech Lead approves waiver 0001 — expires 2026-12-28; staging VM → secrets `STAGING_HOST`, `STAGING_SSH_KEY` +
  `STAGING_DEPLOY_ENABLED=true` (G-06 not yet met); review Dependabot's cms-api Node base-image PR. Follow-up PR:
  `feature/harness-review-followups` (RK-01; ADR-0012). 07-OPS-ARCH §10.3 Dockerfile skeleton predates the workspace build (RK-01).

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
- 2026-11-28 · Main workflow: first full run failed in turn on a missing trivy-action tag, uppercase GHCR owner, lockfile outside the Docker context,
  and 46 image CVEs (Debian + bundled npm); fixed in #4–#7, staging deploy made opt-in (#8). PR Gate now builds and scans the images.
