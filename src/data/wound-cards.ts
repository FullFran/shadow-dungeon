import { registerCards, type CardFightDef, type CardStepDef, type SpellCardDef } from './cards';
import type { DanmakuShot } from './enemies';

/**
 * The wounds (docs/story-quests.md, owner 2026-10-26): the last boss of a
 * Senda is the line's own Pokémon grown huge and corrupted, its wound made
 * flesh. It fights as a spell-card boss on the shared engine (core/cards.ts)
 * with patterns every guardian already uses (aimed fans, gapped rings,
 * spirals, a mark that bursts, a walking curtain, corner turrets), dressed in
 * the species' own moves. A lesser version closes chapters I and II; the full
 * one, chapter III. Per tier it gains cards, density and speed, never density
 * and speed both past x1.3 (the guardians' rule). Every card is proven
 * beatable from every start by tests/sim/wound-prove.test.ts. Values are
 * provisional.
 *
 * Mimikyu Sin Disfraz (the Disguise's wound): what it fears is being seen,
 * so its cards are about eyes, the rag and hugs that hurt.
 */

const ghost = (power: number, speed: number, radius = 5): DanmakuShot => ({ power, type: 'ghost', speed, radius, lifetimeMs: 5000 });
const fairy = (power: number, speed: number, radius = 6): DanmakuShot => ({ power, type: 'fairy', speed, radius, lifetimeMs: 6000 });

/** Its four rag-ghosts in the arena's corners (turrets). */
const CORNERS = [
  { x: 0.08, y: 0.1 },
  { x: 0.92, y: 0.1 },
  { x: 0.92, y: 0.9 },
  { x: 0.08, y: 0.9 },
] as const;

/** Garra Umbría «Costura Rota»: aimed claw fans (keep moving), then rings of pink sparks. */
const clawSteps = (speed: number, perRing: number): CardStepDef[] => [
  { telegraphMs: 800, recoverMs: 1600, pattern: { kind: 'fan', fans: 5, perFan: 3, spreadDeg: 22, gapMs: 480, aim: 'each', shot: ghost(18, speed) } },
  { telegraphMs: 800, recoverMs: 1600, pattern: { kind: 'rings', rings: 3, perRing, gap: 3, gapTurnDeg: 30, gapMs: 600, shot: fairy(15, 100) } },
];

/** Golpe Fantasma «Nadie Mira»: it vanishes and falls where you stood (positional), with a ring; then the corner rags answer. */
const phantomSteps = (volleys: number): CardStepDef[] => [
  // The lock lets a walking player leave the mark (src/sim/prove.ts).
  { telegraphMs: 1200, recoverMs: 1600, pattern: { kind: 'zone', at: 'target', radius: 60, lockMs: 700, impactMs: 220, attack: { power: 32, type: 'ghost', pierceRoll: true }, ring: { count: 12, gap: 3, shot: ghost(14, 105) } } },
  { telegraphMs: 900, recoverMs: 1600, pattern: { kind: 'turrets', points: CORNERS, atOnce: 2, volleys, gapMs: 800, perVolley: 3, spreadDeg: 12, shot: ghost(16, 200) } },
];

/** Bola Sombra «Lo que Hay Debajo»: a slow spiral of shadow balls (a counter spiral from Hard), then a sweeping fan. */
const ballSteps = (counter: boolean): CardStepDef[] => [
  {
    telegraphMs: 800,
    recoverMs: 1600,
    pattern: { kind: 'spiral', arms: 3, everyMs: 200, durationMs: 2200, turnDegPerShot: 11, shot: ghost(14, 90, 6) },
    ...(counter ? { layers: [{ kind: 'spiral', arms: 2, everyMs: 400, durationMs: 2200, turnDegPerShot: -15, shot: fairy(12, 72, 5) }] as const } : {}),
  },
  { telegraphMs: 800, recoverMs: 1600, pattern: { kind: 'fan', fans: 4, perFan: 9, spreadDeg: 100, gapMs: 480, aim: 'first', shot: fairy(15, 110) } },
];

/** Carantoña «Abrazo que Duele»: a curtain of rag scraps whose open lane walks across the arena, then aimed claws. */
const hugSteps = (speed: number, gapWidth: number): CardStepDef[] => [
  { telegraphMs: 1100, recoverMs: 1600, pattern: { kind: 'lanes', waves: 6, gapMs: 650, spacing: 26, gapWidth, shiftPx: 55, snake: true, shot: fairy(18, speed) } },
  { telegraphMs: 700, recoverMs: 1600, pattern: { kind: 'fan', fans: 4, perFan: 3, spreadDeg: 24, gapMs: 500, aim: 'each', shot: ghost(18, 200) } },
];

const claw = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-wmim-claw', nameKey: 'spell.wound.mimikyu.claw', hpShare, timerMs: 35_000, restMs: 600, steps });
const phantom = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-wmim-phantom', nameKey: 'spell.wound.mimikyu.phantom', hpShare, timerMs: 35_000, restMs: 600, steps });
const ball = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-wmim-ball', nameKey: 'spell.wound.mimikyu.ball', hpShare, timerMs: 40_000, phase2: true, restMs: 600, steps });
const hug = (steps: CardStepDef[], hpShare: number): SpellCardDef => ({ id: 'sc-wmim-hug', nameKey: 'spell.wound.mimikyu.hug', hpShare, timerMs: 40_000, restMs: 600, steps });

/** Disfraz Roto «No Me Mires» (Hard+): it cannot be hurt for 15 s; two spirals turn opposite ways while the corner rags fire one at a time. */
const unseen = (atOnce: number): SpellCardDef => ({
  id: 'sc-wmim-unseen',
  nameKey: 'spell.wound.mimikyu.unseen',
  hpShare: 0,
  timerMs: 15_000,
  survival: true,
  restMs: 500,
  steps: [
    {
      telegraphMs: 900,
      recoverMs: 600,
      pattern: { kind: 'spiral', arms: 3, everyMs: 170, durationMs: 4000, turnDegPerShot: 9, shot: ghost(14, 95, 5) },
      layers: [{ kind: 'spiral', arms: 3, everyMs: 340, durationMs: 4000, turnDegPerShot: -12, shot: fairy(12, 70, 5) }],
    },
    { telegraphMs: 900, recoverMs: 600, pattern: { kind: 'turrets', points: CORNERS, atOnce, volleys: 5, gapMs: 700, perVolley: 3, spreadDeg: 14, shot: ghost(16, 190) } },
  ],
});

/** Última Palabra «Ya Me Has Visto» (Nightmare, last 9 %): a slow five-arm spiral with corner shots, then gapped rings with a counter spiral. */
const seen: SpellCardDef = {
  id: 'sc-wmim-seen',
  nameKey: 'spell.wound.mimikyu.seen',
  hpShare: 0.09,
  timerMs: 35_000,
  lastSpell: true,
  restMs: 600,
  steps: [
    {
      telegraphMs: 1000,
      recoverMs: 1600,
      pattern: { kind: 'spiral', arms: 4, everyMs: 240, durationMs: 3000, turnDegPerShot: 9, shot: fairy(14, 88, 5) },
      layers: [{ kind: 'turrets', points: CORNERS, atOnce: 2, volleys: 4, gapMs: 1000, perVolley: 1, spreadDeg: 0, shot: ghost(16, 200) }],
    },
    {
      telegraphMs: 800,
      recoverMs: 1600,
      pattern: { kind: 'rings', rings: 4, perRing: 18, gap: 4, gapTurnDeg: 30, gapMs: 600, shot: fairy(15, 100) },
      layers: [{ kind: 'spiral', arms: 2, everyMs: 300, durationMs: 2400, turnDegPerShot: -15, shot: ghost(12, 75, 5) }],
    },
  ],
};

const FIGHT = { aggroRange: 900, breakMs: 1200, phase2BreakMs: 1800, walkSpeed: 55, keepDistance: 110 } as const;

/** Easy: the lesser wound, two cards (Easy plays no chapter, but the arena is the same). */
export const WOUND_MIMIKYU_EASY: CardFightDef = registerCards({ ...FIGHT, maxShots: 80, power: 0.9, hpScale: 0.5, cards: [claw(clawSteps(180, 12), 0.5), phantom(phantomSteps(3), 0.5)] });

/** Normal (chapter I): three cards, the shadow balls after it sheds its rag (phase 2). */
export const WOUND_MIMIKYU_NORMAL: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 100,
  power: 1,
  hpScale: 0.7,
  cards: [claw(clawSteps(200, 14), 0.38), phantom(phantomSteps(4), 0.4), ball(ballSteps(false), 0.22)],
});

/** Hard (chapter II): claws x1.15 speed, denser rings, the counter spiral, the curtain and the survival card. */
export const WOUND_MIMIKYU_HARD: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 120,
  power: 1.12,
  hpScale: 0.7,
  cards: [claw(clawSteps(230, 16), 0.27), phantom(phantomSteps(5), 0.24), ball(ballSteps(true), 0.21), unseen(1), hug(hugSteps(160, 90), 0.24)],
});

/** Nightmare (chapter III): Hard's cards with two corner rags in the survival card, and the last word at low HP. */
export const WOUND_MIMIKYU_NIGHTMARE: CardFightDef = registerCards({
  ...FIGHT,
  maxShots: 140,
  power: 1.22,
  hpScale: 0.85,
  cards: [claw(clawSteps(230, 16), 0.22), phantom(phantomSteps(6), 0.22), ball(ballSteps(true), 0.22), unseen(2), hug(hugSteps(176, 86), 0.22), seen],
});
