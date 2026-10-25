import { registerCards, type CardFightDef, type CardStepDef, type SpellCardDef } from './cards';
import type { DanmakuShot } from './enemies';

/**
 * Aegislash, el Rey de las Espadas, as a spell-card guardian on Normal and
 * harder (data/cards.ts; Easy keeps the stance duel of data/enemies.ts
 * `AEGISLASH`). It keeps its identity: Shield cards guard its front (flank
 * it) and close walls of shields on the throne room; Blade cards cut fans
 * and spins; its oaths summon floating swords; the hundred swords march as
 * a curtain; the pillars still stop every shot.
 *
 * The same card on a harder tier gains density, speed, layers or aim, never
 * density and speed both past x1.3 (tests/core/guardian-cards.test.ts):
 * - Normal: four cards, the last two after "El Rey desenvaina" (phase 2).
 * - Hard: every card a little denser or faster or with a static layer, and
 *   a survival card in phase 2 (Corona de Espadas, 16 s).
 * - Nightmare: aimed layers on top, plus Juicio del Rey and a last word at
 *   low HP (Rey sin Reino).
 * Values are provisional.
 */

const steel = (power: number, speed: number, radius = 6, lifetimeMs = 6000): DanmakuShot => ({ power, type: 'steel', speed, radius, lifetimeMs });
const ghost = (power: number, speed: number, radius = 8, lifetimeMs = 6000, pierceRoll = false): DanmakuShot => ({ power, type: 'ghost', speed, radius, lifetimeMs, ...(pierceRoll ? { pierceRoll: true } : {}) });

/** Where the oath swords float: the four corners of the throne room, outside the pillars. */
const CORNERS = [
  { x: 0.08, y: 0.1 },
  { x: 0.92, y: 0.1 },
  { x: 0.92, y: 0.9 },
  { x: 0.08, y: 0.9 },
] as const;

// --- Normal: the base cards --------------------------------------------------

/** Escudo Real «Muralla Cerrada»: shields close from both sides with one gap row; then a shield bash of aimed fans. */
const wallsSteps = (speed: number, layer: boolean, aimedLayer: boolean): CardStepDef[] => [
  {
    telegraphMs: 900,
    recoverMs: 900,
    pattern: { kind: 'walls', waves: 4, gapMs: 1500, spacing: 34, gapWidth: 120, shiftPx: 110, shot: steel(16, speed, 7, 8000) },
    ...(layer ? { layers: [{ kind: 'rings', rings: 4, perRing: 14, gap: 3, gapTurnDeg: 40, gapMs: 1500, shot: steel(13, 80) }] as const } : {}),
  },
  {
    telegraphMs: 700,
    recoverMs: 1000,
    pattern: { kind: 'fan', fans: 3, perFan: 7, spreadDeg: 70, gapMs: 600, aim: 'each', shot: steel(14, 135) },
    ...(aimedLayer ? { layers: [{ kind: 'turrets', points: CORNERS, atOnce: 1, volleys: 3, gapMs: 600, perVolley: 1, spreadDeg: 0, shot: steel(14, 150) }] as const } : {}),
  },
];

/** Filo Real «Corte de Medianoche»: fans with alternating gaps, the midnight spin (positional), a ring of blades. */
const fansSteps = (perFan: number, ringLayer: boolean, aimed: boolean): CardStepDef[] => [
  {
    telegraphMs: 800,
    recoverMs: 800,
    pattern: { kind: 'fan', fans: 6, perFan, spreadDeg: 110, gapMs: 400, aim: 'first', shot: steel(14, 120) },
    ...(ringLayer ? { layers: [{ kind: 'rings', rings: 3, perRing: 16, gap: 3, gapTurnDeg: 30, gapMs: 800, shot: steel(12, 85) }] as const } : {}),
  },
  { telegraphMs: 900, recoverMs: 1200, pattern: { kind: 'sweep', radius: 125, sweepDeg: 360, sweepMs: 700, armDeg: 32, attack: { power: 30, type: 'ghost', pierceRoll: true } } },
  {
    telegraphMs: 700,
    recoverMs: 1000,
    pattern: { kind: 'rings', rings: 3, perRing: 18, gap: 3, gapTurnDeg: 25, gapMs: 500, shot: steel(15, 115) },
    ...(aimed ? { layers: [{ kind: 'fan', fans: 3, perFan: 3, spreadDeg: 24, gapMs: 500, aim: 'each', shot: steel(14, 150) }] as const } : {}),
  },
  // Tajo Real: the King marks where the player stands, the mark stops following for the last half second, and it lands there cutting (positional), throwing a ring of blades.
  {
    telegraphMs: 1100,
    recoverMs: 1300,
    pattern: { kind: 'zone', at: 'target', radius: 70, lockMs: 520, impactMs: 220, attack: { power: 32, type: 'ghost', pierceRoll: true }, ring: { count: 16, gap: 3, shot: steel(14, 110) } },
  },
];

/** Juramento «Espadas Flotantes»: swords at the corners fire aimed volleys two at a time; a sword spiral turns around the throne. */
const swordsSteps = (volleys: number, ringLayer: boolean, counter: boolean): CardStepDef[] => [
  {
    telegraphMs: 900,
    recoverMs: 900,
    pattern: { kind: 'turrets', points: CORNERS, atOnce: 2, volleys, gapMs: 700, perVolley: 3, spreadDeg: 16, shot: steel(15, 165) },
    ...(ringLayer ? { layers: [{ kind: 'rings', rings: 4, perRing: 16, gap: 4, gapTurnDeg: 45, gapMs: 1050, shot: steel(12, 75) }] as const } : {}),
  },
  {
    telegraphMs: 800,
    recoverMs: 1000,
    pattern: { kind: 'spiral', arms: 4, everyMs: 170, durationMs: 3000, turnDegPerShot: 9, shot: steel(14, 105) },
    ...(counter ? { layers: [{ kind: 'spiral', arms: 3, everyMs: 340, durationMs: 3000, turnDegPerShot: -14, shot: steel(12, 80) }] as const } : {}),
  },
];

/** Edicto del Eclipse «Desfile de las Cien Espadas»: a curtain of shadow swords whose lane snakes across the room (positional), then aimed cuts. */
const hundredSteps = (speed: number, gapWidth: number, aimed: boolean): CardStepDef[] => [
  {
    telegraphMs: 1100,
    recoverMs: 1300,
    pattern: { kind: 'lanes', waves: 8, gapMs: 650, spacing: 30, gapWidth, shiftPx: 60, snake: true, alternate: true, shot: ghost(24, speed, 8, 6000, true) },
    ...(aimed ? { layers: [{ kind: 'turrets', points: [CORNERS[2], CORNERS[3]], atOnce: 1, volleys: 5, gapMs: 1000, perVolley: 1, spreadDeg: 0, shot: steel(14, 140) }] as const } : {}),
  },
  { telegraphMs: 700, recoverMs: 1000, pattern: { kind: 'fan', fans: 4, perFan: 5, spreadDeg: 50, gapMs: 550, aim: 'each', shot: steel(14, 140) } },
];

const walls = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-aeg-walls', nameKey: 'spell.aegislash.walls', hpShare, timerMs: 40_000, guard: 'front', restMs: 700, steps });
const fans = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-aeg-fans', nameKey: 'spell.aegislash.fans', hpShare, timerMs: 40_000, restMs: 600, steps });
const swords = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-aeg-swords', nameKey: 'spell.aegislash.swords', hpShare, timerMs: 45_000, guard: 'front', phase2: true, restMs: 700, steps });
const hundred = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-aeg-hundred', nameKey: 'spell.aegislash.hundred', hpShare, timerMs: 45_000, restMs: 700, steps });

/** Juramento Eterno «Corona de Espadas» (Hard+): it cannot be hurt for 16 s; two sword spirals turn opposite ways around the throne, and shields close. */
const crown = (aimed: boolean): SpellCardDef => ({
  id: 'sc-aeg-crown',
  nameKey: 'spell.aegislash.crown',
  hpShare: 0,
  timerMs: 16_000,
  survival: true,
  restMs: 500,
  steps: [
    {
      telegraphMs: 900,
      recoverMs: 600,
      pattern: { kind: 'spiral', arms: 3, everyMs: 150, durationMs: 4500, turnDegPerShot: 8, shot: steel(14, 100) },
      layers: [{ kind: 'spiral', arms: 3, everyMs: 300, durationMs: 4500, turnDegPerShot: -11, shot: steel(12, 75) }],
    },
    {
      telegraphMs: 900,
      recoverMs: 600,
      pattern: { kind: 'walls', waves: 3, gapMs: 1600, spacing: 36, gapWidth: 120, shiftPx: 110, shot: steel(15, 110, 7, 8000) },
      ...(aimed ? { layers: [{ kind: 'turrets', points: CORNERS, atOnce: 1, volleys: 4, gapMs: 1200, perVolley: 1, spreadDeg: 0, shot: steel(14, 140) }] as const } : {}),
    },
  ],
});

/** Juicio del Rey «Las Cien Espadas vuelven» (Nightmare): the curtain from the other end with swords firing on the sides, then the shields close over a ring. */
const judgement: SpellCardDef = {
  id: 'sc-aeg-judgement',
  nameKey: 'spell.aegislash.judgement2',
  hpShare: 0.16,
  timerMs: 45_000,
  restMs: 700,
  steps: [
    {
      telegraphMs: 1100,
      recoverMs: 1300,
      pattern: { kind: 'lanes', waves: 7, gapMs: 700, spacing: 32, gapWidth: 104, shiftPx: 70, snake: true, alternate: true, shot: ghost(24, 150, 8, 6000, true) },
      layers: [{ kind: 'turrets', points: [CORNERS[0], CORNERS[1]], atOnce: 1, volleys: 4, gapMs: 1200, perVolley: 2, spreadDeg: 10, shot: steel(14, 140) }],
    },
    {
      telegraphMs: 900,
      recoverMs: 1100,
      pattern: { kind: 'walls', waves: 3, gapMs: 1500, spacing: 34, gapWidth: 120, shiftPx: 110, shot: steel(16, 120, 7, 8000) },
      layers: [{ kind: 'rings', rings: 3, perRing: 14, gap: 4, gapTurnDeg: 35, gapMs: 1500, shot: steel(12, 80) }],
    },
  ],
};

/** Última Palabra «Rey sin Reino» (Nightmare, last 12 %): everything at once, slower: a counter-rotating spiral, aimed oath swords and a blade ring. */
const lastWord: SpellCardDef = {
  id: 'sc-aeg-lastword',
  nameKey: 'spell.aegislash.lastword',
  hpShare: 0.12,
  timerMs: 40_000,
  lastSpell: true,
  restMs: 600,
  steps: [
    {
      telegraphMs: 1000,
      recoverMs: 900,
      pattern: { kind: 'spiral', arms: 5, everyMs: 200, durationMs: 4200, turnDegPerShot: 7, shot: steel(14, 95) },
      layers: [{ kind: 'turrets', points: CORNERS, atOnce: 2, volleys: 5, gapMs: 840, perVolley: 1, spreadDeg: 0, shot: steel(14, 150) }],
    },
    {
      telegraphMs: 800,
      recoverMs: 1100,
      pattern: { kind: 'rings', rings: 4, perRing: 22, gap: 4, gapTurnDeg: 30, gapMs: 600, shot: steel(15, 110) },
      layers: [{ kind: 'spiral', arms: 2, everyMs: 300, durationMs: 2400, turnDegPerShot: -15, shot: steel(12, 80) }],
    },
  ],
};

const FIGHT = { aggroRange: 900, breakMs: 1200, phase2BreakMs: 1800, walkSpeed: 50, keepDistance: 160 } as const;

export const AEGISLASH_CARDS_NORMAL: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 120,
  power: 1,
  cards: [walls(wallsSteps(120, false, false), 0.25), fans(fansSteps(9, false, false), 0.25), swords(swordsSteps(6, false, false), 0.25), hundred(hundredSteps(150, 100, false), 0.25)],
});

/** Hard: walls x1.15 speed, fans x1.22 density + a static ring layer, swords +2 volleys and a slow ring layer, curtain x1.1 speed; the survival card in phase 2. */
export const AEGISLASH_CARDS_HARD: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 150,
  power: 1,
  cards: [
    walls(wallsSteps(138, true, false), 0.27),
    fans(fansSteps(11, true, false), 0.27),
    swords(swordsSteps(8, true, false), 0.23),
    crown(false),
    hundred(hundredSteps(165, 96, false), 0.23),
  ],
});

/** Nightmare: Hard's cards with aimed layers (and the swords' counter spiral), plus Juicio del Rey and the last word. */
export const AEGISLASH_CARDS_NIGHTMARE: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 170,
  power: 1,
  cards: [
    walls(wallsSteps(138, true, true), 0.18),
    fans(fansSteps(11, true, true), 0.18),
    swords(swordsSteps(8, true, true), 0.18),
    crown(true),
    hundred(hundredSteps(165, 96, true), 0.18),
    judgement,
    lastWord,
  ],
});
