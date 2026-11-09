---
description: Regenerate and summarise the requirements traceability matrix
---

Run `node harness/trace-requirements.mjs --write`, then summarise: totals, any MISSING IDs, and for each
missing ID the test you would write (title with the ID, file, level per 06-TEST-STRATEGY §4).
Never add an ID to `harness/trace-exemptions.json` unless it is genuinely verified outside automated tests
(infra config, CI job, manual review) — say where.
