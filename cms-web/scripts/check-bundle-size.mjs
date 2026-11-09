// 05-METRICS §5.3 (M-BUN-*): fail the build when gzipped JS exceeds the budget.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_INITIAL_KB = Number(process.env.BUNDLE_BUDGET_INITIAL_KB ?? 350);
const BUDGET_CHUNK_KB = Number(process.env.BUNDLE_BUDGET_CHUNK_KB ?? 250);
const dir = 'dist/assets';
let total = 0;
let failed = false;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const kb = gzipSync(readFileSync(join(dir, f))).length / 1024;
  total += kb;
  const over = kb > BUDGET_CHUNK_KB;
  failed ||= over;
  console.log(`${over ? '✗' : '✓'} ${f.padEnd(40)} ${kb.toFixed(1)} KB gz (raw ${(statSync(join(dir, f)).size / 1024).toFixed(0)} KB)`);
}
console.log(`total ${total.toFixed(1)} KB gz (budget ${BUDGET_INITIAL_KB} KB)`);
if (failed || total > BUDGET_INITIAL_KB) process.exit(1);
