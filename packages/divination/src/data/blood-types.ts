import type { BloodType } from '../types.js';

/** Japanese ketsueki-gata (blood-type personality) archetypes. */
export interface BloodTypeProfile { title: string; traits: string[] }

export const BLOOD_TYPES: Record<BloodType, BloodTypeProfile> = {
  A: { title: 'The Careful Planner', traits: ['earnest', 'responsible', 'sensitive', 'perfectionist'] },
  B: { title: 'The Free Spirit', traits: ['passionate', 'creative', 'independent', 'unconventional'] },
  O: { title: 'The Confident Leader', traits: ['confident', 'generous', 'ambitious', 'resilient'] },
  AB: { title: 'The Enigmatic Dreamer', traits: ['rational', 'adaptable', 'dual-natured', 'imaginative'] },
};
