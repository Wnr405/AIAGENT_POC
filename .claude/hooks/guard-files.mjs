#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit): protect secrets, history and the harness itself.
// Agents may not quietly weaken the gates that judge their work.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ask, block, projectDir, readEvent, relPath } from './_io.mjs';

const ev = readEvent();
const file = relPath(ev.tool_input?.file_path ?? ev.tool_input?.notebook_path ?? '');
if (!file) process.exit(0);

if (/(^|\/)\.env(\.[a-z]+)?$/.test(file) && !file.endsWith('.env.example')) {
  block(`Blocked: ${file} holds secrets. Edit .env.example (schema) instead and document the change in cms-infra/CHANGELOG.env.md.`);
}
if (/prisma\/migrations\/[^/]+\/migration\.sql$/.test(file) && existsSync(resolve(projectDir(), file))) {
  block(`Blocked: migrations are forward-only and immutable once created (07-OPS-ARCH §12.2). Create a new migration: pnpm --dir cms-api prisma migrate dev --name <change>.`);
}
if (/^0[1-9]-[^/]+\.md$/.test(file)) {
  ask(`${file} is a source-of-truth specification. Changes need human sign-off (change control, 01 §RK-01). Proceed?`);
}
const HARNESS = [
  /^harness\//,
  /^\.claude\/(settings\.json|hooks\/)/,
  /^\.github\/workflows\//,
  /(^|\/)vitest(\.integration)?\.config\.ts$/,
  /(^|\/)vite\.config\.ts$/,
  /(^|\/)stryker\.config\.json$/,
  /(^|\/)\.dependency-cruiser\.cjs$/,
  /(^|\/)eslint\.config\.m?js$/,
  /(^|\/)\.jscpd\.json$/,
  /^\.husky\//,
];
if (HARNESS.some((re) => re.test(file))) {
  ask(`${file} is part of the quality harness (gates, thresholds, rules). Lowering a gate requires a waiver (05-METRICS §15). Proceed with this edit?`);
}
process.exit(0);
