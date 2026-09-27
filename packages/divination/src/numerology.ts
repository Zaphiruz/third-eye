import type { NumerologyData, Profile } from './types.js';

const MASTER = new Set([11, 22, 33]);
const digitSum = (n: number) => String(n).split('').reduce((s, d) => s + Number(d), 0);

export function reduceNumber(n: number): number {
  let x = n;
  while (x > 9 && !MASTER.has(x)) x = digitSum(x);
  return x;
}

export function lifePathNumber(birthDate: string): number {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  return reduceNumber(reduceNumber(m) + reduceNumber(d) + reduceNumber(y));
}

/** A=1 … I=9, J=1 … R=9, S=1 … Z=8. */
const letterValue = (ch: string) => ((ch.charCodeAt(0) - 65) % 9) + 1;

export function expressionNumber(fullName: string): number | null {
  const letters = fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return null;
  return reduceNumber([...letters].reduce((s, ch) => s + letterValue(ch), 0));
}

export function castNumerology(p: Profile): NumerologyData {
  return { lifePath: lifePathNumber(p.birthDate), expression: p.fullName ? expressionNumber(p.fullName) : null };
}
