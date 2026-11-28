import type { z } from 'zod';

/** zod 3's names for a received value ("nan", "date", "array", "null"), as shown on cms-web forms. */
function receivedType(input: unknown): string {
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'array';
  if (input instanceof Date) return 'date';
  if (typeof input === 'number' && Number.isNaN(input)) return 'nan';
  return typeof input;
}

/**
 * 04-ARCH §6.4: the 422 field messages are user-visible, so missing / wrong-type fields keep the
 * wording they had before zod 4 ("Required", "Expected number, received string"). Messages a schema
 * sets itself win over this map; every other issue falls through to zod's default (undefined).
 */
const stableMessages: z.core.$ZodErrorMap = (issue) => {
  if (issue.code !== 'invalid_type') return undefined;
  return issue.input === undefined ? 'Required' : `Expected ${issue.expected}, received ${receivedType(issue.input)}`;
};

/** Zod at the driving adapter BEFORE reaching a use case (04-ARCH §4.9). ZodError → 422 via the filter. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  return schema.parse(input, { error: stableMessages });
}
