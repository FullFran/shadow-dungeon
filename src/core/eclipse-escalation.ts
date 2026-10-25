import { ENDLESS } from '../data/endless';
import type { EclipseEchoDef } from '../data/enemies';

/**
 * The Eclipse Echo grows with every encounter (user feedback 2026-10-25;
 * docs/gdd.md "Eco del Eclipse"): on floor 10 it is the first, on 20 the
 * second, and so on. Each encounter, on top of the card it already gains (a
 * new pattern family, core/eclipse-echo.ts `eclipseCardCount`):
 *
 * - denser volleys: rings carry more shots with the same angular gap (the
 *   gap's slots grow with them), spirals and mirrored spirals emit longer,
 *   lane walls stand closer (the safe lane keeps its width), +6 % per
 *   encounter up to x1.3 (the fairness knob limit; speed never changes, so
 *   density x speed stays at most x1.3);
 * - faster card transitions: the rest between cards -7 % per encounter and
 *   the opening after a card -4 %, down to 60 % and 75 %;
 * - an escalating epithet: «Eco del Eclipse · III».
 *
 * Its corona and noose (positional) keep their shape. The shot cap
 * (`maxShots`) is the same, so a denser card can only lose shots, never
 * overfill the air.
 */
export const ECHO_ESCALATION = { densityPerEncounter: 0.06, maxDensity: 1.3, restPerEncounter: 0.07, minRest: 0.6, recoverPerEncounter: 0.04, minRecover: 0.75, minLaneSpacing: 18 } as const;

/** Which encounter with the Echo floor `floor` is (1 on floor 10). */
export const echoEncounter = (floor: number): number => Math.max(1, Math.floor(floor / (ENDLESS.eclipseEvery ?? 10)));

/** The knobs of encounter `n`. */
export function echoKnobs(n: number): { density: number; rest: number; recover: number } {
  const k = Math.max(0, n - 1);
  const e = ECHO_ESCALATION;
  return {
    density: Math.min(e.maxDensity, 1 + e.densityPerEncounter * k),
    rest: Math.max(e.minRest, 1 - e.restPerEncounter * k),
    recover: Math.max(e.minRecover, 1 - e.recoverPerEncounter * k),
  };
}

const CACHE = new WeakMap<EclipseEchoDef, Map<number, EclipseEchoDef>>();

/** The Echo as it fights on floor `floor` (the same object for the first encounter). */
export function escalatedEcho(def: EclipseEchoDef, floor: number): EclipseEchoDef {
  const n = echoEncounter(floor);
  if (n <= 1) return def;
  let byN = CACHE.get(def);
  if (!byN) CACHE.set(def, (byN = new Map()));
  const known = byN.get(n);
  if (known) return known;
  const { density, rest, recover } = echoKnobs(n);
  const count = Math.round(def.ring.count * density);
  const next: EclipseEchoDef = {
    ...def,
    restMs: Math.round(def.restMs * rest),
    recoverMs: Math.round(def.recoverMs * recover),
    ring: { ...def.ring, count, gap: Math.round((def.ring.gap * count) / def.ring.count), turn: Math.round((def.ring.turn * count) / def.ring.count) },
    spiral: { ...def.spiral, emissions: Math.round(def.spiral.emissions * density) },
    mirror: { ...def.mirror, emissions: Math.round(def.mirror.emissions * density) },
    lanes: { ...def.lanes, spacing: Math.max(ECHO_ESCALATION.minLaneSpacing, Math.round(def.lanes.spacing / density)) },
  };
  byN.set(n, next);
  return next;
}

const ROMAN: readonly [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function romanNumeral(n: number): string {
  let left = Math.max(1, Math.floor(n));
  let out = '';
  for (const [value, glyph] of ROMAN)
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  return out;
}

/** «Eco del Eclipse» the first time, «Eco del Eclipse · III» on the third. */
export const echoTitle = (name: string, floor: number): string => (echoEncounter(floor) <= 1 ? name : `${name} · ${romanNumeral(echoEncounter(floor))}`);
