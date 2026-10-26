import { registerCards, type CardFightDef, type CardStepDef, type SpellCardDef } from './cards';
import type { DanmakuShot } from './enemies';

/**
 * Decidueye, el Arquero de la niebla, as a spell-card guardian on Normal and
 * harder (data/cards.ts; Easy keeps the shipped Volley/Fan/Dive cards of
 * data/enemies.ts `DECIDUEYE`). Its identity stays: aimed arrows, leaf fans
 * whose gaps shift, the dive onto a marked spot, feather spirals, its shadow
 * clones' crossfire and the rain of arrows; the roost's four trees still
 * stop every shot.
 *
 * Per tier the same card gains density, speed, layers or aim (never density
 * and speed both past x1.3; tests/core/guardian-cards.test.ts):
 * - Normal: four cards, the last two after the mist (phase 2).
 * - Hard: denser or faster cards and a survival card (Bosque de Flechas).
 * - Nightmare: aimed layers, plus Costura de Sombras and a last arrow at
 *   low HP (Noche sin Luna).
 * Values are provisional.
 */

const arrow = (power: number, speed: number, pierceRoll = false): DanmakuShot => ({ power, type: 'ghost', speed, radius: 5, lifetimeMs: 4000, ...(pierceRoll ? { pierceRoll: true } : {}) });
const leaf = (power: number, speed: number, radius = 6): DanmakuShot => ({ power, type: 'grass', speed, radius, lifetimeMs: 6000 });

/** The shadow clones: the two top corners of the clearing (and the bottom ones on the hardest cards). */
const CLONES_TOP = [
  { x: 0.08, y: 0.1 },
  { x: 0.92, y: 0.1 },
] as const;
const CLONES_ALL = [CLONES_TOP[0], CLONES_TOP[1], { x: 0.92, y: 0.9 }, { x: 0.08, y: 0.9 }] as const;

/** Signo Sombra «Andanada del Arquero»: aimed arrow fans (keep moving), then rings of leaves. */
const volleySteps = (speed: number, aimed: boolean): CardStepDef[] => [
  {
    telegraphMs: 800,
    recoverMs: 800,
    pattern: { kind: 'fan', fans: 5, perFan: 3, spreadDeg: 20, gapMs: 450, aim: 'each', shot: arrow(18, speed) },
    ...(aimed ? { layers: [{ kind: 'turrets', points: CLONES_TOP, atOnce: 1, volleys: 3, gapMs: 750, perVolley: 1, spreadDeg: 0, shot: arrow(16, 200) }] as const } : {}),
  },
  // The clones answer from the four corners, two at a time, over rings of leaves: no trunk shelters from both sides.
  {
    telegraphMs: 800,
    recoverMs: 900,
    pattern: { kind: 'turrets', points: CLONES_ALL, atOnce: 2, volleys: 4, gapMs: 650, perVolley: 1, spreadDeg: 0, shot: arrow(16, 200) },
    layers: [{ kind: 'rings', rings: 3, perRing: 14, gap: 3, gapTurnDeg: 30, gapMs: 550, shot: leaf(16, 100) }],
  },
];

/** Signo Hoja «Abanico del Claro»: leaf fans whose gaps shift, then the dive onto the marked spot (positional) with a ring of leaves. */
const leavesSteps = (perFan: number, ringLayer: boolean): CardStepDef[] => [
  {
    telegraphMs: 800,
    recoverMs: 800,
    pattern: { kind: 'fan', fans: 5, perFan, spreadDeg: 100, gapMs: 450, aim: 'first', shot: leaf(16, 115) },
    ...(ringLayer ? { layers: [{ kind: 'rings', rings: 2, perRing: 12, gap: 3, gapTurnDeg: 30, gapMs: 1000, shot: leaf(13, 80) }] as const } : {}),
  },
  // The lock lets a walking player leave the mark on every tier (src/sim/prove.ts).
  {
    telegraphMs: 1200,
    recoverMs: 1300,
    pattern: { kind: 'zone', at: 'target', radius: 60, lockMs: 700, impactMs: 220, attack: { power: 32, type: 'flying', pierceRoll: true }, ring: { count: 12, gap: 3, shot: leaf(14, 105) } },
  },
];

/** Signo Pluma «Plumas en Espiral»: a feather spiral (counter-rotating layer on Hard), then the shadow clones' crossfire. */
const feathersSteps = (counter: boolean, volleys: number): CardStepDef[] => [
  {
    telegraphMs: 800,
    recoverMs: 900,
    pattern: { kind: 'spiral', arms: 4, everyMs: 180, durationMs: 3000, turnDegPerShot: 10, shot: leaf(14, 95, 5) },
    ...(counter ? { layers: [{ kind: 'spiral', arms: 3, everyMs: 360, durationMs: 3000, turnDegPerShot: -15, shot: leaf(12, 75, 5) }] as const } : {}),
  },
  { telegraphMs: 900, recoverMs: 900, pattern: { kind: 'turrets', points: CLONES_ALL, atOnce: 2, volleys, gapMs: 800, perVolley: 3, spreadDeg: 12, shot: arrow(16, 210) } },
];

/** Signo Niebla «Lluvia del Arquero»: rain whose dry lane walks across the clearing, from above and then from below (positional), then aimed arrows. */
const rainSteps = (speed: number, gapWidth: number, aimed: boolean): CardStepDef[] => [
  {
    telegraphMs: 1100,
    recoverMs: 1200,
    pattern: { kind: 'lanes', waves: 7, gapMs: 600, spacing: 26, gapWidth, shiftPx: 55, snake: true, alternate: true, shot: arrow(20, speed, true) },
    ...(aimed ? { layers: [{ kind: 'turrets', points: CLONES_TOP, atOnce: 1, volleys: 4, gapMs: 1000, perVolley: 1, spreadDeg: 0, shot: arrow(16, 200) }] as const } : {}),
  },
  { telegraphMs: 700, recoverMs: 900, pattern: { kind: 'fan', fans: 4, perFan: 3, spreadDeg: 24, gapMs: 500, aim: 'each', shot: arrow(18, 210) } },
];

const volley = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-dec-volley', nameKey: 'spell.decidueye.cardVolley', hpShare, timerMs: 35_000, restMs: 600, steps });
const leaves = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-dec-leaves', nameKey: 'spell.decidueye.cardLeaves', hpShare, timerMs: 35_000, restMs: 600, steps });
const feathers = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-dec-feathers', nameKey: 'spell.decidueye.cardFeathers', hpShare, timerMs: 40_000, phase2: true, restMs: 600, steps });
const rain = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-dec-rain', nameKey: 'spell.decidueye.cardRain', hpShare, timerMs: 40_000, restMs: 600, steps });

/** Signo Bosque «Bosque de Flechas» (Hard+): it cannot be hurt for 15 s; two feather spirals turn opposite ways and the clones fire one at a time. */
const forest = (aimed: boolean): SpellCardDef => ({
  id: 'sc-dec-forest',
  nameKey: 'spell.decidueye.cardForest',
  hpShare: 0,
  timerMs: 15_000,
  survival: true,
  restMs: 500,
  steps: [
    {
      telegraphMs: 900,
      recoverMs: 600,
      pattern: { kind: 'spiral', arms: 3, everyMs: 170, durationMs: 4000, turnDegPerShot: 9, shot: leaf(14, 95, 5) },
      layers: [{ kind: 'spiral', arms: 3, everyMs: 340, durationMs: 4000, turnDegPerShot: -12, shot: leaf(12, 70, 5) }],
    },
    {
      telegraphMs: 900,
      recoverMs: 600,
      pattern: { kind: 'turrets', points: CLONES_ALL, atOnce: aimed ? 2 : 1, volleys: 5, gapMs: 700, perVolley: 3, spreadDeg: 14, shot: arrow(16, 190) },
    },
  ],
});

/** Signo Sombra «Costura de Sombras» (Nightmare): four clones fire in pairs across the clearing over a slow leaf ring. */
const stitch: SpellCardDef = {
  id: 'sc-dec-stitch',
  nameKey: 'spell.decidueye.cardStitch',
  hpShare: 0.16,
  timerMs: 40_000,
  restMs: 600,
  steps: [
    {
      telegraphMs: 900,
      recoverMs: 1000,
      pattern: { kind: 'turrets', points: CLONES_ALL, atOnce: 2, volleys: 6, gapMs: 700, perVolley: 3, spreadDeg: 12, shot: arrow(16, 210) },
      layers: [{ kind: 'rings', rings: 3, perRing: 12, gap: 3, gapTurnDeg: 40, gapMs: 1400, shot: leaf(12, 75) }],
    },
    { telegraphMs: 800, recoverMs: 1000, pattern: { kind: 'fan', fans: 5, perFan: 11, spreadDeg: 110, gapMs: 450, aim: 'first', shot: leaf(15, 115) } },
  ],
};

/** Última Flecha «Noche sin Luna» (Nightmare, last 12 %): a slow five-arm spiral with aimed clone arrows, then rings with a counter spiral. */
const moonless: SpellCardDef = {
  id: 'sc-dec-moonless',
  nameKey: 'spell.decidueye.cardMoonless',
  hpShare: 0.12,
  timerMs: 35_000,
  lastSpell: true,
  restMs: 600,
  steps: [
    {
      telegraphMs: 1000,
      recoverMs: 900,
      pattern: { kind: 'spiral', arms: 5, everyMs: 220, durationMs: 4000, turnDegPerShot: 8, shot: leaf(14, 90, 5) },
      layers: [{ kind: 'turrets', points: CLONES_ALL, atOnce: 2, volleys: 4, gapMs: 1000, perVolley: 1, spreadDeg: 0, shot: arrow(16, 200) }],
    },
    {
      telegraphMs: 800,
      recoverMs: 1100,
      pattern: { kind: 'rings', rings: 4, perRing: 18, gap: 4, gapTurnDeg: 30, gapMs: 600, shot: leaf(15, 100) },
      layers: [{ kind: 'spiral', arms: 2, everyMs: 300, durationMs: 2400, turnDegPerShot: -15, shot: leaf(12, 75, 5) }],
    },
  ],
};

const FIGHT = { aggroRange: 900, breakMs: 1200, phase2BreakMs: 1800, walkSpeed: 60, keepDistance: 150 } as const;

export const DECIDUEYE_CARDS_NORMAL: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 100,
  power: 1,
  cards: [volley(volleySteps(200, false), 0.25), leaves(leavesSteps(9, false), 0.25), feathers(feathersSteps(false, 4), 0.25), rain(rainSteps(170, 90, false), 0.25)],
});

/** Hard: arrows x1.15 speed, leaf fans x1.22 density + a ring layer, the counter spiral and two more clone volleys, rain x1.1 speed; the survival card in phase 2. */
export const DECIDUEYE_CARDS_HARD: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 120,
  power: 1.12,
  cards: [
    volley(volleySteps(230, false), 0.27),
    leaves(leavesSteps(11, true), 0.27),
    feathers(feathersSteps(true, 6), 0.23),
    forest(false),
    rain(rainSteps(187, 86, false), 0.23),
  ],
});

/** Nightmare: Hard's cards with aimed clone layers, plus Costura de Sombras and the last arrow. */
export const DECIDUEYE_CARDS_NIGHTMARE: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 140,
  power: 1.22,
  // The compressed chart cut Zorua's margin on the rain and the stitch (1.09, 1.10 < 1.1; the echo's feathers too): HP x0.95 restores it (odd/tasks/type-balance.md).
  hpScale: 0.95,
  cards: [
    volley(volleySteps(230, true), 0.18),
    leaves(leavesSteps(11, true), 0.18),
    feathers(feathersSteps(true, 6), 0.18),
    forest(true),
    rain(rainSteps(187, 86, true), 0.18),
    stitch,
    moonless,
  ],
});
