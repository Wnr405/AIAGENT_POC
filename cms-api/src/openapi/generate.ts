import { readFileSync, writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from './openapi';

/**
 * `pnpm openapi:generate` → writes ./openapi.json (committed).
 * `pnpm openapi:check`    → exits 1 if the committed file is stale (CI, cross-platform).
 */
const target = process.argv[2] ?? 'openapi.json';
const json = `${JSON.stringify(buildOpenApiDocument(process.env['APP_VERSION'] ?? '1.0.0'), null, 2)}\n`;
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    /* missing file counts as stale */
  }
  if (current !== json) {
    process.stderr.write(`${target} is out of date — run: pnpm --dir cms-api openapi:generate\n`);
    process.exit(1);
  }
  process.stdout.write(`${target} is up to date\n`);
} else {
  writeFileSync(target, json);
}
