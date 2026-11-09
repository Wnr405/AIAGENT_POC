---
description: Draft the PR title + description from the template (08-GIT-WORKFLOW §8.4)
---

1. Collect: `git log --oneline main..HEAD`, `git diff --stat main...HEAD`, gate results
   (`node harness/gate.mjs full`), requirement IDs touched (`node harness/trace-requirements.mjs`).
2. Title: one Conventional Commit line (it becomes the squash commit) — validate with
   `node harness/check-commit-msg.mjs --title "<title>"`.
3. Fill `.github/pull_request_template.md` completely: What / Why (FR IDs) / How / Test plan / Risk /
   Checklist. PRs over 400 production LOC must propose a split (§8.6).
4. Show the draft. Only run `gh pr create --draft` if the user explicitly asks.
