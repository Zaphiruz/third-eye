import type { BloodTypeData, Profile } from './types.js';

export function castBloodType(p: Profile): BloodTypeData | null {
  return p.bloodType ? { type: p.bloodType } : null;
}
