import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// No test.globals, so testing-library can't auto-register cleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// jsdom has no matchMedia; motion's useReducedMotion reads it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}
