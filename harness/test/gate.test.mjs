// G-02/G-03 (05-METRICS §11): the local full gate must never report green when steps were skipped
// for missing dependencies, and the env-sync check (07-OPS-ARCH §7.4) must actually see the schema keys.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gateExitCode, needsShell, SKIPPED_NO_DEPS } from '../gate-verdict.mjs';
import { schemaKeysOf } from '../../cms-infra/scripts/env-keys.mjs';

const ENV_SCHEMA = new URL('../../cms-api/src/config/env.schema.ts', import.meta.url);

test('G-03: a step SKIPPED for missing dependencies fails the gate', () => {
  assert.equal(gateExitCode([['lint', 'PASS'], ['cms-api: typecheck', SKIPPED_NO_DEPS]]), 1);
});

test('G-03: --allow-skip tolerates steps SKIPPED for missing dependencies', () => {
  assert.equal(gateExitCode([['cms-api: typecheck', SKIPPED_NO_DEPS]], { allowSkip: true }), 0);
});

test('G-03: --allow-skip never hides a FAIL', () => {
  assert.equal(gateExitCode([['lint', 'FAIL']], { allowSkip: true }), 1);
  assert.equal(gateExitCode([['lint', 'FAIL'], ['typecheck', SKIPPED_NO_DEPS]], { allowSkip: true }), 1);
});

test('G-03: a FAIL together with a dependency skip fails without --allow-skip', () => {
  assert.equal(gateExitCode([['lint', 'FAIL'], ['typecheck', SKIPPED_NO_DEPS]]), 1);
});

test('G-03: an empty result list passes', () => {
  assert.equal(gateExitCode([]), 0);
});

test('G-01: SKIPPED (nothing changed) is not a failure', () => {
  assert.equal(gateExitCode([['architecture (changed)', 'SKIPPED (nothing changed)'], ['x', 'PASS']]), 0);
});

test('G-03: env sync reads indented UPPER_CASE keys at any indentation', () => {
  const src = "const baseSchema = z.object({\n  NODE_ENV: z.enum(['a']),\n\n  /** doc */\n  HTTP_PORT: z.coerce.number(),\n    INDENTED_DEEPER: z.string(),\n  lower: z.string(),\n});";
  assert.deepEqual(schemaKeysOf(src), ['NODE_ENV', 'HTTP_PORT', 'INDENTED_DEEPER']);
});

test('G-03: env sync ignores a column-0 key, even after a blank line', () => {
  assert.deepEqual(schemaKeysOf('const x = 1;\n\nTOP: 1\nALSO_TOP: 2'), []);
});

test('G-03: env sync extracts the keys of the real env.schema.ts', () => {
  const keys = schemaKeysOf(readFileSync(ENV_SCHEMA, 'utf8'));
  for (const k of ['NODE_ENV', 'HTTP_PORT', 'DATABASE_URL', 'JWT_SECRET']) assert.ok(keys.includes(k), k);
  assert.equal(new Set(keys).size, keys.length, 'no duplicate keys');
});

test('G-02: only pnpm runs through a shell on Windows, so a node path with spaces still launches', () => {
  const node = String.raw`C:\Program Files\nodejs\node.exe`;
  assert.ok(node.includes(' ') && !node.includes('\n'), 'fixture is a real Windows path with a space');
  assert.equal(needsShell([node, 'harness/x.mjs'], 'win32'), false);
  assert.equal(needsShell(['pnpm', 'lint'], 'win32'), true);
  assert.equal(needsShell(['pnpm', 'lint'], 'linux'), false);
});
