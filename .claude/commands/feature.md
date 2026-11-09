---
description: Implement a requirement end-to-end (trace → branch → TDD → gate → review → PR draft)
argument-hint: <FR-ID(s) or short description>
---

Implement: **$ARGUMENTS**

Follow this pipeline and do not skip steps:

1. **Trace** — use the `spec-tracer` subagent to map the request to requirement IDs and acceptance criteria.
   Stop if it is out of MVP scope (01 §7).
2. **Branch** — `git switch -c feature/<scope>-<2-4-words>` (08-GIT-WORKFLOW §3.2). Never work on main.
3. **Build** — use the `tdd-implementer` subagent, one behaviour per red→green→refactor cycle. Commit after
   each green step with Conventional Commits (`test(content): …`, `feat(content): …`).
4. **Gate** — `node harness/gate.mjs full`. Everything that ran must be green.
5. **Review** — run `architecture-reviewer`, `test-auditor` and, if auth/input/infra is touched,
   `security-reviewer` in parallel. Fix every blocking finding.
6. **Docs** — OpenAPI regenerated if the API changed; `node harness/trace-requirements.mjs --write`;
   ADR if a significant decision was made; runbook/`.env.example` if ops changed.
7. **PR** — run `/pr` to draft the description. Do not push or merge without the user's go-ahead.
