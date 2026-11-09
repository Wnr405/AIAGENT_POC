#!/usr/bin/env node
// Stop: before Claude ends its turn, run the fast gate on changed files. If it fails,
// Claude is told to keep working (decision: block). Never loops: respects stop_hook_active.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { projectDir, readEvent } from './_io.mjs';

const ev = readEvent();
if (ev.stop_hook_active) process.exit(0);
const gate = spawnSync(process.execPath, [join(projectDir(), 'harness', 'gate.mjs'), 'quick'], { cwd: projectDir(), encoding: 'utf8' });
const tdd = spawnSync(process.execPath, [join(projectDir(), 'harness', 'check-tdd.mjs')], { cwd: projectDir(), encoding: 'utf8' });
const failed = [gate, tdd].filter((r) => r.status !== 0);
if (failed.length === 0) process.exit(0);
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `Quality gate G-01 is red — fix before finishing:\n${failed.map((r) => `${r.stdout}${r.stderr}`.trim()).join('\n')}`,
  }),
);
process.exit(0);
