# AGENTS.md

Tool-agnostic entry point for AI coding agents (Codex, Cursor, Copilot, Claude, …).
The full operating manual is **[CLAUDE.md](./CLAUDE.md)** — read it first; everything there applies to you.

Minimum contract:

1. Specs `01`–`09` at the repo root are the source of truth. Cite requirement IDs in test names.
2. TDD: failing test → minimal code → refactor. No production change without a test change.
3. Respect the import rules: `node harness/check-architecture.mjs` must pass.
4. Before finishing any task: `node harness/gate.mjs quick` (and `full` before a PR).
5. Conventional Commits on a short-lived branch; never commit on main, force-push or skip hooks.
6. Never read/write `.env` files, never edit committed migrations, never lower a quality gate.
