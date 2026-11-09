#!/usr/bin/env node
// 05-METRICS §2.4 — M-TDD-06 (no production change without tests) and M-TDD-01
// (test-to-code ratio ≥ 1.0 on the diff vs main). Usage: node harness/check-tdd.mjs [--ratio]
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { changedFiles, git, isSpec, isTs, report, ROOT } from './lib.mjs';

const PROD = /^cms-(api|web)\/src\/.*\.(ts|tsx)$/;
const EXEMPT = /(\.port\.ts|\/ports\/|\.types\.ts|\.d\.ts|\/main\.tsx?$|\/tracing\.ts$|\/i18n\/en\.ts$)/;

function loc(file) {
  const base = git('merge-base HEAD origin/main') || git('merge-base HEAD main');
  const stat = git(`diff --numstat ${base || 'HEAD'} -- "${file}"`);
  const added = Number(stat.split('\t')[0]);
  return Number.isFinite(added) ? added : 0;
}

const changed = changedFiles().filter((f) => existsSync(join(ROOT, f)));
const prod = changed.filter((f) => PROD.test(f) && !isSpec(f) && !EXEMPT.test(f) && isTs(f));
const tests = changed.filter((f) => /^cms-(api|web)\//.test(f) && isSpec(f));
const problems = [];
if (prod.length > 0 && tests.length === 0) {
  problems.push(`production files changed without any test change (M-TDD-06):\n    ${prod.join('\n    ')}`);
}
if (process.argv.includes('--ratio') && prod.length > 0) {
  const p = prod.reduce((s, f) => s + loc(f), 0);
  const t = tests.reduce((s, f) => s + loc(f), 0);
  const ratio = p === 0 ? Infinity : t / p;
  console.log(`  test-to-code ratio: ${t} test LOC / ${p} prod LOC = ${ratio.toFixed(2)} (target ≥ 1.0)`);
  if (ratio < 1) problems.push(`test-to-code ratio ${ratio.toFixed(2)} < 1.0 (M-TDD-01)`);
}
process.exit(report(`TDD discipline (${prod.length} prod / ${tests.length} test files changed)`, problems) ? 0 : 1);
