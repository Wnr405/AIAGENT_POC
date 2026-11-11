#!/usr/bin/env node
// Local quality gates (05-METRICS §11). Mirrors CI so humans and agents get the
// same verdict before pushing.
//   node harness/gate.mjs quick   → G-01 pre-commit (< 10 s, changed files only, zero deps)
//   node harness/gate.mjs full    → G-02/G-03 locally (all checks; tool steps need `pnpm install`)
//   add --allow-skip to tolerate steps skipped because dependencies are missing (they fail by default)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gateExitCode, SKIPPED_NO_DEPS } from './gate-verdict.mjs';
import { changedFiles, ROOT } from './lib.mjs';

const mode = process.argv[2] ?? 'quick';
const allowSkip = process.argv.includes('--allow-skip');
const node = process.execPath;
const changedTs = changedFiles().filter((f) => /^cms-(api|web)\/.*\.(ts|tsx)$/.test(f) && existsSync(join(ROOT, f)));
const hasDeps = (pkg) => existsSync(join(ROOT, pkg, 'node_modules', '.bin'));

/** @type {{ name: string; cmd: string[]; cwd?: string; when?: boolean }[]} */
const steps =
  mode === 'quick'
    ? [
        { name: 'architecture (changed)', cmd: [node, 'harness/check-architecture.mjs', ...changedTs], when: changedTs.length > 0 },
        { name: 'tech debt (changed)', cmd: [node, 'harness/check-debt.mjs', ...changedTs], when: changedTs.length > 0 },
      ]
    : [
        { name: 'harness self-tests', cmd: [node, '--test', 'harness/test/gate.test.mjs'] },
        { name: 'architecture', cmd: [node, 'harness/check-architecture.mjs'] },
        { name: 'tech debt', cmd: [node, 'harness/check-debt.mjs'] },
        { name: 'TDD discipline', cmd: [node, 'harness/check-tdd.mjs', '--ratio'] },
        { name: 'traceability', cmd: [node, 'harness/trace-requirements.mjs', '--check'] },
        { name: 'env schema sync', cmd: [node, 'cms-infra/scripts/check-env-sync.mjs'] },
        ...['cms-api', 'cms-web'].flatMap((pkg) => [
          { name: `${pkg}: typecheck`, cmd: ['pnpm', 'typecheck'], cwd: pkg, when: hasDeps(pkg) },
          { name: `${pkg}: lint`, cmd: ['pnpm', 'lint'], cwd: pkg, when: hasDeps(pkg) },
          { name: `${pkg}: depcruise`, cmd: ['pnpm', 'depcruise'], cwd: pkg, when: hasDeps(pkg) },
          { name: `${pkg}: tests + coverage (98%)`, cmd: ['pnpm', 'test:cov'], cwd: pkg, when: hasDeps(pkg) },
          { name: `${pkg}: duplication ≤ 3%`, cmd: ['pnpm', 'dup'], cwd: pkg, when: hasDeps(pkg) },
        ]),
        { name: 'cms-api: OpenAPI in sync', cmd: ['pnpm', 'openapi:check'], cwd: 'cms-api', when: hasDeps('cms-api') },
      ];

const results = [];
for (const s of steps) {
  if (s.when === false) {
    results.push([s.name, s.cmd[0] === 'pnpm' ? SKIPPED_NO_DEPS : 'SKIPPED (nothing changed)']);
    continue;
  }
  const r = spawnSync(s.cmd[0], s.cmd.slice(1), { cwd: join(ROOT, s.cwd ?? ''), stdio: 'inherit', shell: process.platform === 'win32' });
  results.push([s.name, r.status === 0 ? 'PASS' : 'FAIL']);
}

console.log(`\n── ${mode === 'quick' ? 'G-01 pre-commit' : 'G-02/G-03 local'} gate ──`);
for (const [name, status] of results) console.log(`${status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '·'} ${name.padEnd(36)} ${status}`);
const exitCode = gateExitCode(results, { allowSkip });
if (exitCode !== 0 && !allowSkip && results.some(([, s]) => s === SKIPPED_NO_DEPS)) {
  console.error('\nSteps were skipped because dependencies are missing: run `pnpm install` (or pass --allow-skip).');
}
process.exit(exitCode);
