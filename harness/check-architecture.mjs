#!/usr/bin/env node
// Hexagonal (04-ARCH §4.8) + reactive (§5.8) import rules — zero-dependency mirror of
// .dependency-cruiser.cjs / eslint-plugin-boundaries, so agents get instant feedback
// even before `pnpm install`. Usage: node harness/check-architecture.mjs [files...]
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { importsOf, isSpec, isTs, read, rel, report, resolveRelative, ROOT, walk } from './lib.mjs';

const API_SRC = 'cms-api/src/';
const WEB_SRC = 'cms-web/src/';

/** @returns {string|null} violation message */
function apiRule(from, to, spec) {
  const mod = (p) => p.match(/^cms-api\/src\/modules\/([^/]+)\//)?.[1];
  const layer = (p) => p.match(/^cms-api\/src\/modules\/[^/]+\/(domain|application|adapters\/in|adapters\/out)\//)?.[1];
  const fromLayer = layer(from);
  const pkg = !spec.startsWith('.');

  if ((fromLayer === 'domain' || from.startsWith(`${API_SRC}shared/kernel/`)) && pkg) {
    return `domain/kernel must not import npm package "${spec}" (04-ARCH §4.1.1 rule 2)`;
  }
  if (pkg) {
    if (fromLayer === 'application' && spec !== 'zod') return `application must not import framework/library "${spec}" — declare a port`;
    return null;
  }
  if (!to) return null;
  if (to.startsWith('cms-api/test/') && !from.includes('/test/')) return 'production code must not import test code';
  if (fromLayer === 'domain' && !(layer(to) === 'domain' && mod(to) === mod(from)) && !to.startsWith(`${API_SRC}shared/kernel/`)) {
    return `domain may only import its own domain + shared/kernel (got ${to})`;
  }
  if (fromLayer === 'application' && (/\/adapters\//.test(to) || to.startsWith(`${API_SRC}composition/`) || to.startsWith(`${API_SRC}shared/http/`))) {
    return `application must depend on ports, not adapters (got ${to})`;
  }
  if (fromLayer === 'adapters/in' && /\/domain\/(entities|services)\//.test(to)) {
    return `inbound adapters call use cases; they must not reach domain entities/services (got ${to})`;
  }
  if (fromLayer === 'adapters/in' && layer(to) === 'adapters/out' && !to.includes('in-memory-object-storage')) {
    return `adapters/in must not import adapters/out (got ${to})`;
  }
  if (mod(from) && mod(to) && mod(from) !== mod(to)) {
    return `module "${mod(from)}" must not import module "${mod(to)}" — wire it in src/composition (04-ARCH §4.7)`;
  }
  if (from.startsWith(`${API_SRC}shared/`) && !from.startsWith(`${API_SRC}shared/http/`) && to.startsWith(`${API_SRC}modules/`)) {
    return `shared must not depend on modules (got ${to})`;
  }
  return null;
}

function webRule(from, to) {
  if (!to) return null;
  const zone = (p) =>
    p.startsWith(`${WEB_SRC}design-system/`) ? 'design-system'
    : p.startsWith(`${WEB_SRC}shared/`) ? 'shared'
    : p.startsWith(`${WEB_SRC}features/`) ? `feature:${p.split('/')[3]}`
    : p.startsWith(`${WEB_SRC}app/`) ? 'app'
    : 'other';
  const f = zone(from);
  const t = zone(to);
  if (f === 'design-system' && t !== 'design-system') return `design-system must not import ${t} (04-ARCH §5.8)`;
  if (f === 'shared' && (t.startsWith('feature:') || t === 'app')) return `shared must not import ${t}`;
  if (f.startsWith('feature:') && t.startsWith('feature:') && f !== t) return `${f} must not import ${t} — go through shared/ or routing`;
  if (f.startsWith('feature:') && t === 'app') return `features must not import app/`;
  return null;
}

export function checkFiles(files) {
  const problems = [];
  for (const abs of files) {
    const from = rel(abs);
    const inApi = from.startsWith(API_SRC);
    const inWeb = from.startsWith(WEB_SRC);
    if (!(inApi || inWeb) || isSpec(abs)) continue;
    for (const { spec, line } of importsOf(read(abs))) {
      const target = resolveRelative(abs, spec);
      const to = target ? rel(target) : null;
      const msg = inApi ? apiRule(from, to, spec) : webRule(from, to);
      if (msg) problems.push(`${from}:${line} → ${msg}`);
    }
  }
  return problems;
}

const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => (a.startsWith('/') || /^[A-Za-z]:/.test(a) ? a : join(ROOT, a))).filter((p) => existsSync(p) && isTs(p))
  : [...walk(join(ROOT, 'cms-api/src'), isTs), ...walk(join(ROOT, 'cms-web/src'), isTs)];
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-architecture.mjs')) {
  process.exit(report('architecture rules (hexagonal BE / reactive FE)', checkFiles(files)) ? 0 : 1);
}
