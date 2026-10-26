import type { DotKind, MoveId, ZoneDef } from './moves';

/**
 * The tutor's ranks (odd/tasks/move-progression.md T2): every move can be
 * ranked up twice (+1, +2); besides +10 % damage per rank (and a shorter
 * cooldown on boosts), each rank adds one designed effect, from a small set
 * of generic kinds (core/rank-effects.ts applies them to the move). Inspired
 * by the "move evolutions" of PokeSurvivor (ideas only, no code or data).
 */
export type RankEffect =
  /** Extra crit chance. */
  | { kind: 'crit'; bonus: number }
  /** A bigger hitbox: arc range, dash and projectile radius. */
  | { kind: 'size'; multiplier: number }
  /** A chance to burn or poison. */
  | { kind: 'dot'; dot: DotKind; chance: number }
  /** A mark that bursts later for a share of the hit. */
  | { kind: 'mark'; share: number; delayMs: number }
  /** The shot splits on impact. */
  | { kind: 'split'; count: number; share: number }
  /** The target deals less damage for a while. */
  | { kind: 'weaken'; factor: number; durationMs: number }
  /** A lingering zone. */
  | ({ kind: 'zone' } & ZoneDef)
  /** More hits for a multi-hit move. */
  | { kind: 'hits'; add: number }
  /** A boomerang thrown out again. */
  | { kind: 'return'; times: number; share: number }
  /** The hit jumps to another enemy. */
  | { kind: 'chain'; share: number; range: number }
  /** Brief super-armor (less damage taken) from the move's start. */
  | { kind: 'ward'; damageTaken: number; durationMs: number }
  /** I-frames during the active phase. */
  | { kind: 'iframes' }
  /** A stronger boost buff (added to its fields). */
  | { kind: 'buff'; hits?: number; durationMs?: number; multiplier?: number; speed?: number; critChance?: number; damageTaken?: number }
  /** More drain. */
  | { kind: 'drain'; share: number }
  /** Longer stagger and knockback. */
  | { kind: 'stagger'; multiplier: number }
  /** The shot bends towards the nearest enemy. */
  | { kind: 'homing'; degPerSec: number }
  /** Heals a share of max HP as the move takes hold. */
  | { kind: 'heal'; share: number };

export type RankEffectKind = RankEffect['kind'];

/**
 * The least share of a hit the player's own defences let through together: a
 * guard buff (Bulk Up, Iron Defense...) and a ranked move's super-armor
 * multiply, but never below this (odd/tasks/degenerate-builds.md B2).
 */
export const DAMAGE_TAKEN_FLOOR = 0.5;

const crit = (bonus: number): RankEffect => ({ kind: 'crit', bonus });
const size = (multiplier: number): RankEffect => ({ kind: 'size', multiplier });
const dot = (kind: DotKind, chance: number): RankEffect => ({ kind: 'dot', dot: kind, chance });
const mark = (share: number, delayMs: number): RankEffect => ({ kind: 'mark', share, delayMs });
const split = (count: number, share: number): RankEffect => ({ kind: 'split', count, share });
const weaken = (factor: number, durationMs: number): RankEffect => ({ kind: 'weaken', factor, durationMs });
const zone = (z: ZoneDef): RankEffect => ({ kind: 'zone', ...z });
const hits = (add: number): RankEffect => ({ kind: 'hits', add });
const back = (times: number, share: number): RankEffect => ({ kind: 'return', times, share });
const chain = (share: number, range: number): RankEffect => ({ kind: 'chain', share, range });
const ward = (damageTaken: number, durationMs: number): RankEffect => ({ kind: 'ward', damageTaken, durationMs });
const IFRAMES: RankEffect = { kind: 'iframes' };
const buff = (more: Omit<Extract<RankEffect, { kind: 'buff' }>, 'kind'>): RankEffect => ({ kind: 'buff', ...more });
const drain = (share: number): RankEffect => ({ kind: 'drain', share });
const stagger = (multiplier: number): RankEffect => ({ kind: 'stagger', multiplier });
const homing = (degPerSec: number): RankEffect => ({ kind: 'homing', degPerSec });
const heal = (share: number): RankEffect => ({ kind: 'heal', share });

/** An aftershock: a ring around the player, once, a moment after the move. */
const aftershock = (power: number, radius: number, delayMs: number): RankEffect => zone({ at: 'self', power, radius, lifetimeMs: 200, delayMs });

/** Rank +1 and rank +2 of every move. */
export const RANK_EFFECTS: Readonly<Record<MoveId, readonly [RankEffect, RankEffect]>> = {
  // --- Original kits (Básico) ---
  // Mimikyu
  'shadow-claw': [crit(0.15), mark(0.35, 1200)],
  'shadow-sneak': [size(1.25), IFRAMES],
  'play-rough': [stagger(1.3), weaken(0.7, 4000)],
  'shadow-ball': [size(1.35), split(3, 0.35)],
  'swords-dance': [buff({ hits: 1 }), ward(0.6, 3000)],
  'dazzling-gleam': [size(1.2), weaken(0.75, 3000)],
  'shadow-force': [IFRAMES, mark(0.3, 900)],
  // Zorua
  'fury-swipes': [crit(0.1), hits(1)],
  'feint-attack': [crit(0.2), mark(0.35, 900)],
  'night-daze': [size(1.2), weaken(0.75, 3000)],
  'foul-play': [stagger(1.3), drain(0.25)],
  'nasty-plot': [buff({ durationMs: 1000 }), buff({ critChance: 0.1 })],
  'dark-pulse': [stagger(1.5), mark(0.25, 800)],
  snarl: [size(1.2), weaken(0.7, 4000)],
  // Litwick
  ember: [dot('burn', 0.4), zone({ at: 'impact', power: 7, radius: 22, lifetimeMs: 1800, every: 600, delayMs: 150, dot: 'burn' })],
  astonish: [stagger(1.4), weaken(0.75, 2500)],
  hex: [homing(120), mark(0.4, 1000)],
  inferno: [dot('burn', 1), zone({ at: 'impact', power: 8, radius: 30, lifetimeMs: 2400, every: 800, delayMs: 150, dot: 'burn' })],
  'will-o-wisp': [ward(0.75, 2500), aftershockBurn()],
  flamethrower: [dot('burn', 0.3), zone({ at: 'line', power: 8, radius: 14, lifetimeMs: 2000, every: 500, dot: 'burn' })],
  'heat-wave': [size(1.15), dot('burn', 0.5)],
  // Cubone
  'bone-club': [stagger(1.3), crit(0.25)],
  'bone-rush': [size(1.2), hits(1)],
  bonemerang: [size(1.25), back(1, 0.5)],
  'stomping-tantrum': [size(1.15), aftershock(40, 60, 500)],
  'bulk-up': [buff({ damageTaken: -0.1 }), heal(0.1)],
  earthquake: [stagger(1.25), aftershock(50, 100, 600)],
  bulldoze: [size(1.15), weaken(0.8, 3000)],
  // --- Tutor: Mimikyu ---
  slash: [crit(0.1), stagger(1.3)],
  'x-scissor': [crit(0.15), mark(0.3, 800)],
  'leech-life': [drain(0.1), weaken(0.85, 3000)],
  'draining-kiss': [drain(0.15), weaken(0.7, 3000)],
  'night-slash': [crit(0.1), mark(0.3, 1000)],
  'wood-hammer': [stagger(1.3), ward(0.7, 2000)],
  'drain-punch': [drain(0.15), ward(0.75, 2500)],
  'giga-drain': [homing(90), drain(0.2)],
  thunderbolt: [stagger(1.4), chain(0.5, 90)],
  'take-down': [size(1.2), IFRAMES],
  'hone-claws': [buff({ durationMs: 1000 }), buff({ critChance: 0.1 })],
  curse: [buff({ hits: 1 }), ward(0.7, 3000)],
  'phantom-force': [size(1.2), IFRAMES],
  'burning-jealousy': [size(1.15), weaken(0.75, 3000)],
  thunder: [stagger(1.3), chain(0.5, 120)],
  // --- Tutor: Zorua ---
  'sucker-punch': [IFRAMES, crit(0.3)],
  'u-turn': [IFRAMES, mark(0.25, 700)],
  'lash-out': [stagger(1.3), drain(0.2)],
  swift: [size(1.3), split(2, 0.4)],
  'knock-off': [stagger(1.3), weaken(0.75, 4000)],
  'sludge-bomb': [size(1.25), zone({ at: 'impact', power: 5, radius: 24, lifetimeMs: 2400, every: 800, delayMs: 150, dot: 'poison' })],
  'grass-knot': [stagger(1.4), weaken(0.8, 3000)],
  extrasensory: [stagger(1.3), homing(120)],
  'calm-mind': [buff({ durationMs: 2000 }), buff({ damageTaken: -0.1 })],
  agility: [buff({ durationMs: 1500 }), buff({ critChance: 0.15 })],
  'hyper-voice': [size(1.15), weaken(0.75, 3000)],
  // --- Tutor: Litwick ---
  smog: [size(1.3), zone({ at: 'impact', power: 8, radius: 20, lifetimeMs: 1600, every: 800, delayMs: 150, dot: 'poison' })],
  'night-shade': [homing(90), mark(0.3, 1000)],
  'flame-charge': [ward(0.8, 2000), IFRAMES],
  'clear-smog': [size(1.2), weaken(0.8, 3000)],
  'fire-blast': [size(1.2), split(4, 0.3)],
  'energy-ball': [size(1.2), split(3, 0.3)],
  overheat: [size(1.2), ward(0.7, 2500)],
  'flare-blitz': [ward(0.75, 2000), IFRAMES],
  poltergeist: [stagger(1.3), mark(0.3, 1200)],
  'solar-beam': [size(1.2), zone({ at: 'line', power: 12, radius: 12, lifetimeMs: 1800, every: 600 })],
  psychic: [homing(90), weaken(0.8, 3000)],
  'temper-flare': [size(1.15), zone({ at: 'self', power: 20, radius: 42, lifetimeMs: 1800, every: 600, delayMs: 100, dot: 'burn' })],
  'acid-armor': [buff({ durationMs: 1500 }), heal(0.08)],
  minimize: [buff({ speed: 0.1 }), ward(0.7, 2000)],
  'fire-spin': [size(1.2), weaken(0.8, 3000)],
  // --- Tutor: Cubone ---
  'mud-slap': [stagger(1.3), weaken(0.7, 3000)],
  headbutt: [stagger(1.3), ward(0.8, 1500)],
  'double-kick': [crit(0.1), hits(1)],
  'low-kick': [stagger(1.4), weaken(0.8, 2500)],
  'fire-punch': [crit(0.1), zone({ at: 'impact', power: 10, radius: 18, lifetimeMs: 1500, every: 500, delayMs: 150, dot: 'burn' })],
  'thunder-punch': [stagger(1.3), chain(0.5, 80)],
  'double-edge': [stagger(1.2), ward(0.7, 2000)],
  'iron-head': [stagger(1.3), IFRAMES],
  'earth-power': [size(1.2), zone({ at: 'line', power: 12, radius: 12, lifetimeMs: 1500, every: 500 })],
  dig: [IFRAMES, aftershock(30, 56, 300)],
  'brick-break': [crit(0.15), weaken(0.75, 3000)],
  'focus-punch': [ward(0.7, 1500), stagger(1.4)],
  'scorching-sands': [size(1.2), zone({ at: 'impact', power: 8, radius: 22, lifetimeMs: 1800, every: 600, delayMs: 150, dot: 'burn' })],
  'focus-energy': [buff({ durationMs: 1000 }), buff({ critChance: 0.1 })],
  'belly-drum': [buff({ hits: 1 }), heal(0.15)],
  'iron-defense': [buff({ durationMs: 1500 }), heal(0.08)],
  'rock-slide': [stagger(1.3), zone({ at: 'impact', power: 15, radius: 20, lifetimeMs: 200, delayMs: 400 })],
  'ice-beam': [size(1.15), weaken(0.75, 3000)],
  // --- The gacha lines' own moves (data/line-moves.ts) ---
  'water-gun': [size(1.3), split(2, 0.4)],
  'bubble-beam': [size(1.2), weaken(0.8, 3000)],
  surf: [size(1.15), weaken(0.75, 3000)],
  spark: [stagger(1.3), chain(0.5, 80)],
  'dragon-claw': [crit(0.15), mark(0.3, 800)],
  'dragon-pulse': [size(1.2), split(3, 0.3)],
};

/** Will-O-Wisp +2: the wisps circle the user and burn what they touch for a while. */
function aftershockBurn(): RankEffect {
  return zone({ at: 'self', power: 12, radius: 40, lifetimeMs: 2400, every: 600, delayMs: 0, dot: 'burn' });
}
