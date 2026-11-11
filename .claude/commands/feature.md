---
description: Implement a requirement end-to-end (trace → branch → TDD → gate → review → PR draft)
argument-hint: <FR-ID(s) or short description>
---

Implement: **$ARGUMENTS**

Follow this pipeline and do not skip steps:

0. **Resume** — read the head of `cms-docs/progress.md` (the SessionStart hook prints it) and
   `cms-docs/TRACEABILITY.md` (the feature list). If the recorded _Next_ step is unfinished work for
   these IDs, continue from there instead of starting over.
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
8. **Close the session** — also when stopping early. Rewrite the head of `cms-docs/progress.md`
   (everything above `<!-- progress:end-head -->`) with:
   - **Current** — requirement ID(s) and branch
   - **Status** — `in progress` / `blocked: <why>` / `ready for review` / `merged`
   - **Evidence** — the gate summary lines you actually saw (`node harness/gate.mjs full`, noting any
     `--allow-skip`) and the commit(s) (`git log --oneline -n 3`). Never write a result you did not run.
   - **Next** — the single next step for whoever picks this up

   Then add a dated one-line entry under `## Log`, run `node harness/trace-requirements.mjs --write`,
   and commit both as `docs(progress): <IDs> <status>`. The feature list is `cms-docs/TRACEABILITY.md` —
   do not create a separate feature list.
