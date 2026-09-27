import type { z } from 'zod';
import type { ErrorCode } from '@third-eye/shared';

export class AppError extends Error {
  constructor(public status: number, public code: ErrorCode, message: string, public details?: unknown) {
    super(message);
  }
}
export const notFound = (message = 'Not found') => new AppError(404, 'not_found', message);
export const forbidden = (message = 'Forbidden') => new AppError(403, 'forbidden', message);

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(400, 'validation_error', 'Invalid request', r.error.flatten());
  return r.data;
}

/**
 * Reduces an unhandled error to a shape safe to log. Prisma validation errors embed argument
 * values (potentially PII, e.g. a user's birth date or name) in their message, so for those we
 * keep only the first line, tightly truncated; other errors keep more of the message but still capped.
 */
export function sanitizeErrorLog(err: unknown): { errName: string; errMessage: string; errCode?: string } {
  const name = (err instanceof Error && err.name) || 'Error';
  const rawMessage = (err instanceof Error && err.message) || String(err);
  const errMessage = name.startsWith('PrismaClient')
    ? rawMessage.split('\n')[0]!.slice(0, 120)
    : rawMessage.slice(0, 300);
  const code = (err as { code?: unknown })?.code;
  return { errName: name, errMessage, ...(typeof code === 'string' ? { errCode: code } : {}) };
}
