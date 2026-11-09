// Shared helpers for the zero-dependency harness scripts (Node ≥ 20, no npm install needed).
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const posix = (p) => p.split(sep).join('/');
export const rel = (abs) => posix(relative(ROOT, abs));

export function walk(dir, filter = () => true, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

export const isTs = (p) => /\.(ts|tsx)$/.test(p) && !p.endsWith('.d.ts');
export const isSpec = (p) => /\.(spec|test)\.(ts|tsx)$/.test(p) || /[\\/]test[\\/]/.test(p);

export function read(p) {
  return readFileSync(p, 'utf8');
}

/** Static import/export-from/dynamic-import specifiers with their line numbers. */
export function importsOf(source) {
  const out = [];
  const re = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(source))) {
    const spec = m[2] ?? m[3];
    const line = source.slice(0, m.index).split('\n').length + (source[m.index] === '\n' ? 1 : 0);
    out.push({ spec, typeOnly: Boolean(m[1]), line });
  }
  return out;
}

export function resolveRelative(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return base;
}

export function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

/** Files changed vs the merge base with main (falls back to the working tree). */
export function changedFiles() {
  const base = git('merge-base HEAD origin/main') || git('merge-base HEAD main');
  const committed = base ? git(`diff --name-only ${base}...HEAD`) : '';
  const working = git('diff --name-only HEAD');
  const untracked = git('ls-files --others --exclude-standard');
  return [...new Set([committed, working, untracked].join('\n').split('\n').filter(Boolean))];
}

export function report(title, problems) {
  if (problems.length === 0) {
    console.log(`✓ ${title}`);
    return true;
  }
  console.error(`✗ ${title} — ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  return false;
}
