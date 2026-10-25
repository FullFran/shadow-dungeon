import { scaledTelegraphMs, type Difficulty } from '../../data/difficulty';
import {
  HERALD_ANIMS,
  HERALD_ARENA,
  HERALD_FAIRNESS,
  HERALD_MINIONS,
  HERALD_RADIUS,
  HERALD_SPECIES,
  type HeraldArrival,
  type HeraldCard,
  type HeraldDef,
  type HeraldLayer,
  type HeraldLayerKind,
  type HeraldMove,
  type HeraldPhase2Rule,
  type HeraldShot,
} from '../../data/herald';
import { TYPE_COLOURS } from '../../data/herald-words';
import { SPECIES } from '../../data/species';
import { SPRITE_KEYS, SPRITES } from '../../data/sprites';
import type { PokemonType } from '../../data/types';
import { vec, type Vec2 } from '../vec';
import { checkCard, type FairnessEnv } from './fairness';
import { cardName, heraldWords } from './names';
import { asksChoice, cardAttackMs } from './patterns';
import { Rand } from './rand';

/**
 * The heralds' generator (docs/gdd.md "Heraldos del Eclipse"): from a seed,
 * a depth and a tier, a whole boss, deterministic (every peer of a shared
 * run regenerates the same one from the run seed). Touhou-like structure:
 * 3-5 cards (more with depth, one more on nightmare), each 1-3 compatible
 * layers of the pattern grammar (core/herald/patterns.ts), its own HP
 * segment and timer (core/cards.ts), a movement style, a phase-2 rule from
 * the middle card on, and names composed from our own word lists. Every
 * card goes through the fairness proof (core/herald/fairness.ts): a card
 * that fails is thrown away and drawn again (rejection sampling); if a slot
 * keeps failing, a plain fallback card is used, itself checked.
 */

/** The sheets a herald may wear: the curated list, kept only when every animation it plays is there without a fallback. */
export function heraldPool(): readonly { sprite: string; source: (typeof HERALD_SPECIES)[number]['source'] }[] {
  return HERALD_SPECIES.filter(({ sprite }) => {
    const key = (SPRITE_KEYS as Record<string, string>)[sprite];
    const meta = key ? SPRITES.sprites[key] : undefined;
    return meta !== undefined && HERALD_ANIMS.every((a) => meta.anims[a]?.source === a);
  });
}

/** Density and speed knobs by tier (docs/souls-difficulty-research.md P4 table), before depth. */
const TIER_KNOBS: Readonly<Record<Difficulty, { density: number; speed: number; extraCards: number }>> = {
  easy: { density: 0.85, speed: 0.92, extraCards: 0 },
  normal: { density: 1, speed: 1, extraCards: 0 },
  hard: { density: 1.15, speed: 1.08, extraCards: 0 },
  nightmare: { density: 1.3, speed: 1.12, extraCards: 1 },
};

/** HP multiplier of a herald with `count` cards (each card is a segment of the bar). */
export const heraldHpScale = (count: number): number => 0.8 + 0.12 * count;

/** Cards by depth: 3 until floor 40, 4 until 70, then 5 (nightmare one more), at most 5. */
export const heraldCardCount = (depth: number, tier: Difficulty): number => Math.min(5, (depth < 40 ? 3 : depth < 70 ? 4 : 5) + TIER_KNOBS[tier].extraCards);

/** The arena's cells the herald may attack from (upper band, clear of the pillars). */
const ANCHOR_SLOTS: readonly Vec2[] = [vec(320, 100), vec(190, 110), vec(450, 110), vec(120, 130), vec(520, 130), vec(260, 140), vec(380, 140)];

export function originsOf(def: Pick<HeraldDef, 'anchors'>, move: HeraldMove): Vec2[] {
  const all = def.anchors.map((a) => vec(a.x, a.y));
  return move === 'static' ? all.slice(0, 1) : move === 'drift' ? all.slice(0, 2) : all;
}

interface GenContext {
  depth: number;
  tier: Difficulty;
  type: PokemonType;
  density: number;
  speed: number;
  power: number;
  maxShots: number;
  origins: Vec2[];
  stats: GenStats;
}

/** How many drawn cards passed and how many the fairness proof threw away (tests, the dev route). */
export interface GenStats {
  checked: number;
  rejected: number;
}

const R = Math.round;

function shot(g: GenContext, speed: number, radius: number, s: number, extra: Partial<HeraldShot> = {}): HeraldShot {
  return { power: g.power, type: g.type, speed: R(speed * s), radius, lifetimeMs: 7000, ...extra };
}

/** Which primitives a card's first layer may be (deeper floors open more). */
function primaryWeights(depth: number): (readonly [HeraldLayerKind, number])[] {
  const deep = depth >= 35;
  return [
    ['ring', 3],
    ['spiral', 3],
    ['wave', 2],
    ['stream', 2],
    ['scatter', 2],
    ['lanes', 2],
    ['closing', 1.5],
    ['laser', 1.5],
    ['pockets', 1],
    ['homing', deep ? 1 : 0.5],
  ];
}

/** Primitives that may join a card as a lighter extra layer. */
const SECONDARY: readonly (readonly [HeraldLayerKind, number])[] = [
  ['spiral', 3],
  ['ring', 2],
  ['wave', 2],
  ['scatter', 1.5],
  ['stream', 1.5],
  ['homing', 1],
  ['summon', 0.7],
];

const FIELD = new Set<HeraldLayerKind>(['lanes', 'closing', 'pockets']);

/** One layer of `kind` at density `d` (already lightened for extra layers) and speed `s`. */
function makeLayer(rand: Rand, kind: HeraldLayerKind, g: GenContext, d: number, s: number, startMs: number): HeraldLayer {
  const turn = () => (rand.chance(0.5) ? 1 : -1);
  switch (kind) {
    case 'ring': {
      const perRing = Math.max(10, R(rand.range(16, 22) * d));
      return { kind, startMs, aim: rand.chance(0.6) ? 'aimed' : 'static', rings: rand.int(3, 5), everyMs: R(rand.range(750, 950)), perRing, gap: Math.max(3, Math.ceil(perRing * 0.17)), gapTurnDeg: turn() * R(rand.range(15, 35)), offsetDeg: R(rand.range(0, 360)), shot: shot(g, 90, 6, s) };
    }
    case 'spiral': {
      const arms = rand.int(1, 4);
      return { kind, startMs, arms, emissions: R(rand.range(18, 26) * d * (arms >= 3 ? 0.8 : 1)), everyMs: R(rand.range(115, 150)), turnDeg: turn() * R(rand.range(9, 15)), mirror: arms <= 2 && rand.chance(0.35), offsetDeg: R(rand.range(0, 360)), shot: shot(g, 95, 5, s) };
    }
    case 'wave':
      return { kind, startMs, aim: rand.chance(0.5) ? 'aimed' : 'static', arms: rand.int(2, 4), emissions: R(rand.range(16, 22) * d), everyMs: R(rand.range(120, 160)), amplitudeDeg: R(rand.range(18, 40)), periodMs: R(rand.range(1000, 1800)), mirror: rand.chance(0.3), offsetDeg: R(rand.range(0, 360)), shot: shot(g, 90, 5, s) };
    case 'stream':
      return g.depth >= 30 && rand.chance(0.4)
        ? { kind, startMs, aim: 'tracking', bursts: rand.int(4, 6), everyMs: R(rand.range(450, 600)), perBurst: rand.int(1, 3), spreadDeg: R(rand.range(6, 12)), shot: shot(g, 115, 5, s) }
        : { kind, startMs, aim: 'aimed', bursts: rand.int(4, 6), everyMs: R(rand.range(450, 650)), perBurst: Math.max(3, R(rand.range(3, 5) * d)), spreadDeg: R(rand.range(24, 40)), shot: shot(g, 130, 5, s) };
    case 'lanes':
      return { kind, startMs, waves: rand.int(3, 4), everyMs: R(rand.range(1000, 1200)), spacing: R(rand.range(26, 32) / Math.sqrt(d)), gapWidth: R(rand.range(96, 112)), shiftPx: R(rand.range(80, 120)), flip: rand.chance(0.35), shot: shot(g, 95, 7, s) };
    case 'closing': {
      const perRing = R(rand.range(24, 28) * d);
      return { kind, startMs, rings: rand.int(2, 3), everyMs: R(rand.range(1300, 1600)), perRing, gap: Math.max(5, Math.ceil(perRing * 0.2)), radius: 185, gapTurnDeg: R(rand.range(0, 20)), shot: shot(g, 80, 6, s) };
    }
    case 'scatter': {
      const aimed = rand.chance(0.55);
      return { kind, startMs, aim: aimed ? 'aimed' : 'static', bursts: rand.int(4, 6), everyMs: R(rand.range(420, 560)), count: Math.max(5, R(rand.range(7, 10) * d)), coneDeg: aimed ? R(rand.range(60, 110)) : 360, salt: rand.int(1, 1 << 30), shot: shot(g, 105, 5, s) };
    }
    case 'homing':
      return { kind, startMs, orbs: rand.int(2, 3), everyMs: 1600, volleys: 2, shot: shot(g, rand.range(60, 76) / s, 8, 1, { lifetimeMs: 5000, steer: { degPerSec: R(rand.range(50, 80)), ms: 2500 } }) };
    case 'laser': {
      const aimed = rand.chance(0.5);
      const lines = aimed ? rand.int(2, 3) : rand.int(3, 4);
      return {
        kind,
        startMs,
        aim: aimed ? 'aimed' : 'static',
        volleys: rand.int(2, 3),
        everyMs: R(rand.range(1300, 1600)),
        lines,
        fanDeg: aimed ? R(rand.range(50, 80)) : R((360 * (lines - 1)) / lines),
        turnDeg: turn() * R(rand.range(25, 40)),
        offsetDeg: aimed ? (rand.chance(0.5) ? 25 : -25) : R(rand.range(0, 360)),
        warnMs: R(rand.range(650, 800)),
        fireMs: 250,
        beamEveryMs: 50,
        shot: shot(g, 460, 5, 1, { lifetimeMs: 1600 }),
      };
    }
    case 'pockets':
      return { kind, startMs, pockets: pocketSpots(rand), radius: R(rand.range(50, 58)), warnMs: R(rand.range(1500, 1900)), flashMs: 320, attack: { power: R(g.power * 1.8), type: g.type, pierceRoll: true } };
    case 'summon':
      return { kind, startMs, species: rand.chance(0.5) ? [rand.pick(HERALD_MINIONS)] : [rand.pick(HERALD_MINIONS), rand.pick(HERALD_MINIONS)] };
  }
}

/** Three safe pockets spread over the lower arena, clear of the pillars. */
function pocketSpots(rand: Rand): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let tries = 0; out.length < 3 && tries < 200; tries++) {
    const p = { x: R(rand.range(90, 550)), y: R(rand.range(200, 350)) };
    const clear = HERALD_ARENA.obstacles.every((o) => p.x < o.x - 20 || p.x > o.x + o.width + 20 || p.y < o.y - 20 || p.y > o.y + o.height + 20);
    if (clear && out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 170)) out.push(p);
  }
  return out.length === 3 ? out : [{ x: 120, y: 300 }, { x: 320, y: 220 }, { x: 520, y: 300 }];
}

/** The card's layers: a primary, then up to two lighter compatible extras. */
function makeLayers(rand: Rand, g: GenContext, index: number, count: number): HeraldLayer[] {
  const maxLayers = Math.min(HERALD_FAIRNESS.maxLayers, 1 + (g.depth >= 30 ? 1 : 0) + (index >= 2 && g.depth >= 45 ? 1 : 0) + (index === count - 1 && g.depth >= 30 ? 1 : 0));
  const n = rand.int(Math.min(2, maxLayers), maxLayers);
  const primary = rand.weighted(primaryWeights(g.depth));
  const layers = [makeLayer(rand, primary, g, g.density, g.speed, 0)];
  for (let i = 1; i < n; i++) {
    const kinds = SECONDARY.filter(([k]) => {
      if (layers.some((l) => l.kind === k)) return false;
      // A field (lanes, closing ring, pockets) takes only a light static companion.
      if (FIELD.has(primary) && (k === 'stream' || k === 'homing' || k === 'summon')) return false;
      if (k === 'summon' && g.depth < 30) return false;
      return true;
    });
    if (kinds.length === 0) break;
    const kind = rand.weighted(kinds);
    // Extra layers are lighter: each takes a share of the density.
    const layer = makeLayer(rand, kind, g, g.density * 0.62, g.speed * 0.95, R(rand.range(150, 700)));
    layers.push(FIELD.has(primary) && (layer.kind === 'ring' || layer.kind === 'wave' || layer.kind === 'scatter') && layer.aim === 'aimed' ? { ...layer, aim: 'static' as const } : layer);
  }
  return layers;
}

function telegraphFor(rand: Rand, layers: readonly HeraldLayer[], tier: Difficulty): number {
  const choice = layers.some(asksChoice);
  const floor = choice ? HERALD_FAIRNESS.choiceTelegraphMs : HERALD_FAIRNESS.plainTelegraphMs;
  let t = R(choice ? rand.range(780, 980) : rand.range(560, 760));
  while (scaledTelegraphMs(t, tier) < floor + 40) t += 50;
  return t;
}

const envOf = (g: GenContext, origins: Vec2[] = g.origins): FairnessEnv => ({ arena: HERALD_ARENA, origins, bossRadius: HERALD_RADIUS, tier: g.tier, maxShots: g.maxShots });

/** Timing around a checked card: the opening lasts until its shots are gone; the timer covers about five cycles. */
function timed(card: Omit<HeraldCard, 'recoverMs' | 'timerMs'>, clearMs: number, rand: Rand, tier: Difficulty): HeraldCard {
  const recoverMs = Math.max(R(rand.range(900, 1300)), R(clearMs - card.attackMs + 150));
  const cycle = scaledTelegraphMs(card.telegraphMs, tier) + card.attackMs + recoverMs + card.restMs;
  const timerMs = Math.min(48_000, Math.max(22_000, Math.round((cycle * 5) / 1000) * 1000));
  return { ...card, recoverMs, timerMs };
}

/** A plain, sparse spiral: the last resort for a slot (checked like any card). */
function fallbackLayers(g: GenContext): HeraldLayer[] {
  return [{ kind: 'spiral', startMs: 0, arms: 2, emissions: 16, everyMs: 150, turnDeg: 13, mirror: false, offsetDeg: 0, shot: shot(g, 90, 5, 1) }];
}

/** Draws cards until one passes the fairness proof (at most `tries`), else the fallback. */
function fairCard(rand: Rand, g: GenContext, id: string, index: number, count: number, restMs: number, build: () => HeraldLayer[], origins = g.origins, tries = 14): HeraldCard {
  for (let attempt = 0; attempt <= tries; attempt++) {
    const layers = attempt < tries ? build() : fallbackLayers(g);
    const card = { id, name: cardName(rand, g.type, layers[0]!.kind), telegraphMs: telegraphFor(rand, layers, g.tier), attackMs: cardAttackMs({ layers }), restMs, layers, density: g.density, speed: g.speed };
    const report = checkCard(card, envOf(g, origins));
    if (report.ok) {
      g.stats.checked++;
      return timed(card, report.clearMs, rand, g.tier);
    }
    g.stats.rejected++;
  }
  // Unreachable in practice (the fallback passes everywhere); a card with no layer would be worse than a sparse one.
  throw new Error(`herald card ${id}: no fair card found`);
}

/** The phase-2 version of a card under `rule` (checked; a failing variant falls back to the haste version, which plays the same shots). */
function variant(rand: Rand, g: GenContext, card: HeraldCard, rule: HeraldPhase2Rule, origins: Vec2[]): { card: HeraldCard; ok: boolean } {
  const id = `${card.id}x`;
  const haste = { card: { ...card, id, restMs: R(card.restMs * 0.55) }, ok: rule === 'haste' };
  let layers: HeraldLayer[] | null = null;
  if (rule === 'mirror') {
    const mirrored = card.layers.map((l) => (l.kind === 'spiral' || l.kind === 'wave' ? { ...l, mirror: true } : l));
    if (mirrored.some((l, i) => l !== card.layers[i])) layers = mirrored;
  }
  if (rule === 'layer' && card.layers.length < HERALD_FAIRNESS.maxLayers && !card.layers.some((l) => l.kind === 'spiral')) {
    layers = [...card.layers, makeLayer(rand, 'spiral', g, g.density * 0.5, g.speed * 0.95, 300)];
  }
  if (rule === 'blink') layers = [...card.layers];
  if (!layers) return { ...haste, ok: true };
  const next = { ...card, id, name: cardName(rand, g.type, layers[0]!.kind), layers, telegraphMs: telegraphFor(rand, layers, g.tier), attackMs: cardAttackMs({ layers }), restMs: R(card.restMs * 0.8) };
  const report = checkCard(next, envOf(g, origins));
  if (report.ok) g.stats.checked++;
  else g.stats.rejected++;
  return report.ok ? { card: timed(next, report.clearMs, rand, g.tier), ok: true } : haste;
}

const MOVES: readonly (readonly [HeraldMove, number])[] = [
  ['static', 1],
  ['drift', 2],
  ['teleport', 2],
  ['dash', 1.5],
];

const ARRIVAL: Readonly<Record<HeraldMove, HeraldArrival>> = { static: 'emerge', drift: 'descend', teleport: 'teleport', dash: 'emerge' };

const WEAR_SALT = 0x4e1a1d;

/** The sheet a herald wears: the generator's first draw, so the renderer gets it without generating the boss. */
export function heraldWear(seed: number): { sprite: string; source: (typeof HERALD_SPECIES)[number]['source'] } {
  const pool = heraldPool();
  return new Rand(seed, WEAR_SALT).pick(pool.length > 0 ? pool : [{ sprite: 'gastly', source: 'gastly' as const }]);
}

/** Generates a herald (pure and deterministic). */
export function generateBoss(seed: number, depth: number, tier: Difficulty, stats: GenStats = { checked: 0, rejected: 0 }): HeraldDef {
  const rand = new Rand(seed, WEAR_SALT);
  const pool = heraldPool();
  const wear = rand.pick(pool.length > 0 ? pool : [{ sprite: 'gastly', source: 'gastly' as const }]);
  const types = SPECIES[wear.source].types;
  const type = rand.pick(types);
  const words = heraldWords(rand);
  const move = rand.weighted(MOVES);
  // Three or four anchors: the first is its home (static), the first two its drift.
  const slots = [...ANCHOR_SLOTS];
  const anchors: Vec2[] = [];
  const wanted = rand.int(3, 4);
  while (anchors.length < wanted && slots.length > 0) anchors.push(slots.splice(rand.int(0, slots.length - 1), 1)[0]!);
  if (move === 'drift') anchors.sort((a, b) => a.x - b.x);
  const knobs = TIER_KNOBS[tier];
  const deep = Math.min(0.2, Math.max(0, depth - 20) * 0.004);
  const g: GenContext = {
    depth,
    tier,
    type,
    density: Math.min(1.55, knobs.density * (1 + deep)),
    speed: Math.min(1.2, knobs.speed * (1 + deep / 2)),
    power: Math.min(22, 15 + Math.floor(depth / 20)),
    maxShots: 130,
    origins: originsOf({ anchors }, move),
    stats,
  };
  const count = heraldCardCount(depth, tier);
  const restMs = move === 'dash' ? 900 : move === 'teleport' ? 1000 : 1200;
  const cards = Array.from({ length: count }, (_, i) => fairCard(rand, g, `herald${i}`, i, count, R(restMs * rand.range(0.9, 1.15)), () => makeLayers(rand, g, i, count)));
  // Phase 2 from the middle card on.
  let rule = rand.pick<HeraldPhase2Rule>(['haste', 'mirror', 'layer', 'blink']);
  const fromCard = Math.max(1, Math.floor(count / 2));
  const origins2 = originsOf({ anchors }, rule === 'blink' ? 'teleport' : move);
  let drawn = cards.map((c, i) => (i < fromCard ? { card: c, ok: true } : variant(rand, g, c, rule, origins2)));
  if (rule === 'blink' && drawn.some((d) => !d.ok)) {
    // A blink card that failed from some anchor: the whole phase falls back to haste (phase 1's anchors, the same shots).
    rule = 'haste';
    drawn = cards.map((c, i) => (i < fromCard ? { card: c, ok: true } : variant(rand, g, c, 'haste', g.origins)));
  }
  const phase2Cards = drawn.map((d) => d.card);
  return {
    seed,
    depth,
    tier,
    sprite: wear.sprite,
    source: wear.source,
    types,
    name: words.name,
    epithet: words.epithet,
    epigraph: words.epigraph,
    theme: { type, ...TYPE_COLOURS[type] },
    move,
    arrival: ARRIVAL[move],
    anchors: anchors.map((a) => ({ x: a.x, y: a.y })),
    moveSpeed: move === 'dash' ? 380 : move === 'drift' ? 70 : 90,
    hpScale: heraldHpScale(count),
    cards,
    phase2: { rule, fromCard, transformMs: 1400, cards: phase2Cards, move: rule === 'blink' ? 'teleport' : move },
    maxShots: g.maxShots,
  };
}

const CACHE = new Map<string, HeraldDef>();

/** The herald of (seed, depth, tier), generated once per session (the fight asks for it every step). */
export function heraldDef(seed: number, depth: number, tier: Difficulty): HeraldDef {
  const key = `${seed}:${depth}:${tier}`;
  let def = CACHE.get(key);
  if (!def) {
    def = generateBoss(seed, depth, tier);
    if (CACHE.size > 32) CACHE.delete(CACHE.keys().next().value!);
    CACHE.set(key, def);
  }
  return def;
}
