import type { ReactNode } from 'react';
import type { Method } from '@third-eye/divination';

/** The long-form explanation of each method on /how-it-works. Short summaries live in METHOD_INFO. */
export const METHOD_GUIDES: Record<Method, ReactNode> = {
  TAROT: <>
    <p>Tarot decks appeared in northern Italy in the 1400s as playing cards. Reading them for meaning became popular in France in the late 1700s. The modern deck has 78 cards: 22 Major Arcana (The Fool, The Tower, The Star…) for life's big themes, and 56 Minor Arcana in four suits — Wands (drive), Cups (feeling), Swords (thought) and Pentacles (the material world).</p>
    <p><strong>How Third Eye draws:</strong> the whole deck is shuffled with cryptographic randomness and three cards are laid out — <em>Situation</em> (where you stand), <em>Challenge</em> (what pushes back) and <em>Advice</em> (how to meet it). Each card has an even chance of landing reversed.</p>
    <p><strong>Reading it:</strong> a reversed card is not "bad". It points to the same energy blocked, turned inward or arriving late.</p>
  </>,
  RUNE: <>
    <p>The Elder Futhark is the oldest runic alphabet, carved by Germanic peoples from about the 2nd to the 8th century. Each of its 24 runes is a sound and a word — Fehu (cattle, wealth), Ansuz (a god, the voice), Raidho (the journey). Casting runes for guidance is mostly a 20th-century revival, inspired by the Roman historian Tacitus.</p>
    <p><strong>How Third Eye draws:</strong> one rune is chosen at random from the 24. Runes that look the same upside down, such as Gebo and Isa, are always upright. Every other rune has an even chance of being <em>merkstave</em> (reversed).</p>
    <p><strong>Reading it:</strong> merkstave turns a rune's meaning toward its shadow side — wealth becomes loss, a message becomes misunderstanding.</p>
  </>,
  ICHING: <>
    <p>The I Ching, or Book of Changes, dates from China's Zhou dynasty, roughly 3,000 years ago. Confucian scholars later added commentaries to it. It describes 64 hexagrams, each a stack of six solid (yang) or broken (yin) lines.</p>
    <p><strong>How Third Eye casts:</strong> the three-coin method. For each line, three virtual coins are tossed (heads count 3, tails 2), giving 6, 7, 8 or 9. Lines are built from the bottom up: 7 is a steady yang line, 8 a steady yin line, and 9 and 6 are yang and yin lines that are <em>changing</em>.</p>
    <p><strong>Reading it:</strong> the first hexagram is the present. Changing lines flip to their opposite, giving a second, <em>relating</em> hexagram that shows where the situation is heading.</p>
  </>,
  SKY: <>
    <p>Astrologers from Babylon to Alexandria tracked the seven "wandering stars" visible to the naked eye — the Sun, the Moon, Mercury, Venus, Mars, Jupiter and Saturn — as they move through the twelve signs of the zodiac. The Moon's phases have marked time for almost every culture.</p>
    <p><strong>How Third Eye calculates it:</strong> no randomness here. Using the astronomy-engine library, Third Eye computes where each body appears from Earth, against the tropical zodiac, at <em>noon on the day of your reading in your time zone</em>, along with the Moon's phase and how much of it is lit. A planet is marked <em>retrograde</em> (℞) when it appears to be moving backwards — an illusion caused by Earth passing it, or it passing Earth.</p>
    <p><strong>Reading it:</strong> this is the same sky for everyone that day, not your birth chart. Think of it as the day's weather: a waxing Moon builds, a full Moon peaks, a waning Moon releases, and a new Moon begins. A retrograde planet is traditionally a time to review its area of life — Mercury for communication, Venus for love, Mars for drive — rather than start something new.</p>
  </>,
  WESTERN: <>
    <p>Western astrology comes from Hellenistic Egypt, where Babylonian sky-watching met Greek philosophy. The tropical zodiac divides the Sun's yearly path into twelve 30° signs, starting at the spring equinox. Each sign has an element (fire, earth, air, water), a modality (cardinal, fixed, mutable) and a ruling planet.</p>
    <p><strong>How Third Eye calculates it:</strong> your sun sign comes from your birth date, using the conventional dates (for example, Gemini runs May 21 – June 20). If you were born on the first or last day of a sign, your exact sign can depend on the year and time.</p>
    <p><strong>Reading it:</strong> your sun sign is your core temperament. The oracle reads today's cards and sky in its light.</p>
  </>,
  CHINESE: <>
    <p>The Chinese zodiac goes back more than 2,000 years. Twelve animals (Rat, Ox, Tiger…) cycle with the five elements (wood, fire, earth, metal, water), each in a yang and a yin year, giving a 60-year cycle.</p>
    <p><strong>How Third Eye calculates it:</strong> the zodiac year starts at Lunar New Year (between January 21 and February 20), not on January 1. Third Eye looks up the exact Lunar New Year date for your birth year in a table covering 1900–2100. If you were born in January or early February, you may belong to the previous year's animal.</p>
    <p><strong>Reading it:</strong> the animal is your character; the element colours how it shows; yin and yang say whether it turns inward or outward.</p>
  </>,
  NUMEROLOGY: <>
    <p>The idea that numbers carry meaning is ancient and is often credited to Pythagoras. Modern "Pythagorean" numerology took shape in the early 20th century.</p>
    <p><strong>How Third Eye calculates it:</strong> for your <em>Life Path</em>, your birth month, day and year are each reduced to one digit by adding their digits, then added together and reduced again. For your <em>Expression</em> number (only if you gave a full name), letters count A=1 … I=9, J=1 … R=9, S=1 … Z=8, and the total is reduced the same way. 11, 22 and 33 are <em>master numbers</em> and are never reduced.</p>
    <p><strong>Reading it:</strong> your Life Path is the road you walk; your Expression is the toolkit you bring to it. Master numbers carry extra intensity.</p>
  </>,
  BLOODTYPE: <>
    <p>Blood type personality (ketsueki-gata) began with a 1927 paper by the Japanese psychologist Takeji Furukawa. It became a pop-culture favourite in Japan and Korea in the 1970s. Studies have found no real link between blood type and personality — it is here for fun and cultural flavour.</p>
    <p><strong>How Third Eye uses it:</strong> only if you add your blood type in Settings. Each type has a classic archetype — A the Careful Planner, B the Free Spirit, O the Confident Leader, AB the Enigmatic Dreamer.</p>
    <p><strong>Reading it:</strong> treat it as a lighthearted lens on how you might meet the day.</p>
  </>,
};
