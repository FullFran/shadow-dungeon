import { registerCards, type CardFightDef, type CardStepDef, type SpellCardDef } from '../cards';
import type { DanmakuPattern, DanmakuShot } from '../enemies';
import type { RoomDef, RoomId } from '../rooms';
import type { SPRITE_KEYS } from '../sprites';
import type { PokemonType } from '../types';

/**
 * The Sendas' card bosses as data (docs/story-quests.md, owner 2026-10-26:
 * "Touhou por dentro, souls/MD por fuera"). A Senda's bosses are shadows of
 * what came back from the dungeons: each fights as a spell-card boss on the
 * shared engine (core/cards.ts) with a few signature cards, each built from
 * patterns the guardians already use (aimed fans, gapped rings, spirals that
 * bloom, a mark that falls on you, a walking curtain, closing walls, turrets)
 * and named in-world in the «Signo» manner. Per tier a boss gains cards,
 * density and speed; from Hard on a survival card, on Nightmare its last
 * word. Every card of every boss is proven survivable and killable on every
 * tier by tests/sim/story-prove-<line>.test.ts (the wounds by
 * tests/sim/wound-prove.test.ts). Values are provisional.
 */

/** A tier's value, Easy to Nightmare. */
export type Tier4<T> = readonly [T, T, T, T];
type Tier = 0 | 1 | 2 | 3;

/** A signature card's pattern family (the card's look), each a pair of moves from the guardians' proven repertoire. */
export type CardTemplate =
  /** Aimed fans (keep moving), then gapped rings. */
  | 'fan'
  /** A mark falls where you stood with a ring, then its points fire in turn. */
  | 'drop'
  /** A slow spiral that blooms (a counter spiral from Hard), then a wide static fan. */
  | 'bloom'
  /** A curtain whose open lane walks the arena (a rain to walk along), then aimed fans. */
  | 'rain'
  /** Rings whose gaps turn like the phases of a moon, over a slow counter spiral, then aimed fans. */
  | 'moon'
  /** Two walls close in from the sides with one row open, then aimed fans. */
  | 'walls';

/** The two of a boss's shot types: `a` its main bullets, `b` its layers and rings. */
export interface ShotTypes {
  a: PokemonType;
  b: PokemonType;
}

const shotOf = (type: PokemonType, power: number, speed: number, radius = 5, lifetimeMs = 5000): DanmakuShot => ({ power, type, speed, radius, lifetimeMs });

/** The four corners of an arena (the default turret points). */
export const CORNERS = [
  { x: 0.08, y: 0.1 },
  { x: 0.92, y: 0.1 },
  { x: 0.92, y: 0.9 },
  { x: 0.08, y: 0.9 },
] as const;

type Points = readonly { x: number; y: number }[];

/** One template's two moves on a tier (Easy..Nightmare, the guardians' knobs: never density and speed both past x1.3). */
function stepsOf(template: CardTemplate, k: Tier, t: ShotTypes, points: Points): CardStepDef[] {
  const fanSpeed = ([180, 200, 230, 230] as const)[k];
  const perRing = ([12, 14, 16, 16] as const)[k];
  switch (template) {
    case 'fan':
      return [
        { telegraphMs: 800, recoverMs: 1600, pattern: { kind: 'fan', fans: 5, perFan: 3, spreadDeg: 22, gapMs: 480, aim: 'each', shot: shotOf(t.a, 18, fanSpeed) } },
        { telegraphMs: 800, recoverMs: 1600, pattern: { kind: 'rings', rings: 3, perRing, gap: 3, gapTurnDeg: 30, gapMs: 600, shot: shotOf(t.b, 15, 100, 6, 6000) } },
      ];
    case 'drop':
      return [
        {
          telegraphMs: 1200,
          recoverMs: 1600,
          pattern: { kind: 'zone', at: 'target', radius: 60, lockMs: 700, impactMs: 220, attack: { power: 32, type: t.a, pierceRoll: true }, ring: { count: 12, gap: 3, shot: shotOf(t.b, 14, 105) } },
        },
        { telegraphMs: 900, recoverMs: 1600, pattern: { kind: 'turrets', points, atOnce: 2, volleys: 3 + k, gapMs: 800, perVolley: 3, spreadDeg: 12, shot: shotOf(t.b, 16, 190) } },
      ];
    case 'bloom': {
      const counter: readonly DanmakuPattern[] = k >= 2 ? [{ kind: 'spiral', arms: 2, everyMs: 400, durationMs: 2200, turnDegPerShot: -15, shot: shotOf(t.b, 12, 72) }] : [];
      return [
        { telegraphMs: 800, recoverMs: 1600, pattern: { kind: 'spiral', arms: 3, everyMs: 200, durationMs: 2200, turnDegPerShot: 11, shot: shotOf(t.a, 14, 90, 6) }, ...(counter.length ? { layers: counter } : {}) },
        { telegraphMs: 800, recoverMs: 1600, pattern: { kind: 'fan', fans: 4, perFan: 9, spreadDeg: 100, gapMs: 480, aim: 'first', shot: shotOf(t.b, 15, 110, 6, 6000) } },
      ];
    }
    case 'rain':
      return [
        { telegraphMs: 1100, recoverMs: 2000, pattern: { kind: 'lanes', waves: 6, gapMs: 650, spacing: 26, gapWidth: ([96, 94, 90, 86] as const)[k], shiftPx: 55, snake: true, shot: shotOf(t.a, 18, ([150, 156, 160, 176] as const)[k], 6, 6000) } },
        { telegraphMs: 700, recoverMs: 1600, pattern: { kind: 'fan', fans: 4, perFan: 3, spreadDeg: 24, gapMs: 500, aim: 'each', shot: shotOf(t.b, 18, 200) } },
      ];
    case 'moon':
      return [
        {
          telegraphMs: 900,
          recoverMs: 2200,
          pattern: { kind: 'rings', rings: k === 3 ? 4 : 3, perRing: ([14, 16, 16, 18] as const)[k], gap: 4, gapTurnDeg: 45, gapMs: 650, shot: shotOf(t.a, 15, 100) },
          ...(k >= 2 ? { layers: [{ kind: 'spiral', arms: 2, everyMs: 340, durationMs: 2000, turnDegPerShot: -15, shot: shotOf(t.b, 12, 75) }] as const } : {}),
        },
        { telegraphMs: 700, recoverMs: 2000, pattern: { kind: 'fan', fans: 4, perFan: 3, spreadDeg: 24, gapMs: 500, aim: 'each', shot: shotOf(t.b, 18, 200) } },
      ];
    case 'walls':
      return [
        { telegraphMs: 1100, recoverMs: 1600, pattern: { kind: 'walls', waves: 5, gapMs: 900, spacing: 26, gapWidth: ([96, 94, 90, 86] as const)[k], shiftPx: 50, shot: shotOf(t.a, 18, ([140, 150, 150, 165] as const)[k], 6, 6000) } },
        { telegraphMs: 700, recoverMs: 1600, pattern: { kind: 'fan', fans: 4, perFan: 3, spreadDeg: 24, gapMs: 500, aim: 'each', shot: shotOf(t.b, 18, 200) } },
      ];
  }
}

/** The survival card's moves (Hard+, 15 s it cannot be hurt): two spirals turning opposite ways, then its points one or two at a time. */
const survivalSteps = (k: Tier, t: ShotTypes, points: Points): CardStepDef[] => [
  {
    telegraphMs: 900,
    recoverMs: 600,
    pattern: { kind: 'spiral', arms: 3, everyMs: 170, durationMs: 4000, turnDegPerShot: 9, shot: shotOf(t.a, 14, 95) },
    layers: [{ kind: 'spiral', arms: 3, everyMs: 340, durationMs: 4000, turnDegPerShot: -12, shot: shotOf(t.b, 12, 70) }],
  },
  { telegraphMs: 900, recoverMs: 600, pattern: { kind: 'turrets', points, atOnce: k >= 3 ? 2 : 1, volleys: 5, gapMs: 700, perVolley: 3, spreadDeg: 14, shot: shotOf(t.b, 16, 190) } },
];

/** The last word's moves (Nightmare, last 9 %): a slow four-arm spiral with single shots from its points, then gapped rings over a counter spiral. */
const lastSteps = (t: ShotTypes, points: Points): CardStepDef[] => [
  {
    telegraphMs: 1000,
    recoverMs: 1600,
    pattern: { kind: 'spiral', arms: 4, everyMs: 240, durationMs: 3000, turnDegPerShot: 9, shot: shotOf(t.a, 14, 88) },
    layers: [{ kind: 'turrets', points, atOnce: 2, volleys: 4, gapMs: 1000, perVolley: 1, spreadDeg: 0, shot: shotOf(t.b, 16, 200) }],
  },
  {
    telegraphMs: 800,
    recoverMs: 1600,
    pattern: { kind: 'rings', rings: 4, perRing: 18, gap: 4, gapTurnDeg: 30, gapMs: 600, shot: shotOf(t.a, 15, 100) },
    layers: [{ kind: 'spiral', arms: 2, everyMs: 300, durationMs: 2400, turnDegPerShot: -15, shot: shotOf(t.b, 12, 75) }],
  },
];

/**
 * A Senda boss: the shadow of a Pokémon (its sheet, drawn in the eclipse's
 * corruption), its types (a shadow does not fly: a winged boss trades its
 * Flying type for Ghost, so the line can always reach it), its signature
 * cards in order, and its arena.
 */
export interface StoryBossDef {
  /** Species id, prefixed by its line (`cubone-mandibuzz`); a wound ends in `-wound`. */
  id: string;
  sprite: keyof typeof SPRITE_KEYS;
  types: readonly PokemonType[];
  maxHp: number;
  radius: number;
  shots: ShotTypes;
  /** Its signature cards: three for a mid-boss, four for a wound (the fourth arrives on Hard). */
  cards: readonly CardTemplate[];
  /** Turret points (the arena's corners by default). */
  points?: Points;
  /** HP in its fight as a share of what its species and tier give it, per tier (the kill margin's knob). */
  hpScale: Tier4<number>;
  /** A wound: the line's last boss (two more cards per tier than a mid-boss, and the phase-2 bloom). */
  wound?: true;
}

const FIGHT = { aggroRange: 900, breakMs: 1200, phase2BreakMs: 1800, walkSpeed: 55, keepDistance: 110 } as const;
const POWER: Tier4<number> = [0.9, 1, 1.12, 1.22];
const MAX_SHOTS: Tier4<number> = [80, 100, 120, 140];

/** The signature cards a tier plays: a mid-boss 2, 2, 3 and 3; a wound 2, 3, 4 and 4 (its fourth from Hard). */
const signatureCount = (boss: StoryBossDef, k: Tier): number => (boss.wound ? [2, 3, 4, 4] : [2, 2, 3, 3])[k]!;

const cardId = (boss: StoryBossDef, name: string): `sc-${string}` => `sc-${boss.id}-${name}`;
/** i18n keys: `spell.story.<boss>.<card>` (the banner) and `boss.stance.sc-<boss>-<card>` (its short name). */
export const spellKey = (bossId: string, name: string): string => `spell.story.${bossId}.${name}`;

/** A boss's fight on one tier: its signature cards (equal HP shares), a survival card from Hard, its last word on Nightmare. */
function fightOf(boss: StoryBossDef, k: Tier): CardFightDef {
  const points = boss.points ?? CORNERS;
  const signature = boss.cards.slice(0, signatureCount(boss, k));
  const last = k === 3 ? 0.09 : 0;
  const share = (1 - last) / signature.length;
  const cards: SpellCardDef[] = signature.map((template, i) => ({
    id: cardId(boss, template),
    nameKey: spellKey(boss.id, template),
    hpShare: share,
    timerMs: i < 2 ? 35_000 : 40_000,
    restMs: 600,
    ...(boss.wound && template === 'bloom' ? { phase2: true as const } : {}),
    steps: stepsOf(template, k, boss.shots, points),
  }));
  if (k >= 2) {
    // The survival card comes after the third signature card (a wound's fourth follows it).
    cards.splice(3, 0, { id: cardId(boss, 'survival'), nameKey: spellKey(boss.id, 'survival'), hpShare: 0, timerMs: 15_000, survival: true, restMs: 500, steps: survivalSteps(k, boss.shots, points) });
  }
  if (k === 3) cards.push({ id: cardId(boss, 'last'), nameKey: spellKey(boss.id, 'last'), hpShare: last, timerMs: 35_000, lastSpell: true, restMs: 600, steps: lastSteps(boss.shots, points) });
  return registerCards({ ...FIGHT, maxShots: MAX_SHOTS[k], power: POWER[k], hpScale: boss.hpScale[k], cards });
}

/** A boss's four fights, Easy to Nightmare. */
export const fightsOf = (boss: StoryBossDef): Tier4<CardFightDef> => [fightOf(boss, 0), fightOf(boss, 1), fightOf(boss, 2), fightOf(boss, 3)];

/** The card names a boss needs in the i18n (its signature cards, survival and last word). */
export const cardNamesOf = (boss: StoryBossDef): string[] => [...boss.cards, 'survival', 'last'];

/**
 * A Senda boss's arena: about one screen big, four pillars to hide behind
 * (cover, like the throne room's), the boss in the upper middle; a mid-boss's
 * has the way on at the top once it falls.
 */
export const bossArena = (id: RoomId, species: string, wayOn: boolean): RoomDef => ({
  id,
  width: 800,
  height: 640,
  obstacles: [
    { x: 172, y: 150, width: 56, height: 56, cover: true },
    { x: 572, y: 150, width: 56, height: 56, cover: true },
    { x: 172, y: 400, width: 56, height: 56, cover: true },
    { x: 572, y: 400, width: 56, height: 56, cover: true },
  ],
  playerStart: { x: 400, y: 540 },
  spawns: [{ species: species as RoomDef['spawns'][number]['species'], x: 400, y: 220 }],
  exit: wayOn ? { x: 360, y: 0, width: 80, height: 50 } : null,
  next: null,
});
