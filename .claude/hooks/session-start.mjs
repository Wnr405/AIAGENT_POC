#!/usr/bin/env node
// SessionStart: give the agent its bearings (branch, pending changes, the rules that matter most,
// and the head of cms-docs/progress.md — where the last session stopped and what comes next).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROGRESS_FILE, progressHead } from './_progress.mjs';
import { projectDir } from './_io.mjs';

const sh = (c) => {
  try {
    return execSync(c, { cwd: projectDir(), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
const branch = sh('git rev-parse --abbrev-ref HEAD') || '(not a git repo yet)';
const dirty = sh('git status --porcelain').split('\n').filter(Boolean).length;
const progressPath = join(projectDir(), PROGRESS_FILE);
const progress = existsSync(progressPath) ? readFileSync(progressPath, 'utf8') : undefined;
process.stdout.write(
  [
    `CMS harness · branch: ${branch} · uncommitted files: ${dirty}`,
    'Read CLAUDE.md first. Non-negotiables: TDD (failing test first, cite FR-IDs), hexagonal/reactive import rules,',
    '98% coverage (100% critical paths), Conventional Commits on a short-lived branch, never touch .env or committed migrations.',
    'Fast feedback: `node harness/gate.mjs quick` · full local gate: `node harness/gate.mjs full`.',
    '',
    `── ${PROGRESS_FILE} (head) ──`,
    progressHead(progress),
    'Feature list / requirement status: cms-docs/TRACEABILITY.md.',
  ].join('\n'),
);
