/** Integer in [0, maxExclusive). The ONLY source of randomness in this package. */
export type Rng = (maxExclusive: number) => number;

export type BloodType = 'A' | 'B' | 'AB' | 'O';
export const BLOOD_TYPE_IDS = ['A', 'B', 'AB', 'O'] as const satisfies readonly BloodType[];

/** Display and ritual order. castAll returns results in this order. */
export const METHODS = ['TAROT', 'RUNE', 'ICHING', 'WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE'] as const;
export type Method = (typeof METHODS)[number];

export const METHOD_LABELS: Record<Method, string> = {
  TAROT: 'Tarot', RUNE: 'Rune', ICHING: 'I Ching', WESTERN: 'Sun Sign',
  CHINESE: 'Chinese Zodiac', NUMEROLOGY: 'Numerology', BLOODTYPE: 'Blood Type',
};

/** birthDate is YYYY-MM-DD. */
export interface Profile { birthDate: string; fullName: string | null; bloodType: BloodType | null }

export type ZodiacSignId =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';
export type ChineseAnimalId =
  | 'rat' | 'ox' | 'tiger' | 'rabbit' | 'dragon' | 'snake'
  | 'horse' | 'goat' | 'monkey' | 'rooster' | 'dog' | 'pig';
export type ChineseElementId = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export type TarotPosition = 'situation' | 'challenge' | 'advice';
export interface TarotData { cards: { id: string; reversed: boolean; position: TarotPosition }[] }
export interface RuneData { id: string; reversed: boolean }
/** lines are bottom → top. 6 = old yin (changing), 7 = young yang, 8 = young yin, 9 = old yang (changing). */
export interface IChingData { lines: (6 | 7 | 8 | 9)[]; primary: number; changingLines: number[]; relating: number | null }
export interface WesternData { sign: ZodiacSignId }
export interface ChineseData { animal: ChineseAnimalId; element: ChineseElementId; polarity: 'yin' | 'yang'; lunarYear: number }
export interface NumerologyData { lifePath: number; expression: number | null }
export interface BloodTypeData { type: BloodType }

export type SkyBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
export type MoonPhase =
  | 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous'
  | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';
/** Tropical zodiac position; degree is 0–29 within the sign. Sun and Moon are never retrograde. */
export interface SkyBodyPosition { body: SkyBody; sign: ZodiacSignId; degree: number; retrograde: boolean }
/** illumination is a 0–1 fraction (2 decimals); bodies are in SKY_BODY_IDS order. */
export interface SkyData { moon: { phase: MoonPhase; illumination: number; waxing: boolean }; bodies: SkyBodyPosition[] }

export type MethodResult =
  | { method: 'TAROT'; data: TarotData }
  | { method: 'RUNE'; data: RuneData }
  | { method: 'ICHING'; data: IChingData }
  | { method: 'WESTERN'; data: WesternData }
  | { method: 'CHINESE'; data: ChineseData }
  | { method: 'NUMEROLOGY'; data: NumerologyData }
  | { method: 'BLOODTYPE'; data: BloodTypeData };
export type MethodData = MethodResult['data'];

/** Human-readable facts about one result, used in the AI prompt and in the UI. */
export interface ResultDescription { method: Method; title: string; facts: string[] }
