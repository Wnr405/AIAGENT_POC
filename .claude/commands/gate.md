---
description: Run the local quality gates (G-01 quick or G-02/G-03 full) and fix what fails
argument-hint: [quick|full]
---

Run `node harness/gate.mjs ${ARGUMENTS:-full}` from the repo root and report the summary table.
For each failure: show the first relevant error, fix the root cause (never lower a threshold or add a skip),
re-run until green. If tool steps are SKIPPED, tell the user to run `pnpm install` at the repo root.
