import type { CardStepDef } from '../data/cards';
import type { DanmakuPattern } from '../data/enemies';

/**
 * The fairness rules every spell card's moves keep (docs/gdd.md §9,
 * docs/souls-difficulty-research.md P4/P5, docs/research/boss-patterns.md §4),
 * as pure functions the card tests iterate over every boss, tier and card:
 * how many aimed threats a move sends at one player, how dense a pattern is
 * (the tier knob), and the limits of the new bullet families.
 */

/** Every pattern a move fires: its own and its layers. */
export const stepPatterns = (s: CardStepDef): readonly DanmakuPattern[] => [s.pattern, ...(s.layers ?? [])];

const shotOf = (p: DanmakuPattern) => ('shot' in p ? p.shot : undefined);

/** A move that asks for a choice of place rather than a dodge (a pierce zone, a sweep, a positional wall): its wind-up floor is the higher one. */
export const positionalStep = (s: CardStepDef): boolean =>
  stepPatterns(s).some((p) => ((p.kind === 'sweep' || p.kind === 'zone') && p.attack.pierceRoll === true) || shotOf(p)?.pierceRoll === true);

/**
 * Aimed threats one pattern sends at a player at once: a fan or scatter
 * aimed at each part is one, turrets and aimed familiars fire from `atOnce`
 * places, homing orbs are one. Shapes aimed once at the wind-up (rings,
 * spirals, waves, closing rings, lasers) are not.
 */
export function patternAimedThreats(p: DanmakuPattern): number {
  if ((p.kind === 'fan' || p.kind === 'scatter') && p.aim === 'each') return 1;
  if (p.kind === 'turrets') return p.atOnce;
  if (p.kind === 'familiars') return p.aim === 'target' ? p.atOnce : 0;
  if (p.kind === 'homing') return 1;
  return 0;
}

/** Aimed threats a move sends at one player at once (at most two, GDD §3 "Equidad"). */
export const aimedThreats = (s: CardStepDef): number => stepPatterns(s).reduce((n, p) => n + patternAimedThreats(p), 0);

/** Shots per part (ring, fan, wave, volley, laser beat): the density knob. */
export function patternDensity(p: DanmakuPattern): number {
  if (p.kind === 'rings' || p.kind === 'closing') return p.perRing - p.gap;
  if (p.kind === 'spiral') return p.arms;
  if (p.kind === 'wave') return p.arms * (p.mirror ? 2 : 1);
  if (p.kind === 'fan') return p.perFan;
  if (p.kind === 'turrets' || p.kind === 'familiars') return p.atOnce * p.perVolley;
  if (p.kind === 'lanes' || p.kind === 'walls') return 1000 / p.spacing - p.gapWidth / p.spacing;
  if (p.kind === 'scatter') return p.count;
  if (p.kind === 'homing') return p.orbs;
  if (p.kind === 'laser') return p.lines;
  return 1;
}

/**
 * Limits of the new families (docs/research/boss-patterns.md §4 fairness
 * defaults), each broken one a message: lasers warn at least 400 ms before
 * they fire and fire for less than their volley; familiars orbit at most
 * 60°/s; curves turn at most 40°/s; a shot bounces at most once; homing
 * bends at most 80°/s for at most 2.5 s; a closing ring leaves a gap at
 * least as wide as a player at its start; a returning shot comes back at
 * most at 140 px/s.
 */
export function familyViolations(p: DanmakuPattern): string[] {
  const out: string[] = [];
  if (p.kind === 'laser') {
    if (p.warnMs < 400) out.push(`laser warns ${p.warnMs} ms < 400`);
    if (p.warnMs + p.fireMs > p.everyMs) out.push('laser fires past its volley');
  }
  if (p.kind === 'familiars' && Math.abs(p.degPerSec) > 60) out.push(`familiars orbit ${p.degPerSec}°/s > 60`);
  if (p.kind === 'closing') {
    const gapPx = (2 * Math.PI * p.radius * p.gap) / p.perRing;
    if (gapPx < 40) out.push(`closing gap ${Math.round(gapPx)} px < 40`);
  }
  const s = shotOf(p);
  if (s?.kin?.curveDegPerSec !== undefined && Math.abs(s.kin.curveDegPerSec) > 40) out.push(`curve ${s.kin.curveDegPerSec}°/s > 40`);
  if ((s?.kin?.bounces ?? 0) > 1) out.push(`bounces ${s!.kin!.bounces} > 1`);
  if (s?.kin?.accel !== undefined && s.kin.accel < 0 && !s.kin.stop && (s.kin.maxSpeed ?? Infinity) > 140) out.push('a returning shot comes back faster than 140 px/s');
  if (s?.steer && (s.steer.degPerSec > 80 || s.steer.ms > 2500)) out.push(`homing ${s.steer.degPerSec}°/s for ${s.steer.ms} ms`);
  return out;
}
