// Key extraction for check-env-sync.mjs (07-OPS-ARCH §7.4) — pure, unit-tested from harness/test.
/** Top-level keys of the zod env schema in cms-api/src/config/env.schema.ts (any indentation). */
export const schemaKeysOf = (source) => [...source.matchAll(/^\s+([A-Z0-9_]+):/gm)].map((m) => m[1]);
