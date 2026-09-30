import type { BloodType, Method, MethodData } from '@third-eye/divination';
import type { PersonaId } from './constants.js';

export interface ProfileDto {
  birthDate: string | null;       // YYYY-MM-DD
  fullName: string | null;
  bloodType: BloodType | null;
  timeZone: string;               // IANA
  persona: PersonaId;
}

export interface MeDto {
  user: { sub: string; name: string; email: string; isAdmin: boolean };
  profile: ProfileDto;
  onboarded: boolean;             // birthDate !== null
}

export type FortuneStatus = 'PENDING' | 'READY' | 'FAILED';

export interface FortuneResultDto { method: Method; data: MethodData; reading: string | null }

export interface FortuneDto {
  id: string;
  date: string;                   // YYYY-MM-DD, the user's local date
  status: FortuneStatus;
  persona: PersonaId;
  summary: string | null;
  results: FortuneResultDto[];    // METHODS order
}

export interface TodayDto { fortune: FortuneDto; fresh: boolean }

export interface FortuneSummaryDto {
  id: string;
  date: string;
  status: FortuneStatus;
  persona: PersonaId;
  excerpt: string | null;         // first sentence of summary, max 160 chars
  results: FortuneResultDto[];    // readings omitted (null) to keep the page small
}

export interface FortunePageDto { items: FortuneSummaryDto[]; nextCursor: string | null }

export interface ApiErrorBody { error: { code: string; message: string; details?: unknown } }

export interface ShareDto {
  id: string;
  url: string;               // `${FRONTEND_ORIGIN}/s/${token}`
  sharedByName: string;
  includeBirthSigns: boolean;
  createdAt: string;         // ISO timestamp
}
