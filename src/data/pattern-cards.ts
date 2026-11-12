import type { CardStepDef, SpellCardDef, SpellCardId } from './cards';
import { DHELMISE_PATTERNS, LANTURN_PATTERNS, type DanmakuPattern, type DanmakuShot, type ShotKinDef, type SteerDef } from './enemies';
import type { PokemonType } from './types';

/**
 * The new spell cards of the eight dungeon bosses (odd/tasks/boss-patterns.md,
 * docs/research/boss-patterns.md §4), built on the pattern engine's new
 * families: shots that bounce, curve, slow down and come back, hang, fall
 * upwards; orbiting familiars; warned lasers (lines of fast shots); arms that
 * swing; rings that close on the player; seeded scatter; homing orbs.
 *
 * Owner decision 2(b): on Normal each boss's new card `a` replaces its
 * weakest card (the lowest HP share; ties: the highest Normal kill margin in
 * reports/proof/latest.md), which stays on Hard and Nightmare; the other new
 * cards join on Hard and Nightmare (the bolt only on Nightmare). The same
 * card on a harder tier gains density, speed or a layer, never density and
 * speed both past x1.3 (tests/core/card-fairness.test.ts).
 *
 * Hitboxes (owner decision 3a: the bright core is the hitbox, the glow is
 * harmless): needles (lasers, arrows, sparks) radius 4-5, orbs (rings,
 * spirals, fans) 6-7, big slow shots (homing orbs, falling drops) 8-9.
 * Nightmare's waltz and neurotoxin hit harder: a ranked drain build otherwise
 * out-healed them face-tanking (tests/sim/degenerate-builds.test.ts).
 * Values are provisional; the beatability proof (`npm run prove`) holds them.
 */

export type CardTier = 'normal' | 'hard' | 'nightmare';
const T = { normal: 0, hard: 1, nightmare: 2 } as const;
const pick = <V>(tier: CardTier, values: readonly [V, V, V]): V => values[T[tier]];

const shot = (type: PokemonType, power: number, speed: number, radius: number, lifetimeMs = 6000, more: { kin?: ShotKinDef; steer?: SteerDef; pierceRoll?: true } = {}): DanmakuShot => ({ power, type, speed, radius, lifetimeMs, ...more });

/**
 * The opening after each move of a new card ("tu turno" lasts at least this
 * long): long enough for a melee starter to walk in from where the move
 * pushed it and still hit (src/sim/prove.ts punish windows and kill margins;
 * the Senda templates use 1600-2200 ms the same way).
 */
const OPENING_MS = 2200;

/** A card from its id, banner key and steps (each with at least `OPENING_MS` of opening). */
const card = (id: SpellCardId, nameKey: string, hpShare: number, timerMs: number, restMs: number, steps: CardStepDef[], more: Partial<SpellCardDef> = {}): SpellCardDef => ({
  id,
  nameKey,
  hpShare,
  timerMs,
  restMs,
  steps: steps.map((s) => (s.recoverMs >= OPENING_MS ? s : { ...s, recoverMs: OPENING_MS })),
  ...more,
});

const layered = (step: CardStepDef, layers: readonly DanmakuPattern[]): CardStepDef => (layers.length > 0 ? { ...step, layers } : step);

// --- Aegislash, el Rey de las Espadas (Crypt guardian; pillars stop shots) -----

const steel = (power: number, speed: number, radius = 6, lifetimeMs = 6000, kin?: ShotKinDef): DanmakuShot => shot('steel', power, speed, radius, lifetimeMs, kin ? { kin } : {});
const AEG_CORNERS = [
  { x: 0.08, y: 0.1 },
  { x: 0.92, y: 0.1 },
  { x: 0.92, y: 0.9 },
  { x: 0.08, y: 0.9 },
] as const;

/** Juramento «Vals de la Hoja Errante»: two shield-swords orbit the King firing short fans outwards (on Nightmare at the player: no pocket inside their circle; the guard turns with them), then the corner swords answer two at a time (no pillar shelters from both). Guards its front (flank it). */
export const aegWaltz = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-aeg-waltz', 'spell.aegislash.waltz', hpShare, 40_000, 700, [
    layered(
      { telegraphMs: 900, recoverMs: 1000, pattern: { kind: 'familiars', count: 2, radius: 90, degPerSec: 45, centre: 'boss', atOnce: 2, volleys: 6, gapMs: 700, perVolley: pick(tier, [5, 6, 6]), spreadDeg: 50, aim: tier === 'nightmare' ? 'target' : 'out', shot: steel(pick(tier, [14, 14, 20]), 105) } },
      [
        ...(tier !== 'normal' ? [{ kind: 'rings', rings: 3, perRing: 12, gap: 3, gapTurnDeg: 40, gapMs: 1400, shot: steel(12, 75) } as const] : []),
      ],
    ),
    { telegraphMs: 900, recoverMs: 1000, pattern: { kind: 'turrets', points: AEG_CORNERS, atOnce: 2, volleys: pick(tier, [4, 5, 5]), gapMs: 700, perVolley: 3, spreadDeg: 16, shot: steel(pick(tier, [14, 14, 20]), pick(tier, [150, 160, 160])) } },
  ], { guard: 'front' });

/** Edicto «Acero que Devuelve» (Hard+): slow sword fans that bounce once off the throne room's walls (the rebound is the second wave), then bouncing rings while a corner sword fires (no pillar shelters for long). */
export const aegEdict = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-aeg-edict', 'spell.aegislash.edict', hpShare, 40_000, 700, [
    { telegraphMs: 900, recoverMs: 1300, pattern: { kind: 'fan', fans: 3, perFan: pick(tier, [9, 9, 11]), spreadDeg: 120, gapMs: 900, aim: 'first', shot: steel(14, 95, 6, 7000, { bounces: 1 }) } },
    layered(
      { telegraphMs: 800, recoverMs: 1200, pattern: { kind: 'rings', rings: 2, perRing: 14, gap: 3, gapTurnDeg: 30, gapMs: 1000, shot: steel(13, 90, 6, 7000, { bounces: 1 }) } },
      [
        { kind: 'turrets', points: AEG_CORNERS, atOnce: 1, volleys: 8, gapMs: 400, perVolley: 1, spreadDeg: 0, shot: steel(14, 150) },
        ...(tier === 'nightmare' ? [{ kind: 'fan', fans: 2, perFan: 3, spreadDeg: 20, gapMs: 1000, aim: 'each', shot: steel(14, 140) } as const] : []),
      ],
    ),
  ]);

// --- Decidueye, el Arquero de la Niebla (Forest guardian; trees stop arrows) ---

const arrow = (power: number, speed: number, kin?: ShotKinDef): DanmakuShot => shot('ghost', power, speed, 5, 4000, kin ? { kin } : {});
const leaf = (power: number, speed: number, radius = 6, kin?: ShotKinDef, lifetimeMs = 6000): DanmakuShot => shot('grass', power, speed, radius, lifetimeMs, kin ? { kin } : {});
const CLONES_TOP = [
  { x: 0.08, y: 0.1 },
  { x: 0.92, y: 0.1 },
] as const;
/** The shadow clones at the four corners of the clearing (no trunk shelters from both sides). */
const CLONES_ALL = [CLONES_TOP[0], CLONES_TOP[1], { x: 0.92, y: 0.9 }, { x: 0.08, y: 0.9 }] as const;

/** Signo Niebla «Flechas que se Curvan»: arrows lost in the mist curve left and right in alternate volleys, then leaf rings that curl the other way. */
export const decBend = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-dec-bend', 'spell.decidueye.cardBend', hpShare, 35_000, 600, [
    layered(
      { telegraphMs: 800, recoverMs: 900, pattern: { kind: 'fan', fans: 6, perFan: pick(tier, [7, 8, 8]), spreadDeg: 90, gapMs: 500, aim: 'first', shot: arrow(16, 150, { curveDegPerSec: 35, curveAlternate: true }) } },
      tier === 'nightmare' ? [{ kind: 'turrets', points: CLONES_TOP, atOnce: 1, volleys: 3, gapMs: 1000, perVolley: 1, spreadDeg: 0, shot: arrow(16, 200) }] : [],
    ),
    {
      telegraphMs: 800,
      recoverMs: 900,
      pattern: { kind: 'rings', rings: 3, perRing: pick(tier, [14, 16, 16]), gap: 3, gapTurnDeg: 30, gapMs: 650, shot: leaf(14, 95, 6, { curveDegPerSec: -30, curveAlternate: true }) },
      layers: [{ kind: 'turrets', points: CLONES_ALL, atOnce: 2, volleys: 4, gapMs: 600, perVolley: 1, spreadDeg: 0, shot: arrow(16, 200) }],
    },
  ]);

/** Signo Hoja «Rayo del Claro» (Hard+): sunlight through the canopy, three warned laser lines turning a little each volley over leaf rings, then aimed arrows. */
export const decSunbeam = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-dec-sunbeam', 'spell.decidueye.cardSunbeam', hpShare, 40_000, 600, [
    {
      telegraphMs: 900,
      recoverMs: 1200,
      pattern: { kind: 'laser', volleys: 3, everyMs: 1500, lines: 3, fanDeg: 50, turnDeg: 12, warnMs: 650, fireMs: 400, beamEveryMs: 45, shot: leaf(18, 420, 4, undefined, 2000) },
      layers: [{ kind: 'rings', rings: 2, perRing: pick(tier, [12, 12, 14]), gap: 3, gapTurnDeg: 30, gapMs: 1500, shot: leaf(13, 80) }],
    },
    {
      telegraphMs: 800,
      recoverMs: 1000,
      pattern: { kind: 'fan', fans: 3, perFan: 3, spreadDeg: 24, gapMs: 500, aim: 'each', shot: arrow(18, 200) },
      layers: [{ kind: 'turrets', points: CLONES_ALL, atOnce: 1, volleys: 4, gapMs: 450, perVolley: 1, spreadDeg: 0, shot: arrow(16, 200) }],
    },
  ]);

// --- Sableye, el Ladrón de Gemas (Crypt mid-boss) ---------------------------

const gem = (power: number, speed: number, kin?: ShotKinDef): DanmakuShot => shot('dark', power, speed, 6, 6000, kin ? { kin } : {});

/** «Gemas de Rebote»: stolen gems thrown in gapped rings bounce once off the vault walls, then a fan of gems that bounce too. */
export const sabRicochet = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-sab-ricochet', 'spell.sableye.card-ricochet', hpShare, 35_000, 600, [
    layered(
      { telegraphMs: 900, recoverMs: 1300, pattern: { kind: 'rings', rings: 3, perRing: pick(tier, [12, 14, 14]), gap: 3, gapTurnDeg: 35, gapMs: 900, shot: gem(18, 100, { bounces: 1 }) } },
      tier === 'nightmare' ? [{ kind: 'fan', fans: 2, perFan: 3, spreadDeg: 20, gapMs: 900, aim: 'each', shot: gem(16, 150) }] : [],
    ),
    { telegraphMs: 800, recoverMs: 1100, pattern: { kind: 'fan', fans: 3, perFan: 7, spreadDeg: 90, gapMs: 700, aim: 'first', shot: gem(16, pick(tier, [110, 120, 120]), { bounces: 1 }) } },
  ]);

// --- Trevenant (Forest mid-boss) ---------------------------------------------

const wisp = (power: number, speed: number, radius = 7, lifetimeMs = 6000, more: { kin?: ShotKinDef; steer?: SteerDef } = {}): DanmakuShot => shot('ghost', power, speed, radius, lifetimeMs, more);

/** «Ramas al Viento»: arms of leaves swing back and forth like branches in a storm, then cursed rings. */
export const treBranches = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-tre-branches', 'spell.trevenant.card-branches', hpShare, 35_000, 600, [
    { telegraphMs: 900, recoverMs: 1300, pattern: { kind: 'wave', arms: pick(tier, [3, 3, 4]), everyMs: 140, durationMs: 2800, amplitudeDeg: 30, periodMs: 1600, shot: leaf(16, pick(tier, [95, 105, 95])) } },
    { telegraphMs: 800, recoverMs: 1200, pattern: { kind: 'rings', rings: 3, perRing: 14, gap: 3, gapTurnDeg: 30, gapMs: 700, shot: wisp(16, 90) } },
  ]);

/** «Corro de Fuegos Fatuos» (Hard+): a ring of cursed wisps closes on where the player stood, one gap away from the tree, and slow wisps follow; then swinging arms. */
export const treWisps = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-tre-wisps', 'spell.trevenant.card-wisps', hpShare, 40_000, 600, [
    {
      telegraphMs: 1000,
      recoverMs: 1300,
      pattern: { kind: 'closing', rings: 2, gapMs: 1300, perRing: pick(tier, [18, 18, 20]), gap: 4, radius: 190, gapTurnDeg: 40, shot: wisp(18, 85, 7, 2600) },
      layers: [{ kind: 'homing', volleys: 2, gapMs: 1300, orbs: 2, spreadDeg: 70, shot: wisp(14, 70, 8, 3500, { steer: { degPerSec: 70, ms: 2000 } }) }],
    },
    { telegraphMs: 800, recoverMs: 1200, pattern: { kind: 'wave', arms: 2, mirror: true, everyMs: 160, durationMs: 2400, amplitudeDeg: 35, periodMs: 1400, shot: leaf(15, 100) } },
  ]);

// --- Lanturn, el Farol del Abismo (Caves mid-boss) ----------------------------

const bubble = (power: number, speed: number, radius = 7, lifetimeMs = 6000, kin?: ShotKinDef): DanmakuShot => shot('water', power, speed, radius, lifetimeMs, kin ? { kin } : {});
const spark = (power: number, speed: number, lifetimeMs = 4500): DanmakuShot => shot('electric', power, speed, 5, lifetimeMs);
/** Its own discharge around the body (walk out of the circle: a roll does not help). */
const SURGE: CardStepDef = LANTURN_PATTERNS.surge!;

/** «Corriente de Retorno»: bubble rings go out, slow down and come back through Lanturn and out the other side (the gap you used on the way out is behind you on the way back), then its discharge. */
export const lanBackflow = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-lan-backflow', 'spell.lanturn.card-backflow', hpShare, 35_000, 0, [
    layered(
      { telegraphMs: 900, recoverMs: 1500, pattern: { kind: 'rings', rings: 3, perRing: pick(tier, [16, 18, 18]), gap: 4, gapTurnDeg: 40, gapMs: 800, shot: bubble(16, 140, 7, 6500, { accel: -80, maxSpeed: 140 }) } },
      tier === 'nightmare' ? [{ kind: 'spiral', arms: 2, everyMs: 300, durationMs: 2400, turnDegPerShot: 13, shot: spark(14, 90) }] : [],
    ),
    SURGE,
  ]);

/** «Faroles a la Deriva» (Hard+): three lure-lights drift around Lanturn and fire single sparks at the player in turn over slow bubble rings, then its discharge. */
export const lanLanterns = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-lan-lanterns', 'spell.lanturn.card-lanterns', hpShare, 35_000, 0, [
    {
      telegraphMs: 900,
      recoverMs: 1300,
      pattern: { kind: 'familiars', count: 3, radius: 110, degPerSec: 40, centre: 'boss', atOnce: 1, volleys: 9, gapMs: 450, perVolley: 1, spreadDeg: 0, aim: 'target', shot: spark(16, pick(tier, [170, 170, 185])) },
      layers: [{ kind: 'rings', rings: 2, perRing: 14, gap: 3, gapTurnDeg: 30, gapMs: 1800, shot: bubble(14, 85) }],
    },
    SURGE,
  ]);

/** «Relámpago Abisal» (Nightmare): two opposite electric lines from the lure, warned, turning each volley over bubble rings, then its discharge. */
export const lanBolt = (_tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-lan-bolt', 'spell.lanturn.card-bolt', hpShare, 35_000, 0, [
    {
      telegraphMs: 900,
      recoverMs: 1300,
      pattern: { kind: 'laser', volleys: 3, everyMs: 1400, lines: 2, fanDeg: 180, turnDeg: 25, warnMs: 700, fireMs: 400, beamEveryMs: 45, shot: shot('electric', 18, 440, 4, 2000) },
      layers: [{ kind: 'rings', rings: 3, perRing: 14, gap: 3, gapTurnDeg: 30, gapMs: 1400, shot: bubble(14, 85) }],
    },
    SURGE,
  ]);

// --- Dhelmise, el Ancla de los Juramentos Hundidos (Caves guardian) -----------

/** «Cadena del Ancla» (its awakening on Normal): two dense spokes of bubbles turning slowly around the wreck (walk round with the gap), then the kelp lanes. */
export const dheChain = (tier: CardTier, hpShare: number, phase2: boolean): SpellCardDef =>
  card('sc-dhe-chain', 'spell.dhelmise.card-chain', hpShare, 45_000, 0, [
    layered(
      { telegraphMs: 900, recoverMs: 1300, pattern: { kind: 'spiral', arms: 2, everyMs: 80, durationMs: 3200, turnDegPerShot: 2.4, shot: bubble(16, pick(tier, [100, 110, 110]), 6, 4000) } },
      tier === 'nightmare' ? [{ kind: 'rings', rings: 2, perRing: 12, gap: 3, gapTurnDeg: 40, gapMs: 1600, shot: bubble(13, 75) }] : [],
    ),
    DHELMISE_PATTERNS.kelp!,
  ], phase2 ? { phase2: true } : {});

/** «Remolino Inverso» (Hard+): bubbles appear on a wide ring round the player and curl inwards (the gap turns as it closes), then the anchor's swing. */
export const dheWhirl = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-dhe-whirl', 'spell.dhelmise.card-whirl', hpShare, 40_000, 0, [
    { telegraphMs: 1000, recoverMs: 1300, pattern: { kind: 'closing', rings: 3, gapMs: 1100, perRing: pick(tier, [20, 20, 22]), gap: 5, radius: 200, gapTurnDeg: 30, shot: bubble(16, 80, 7, 3000, { curveDegPerSec: 25 }) } },
    DHELMISE_PATTERNS.undertow!,
  ]);

// --- Salazzle, la Reina de la Ponzoña (Swamp mid-boss) ------------------------

const ember = (power: number, speed: number, radius = 5, lifetimeMs = 5000, kin?: ShotKinDef): DanmakuShot => shot('fire', power, speed, radius, lifetimeMs, kin ? { kin } : {});

/** «Chispas de Feromona»: a seeded scatter of embers that brake and hang in the air as burning motes, then a flame spiral. */
export const salSparks = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-sal-sparks', 'spell.salazzle.card-sparks', hpShare, 35_000, 0, [
    { telegraphMs: 900, recoverMs: 1400, pattern: { kind: 'scatter', bursts: 4, gapMs: 450, count: pick(tier, [8, 9, 10]), coneDeg: 100, salt: 7, aim: 'each', shot: ember(16, 190, 5, 2900, { accel: -120, stop: true }) } },
    { telegraphMs: 900, recoverMs: 1400, pattern: { kind: 'spiral', arms: 3, everyMs: 180, durationMs: 2400, turnDegPerShot: 12, shot: ember(16, pick(tier, [110, 120, 120]), 6) } },
  ]);

// --- Nihilego, la que Cayó del Cielo (Swamp guardian) -------------------------

const shard = (power: number, speed: number, radius = 6, lifetimeMs = 5000): DanmakuShot => shot('rock', power, speed, radius, lifetimeMs);
const toxin = (power: number, speed: number, radius: number, lifetimeMs: number, more: { kin?: ShotKinDef; steer?: SteerDef }): DanmakuShot => shot('poison', power, speed, radius, lifetimeMs, more);
const shardRings = (tier: CardTier): CardStepDef => ({ telegraphMs: 850, recoverMs: 1200, pattern: { kind: 'rings', rings: 3, perRing: pick(tier, [14, 16, 16]), gap: 3, gapTurnDeg: 30, gapMs: 700, shot: shard(18, 115) } });

/** «Fractura del Cielo»: the rift cracks in straight lines, warned laser lines from the wormhole's mouth at a new angle each volley, then shard rings. */
export const nihFracture = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-nih-fracture', 'spell.nihilego.card-fracture', hpShare, 40_000, 0, [
    layered(
      { telegraphMs: 1000, recoverMs: 1300, pattern: { kind: 'laser', volleys: 3, everyMs: 1500, lines: 3, fanDeg: 70, turnDeg: 20, warnMs: 700, fireMs: 400, beamEveryMs: 45, shot: shard(18, 430, 4, 2000) } },
      tier !== 'normal' ? [{ kind: 'rings', rings: 2, perRing: 12, gap: 3, gapTurnDeg: 30, gapMs: 1500, shot: shard(14, 90) }] : [],
    ),
    shardRings(tier),
  ]);

/** «Lluvia al Revés» (Hard+): gapped rings of neurotoxin drops that fall upwards (the Ultra's own gravity bends them), then a scatter of drops. */
export const nihUpward = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-nih-upward', 'spell.nihilego.card-upward', hpShare, 40_000, 0, [
    { telegraphMs: 1000, recoverMs: 1400, pattern: { kind: 'rings', rings: 3, perRing: pick(tier, [14, 14, 16]), gap: 4, gapTurnDeg: 35, gapMs: 900, shot: toxin(16, 120, 8, 3000, { kin: { gravity: { x: 0, y: -60 } } }) } },
    { telegraphMs: 900, recoverMs: 1300, pattern: { kind: 'scatter', bursts: 3, gapMs: 600, count: 7, coneDeg: 60, salt: 23, aim: 'each', shot: toxin(16, 120, 7, 5000, {}) } },
  ]);

/** «Neurotoxina Errante» (Hard+): slow jelly orbs that follow the player for a while, over shard rings, then shard rings. */
export const nihNeurotoxin = (tier: CardTier, hpShare: number): SpellCardDef =>
  card('sc-nih-neurotoxin', 'spell.nihilego.card-neurotoxin', hpShare, 40_000, 0, [
    {
      telegraphMs: 900,
      recoverMs: 1300,
      pattern: { kind: 'homing', volleys: pick(tier, [3, 3, 4]), gapMs: pick(tier, [1300, 1300, 1000]), orbs: pick(tier, [2, 2, 3]), spreadDeg: 80, shot: toxin(pick(tier, [16, 16, 22]), 70, 9, 4000, { steer: { degPerSec: 75, ms: 2200 } }) },
      layers: [{ kind: 'rings', rings: 3, perRing: pick(tier, [14, 14, 16]), gap: 3, gapTurnDeg: 30, gapMs: 1300, shot: shard(pick(tier, [15, 15, 20]), 100) }],
    },
    shardRings(tier),
  ]);

/**
 * Where each boss's new cards play (owner decision 2b): `normal` replaces
 * `replaces` on Normal (which stays on Hard and Nightmare), `extra` joins on
 * Hard and Nightmare, `nightmareOnly` on Nightmare. tests/core/card-fairness.test.ts
 * holds every dungeon boss to it.
 */
export const NEW_CARDS = {
  aegislash: { normal: 'sc-aeg-waltz', replaces: 'sc-aeg-walls', extra: ['sc-aeg-edict'], nightmareOnly: [] },
  decidueye: { normal: 'sc-dec-bend', replaces: 'sc-dec-leaves', extra: ['sc-dec-sunbeam'], nightmareOnly: [] },
  sableye: { normal: 'sc-sab-ricochet', replaces: 'sc-sab-gems', extra: [], nightmareOnly: [] },
  trevenant: { normal: 'sc-tre-branches', replaces: 'sc-tre-curse', extra: ['sc-tre-wisps'], nightmareOnly: [] },
  lanturn: { normal: 'sc-lan-backflow', replaces: 'sc-lan-lure', extra: ['sc-lan-lanterns'], nightmareOnly: ['sc-lan-bolt'] },
  dhelmise: { normal: 'sc-dhe-chain', replaces: 'sc-dhe-riptide', extra: ['sc-dhe-whirl'], nightmareOnly: [] },
  salazzle: { normal: 'sc-sal-sparks', replaces: 'sc-sal-haze', extra: [], nightmareOnly: [] },
  nihilego: { normal: 'sc-nih-fracture', replaces: 'sc-nih-shards', extra: ['sc-nih-upward', 'sc-nih-neurotoxin'], nightmareOnly: [] },
} as const satisfies Record<string, { normal: SpellCardId; replaces: SpellCardId; extra: readonly SpellCardId[]; nightmareOnly: readonly SpellCardId[] }>;
