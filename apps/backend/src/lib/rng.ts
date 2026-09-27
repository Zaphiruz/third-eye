import { randomInt } from 'node:crypto';
import type { Rng } from '@third-eye/divination';

/** Cryptographically random draws for production fortunes. */
export const cryptoRng: Rng = (maxExclusive) => randomInt(maxExclusive);
