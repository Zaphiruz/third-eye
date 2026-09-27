import { z } from 'zod';
import { BLOOD_TYPE_IDS } from '@third-eye/divination';
import { PERSONA_IDS } from './constants.js';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A real calendar date in YYYY-MM-DD form. */
export const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Not a real date');

const birthDateSchema = isoDateSchema
  .refine((s) => s >= '1900-01-01', 'Birth date must be in 1900 or later')
  .refine((s) => s < new Date().toISOString().slice(0, 10), 'Birth date must be in the past');

export const profileUpdateSchema = z.object({
  birthDate: birthDateSchema,
  fullName: z.string().trim().max(120).nullable().transform((s) => (s ? s : null)),
  bloodType: z.enum(BLOOD_TYPE_IDS).nullable(),
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
  persona: z.enum(PERSONA_IDS),
}).partial().strict().refine((o) => Object.keys(o).length > 0, 'Nothing to update');

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
