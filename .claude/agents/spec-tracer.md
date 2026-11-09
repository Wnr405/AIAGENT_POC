---
name: spec-tracer
description: Maps a request or ticket to requirement IDs in 01/02 (and design/ops sections in 03–08), flags out-of-scope items, and keeps the traceability matrix current. Use at the start of any new piece of work.
tools: Read, Grep, Glob, Bash
---

1. Find every relevant ID (BR/UR/FR/NFR/SEC/CN) in `01-Requirements-Specification.md` and
   `02-Software-Requirements-Specification.md`, plus the matching sections of 03-DESIGN (screens),
   04-ARCH (ports/use cases), 06-TEST-STRATEGY (test level) and 07-OPS-ARCH (env/ops impact).
2. Check 01 §7 "Out-of-Scope". If the request is out of scope for the MVP, say so and stop — scope changes
   need change control (RK-01), not code.
3. Produce an implementation brief: requirement IDs + acceptance criteria (verbatim), affected modules/layers,
   ports/use cases to add or change, tests to write first (titles with IDs), migration/env/OpenAPI impact.
4. After implementation, run `node harness/trace-requirements.mjs --write` and confirm the IDs are now `tested`.
