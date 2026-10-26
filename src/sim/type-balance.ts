import type { CardFightDef } from '../data/cards';
import { CHALLENGES, guardianOf } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import type { RoomId } from '../data/rooms';
import { SPECIES, type SpeciesId } from '../data/species';
import { TUNING } from '../data/tuning';
import { TYPE_CHART, type PokemonType } from '../data/types';
import { cardFloorShare } from '../core/cards';
import { stageBonus } from '../core/evolution';
import { expectedLevel } from '../core/fairness';
import { damageRate, effectFactor, extraShare } from '../core/move-power';
import { levelDamage } from '../core/progression';
import { rankedMove } from '../core/rank-effects';
import { loadRoom } from '../core/rooms';
import { atLevel } from '../core/shrine';
import type { EnemyState, WorldState } from '../core/state';
import { step } from '../core/step';
import { FIXED_DT_MS } from '../core/timestep';
import { RANK_EFFECT } from '../data/tutor';
import { vec } from '../core/vec';
import { createWorld } from '../core/world';
import { createBot, BOT_PROFILES } from './bots';
import { observe } from './observe';
import { bossFloor, CARD_BOSSES, ECHO_BOSSES, fightIn, type BossCase } from './prove';

/**
 * The type-chart study (odd/tasks/type-balance.md, tools/type-balance.ts):
 * how long each playable species takes on each spell card of each card boss,
 * under the shipped chart and under candidate fixes (a compressed chart, a
 * minimum duration per card). Two instruments:
 *
 * - the engine bot: the perfect balance bot (src/sim/bots.ts) plays the whole
 *   fight on the real engine, unkillable, at the floor's expected level (a
 *   Shrine reflection's setup), and every card's end, length and damage by
 *   move type is recorded;
 * - the analytic bound: the build's best fast or heavy move hitting non-stop
 *   (core/move-power.ts damage rate, rank effects included), no dodging.
 *
 * Candidates are applied to the recorded cards: a card's damage rate scales
 * with the candidate's effectiveness over the shipped one, the card ends when
 * its segment is empty (or its timer), never before the floor share of its
 * timer.
 */

/** A type chart by effectiveness level: the net count of super-effective over resisted defender types. */
export interface ChartRule {
  name: string;
  /** Net +1 (one super-effective type). */
  superEffective: number;
  /** Net +2 (both types super-effective): the cap. */
  doubleSuper: number;
  /** Net −1. */
  resisted: number;
  /** Net −2. */
  doubleResisted: number;
}

/** The shipped Gen 6+ chart as levels (×2, ×4, ×0.5, ×0.25). */
export const RAW_RULE: ChartRule = { name: 'Gen 6 (shipped)', superEffective: 2, doubleSuper: 4, resisted: 0.5, doubleResisted: 0.25 };

export const CANDIDATE_RULES: readonly ChartRule[] = [
  RAW_RULE,
  { name: 'A ×1.5 / cap ×2', superEffective: 1.5, doubleSuper: 2, resisted: 0.75, doubleResisted: 0.5 },
  { name: 'B ×1.6 / cap ×2.2', superEffective: 1.6, doubleSuper: 2.2, resisted: 0.75, doubleResisted: 0.5 },
  { name: 'C ×1.4 / cap ×1.8', superEffective: 1.4, doubleSuper: 1.8, resisted: 0.75, doubleResisted: 0.5 },
];

/** Effectiveness of `moveType` on `defender` under `rule`: immunities softened as shipped, the rest by net level. */
export function ruleEffectiveness(rule: ChartRule, moveType: PokemonType, defender: readonly PokemonType[]): number {
  let net = 0;
  let immune = 1;
  for (const d of defender) {
    const m = TYPE_CHART[moveType][d] ?? 1;
    if (m === 0) immune *= TUNING.combat.immunityMultiplier;
    else if (m > 1) net += 1;
    else if (m < 1) net -= 1;
  }
  const level = net >= 2 ? rule.doubleSuper : net === 1 ? rule.superEffective : net === 0 ? 1 : net === -1 ? rule.resisted : rule.doubleResisted;
  return immune * level;
}

/** One species of the study: its final form (or a starter's base form), with Mimikyu's awakenings. */
export interface StudyEntry {
  label: string;
  species: SpeciesId;
  awakened: number;
  final: boolean;
}

export const STUDY_ENTRIES: readonly StudyEntry[] = [
  { label: 'mimikyu', species: 'mimikyu', awakened: 0, final: false },
  { label: 'zorua', species: 'zorua', awakened: 0, final: false },
  { label: 'litwick', species: 'litwick', awakened: 0, final: false },
  { label: 'cubone', species: 'cubone', awakened: 0, final: false },
  { label: 'mimikyu (awakened)', species: 'mimikyu', awakened: 2, final: true },
  { label: 'zoroark', species: 'zoroark', awakened: 0, final: true },
  { label: 'chandelure', species: 'chandelure', awakened: 0, final: true },
  { label: 'marowak', species: 'marowak', awakened: 0, final: true },
  { label: 'alakazam', species: 'alakazam', awakened: 0, final: true },
  { label: 'empoleon', species: 'empoleon', awakened: 0, final: true },
  { label: 'luxray', species: 'luxray', awakened: 0, final: true },
  { label: 'haxorus', species: 'haxorus', awakened: 0, final: true },
];

/** The Sendas' wounds (as tests/sim/wound-prove.test.ts finds them): a challenge whose last arena holds a `-wound` species. */
export const WOUND_BOSSES: readonly BossCase[] = CHALLENGES.flatMap((d) => {
  const species = guardianOf(d);
  const last = [...d.plan].reverse().find((p) => p.kind === 'room' && p.role === undefined);
  if (!species?.endsWith('-wound') || last?.kind !== 'room') return [];
  return [{ species, room: last.room as RoomId, where: { dungeon: d.id, floor: d.plan.length } }];
});

export type BossRole = 'boss' | 'echo' | 'wound';
export const STUDY_CASES: readonly { case: BossCase; role: BossRole }[] = [
  ...CARD_BOSSES.map((c) => ({ case: c, role: 'boss' as const })),
  ...ECHO_BOSSES.map((c) => ({ case: c, role: 'echo' as const })),
  ...WOUND_BOSSES.map((c) => ({ case: c, role: 'wound' as const })),
];

export const caseLabel = (c: BossCase): string => c.label ?? c.species;

/** default: the default loadout unranked; full: the best fast and heavy moves on this boss, rank +2; stab: the same restricted to the species' own types (the owner's Chandelure). */
export type BuildKind = 'default' | 'full' | 'stab';

export interface Build {
  kind: BuildKind;
  loadout: readonly (MoveId | null)[];
  ranks: Partial<Record<MoveId, number>>;
}

const FULL_RANK = 2;

/** Raw damage per second of `move` at `rank` (rank damage and effects included), before STAB, type and the player's multipliers. */
export function moveRate(id: MoveId, rank: number): number {
  const move: MoveDef = rankedMove(id, rank);
  return damageRate(move) * 1000 * effectFactor(move) * (1 + extraShare(move)) * (1 + RANK_EFFECT.damage * rank) * TUNING.combat.damagePerPower;
}

/** Damage per second of `id` for `entry` on `boss` under `rule`, at `level`, non-stop (the analytic bound). */
export function moveDps(entry: StudyEntry, id: MoveId, rank: number, boss: SpeciesId, rule: ChartRule, level: number): number {
  const move = MOVES[id];
  const def = SPECIES[entry.species];
  const stab = def.types.includes(move.type) ? TUNING.combat.stab : 1;
  const stage = 1 + stageBonus(entry.species, 1, entry.awakened).damage;
  return moveRate(id, rank) * stab * ruleEffectiveness(rule, move.type, SPECIES[boss].types) * levelDamage(level) * stage;
}

/** The default build: the species' default loadout, no Mejoras. Full: its best fast and heavy moves on this boss (any tier), everything at rank +2. */
export function buildFor(entry: StudyEntry, kind: BuildKind, boss: SpeciesId): Build {
  const def = SPECIES[entry.species];
  if (kind === 'default') return { kind, loadout: def.defaultLoadout, ranks: {} };
  const best = (slot: MoveDef['slot']): MoveId | null => {
    let out: MoveId | null = null;
    let top = -1;
    for (const id of def.movepool) {
      if (MOVES[id].slot !== slot || (kind === 'stab' && !def.types.includes(MOVES[id].type))) continue;
      const dps = moveDps(entry, id, FULL_RANK, boss, RAW_RULE, 1);
      if (dps > top) {
        top = dps;
        out = id;
      }
    }
    return out;
  };
  const loadout = [best('fast') ?? def.defaultLoadout[0]!, best('heavy') ?? def.defaultLoadout[1]!, def.defaultLoadout[2] ?? null, def.defaultLoadout[3] ?? null];
  const ranks = Object.fromEntries(loadout.filter((m): m is MoveId => m !== null).map((m) => [m, FULL_RANK]));
  return { kind, loadout, ranks };
}

/** The level a Shrine reflection (and the proof) gives the player for this boss and tier. */
export const levelFor = (c: BossCase, tier: Difficulty): number => {
  const where = c.where ?? bossFloor(c.room);
  return expectedLevel(where.dungeon, where.floor, tier);
};

/** The analytic bound: best of the build's fast and heavy moves, non-stop. */
export function analyticDps(entry: StudyEntry, build: Build, boss: SpeciesId, rule: ChartRule, level: number): { dps: number; move: MoveId } {
  let top = { dps: 0, move: build.loadout[0]! };
  for (const id of build.loadout.slice(0, 2)) {
    if (!id) continue;
    const dps = moveDps(entry, id, build.ranks[id] ?? 0, boss, rule, level);
    if (dps > top.dps) top = { dps, move: id };
  }
  return top;
}

/** One card as the engine bot played it. */
export interface CardRun {
  card: string;
  timerMs: number;
  survival: boolean;
  lastSpell: boolean;
  segmentHp: number;
  /** Play time of the card (declaration excluded). */
  durationMs: number;
  outcome: 'broken' | 'timeout' | 'survived' | 'unfinished';
  /** HP the boss lost during the card (the segment, when broken). */
  drop: number;
  /** Damage the bot's hits dealt, by move type (to re-weigh it under another chart). */
  byType: Partial<Record<PokemonType, number>>;
}

export interface FightRecord {
  boss: string;
  tier: Difficulty;
  entry: string;
  build: BuildKind;
  loadout: readonly (MoveId | null)[];
  level: number;
  cleared: boolean;
  /** From the first declaration to the boss's fall (or the run's end). */
  fightMs: number;
  /** Declarations between cards. */
  declareMs: number;
  cards: CardRun[];
}

const bossOf = (s: WorldState, species: SpeciesId): EnemyState | undefined => s.enemies.find((e) => e.species === species && e.boss);

/** The arena of a Shrine reflection for `entry` with `build`: the room's own start, the expected level, an unkillable player. */
export function studyWorld(c: BossCase, tier: Difficulty, seed: number, entry: StudyEntry, build: Build): WorldState {
  let s = loadRoom(
    createWorld({ seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: tier, species: entry.species, loadout: build.loadout, moveRanks: build.ranks, awakened: entry.awakened }),
    c.room,
  );
  if (c.prepare) s = c.prepare(s);
  const level = levelFor(c, tier);
  const player = atLevel(s.player, level);
  return { ...s, referenceLevel: level, player: { ...player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
}

/** Plays a whole fight with the perfect bot (four slots) and records every card. */
export function runFight(c: BossCase, tier: Difficulty, seed: number, entry: StudyEntry, kind: BuildKind): FightRecord {
  const build = buildFor(entry, kind, c.species);
  let s = studyWorld(c, tier, seed, entry, build);
  const fight: CardFightDef = fightIn(s, c.species)!;
  const totalTimer = fight.cards.reduce((sum, k) => sum + k.timerMs + fight.phase2BreakMs, 0);
  const bot = createBot('perfect', seed * 31 + 7, BOT_PROFILES.perfect, { slots: true });
  const cards: CardRun[] = [];
  let byType: Partial<Record<PokemonType, number>> = {};
  let started: number | null = null;
  let declareMs = 0;
  const limit = s.timeMs + totalTimer + 60_000;
  const fallbackType = MOVES[build.loadout[0]!].type;
  while (s.timeMs < limit) {
    const before = bossOf(s, c.species);
    if (!before?.alive) break;
    const input = bot.decide(observe(s), { exit: null });
    const after = step(s, input, FIXED_DT_MS);
    const boss = bossOf(after, c.species);
    if (started === null && boss?.boss?.card !== undefined) started = s.timeMs;
    if (boss?.alive && boss.ai.mode === 'transform' && boss.boss?.card !== undefined) declareMs += FIXED_DT_MS;
    // A hit that empties the last segment fells the boss in combat, before its card engine can end the card: that card is broken too.
    const felled = !boss?.alive && !after.events.some((e) => e.type === 'spellCardEnd' && e.enemyId === before.id) && before.boss?.card !== undefined;
    const ends = after.events.flatMap((e) => (e.type === 'spellCardEnd' && e.enemyId === before.id ? [{ card: e.card as string, outcome: e.outcome }] : []));
    if (felled) ends.push({ card: fight.cards[before.boss!.card!]!.id, outcome: 'broken' });
    for (const e of after.events) {
      if (e.type === 'enemyHit' && e.enemyId === before.id && e.damage > 0) {
        const t = e.moveId ? MOVES[e.moveId].type : fallbackType;
        byType = { ...byType, [t]: (byType[t] ?? 0) + e.damage };
      }
    }
    for (const e of ends) {
      const index = fight.cards.findIndex((k) => k.id === e.card);
      const card = fight.cards[index]!;
      const share = card.hpShare / fight.cards.reduce((sum, k) => sum + k.hpShare, 0);
      const startHp = before.maxHp * (index === 0 ? 1 : cardFloorShare(fight, index - 1));
      const segmentHp = before.maxHp * share;
      const hpAfter = before.hp;
      cards.push({
        card: card.id,
        timerMs: card.timerMs,
        survival: card.survival === true,
        lastSpell: card.lastSpell === true,
        segmentHp,
        durationMs: (before.boss?.cardMs ?? 0) + FIXED_DT_MS,
        outcome: e.outcome,
        drop: e.outcome === 'broken' ? segmentHp : Math.max(0, startHp - hpAfter),
        byType,
      });
      byType = {};
    }
    s = after;
  }
  const boss = bossOf(s, c.species);
  return {
    boss: caseLabel(c),
    tier,
    entry: entry.label,
    build: kind,
    loadout: build.loadout,
    level: levelFor(c, tier),
    cleared: !boss?.alive,
    fightMs: s.timeMs - (started ?? 0),
    declareMs,
    cards,
  };
}

/** A candidate fix: a chart rule and a minimum duration per card (share of its timer; 0 = none). */
export interface Candidate {
  rule: ChartRule;
  floor: number;
  /** A floor per tier instead of `floor` (tiers left out use `floor`). */
  floorByTier?: Partial<Record<Difficulty, number>>;
  /** Human model: every card's own time (before the floor and the timer) is this many times the bot's (1 = the bot). */
  slow?: number;
}

/** The floor share `candidate` gives a card on `tier`. */
export const floorOf = (candidate: Candidate, tier: Difficulty): number => candidate.floorByTier?.[tier] ?? candidate.floor;

/** How long a recorded card lasts under `candidate`: its damage re-weighed by the rule, never under the floor, never past its timer. */
export function cardUnder(run: CardRun, candidate: Candidate, bossTypes: readonly PokemonType[], tier: Difficulty, recorded: ChartRule = RAW_RULE): number {
  if (run.survival) return run.timerMs;
  const hit = Object.values(run.byType).reduce((sum, d) => sum + (d ?? 0), 0);
  let ratio = 1;
  if (hit > 0) {
    let scaled = 0;
    for (const [t, d] of Object.entries(run.byType) as [PokemonType, number][]) scaled += d * (ruleEffectiveness(candidate.rule, t, bossTypes) / ruleEffectiveness(recorded, t, bossTypes));
    ratio = scaled / hit;
  }
  const rate = (run.drop / Math.max(1, run.durationMs)) * ratio;
  const raw = rate > 0 ? (run.segmentHp / rate) * (candidate.slow ?? 1) : Number.POSITIVE_INFINITY;
  return Math.min(run.timerMs, Math.max(raw, floorOf(candidate, tier) * run.timerMs));
}

/** The analytic bound of a card under `candidate`. */
export function cardBound(segmentHp: number, timerMs: number, survival: boolean, dps: number, floor: number): number {
  if (survival) return timerMs;
  const raw = dps > 0 ? (segmentHp / dps) * 1000 : Number.POSITIVE_INFINITY;
  return Math.min(timerMs, Math.max(raw, floor * timerMs));
}
