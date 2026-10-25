import { Rand } from '../core/herald/rand';
import { noteToMidi } from '../data/audio';
import type { HeraldArrival, HeraldDef } from '../data/herald';
import type { CinematicPanel, Shot } from '../data/prologue';
import type { CueMusic, ScoreEvent } from '../data/prologue-music';
import type { Language } from '../i18n';

/**
 * A herald's intro cutscene ("pero to épico"), composed from its def and
 * deterministic from its seed (the daily seed gives everyone the same one),
 * on the guardian cinematics' engine (src/ui/cinematic.ts timing, the
 * prologue player, tableaux in src/adapters/herald-scenes.ts):
 *
 * 1. `arrive` (2.6-3.4 s): the dark arena fades in under the eclipse, which
 *    pulses; the herald's silhouette arrives as it moves (it descends, it
 *    emerges from the ground, or it teleports in with a flash), the camera
 *    pushes in and the ground shakes when it lands; a timpani sting.
 * 2. `title` (2-2.4 s): the big title card in its type's colour: its name,
 *    its epithet and a one-line epigraph.
 *
 * `full` the first time this device meets the seed (the bestiary), `short`
 * (the 2 s title card) after; shared runs never pause, so they get only the
 * name card over the running game (`card`). Skippable like every cinematic.
 */
export type HeraldScene = 'arrive' | 'title';
export type HeraldIntroMode = 'full' | 'short' | 'card';

export const heraldIntroMode = ({ seen, shared }: { seen: boolean; shared: boolean }): HeraldIntroMode => (shared ? 'card' : seen ? 'short' : 'full');

/** Bounds of the full version, and the short title card. */
export const HERALD_INTRO = { minMs: 4000, maxMs: 6000, shortMs: 2000 } as const;

export interface HeraldIntro {
  panels: readonly CinematicPanel<HeraldScene>[];
  music: CueMusic;
  arrival: HeraldArrival;
  /** When the herald lands in the arrive panel (ms into it): the shake starts there. */
  impactMs: number;
  /** Peak shake (stage pixels) and how long it rings. */
  shake: { px: number; ms: number };
  totalMs: number;
}

const WIDE: Shot = { x: 0.5, y: 0.5, zoom: 1 };
const INTRO_SALT = 0x1e7a0;

/** The title card's lines: name, epithet (quoted), epigraph. */
export function titleLines(def: HeraldDef, lang: Language): string[] {
  const epithet = lang === 'es' ? `«${def.epithet.es}»` : `“${def.epithet.en}”`;
  return [def.name, epithet, def.epigraph[lang]];
}

/** The sting: a low drone, a timpani hit as the herald lands, two answering hits on the title (in a key from its seed). */
function sting(rand: Rand, impactS: number, titleS: number, totalS: number): CueMusic {
  const roots = ['D2', 'C2', 'E2', 'A1', 'G1', 'F2'];
  const root = noteToMidi(rand.pick(roots));
  const events: ScoreEvent[] = [
    { atS: 0, voice: 'drone', midi: [root, root + 7], durS: totalS, gain: 0.16 },
    { atS: impactS, voice: 'timpani', midi: [root], durS: 2.5, gain: 0.75 },
    { atS: titleS, voice: 'timpani', midi: [root - 5], durS: 1.8, gain: 0.4 },
    { atS: titleS + 0.35, voice: 'timpani', midi: [root], durS: 2, gain: 0.5 },
    { atS: titleS, voice: 'pad', midi: [root + 12, root + 15, root + 19], durS: Math.max(0.5, totalS - titleS), gain: 0.07 },
  ];
  events.sort((a, b) => a.atS - b.atS);
  return { file: null, score: { durationS: totalS, events } };
}

export function composeHeraldIntro(def: HeraldDef, mode: 'full' | 'short', lang: Language): HeraldIntro {
  const rand = new Rand(def.seed, INTRO_SALT);
  const lines = titleLines(def, lang);
  const titleCard = (durationMs: number, from: Shot): CinematicPanel<HeraldScene> => ({
    id: 'herald-title',
    scene: 'title',
    durationMs,
    fadeInMs: 250,
    fadeOutMs: 500,
    lines,
    textStartMs: 150,
    charsPerSecond: 95,
    lineGapMs: 120,
    camera: { from, to: { x: 0.5, y: 0.47, zoom: 1.04 } },
  });
  if (mode === 'short') {
    const title = titleCard(HERALD_INTRO.shortMs, WIDE);
    return { panels: [title], music: sting(rand, 0.05, 0.05, HERALD_INTRO.shortMs / 1000), arrival: def.arrival, impactMs: 0, shake: { px: 0, ms: 0 }, totalMs: HERALD_INTRO.shortMs };
  }
  const arriveMs = Math.round(rand.range(2600, 3400));
  const titleMs = Math.round(rand.range(2000, 2400));
  // It lands (or appears) at about two thirds of the arrive panel.
  const impactMs = Math.round(arriveMs * (def.arrival === 'teleport' ? 0.55 : 0.68));
  const push: Shot = { x: 0.5, y: rand.range(0.5, 0.58), zoom: rand.range(1.22, 1.32) };
  const arrive: CinematicPanel<HeraldScene> = {
    id: 'herald-arrive',
    scene: 'arrive',
    durationMs: arriveMs,
    fadeInMs: 700,
    fadeOutMs: 0,
    lines: [],
    textStartMs: 0,
    charsPerSecond: 1,
    lineGapMs: 0,
    camera: { from: { x: 0.5, y: 0.42, zoom: 1.02 }, to: push },
  };
  const totalMs = arriveMs + titleMs;
  return {
    panels: [arrive, titleCard(titleMs, { x: 0.5, y: 0.47, zoom: 1.12 })],
    music: sting(rand, impactMs / 1000, arriveMs / 1000, totalMs / 1000),
    arrival: def.arrival,
    impactMs,
    shake: { px: Math.round(rand.range(3, 5)), ms: 700 },
    totalMs,
  };
}

/** The camera shake `ms` into the arrive panel (stage pixels, deterministic in time). */
export function shakeAt(intro: Pick<HeraldIntro, 'impactMs' | 'shake'>, ms: number): { x: number; y: number } {
  const t = ms - intro.impactMs;
  if (t < 0 || t > intro.shake.ms || intro.shake.px === 0) return { x: 0, y: 0 };
  const k = intro.shake.px * (1 - t / intro.shake.ms);
  return { x: Math.round(Math.sin(t / 23) * k), y: Math.round(Math.cos(t / 31) * k) };
}
