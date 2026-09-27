import { describe, expect, it } from 'vitest';
import { sanitizeErrorLog } from './errors.js';

describe('sanitizeErrorLog', () => {
  it('caps a generic error message at 300 chars and keeps its code', () => {
    const err = Object.assign(new Error('x'.repeat(400)), { code: 'ECONNRESET' });
    const out = sanitizeErrorLog(err);
    expect(out.errName).toBe('Error');
    expect(out.errMessage).toHaveLength(300);
    expect(out.errCode).toBe('ECONNRESET');
  });

  it('keeps only the truncated first line for a PrismaClient error, dropping embedded argument values', () => {
    const err = new Error(`Invalid \`prisma.user.create()\` invocation\nArgument birthDate: '1990-06-15' is missing.`);
    err.name = 'PrismaClientValidationError';
    const out = sanitizeErrorLog(err);
    expect(out.errMessage).toBe('Invalid `prisma.user.create()` invocation');
    expect(out.errMessage).not.toContain('1990-06-15');
  });

  it('handles a non-Error thrown value', () => {
    expect(sanitizeErrorLog('boom')).toEqual({ errName: 'Error', errMessage: 'boom' });
  });
});
