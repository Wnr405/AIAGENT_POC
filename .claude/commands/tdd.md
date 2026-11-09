---
description: One strict red → green → refactor cycle for a single behaviour
argument-hint: <behaviour, e.g. "FR-CONTENT-07 scheduled item publishes when due">
---

Run exactly one TDD cycle for: **$ARGUMENTS**

1. RED: write the smallest failing test (title starts with the requirement ID). Run it; show the failure.
2. GREEN: minimal production code in the right layer (domain rule → entity/VO/domain service; orchestration →
   use case; I/O → adapter behind a port). Run the test; show it passing.
3. REFACTOR: improve names/structure with all tests green. Run `node harness/gate.mjs quick`.
4. Summarise the cycle in three lines (red / green / refactor) and propose the commit message.
