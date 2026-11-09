#!/usr/bin/env node
// 05-METRICS M-DEBT-04..06, M-TEST-05: no `any`, no unjustified @ts-ignore / eslint-disable,
// no skipped/focused tests, no console.log in production code.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isSpec, isTs, read, rel, report, ROOT, walk } from './lib.mjs';

const RULES = [
  { re: /:\s*any\b|<any>|\bas any\b/, msg: '`any` type (M-DEBT-04)', prod: true, test: false },
  { re: /@ts-ignore/, msg: '@ts-ignore (use @ts-expect-error with a reason) (M-DEBT-05)', prod: true, test: true },
  { re: /@ts-expect-error(?!\s+\S)/, msg: '@ts-expect-error without a reason (M-DEBT-05)', prod: true, test: true },
  { re: /eslint-disable(?:-next-line|-line)?(?![^\n]*--\s*\S)/, msg: 'eslint-disable without "-- reason" (M-DEBT-06)', prod: true, test: true },
  { re: /\b(?:it|test|describe)\.(?:skip|only|todo)\s*\(|\bx(?:it|describe)\s*\(/, msg: 'skipped/focused test (M-TEST-05)', prod: false, test: true },
  { re: /\bconsole\.(?:log|debug)\s*\(/, msg: 'console.log in production code (use the Logger port)', prod: true, test: false },
];

export function checkDebt(files) {
  const problems = [];
  for (const abs of files) {
    const spec = isSpec(abs);
    const lines = read(abs).split('\n');
    lines.forEach((text, i) => {
      if (/^\s*(\/\/|\*)/.test(text) && !/eslint-disable|@ts-/.test(text)) return;
      for (const r of RULES) if ((spec ? r.test : r.prod) && r.re.test(text)) problems.push(`${rel(abs)}:${i + 1} ${r.msg}`);
    });
  }
  return problems;
}

const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => (a.startsWith('/') || /^[A-Za-z]:/.test(a) ? a : join(ROOT, a))).filter((p) => existsSync(p) && isTs(p))
  : ['cms-api/src', 'cms-api/test', 'cms-web/src', 'cms-web/test'].flatMap((d) => walk(join(ROOT, d), isTs));
process.exit(report('tech-debt markers (any / ts-ignore / disables / skipped tests)', checkDebt(files)) ? 0 : 1);
