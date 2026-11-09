---
description: Parallel review of the current branch by the architecture, test and security reviewers
---

Run these subagents in parallel on `git diff main...HEAD` plus uncommitted changes:
`architecture-reviewer`, `test-auditor`, `security-reviewer`.
Merge their findings into one table sorted by severity (blocking first), de-duplicate, and end with a single
verdict. Do not change code in this command.
