import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { parse } from './validation';

const messagesOf = (schema: z.ZodType, input: unknown) => {
  try {
    parse(schema, input);
  } catch (e) {
    if (e instanceof ZodError) return e.issues.map((i) => [i.path.join('.'), i.message]);
    throw e;
  }
  return [];
};

/**
 * 04-ARCH §4.9 / §6.4: request validation at the driving adapter. The 422 `details.fields[].message`
 * texts land on cms-web form fields, so the wording for missing / wrong-type fields stays stable
 * across zod majors ("Required", "Expected number, received string").
 */
describe('parse (04-ARCH §4.9)', () => {
  it('returns the parsed, typed value', () => {
    expect(parse(z.object({ n: z.coerce.number() }), { n: '7' })).toEqual({ n: 7 });
  });

  it('says "Required" for a missing field', () => {
    expect(messagesOf(z.object({ title: z.string() }), {})).toEqual([['title', 'Required']]);
  });

  it('says "Expected <type>, received <type>" for a wrong type', () => {
    const schema = z.object({ n: z.number(), s: z.string(), b: z.boolean(), o: z.object({}), a: z.array(z.string()) });
    expect(messagesOf(schema, { n: 'x', s: null, b: [], o: 1, a: {} })).toEqual([
      ['n', 'Expected number, received string'],
      ['s', 'Expected string, received null'],
      ['b', 'Expected boolean, received array'],
      ['o', 'Expected object, received number'],
      ['a', 'Expected array, received object'],
    ]);
  });

  it('names NaN and dates the way zod 3 did', () => {
    expect(messagesOf(z.object({ n: z.number(), s: z.string() }), { n: Number.NaN, s: new Date(0) })).toEqual([
      ['n', 'Expected number, received nan'],
      ['s', 'Expected string, received date'],
    ]);
  });

  it('keeps messages a schema sets itself', () => {
    expect(messagesOf(z.object({ slug: z.string().regex(/^[a-z]+$/, 'lowercase only') }), { slug: 'A' })).toEqual([
      ['slug', 'lowercase only'],
    ]);
    expect(messagesOf(z.object({ t: z.string('title is mandatory') }), {})).toEqual([['t', 'title is mandatory']]);
  });

  it('leaves the other zod messages alone', () => {
    expect(messagesOf(z.object({ s: z.string().min(3) }), { s: 'ab' })[0]?.[1]).toMatch(/3/);
  });
});
