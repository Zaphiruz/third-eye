import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// No test.globals, so testing-library can't auto-register cleanup.
afterEach(() => { cleanup(); });
