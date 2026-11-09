import type { z } from 'zod';

/** Zod at the driving adapter BEFORE reaching a use case (04-ARCH §4.9). ZodError → 422 via the filter. */
export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  return schema.parse(input) as z.infer<S>;
}
