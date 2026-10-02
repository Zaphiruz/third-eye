import type { Method } from '../types.js';

export interface MethodInfo { summary: string; learnMoreUrl: string; learnMoreLabel: string }

/** The short "ⓘ" explainer on each method card. The long form lives on /how-it-works. */
export const METHOD_INFO: Record<Method, MethodInfo> = {
  TAROT: {
    summary: 'Tarot began as a 15th-century Italian card game and became a tool for divination in 18th-century France. Third Eye shuffles all 78 cards and lays three — your situation, your challenge and advice — each upright or reversed.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Tarot_card_reading', learnMoreLabel: 'Tarot card reading',
  },
  RUNE: {
    summary: 'The Elder Futhark is the oldest runic alphabet, used by Germanic peoples from about the 2nd century. Third Eye draws one of its 24 runes; most can land reversed ("merkstave"), which turns their meaning toward its shadow.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Elder_Futhark', learnMoreLabel: 'Elder Futhark',
  },
  ICHING: {
    summary: 'The I Ching, or Book of Changes, is a Chinese classic over 2,500 years old. Third Eye tosses three coins six times to build a hexagram from the bottom up; changing lines flip to show where things are heading.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/I_Ching_divination', learnMoreLabel: 'I Ching divination',
  },
  SKY: {
    summary: 'Astrologers have watched the Moon and the five naked-eye planets for thousands of years. Third Eye calculates where the Sun, Moon and planets stand in the zodiac at noon on the day of your reading, the moon phase, and which planets appear to move backwards (retrograde).',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Lunar_phase', learnMoreLabel: 'Lunar phase',
  },
  WESTERN: {
    summary: 'Western astrology divides the year into twelve signs of the tropical zodiac. Your sun sign is the sign the Sun was in on your birth date; each has an element, a modality and a ruling planet.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Astrological_sign', learnMoreLabel: 'Astrological sign',
  },
  CHINESE: {
    summary: 'The Chinese zodiac pairs twelve animals with five elements and yin or yang, in a 60-year cycle. Third Eye finds your animal from the Lunar New Year of your birth year, so early-year birthdays may belong to the year before.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Chinese_zodiac', learnMoreLabel: 'Chinese zodiac',
  },
  NUMEROLOGY: {
    summary: 'Numerology gives meaning to numbers reduced from your birth date and name, in a tradition credited to Pythagoras. Your Life Path comes from your birth date; your Expression number, if you gave a full name, from its letters.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Numerology', learnMoreLabel: 'Numerology',
  },
  BLOODTYPE: {
    summary: 'Blood type personality (ketsueki-gata) is a popular belief in Japan and Korea that your ABO blood type shapes your temperament. It has no scientific support; Third Eye includes it for fun, only if you add your blood type.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Blood_type_personality_theory', learnMoreLabel: 'Blood type personality theory',
  },
};
