import type { Difficulty } from './difficulty';
import type { EnemyAttackDef, PoiseDef, SteerDef } from './enemies';
import type { SpeciesId } from './species';
import type { PokemonType } from './types';

/**
 * Heraldos del Eclipse (docs/gdd.md): the Sima's procedural bosses. A
 * herald is generated from a seed (core/herald/generate.ts) as a list of
 * Touhou-structured spell cards, each made of 1-3 layered pattern
 * primitives (below), every card proven fair before it may be played
 * (core/herald/fairness.ts). Bullet geometry follows the classic bullet-hell
 * families; every name is composed from our own word lists.
 */

export type HeraldShot = EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number; steer?: SteerDef };

/** `static`: the shape does not look at the player; `aimed`: it is turned towards where the player stood when the card's wind-up began. */
export type HeraldAim = 'static' | 'aimed';

interface LayerBase {
  /** Offset of the layer's first part inside the attack window (ms). */
  startMs: number;
}

/**
 * The pattern primitives (the grammar). Times are relative to the start of
 * the card's attack window; every part `k` fires at `startMs + k * everyMs`
 * (lasers add their warning). Each one leaves a way through by construction
 * and is checked by simulation anyway.
 */
export type HeraldLayer =
  /** Bursts of `perBurst` shots fanned over `spreadDeg`: at the wind-up's mark (`aimed`) or at where the player is at each burst (`tracking`). */
  | (LayerBase & { kind: 'stream'; aim: 'aimed' | 'tracking'; bursts: number; everyMs: number; perBurst: number; spreadDeg: number; shot: HeraldShot })
  /** Rings of `perRing` slots, `gap` of them empty around the gap centre (turned `gapTurnDeg` a ring). */
  | (LayerBase & { kind: 'ring'; aim: HeraldAim; rings: number; everyMs: number; perRing: number; gap: number; gapTurnDeg: number; offsetDeg: number; shot: HeraldShot })
  /** 1-4 arms turning `turnDeg` per emission; `mirror` adds the counter-turning arms. */
  | (LayerBase & { kind: 'spiral'; arms: number; emissions: number; everyMs: number; turnDeg: number; mirror: boolean; offsetDeg: number; shot: HeraldShot })
  /** Arms whose angle swings `amplitudeDeg` on a sine of `periodMs`; `mirror` adds the opposite swing. */
  | (LayerBase & { kind: 'wave'; aim: HeraldAim; arms: number; emissions: number; everyMs: number; amplitudeDeg: number; periodMs: number; mirror: boolean; offsetDeg: number; shot: HeraldShot })
  /** Walls from the far edge (`flip`: from the side), a shot every `spacing` px, a safe lane `gapWidth` wide at the mark, shifted `shiftPx` on odd waves. */
  | (LayerBase & { kind: 'lanes'; waves: number; everyMs: number; spacing: number; gapWidth: number; shiftPx: number; flip: boolean; shot: HeraldShot })
  /** A ring around the arena's centre closing inwards from `radius`, its `gap` empty slots facing the mark (turned `gapTurnDeg` a ring). */
  | (LayerBase & { kind: 'closing'; rings: number; everyMs: number; perRing: number; gap: number; radius: number; gapTurnDeg: number; shot: HeraldShot })
  /** Bursts of `count` shots at seeded angles inside a `coneDeg` cone (bounded randomness, the same on every peer). */
  | (LayerBase & { kind: 'scatter'; aim: HeraldAim; bursts: number; everyMs: number; count: number; coneDeg: number; salt: number; shot: HeraldShot })
  /** A few slow orbs that bend towards the nearest player (`shot.steer`). */
  | (LayerBase & { kind: 'homing'; orbs: number; everyMs: number; volleys: number; shot: HeraldShot })
  /** Laser lines as fast lanes: `lines` lines fanned over `fanDeg`, shown `warnMs` before they fire for `fireMs` (a shot every `beamEveryMs`), turned `turnDeg` a volley. */
  | (LayerBase & { kind: 'laser'; aim: HeraldAim; volleys: number; everyMs: number; lines: number; fanDeg: number; turnDeg: number; offsetDeg: number; warnMs: number; fireMs: number; beamEveryMs: number; shot: HeraldShot })
  /** The arena burns outside safe pockets (positional: a roll does not help) `warnMs` into the attack, for `flashMs`. */
  | (LayerBase & { kind: 'pockets'; pockets: readonly { x: number; y: number }[]; radius: number; warnMs: number; flashMs: number; attack: EnemyAttackDef })
  /** Calls `species` (one each) to its side once per card, while fewer are alive. */
  | (LayerBase & { kind: 'summon'; species: readonly SpeciesId[] });

export type HeraldLayerKind = HeraldLayer['kind'];

/** Text in both languages (generated, never i18n keys). */
export interface Bilingual {
  es: string;
  en: string;
}

export interface HeraldCard {
  /** Its stance: `herald<i>` (phase 2 variant: `herald<i>x`). */
  id: string;
  /** «Signo X «Nombre»». */
  name: Bilingual;
  /** Wind-up before each cycle's attack (base; the tier scales it, never below the floor). */
  telegraphMs: number;
  attackMs: number;
  /** The opening after the attack: at least until the cycle's shots are gone. */
  recoverMs: number;
  /** Moving between cycles. */
  restMs: number;
  /** The card's timer: when it runs out the card ends with no capture. */
  timerMs: number;
  layers: readonly HeraldLayer[];
  /** Knob multipliers (fairness: never both above x1.3, product capped). */
  density: number;
  speed: number;
}

export type HeraldMove = 'static' | 'drift' | 'teleport' | 'dash';
export type HeraldPhase2Rule = 'haste' | 'mirror' | 'layer' | 'blink';
export type HeraldArrival = 'descend' | 'emerge' | 'teleport';

/** A generated herald: everything a peer needs, regenerated from (seed, depth, tier). */
export interface HeraldDef {
  seed: number;
  depth: number;
  tier: Difficulty;
  /** A SPRITE_KEYS name (data/sprites.ts) and the species whose types it takes. */
  sprite: string;
  source: SpeciesId;
  types: readonly PokemonType[];
  /** Its own name (original syllables), its epithet and a one-line epigraph. */
  name: string;
  epithet: Bilingual;
  epigraph: Bilingual;
  theme: { type: PokemonType; colour: string; glow: string };
  move: HeraldMove;
  arrival: HeraldArrival;
  /** Where it attacks from (arena pixels): one for static, two for drift, three or four for teleport and dash. */
  anchors: readonly { x: number; y: number }[];
  moveSpeed: number;
  /** HP multiplier over the base herald's. */
  hpScale: number;
  cards: readonly HeraldCard[];
  /** From card `fromCard` on it plays `cards` (same count as `cards`; the earlier ones are unused) under `rule`. */
  phase2: { rule: HeraldPhase2Rule; fromCard: number; transformMs: number; cards: readonly HeraldCard[]; move: HeraldMove };
  maxShots: number;
}

/**
 * The one technical species every herald fights as (`sima-herald`): the
 * enemy table's entry, shared by all; the generated def rides beside it
 * (`EnemyState.herald`).
 */
export interface HeraldBaseDef {
  kind: 'herald';
  poise: PoiseDef;
  bar: true;
  floats: true;
  aggroRange: number;
}

export const HERALD_BASE: HeraldBaseDef = {
  kind: 'herald',
  poise: { hitstunScale: 0, knockbackScale: 0 },
  bar: true,
  floats: true,
  aggroRange: 900,
};

/** The arena heralds fight in (data/rooms.ts `abyss`), for the fairness checks. */
export const HERALD_ARENA = { width: 640, height: 400 } as const;

/** Hard fairness constraints (docs/souls-difficulty-research.md P4, P5). */
export const HERALD_FAIRNESS = {
  /** Wind-up floors after the tier's scaling: cards that ask for a choice (a direction, a gap, a pocket) and the rest. */
  choiceTelegraphMs: 400,
  plainTelegraphMs: 280,
  /** Laser warning lines (a choice). */
  laserWarnMs: 400,
  /** Threats aimed at a player at once (aimed or tracking layers, homing orbs, summons). */
  maxAimed: 2,
  /** Density and speed may not both pass this, and their product stays under `maxProduct`. */
  knobLimit: 1.3,
  maxProduct: 1.95,
  /** Homing orbs: at most this share of the player's speed, this many a volley. */
  homingSpeedShare: 0.6,
  maxOrbs: 3,
  /** Layers per card. */
  maxLayers: 3,
} as const;
