import type { CinematicPanel, Shot } from './prologue';
import type { SpeciesId } from './species';

/**
 * Short lore cinematics around each guardian fight, on the prologue's engine
 * (`src/ui/cinematic.ts` timing, still tableaux drawn in
 * `src/adapters/guardian-scenes.ts`, narration typed out below the picture).
 * Before the fight: the sealed door, the guardian's gaze and its words, then
 * the guardian revealed with its name and epithet (a Touhou-style name card).
 * After it: its last words as it fades, and a hint of what lies deeper (never
 * named). The short versions are just the name card.
 */
export type GuardianScene = 'door' | 'gaze' | 'reveal' | 'fall' | 'below';
export type CinematicPhase = 'pre' | 'post';

/** Colours of a guardian's tableaux (its dungeon). */
export interface SceneTint {
  sky: string;
  ground: string;
  /** Rim light of the silhouettes and the seal. */
  rim: string;
  /** Drifting mist bands (the forest), or none. */
  mist: boolean;
}

export interface GuardianCinematic {
  species: SpeciesId;
  tint: SceneTint;
  pre: readonly CinematicPanel<GuardianScene>[];
  post: readonly CinematicPanel<GuardianScene>[];
  /** The 2-3 s versions: the name card only. */
  preShort: readonly CinematicPanel<GuardianScene>[];
  postShort: readonly CinematicPanel<GuardianScene>[];
}

const WIDE: Shot = { x: 0.5, y: 0.5, zoom: 1 };
const SLOW = { textStartMs: 1100, charsPerSecond: 24, lineGapMs: 600 } as const;
const CARD = { textStartMs: 250, charsPerSecond: 60, lineGapMs: 150 } as const;

function cinematic(species: SpeciesId, tint: SceneTint): GuardianCinematic {
  const key = (rest: string) => `guardian.${species}.${rest}`;
  const name = `species.${species}`;
  return {
    species,
    tint,
    pre: [
      { id: 'door', scene: 'door', durationMs: 5600, fadeInMs: 1400, fadeOutMs: 900, lines: [key('pre.1')], ...SLOW, camera: { from: { x: 0.5, y: 0.45, zoom: 1.08 }, to: { x: 0.5, y: 0.5, zoom: 1.18 } } },
      { id: 'gaze', scene: 'gaze', durationMs: 6200, fadeInMs: 900, fadeOutMs: 900, lines: [key('pre.2')], ...SLOW, camera: { from: WIDE, to: { x: 0.5, y: 0.55, zoom: 1.12 } } },
      { id: 'reveal', scene: 'reveal', durationMs: 4600, fadeInMs: 500, fadeOutMs: 700, lines: [name, key('title')], ...CARD, textStartMs: 1500, camera: { from: { x: 0.5, y: 0.52, zoom: 1.15 }, to: WIDE } },
    ],
    post: [
      { id: 'fall', scene: 'fall', durationMs: 6200, fadeInMs: 900, fadeOutMs: 1000, lines: [key('post.1')], ...SLOW, camera: { from: WIDE, to: { x: 0.5, y: 0.56, zoom: 1.12 } } },
      { id: 'below', scene: 'below', durationMs: 6800, fadeInMs: 1000, fadeOutMs: 1600, lines: [key('post.2')], ...SLOW, camera: { from: { x: 0.5, y: 0.4, zoom: 1.05 }, to: { x: 0.5, y: 0.62, zoom: 1.2 } } },
    ],
    preShort: [{ id: 'reveal-short', scene: 'reveal', durationMs: 2600, fadeInMs: 300, fadeOutMs: 500, lines: [name, key('title')], ...CARD, camera: { from: WIDE, to: WIDE } }],
    postShort: [{ id: 'fall-short', scene: 'fall', durationMs: 2600, fadeInMs: 300, fadeOutMs: 600, lines: [name, key('title')], ...CARD, camera: { from: WIDE, to: WIDE } }],
  };
}

export const GUARDIAN_CINEMATICS: Partial<Record<SpeciesId, GuardianCinematic>> = {
  aegislash: cinematic('aegislash', { sky: '#07050b', ground: '#140c16', rim: '#c8344c', mist: false }),
  decidueye: cinematic('decidueye', { sky: '#040906', ground: '#0b150e', rim: '#86d68f', mist: true }),
};
