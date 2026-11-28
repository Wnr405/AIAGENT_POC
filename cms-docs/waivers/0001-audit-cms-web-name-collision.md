# Waiver 0001: `pnpm audit` false positive on our own `cms-web` workspace

- **Gate / metric:** G-03 · `security` job, `pnpm audit --audit-level high` (05-METRICS §11.4)
- **Scope:** `package.json` → `pnpm.auditConfig.ignoreGhsas: ["GHSA-q4fj-c24w-c5wm"]`. That one advisory only;
  `--audit-level` and every other finding are unchanged.
- **Reason:** GHSA-q4fj-c24w-c5wm ("Malicious code in cms-web", vulnerable range `>0`) is about an unrelated public
  npm package that squats the name `cms-web`. Nothing installs it: our `cms-web/` is a private workspace package
  (`private: true`, now named `@cms/web`), and no lockfile entry resolves `cms-web` from a registry. pnpm 9 audit
  reports workspace importers by **directory** name, so the advisory matches the `cms-web/` folder itself and the
  scope rename cannot clear it. It is a false positive, not a vulnerability in our dependency tree.
- **Exception to §15.3:** 05-METRICS §15.3 says critical/high findings are never waivable. This waiver covers a
  name collision, not a vulnerable dependency, so it needs explicit Tech Lead sign-off as an exception.
- **Mitigation:**
  - Workspace packages are `@cms/`-scoped and private (`harness/test/workspace.test.mjs` enforces it), so a registry
    lookup can never resolve the squatted name (dependency confusion).
  - The ignore is pinned to one GHSA id. A new advisory against `cms-web` under another id still fails the gate.
  - Permanent fix options for the expiry review: rename the `cms-web/` directory, or move to a pnpm version whose
    audit uses manifest names for importers, then delete this waiver and the ignore.
- **Owner:** repository maintainer (Wnr405)
- **Expires:** 2026-12-28 (≤ 30 days)
- **Approved by:** _pending — Tech Lead_ (the user approved the approach in the remediation session on 2026-11-28)
