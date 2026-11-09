import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

// jsdom lacks layout APIs that ProseMirror (TipTap) calls when handling clicks and selections.
if (typeof document.elementFromPoint !== 'function') document.elementFromPoint = () => null;
const emptyRects = (): DOMRectList => Object.assign([], { item: () => null });
Range.prototype.getClientRects = emptyRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();
Element.prototype.scrollIntoView = () => undefined;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
