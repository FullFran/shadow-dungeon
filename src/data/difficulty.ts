/**
 * Difficulty tiers (docs/gdd.md §9). The host picks one for the whole group.
 * `easy` is the balance the game shipped with; harder tiers add attacks and
 * longer combos on top of stat changes. Content gates extra patterns with
 * `minDifficulty` and reads the current tier through `atLeast`.
 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

export const DEFAULT_DIFFICULTY: Difficulty = 'easy';

export const difficultyRank = (d: Difficulty): number => DIFFICULTIES.indexOf(d);

/** True when `current` is `min` or harder. */
export const atLeast = (current: Difficulty, min: Difficulty): boolean => difficultyRank(current) >= difficultyRank(min);

export const isDifficulty = (value: unknown): value is Difficulty => DIFFICULTIES.some((d) => d === value);

/** The tier `delta` steps from `d`: clamped at both ends, or wrapping around (a confirm press cycles). */
export function stepDifficulty(d: Difficulty, delta: -1 | 1, wrap = false): Difficulty {
  const n = DIFFICULTIES.length;
  const i = difficultyRank(d) + delta;
  return DIFFICULTIES[wrap ? (i + n) % n : Math.min(n - 1, Math.max(0, i))]!;
}

/** A stored or received value as a tier: anything unknown (an older peer, a broken save) is the default. */
export const toDifficulty = (value: unknown): Difficulty => (isDifficulty(value) ? value : DEFAULT_DIFFICULTY);

/** What a tier changes (docs/gdd.md §9). `easy` is all ones and zeros: the game as it shipped. */
export interface TierDef {
  /** Enemy max HP at spawn. */
  hp: number;
  /** Damage of every enemy hit on a player (victim side: guests apply it too). */
  damage: number;
  /** Telegraph (wind-up) length; never below `TELEGRAPH_FLOOR` (see `scaledTelegraphMs`). */
  telegraph: number;
  /** Extra enemies per room of a generated floor (the room cap rises by the same). */
  extraPerRoom: number;
  /** Cooldowns between attacks last this share (aggression). */
  cooldown: number;
  /** Chance that an enemy of a generated floor is an elite (tinted, one extra trait). */
  eliteChance: number;
  /** Solo "Restart floor" uses per floor; null = unlimited. */
  restartsPerFloor: number | null;
  /** Whole-run Pokémonedas multiplier (it multiplies the per-minute line too). */
  coins: number;
  /**
   * Set-piece encounters (nests, locked-door wave rooms, ambushes, hunter
   * floors; data-driven events other content defines): `frequency` scales
   * their chance or weight, `extraWaves` adds waves to a wave room. Read
   * through core/difficulty.ts `encounterChance` and `encounterWaves`.
   */
  encounters: { frequency: number; extraWaves: number };
  /**
   * The player's roll (user feedback 2026-10-25: the roll made everything
   * trivial): `iframes` is the share of the i-frame window kept, `stamina`
   * the share of its stamina cost. Positional attacks (`pierceRoll`) ignore
   * the i-frames on every tier.
   */
  roll: { iframes: number; stamina: number };
  /** Co-op revive (core/revive.ts): `false` forbids it on this tier; absent = allowed. */
  coopRevive?: false;
}

export const TIERS: Readonly<Record<Difficulty, TierDef>> = {
  easy: { hp: 1, damage: 1, telegraph: 1, extraPerRoom: 0, cooldown: 1, eliteChance: 0, restartsPerFloor: null, coins: 1, encounters: { frequency: 1, extraWaves: 0 }, roll: { iframes: 1, stamina: 1 } },
  // No tier adds enemies (user feedback 2026-10-25: more enemies is not fun); tougher ones instead: elites, patterns, aggression.
  normal: { hp: 1.15, damage: 1.15, telegraph: 0.95, extraPerRoom: 0, cooldown: 0.9, eliteChance: 0.1, restartsPerFloor: null, coins: 1.3, encounters: { frequency: 1.2, extraWaves: 0 }, roll: { iframes: 1, stamina: 1 } },
  hard: { hp: 1.3, damage: 1.3, telegraph: 0.9, extraPerRoom: 0, cooldown: 0.8, eliteChance: 0.2, restartsPerFloor: 1, coins: 1.7, encounters: { frequency: 1.5, extraWaves: 0 }, roll: { iframes: 0.9, stamina: 1.1 } },
  nightmare: { hp: 1.45, damage: 1.5, telegraph: 0.85, extraPerRoom: 0, cooldown: 0.7, eliteChance: 0.3, restartsPerFloor: 0, coins: 2.2, encounters: { frequency: 2, extraWaves: 1 }, roll: { iframes: 0.8, stamina: 1.2 }, coopRevive: false },
};

/**
 * The readable floor of a telegraph (docs/souls-difficulty-research.md P5):
 * the tier never scales it under `share` of its base; and after every speed
 * modifier (tier, elite pace, enrage, a Sima pact's curse) it never lasts
 * under `minMs`, nor a positional (`pierceRoll`: a choice of where to walk)
 * one under `choiceMinMs` (unless the authored base already was: the floor
 * only undoes what modifiers cut, see core/difficulty.ts `effectiveTelegraphMs`).
 */
export const TELEGRAPH_FLOOR = { share: 0.75, minMs: 280, choiceMinMs: 400 } as const;

/** The floor of a positional (`pierceRoll`) wind-up (P5). */
export const CHOICE_TELEGRAPH_FLOOR_MS = TELEGRAPH_FLOOR.choiceMinMs;

/**
 * The one-hit cap (P5.6): no single enemy hit, after every multiplier (tier,
 * depth, party, pact), takes more than this share of the victim's max HP
 * (core/hits.ts, victim side). Environmental ticks (collapse, gas, fog) are
 * outside it: they are non-lethal by design.
 */
export const MAX_HIT_SHARE = 0.35;

/** A wind-up of `baseMs` at tier `d`: scaled, but never below the readable floor. */
export function scaledTelegraphMs(baseMs: number, d: Difficulty): number {
  const scale = TIERS[d].telegraph;
  if (scale === 1) return baseMs;
  return Math.max(baseMs * scale, baseMs * TELEGRAPH_FLOOR.share, Math.min(baseMs, TELEGRAPH_FLOOR.minMs));
}

/**
 * Elite traits (Enter the Gungeon's Jammed, softened): an elite is drawn
 * tinted in its trait's colour and has exactly one trait. One table for the
 * whole game: the tiers' elites on every dungeon and the Sima's depth elites
 * (data/sima.ts `SIMA_ELITES`) draw from it; a new trait is a row here (the
 * core reads only these fields).
 * - `tough`: more HP.
 * - `frenzied`: its cooldowns run out faster.
 * - `swift`: its whole AI clock runs faster (`pace`).
 * - `volley` (casters only): two more shots beside each one.
 * - `armored`: shrugs off the first hit.
 * - `enrage`: its AI clock runs faster once hurt below a share of its HP.
 */
export type EliteTrait = 'tough' | 'frenzied' | 'swift' | 'volley' | 'armored' | 'enrage';

export interface EliteTraitDef {
  /** Max HP share at spawn. */
  hp: number;
  /** Its cooldowns last this share (on top of the tier's). */
  cooldown: number;
  /** Its AI clock (moves, wind-ups, cooldowns) runs this much faster, always. */
  pace?: number;
  /** Its AI clock runs `pace` times faster once its HP is under `below` of its max. */
  enrage?: { below: number; pace: number };
  /** Two extra shots beside each one, this many degrees to each side. */
  volley?: { degrees: number };
  /** Only enemies of this behaviour kind may draw the trait (the others would never use it). */
  onlyKind?: 'caster';
  /** Spawns armored: the next hit is shrugged off (then the armor is gone). */
  armor?: true;
  /** Tint and aura colour (presentation). */
  tint: string;
  /** i18n key of the trait's name. */
  nameKey: string;
}

export const ELITE_TRAIT_DEFS: Readonly<Record<EliteTrait, EliteTraitDef>> = {
  tough: { hp: 1.5, cooldown: 1, tint: '#d9a441', nameKey: 'elite.tough' },
  frenzied: { hp: 1, cooldown: 0.65, tint: '#e0503c', nameKey: 'elite.frenzied' },
  swift: { hp: 1, cooldown: 1, pace: 1.3, tint: '#7fe3ff', nameKey: 'elite.swift' },
  volley: { hp: 1, cooldown: 1, volley: { degrees: 16 }, onlyKind: 'caster', tint: '#d68cff', nameKey: 'elite.volley' },
  armored: { hp: 1, cooldown: 1, armor: true, tint: '#c9d2e0', nameKey: 'elite.armored' },
  enrage: { hp: 1, cooldown: 1, enrage: { below: 0.4, pace: 1.5 }, tint: '#ff5a3a', nameKey: 'elite.enrage' },
};

/** Every trait, in table order (the wire accepts these). */
export const ALL_ELITE_TRAITS = Object.keys(ELITE_TRAIT_DEFS) as readonly EliteTrait[];

export const isEliteTrait = (value: unknown): value is EliteTrait => ALL_ELITE_TRAITS.some((t) => t === value);

/** The traits a tier's elite may draw on the regular dungeons, in draw order (the Sima draws from its own list). */
export const ELITE_TRAITS: readonly EliteTrait[] = ['tough', 'frenzied'];

/**
 * How a floor makes its elites (core/difficulty.ts `drawElite`): the chance
 * per floor enemy, the traits it may draw, an HP share for every elite on top
 * of its trait's, and the chance that an elite strikes positionally
 * (`pierceRoll`: its attacks ignore roll i-frames; 0 = never).
 */
export interface EliteRule {
  chance: number;
  traits: readonly EliteTrait[];
  hpScale: number;
  pierceRollChance: number;
}

