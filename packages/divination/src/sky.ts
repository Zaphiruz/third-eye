import { Body, Ecliptic, EclipticGeoMoon, GeoVector, MakeTime, SunPosition } from 'astronomy-engine';
import type { MoonPhase, SkyBody, SkyBodyPosition, SkyData } from './types.js';
import { SKY_BODY_IDS } from './data/sky.js';
import { ZODIAC_SIGNS } from './data/zodiac.js';

const DAY_MS = 86_400_000;
const PLANETS: Partial<Record<SkyBody, Body>> = {
  mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
};
const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Geocentric apparent ecliptic longitude (of date) in degrees, [0, 360). */
export function eclipticLongitude(body: SkyBody, at: Date): number {
  const t = MakeTime(at);
  if (body === 'sun') return norm(SunPosition(t).elon);
  if (body === 'moon') return norm(EclipticGeoMoon(t).lon);
  return norm(Ecliptic(GeoVector(PLANETS[body]!, t, true)).elon);
}

// Eight phases, each centred on its principal angle (new 0°, first quarter 90°, full 180°, last quarter 270°).
const PHASES: MoonPhase[] = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
];
/** Moon–Sun elongation in degrees → phase name. */
export function moonPhaseFor(elongation: number): MoonPhase {
  return PHASES[Math.floor(norm(elongation + 22.5) / 45) % 8]!;
}

/** Where the Sun, Moon and planets stand at `at`, in the tropical zodiac, plus the moon phase. */
export function castSky(at: Date): SkyData {
  const next = new Date(at.getTime() + DAY_MS);
  const lon = Object.fromEntries(SKY_BODY_IDS.map((b) => [b, eclipticLongitude(b, at)])) as Record<SkyBody, number>;
  const bodies = SKY_BODY_IDS.map((body): SkyBodyPosition => {
    const l = lon[body];
    let retrograde = false;
    if (PLANETS[body]) {
      let delta = eclipticLongitude(body, next) - l; // unwrap across 0°/360°
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      retrograde = delta < 0;
    }
    return { body, sign: ZODIAC_SIGNS[Math.floor(l / 30)]!.id, degree: Math.floor(l % 30), retrograde };
  });
  const e = norm(lon.moon - lon.sun);
  return {
    moon: { phase: moonPhaseFor(e), illumination: Math.round(((1 - Math.cos((e * Math.PI) / 180)) / 2) * 100) / 100, waxing: e < 180 },
    bodies,
  };
}
