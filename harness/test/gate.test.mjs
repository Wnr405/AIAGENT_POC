// G-02/G-03 (05-METRICS §11): the local full gate must never report green when steps were skipped
// for missing dependencies, and the env-sync check (07-OPS-ARCH §7.4) must actually see the schema keys.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateExitCode } from '../gate-verdict.mjs';
import { schemaKeysOf } from '../../cms-infra/scripts/env-keys.mjs';

test('G-03: a step SKIPPED for missing dependencies fails the gate', () => {
  assert.equal(gateExitCode([['lint', 'PASS'], ['cms-api: typecheck', 'SKIPPED (run pnpm install)']]), 1);
});

test('G-03: --allow-skip tolerates steps SKIPPED for missing dependencies', () => {
  assert.equal(gateExitCode([['cms-api: typecheck', 'SKIPPED (run pnpm install)']], { allowSkip: true }), 0);
});

test('G-03: --allow-skip never hides a FAIL', () => {
  assert.equal(gateExitCode([['lint', 'FAIL']], { allowSkip: true }), 1);
});

test('G-01: SKIPPED (nothing changed) is not a failure', () => {
  assert.equal(gateExitCode([['architecture (changed)', 'SKIPPED (nothing changed)'], ['x', 'PASS']]), 0);
});

test('G-03: env sync reads keys from the 2-space-indented env schema', () => {
  const src = "const baseSchema = z.object({\n  NODE_ENV: z.enum(['a']),\n\n  /** doc */\n  HTTP_PORT: z.coerce.number(),\n    NESTED_KEY: z.string(),\n  lower: z.string(),\n});";
  assert.deepEqual(schemaKeysOf(src), ['NODE_ENV', 'HTTP_PORT', 'NESTED_KEY']);
});

test('G-02: only pnpm runs through a shell on Windows, so a node path with spaces still launches', async () => {
  const { needsShell } = await import('../gate-verdict.mjs');
  assert.equal(needsShell(['C:\Program Files\nodejs\node.exe', 'harness/x.mjs'], 'win32'), false);
  assert.equal(needsShell(['pnpm', 'lint'], 'win32'), true);
  assert.equal(needsShell(['pnpm', 'lint'], 'linux'), false);
});
