// Key extraction for check-env-sync.mjs (07-OPS-ARCH §7.4) — pure, unit-tested from harness/test.
/**
 * Indented UPPER_CASE keys (any depth) in cms-api/src/config/env.schema.ts. Indentation is spaces/tabs
 * only — `\s` would also match newlines and let a column-0 key after a blank line through.
 * A nested UPPER_CASE key would be reported as drift (fails closed); the schema has none.
 */
export const schemaKeysOf = (source) => [...source.matchAll(/^[ \t]+([A-Z0-9_]+):/gm)].map((m) => m[1]);
