import type { Difficulty } from '../data/difficulty';
import { dungeonById, type DungeonId } from '../data/dungeons';
import { TUNING } from '../data/tuning';
import type { FloorResult, RunResult } from './runner';
import type { SweepResults } from './sweep';

/**
 * Target bands of the balance harness (docs/souls-difficulty-research.md P5, P7).
 *
 * Two kinds of band:
 * - **Fairness invariants** (`severity: 'fail'`): properties of the content
 *   that no bot skill can excuse: the biggest hit, telegraph floors, wind-ups
 *   at once, threats from off screen, hits with no warning. A violation fails
 *   CI, unless it is a recorded known violation (`KNOWN_VIOLATIONS`, a ratchet:
 *   fix the content, then delete the entry).
 * - **Performance bands** (`severity: 'warn'`): how bots fare (clear rates,
 *   boss TTK, HP lost per floor, tiers ordering). They only report, because
 *   the bots are stand-ins and the current content was never tuned to them.
 */
export type Severity = 'fail' | 'warn';
export type Status = 'pass' | 'warn' | 'fail';

export interface BandCheck {
  band: BandId;
  severity: Severity;
  /** Where it was measured: `dungeon/tier`, `dungeon/tier/bot/party`, or with the arena floor. */
  scope: string;
  status: Status;
  /** What was measured (the worst case for invariants). */
  value: string;
  target: string;
  /** Why a fairness violation is tolerated for now (a `KNOWN_VIOLATIONS` entry). */
  known?: string;
}

export type BandId =
  | 'max-hit'
  | 'telegraph-floor'
  | 'choice-telegraph-floor'
  | 'simultaneous-telegraphs'
  | 'unseen-threats'
  | 'blind-hits'
  | 'average-clears-easy'
  | 'boss-ttk'
  | 'hp-loss-per-floor'
  | 'nightmare-harder'
  | 'perfect-clears-nightmare'
  | 'perfect-never-dies';

const TICK_MS = 1000 / TUNING.ticksPerSecond;

/** The numbers. Telegraph floors allow one tick of measuring slack (events land on ticks). */
export const BANDS = {
  maxHitShare: 0.35,
  telegraphFloorMs: 280,
  choiceTelegraphFloorMs: 400,
  simultaneous: { default: 2, nightmare: 3 } as const,
  unseenAtOnce: 1,
  blindHits: 0,
  averageClearsEasy: 0.8,
  bossTtkSec: [45, 150] as const,
  hpLossPerFloor: { easy: 0.25, normal: 0.35, hard: 0.5, nightmare: 0.65 } as Readonly<Record<Difficulty, number>>,
  perfectClearsNightmare: 0.8,
} as const;

export const SEVERITY: Readonly<Record<BandId, Severity>> = {
  'max-hit': 'fail',
  'telegraph-floor': 'fail',
  'choice-telegraph-floor': 'fail',
  'simultaneous-telegraphs': 'fail',
  'unseen-threats': 'fail',
  'blind-hits': 'fail',
  'average-clears-easy': 'warn',
  'boss-ttk': 'warn',
  'hp-loss-per-floor': 'warn',
  'nightmare-harder': 'warn',
  'perfect-clears-nightmare': 'warn',
  'perfect-never-dies': 'warn',
};

export interface KnownViolation {
  band: BandId;
  dungeon: DungeonId;
  reason: string;
}

/**
 * Fairness violations of the current content, recorded by the first sweep
 * (2026-10-25, see reports/balance/latest.md). Each one is tolerated as a
 * WARN until the content is fixed; a violation not listed here fails CI.
 */
const SIMULTANEOUS = 'every awake enemy of a floor winds up at the player at once (no attack tokens yet, P5.3)';
const UNSEEN = 'awake walkers and casters start wind-ups off screen (no off-screen limit yet, P5.1)';
export const KNOWN_VIOLATIONS: readonly KnownViolation[] = [
  { band: 'simultaneous-telegraphs', dungeon: 'crypt-of-the-sword-king', reason: SIMULTANEOUS },
  { band: 'unseen-threats', dungeon: 'crypt-of-the-sword-king', reason: UNSEEN },
  { band: 'simultaneous-telegraphs', dungeon: 'misty-forest', reason: `${SIMULTANEOUS}; worst on fog floors (up to 8)` },
  { band: 'unseen-threats', dungeon: 'misty-forest', reason: UNSEEN },
  { band: 'blind-hits', dungeon: 'misty-forest', reason: 'hits with under 280 ms of on-screen warning, mostly in the Trevenant and Decidueye arenas (to inspect: arrows entering the screen late)' },
  { band: 'simultaneous-telegraphs', dungeon: 'flooded-caves', reason: `${SIMULTANEOUS}; worst on flood floors (up to 7)` },
  { band: 'unseen-threats', dungeon: 'flooded-caves', reason: UNSEEN },
  { band: 'blind-hits', dungeon: 'flooded-caves', reason: 'hits with under 280 ms of on-screen warning on generated floors (to inspect: shots entering the screen late)' },
  { band: 'max-hit', dungeon: 'flooded-caves', reason: 'Dhelmise on nightmare hits a level-1 starter (100 HP, isolated arena) for 36 %: no cap on tier-scaled damage yet (P5.6)' },
  { band: 'simultaneous-telegraphs', dungeon: 'toxic-swamp', reason: `${SIMULTANEOUS}; worst on gas floors` },
  { band: 'unseen-threats', dungeon: 'toxic-swamp', reason: UNSEEN },
  { band: 'blind-hits', dungeon: 'toxic-swamp', reason: 'one hit with under 280 ms of warning in the Nihilego arena on normal' },
  { band: 'simultaneous-telegraphs', dungeon: 'eclipse-chasm', reason: `${SIMULTANEOUS}; mixed squads` },
  { band: 'unseen-threats', dungeon: 'eclipse-chasm', reason: UNSEEN },
  { band: 'blind-hits', dungeon: 'eclipse-chasm', reason: 'hits with under 280 ms of warning on deep generated floors (F9)' },
  { band: 'telegraph-floor', dungeon: 'eclipse-chasm', reason: 'wind-ups of 200–217 ms from normal up: suspected Sima elites whose pace (swift, enrage) runs the AI clock past the telegraph floor' },
  { band: 'max-hit', dungeon: 'eclipse-chasm', reason: 'the floor-5 Aegislash echo on nightmare hits a level-1 starter for 36 %: depth × tier damage has no hit cap yet (P5.6)' },
];

interface Where {
  label: string;
}

/** Floor label for tables: `F3 sableye`, `F2 collapse`, `F1`. */
export const floorLabel = (f: Pick<FloorResult, 'floor' | 'boss' | 'kind'>): string => `F${f.floor}${f.boss ? ` ${f.boss}` : f.kind !== 'normal' && f.kind !== 'room' ? ` ${f.kind}` : ''}`;

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const sec = (ms: number): string => `${(ms / 1000).toFixed(0)} s`;
export const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** A run reached the end it could: the guardian down, or (the endless Sima) the sweep's last floor. */
export const runCleared = (r: RunResult): boolean => r.outcome === 'victory' || (r.outcome === 'depth' && dungeonById(r.scenario.dungeon).endless !== undefined);

function group<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Every floor of the sweep with its scenario (runs and isolated arenas). */
function floorsOf(sweep: SweepResults): { s: RunResult['scenario']; f: FloorResult; arena: boolean }[] {
  return [...sweep.runs.flatMap((r) => r.floors.map((f) => ({ s: r.scenario, f, arena: false }))), ...sweep.arenas.map((a) => ({ s: a.scenario, f: a.result, arena: true }))];
}

/** Evaluates every band on a sweep. */
export function evaluate(sweep: SweepResults, known: readonly KnownViolation[] = KNOWN_VIOLATIONS): BandCheck[] {
  const checks: BandCheck[] = [];
  const push = (band: BandId, scope: string, dungeon: DungeonId, ok: boolean, value: string, target: string) => {
    const severity = SEVERITY[band];
    if (ok) return checks.push({ band, severity, scope, status: 'pass', value, target });
    if (severity === 'warn') return checks.push({ band, severity, scope, status: 'warn', value, target });
    const k = known.find((v) => v.band === band && v.dungeon === dungeon);
    return checks.push({ band, severity, scope, status: k ? 'warn' : 'fail', value, target, ...(k ? { known: k.reason } : {}) });
  };

  // Fairness invariants, per dungeon and tier, over every bot, party and floor.
  const floors = floorsOf(sweep);
  for (const [scope, list] of group(floors, (x) => `${x.s.dungeon}/${x.s.tier}`)) {
    const { dungeon, tier } = list[0]!.s;
    const worst = <T>(pick: (f: FloorResult) => T | null, better: (a: T, b: T) => boolean): { v: T; at: Where } | null => {
      let out: { v: T; at: Where } | null = null;
      for (const { f } of list) {
        const v = pick(f);
        if (v !== null && (!out || better(v, out.v))) out = { v, at: { label: floorLabel(f) } };
      }
      return out;
    };
    const hit = worst((f) => f.maxHitShare, (a, b) => a > b);
    push('max-hit', scope, dungeon, !hit || hit.v <= BANDS.maxHitShare, hit ? `${pct(hit.v)} (${hit.at.label})` : 'no hits', `≤ ${pct(BANDS.maxHitShare)} of max HP`);
    const tel = worst((f) => (f.telegraphMs.length ? Math.min(...f.telegraphMs) : null), (a, b) => a < b);
    push('telegraph-floor', scope, dungeon, !tel || tel.v >= BANDS.telegraphFloorMs - TICK_MS, tel ? `${tel.v.toFixed(0)} ms (${tel.at.label})` : 'none', `≥ ${BANDS.telegraphFloorMs} ms`);
    const choice = worst((f) => (f.choiceTelegraphMs.length ? Math.min(...f.choiceTelegraphMs) : null), (a, b) => a < b);
    push('choice-telegraph-floor', scope, dungeon, !choice || choice.v >= BANDS.choiceTelegraphFloorMs - TICK_MS, choice ? `${choice.v.toFixed(0)} ms (${choice.at.label})` : 'none', `≥ ${BANDS.choiceTelegraphFloorMs} ms (positional)`);
    const limit = tier === 'nightmare' ? BANDS.simultaneous.nightmare : BANDS.simultaneous.default;
    const sim = worst((f) => f.maxSimultaneousTelegraphs, (a, b) => a > b);
    push('simultaneous-telegraphs', scope, dungeon, !sim || sim.v <= limit, sim ? `${sim.v} (${sim.at.label})` : '0', `≤ ${limit} at once`);
    const unseen = worst((f) => f.maxSimultaneousUnseen, (a, b) => a > b);
    push('unseen-threats', scope, dungeon, !unseen || unseen.v <= BANDS.unseenAtOnce, unseen ? `${unseen.v} at once (${unseen.at.label})` : '0', `≤ ${BANDS.unseenAtOnce} at once`);
    const blind = list.reduce((n, x) => n + x.f.blindHits, 0);
    const blindAt = worst((f) => (f.blindHits > 0 ? f.blindHits : null), (a, b) => a > b);
    push('blind-hits', scope, dungeon, blind <= BANDS.blindHits, blindAt ? `${blind} (most: ${blindAt.at.label})` : '0', `${BANDS.blindHits}`);
    // The perfect bot never dies (if it does, a pattern may be unavoidable, or the bot is not perfect enough).
    const deaths = list.filter((x) => x.s.bot === 'perfect' && x.f.outcome === 'died');
    if (list.some((x) => x.s.bot === 'perfect'))
      push('perfect-never-dies', scope, dungeon, deaths.length === 0, deaths.length ? `${deaths.length} deaths (${[...new Set(deaths.map((x) => floorLabel(x.f)))].join(', ')})` : '0 deaths', '0 deaths');
  }

  // Performance bands.
  for (const [scope, runs] of group(sweep.runs, (r) => `${r.scenario.dungeon}/${r.scenario.tier}/${r.scenario.bot}/p${r.scenario.party}`)) {
    const { dungeon, tier, bot } = runs[0]!.scenario;
    const share = runs.filter(runCleared).length / runs.length;
    if (bot === 'average' && tier === 'easy') push('average-clears-easy', scope, dungeon, share >= BANDS.averageClearsEasy, `${pct(share)} of ${runs.length}`, `≥ ${pct(BANDS.averageClearsEasy)}`);
    if (bot === 'perfect' && tier === 'nightmare') push('perfect-clears-nightmare', scope, dungeon, share >= BANDS.perfectClearsNightmare, `${pct(share)} of ${runs.length}`, `≥ ${pct(BANDS.perfectClearsNightmare)}`);
    if (bot === 'average') {
      const loss = median(runs.flatMap((r) => r.floors.map((f) => f.damage / f.maxHp)));
      const band = BANDS.hpLossPerFloor[tier];
      push('hp-loss-per-floor', scope, dungeon, loss <= band, `median ${pct(loss)}`, `≤ ${pct(band)}`);
    }
  }
  for (const [scope, arenas] of group(
    sweep.arenas.filter((a) => a.scenario.bot === 'average' && a.scenario.party === 1),
    (a) => `${a.scenario.dungeon}/${a.scenario.tier}/average/p1/${floorLabel(a.result)}`,
  )) {
    const dungeon = arenas[0]!.scenario.dungeon;
    const times = arenas.map((a) => a.result.bossTtkMs).filter((t): t is number => t !== null);
    const [lo, hi] = BANDS.bossTtkSec;
    const ttk = median(times);
    const ok = times.length > 0 && ttk >= lo * 1000 && ttk <= hi * 1000;
    push('boss-ttk', scope, dungeon, ok, times.length ? `median ${sec(ttk)} (${times.length}/${arenas.length} felled)` : `not felled (0/${arenas.length})`, `${lo}–${hi} s`);
  }
  // Nightmare is harder than easy for the average bot: more HP lost per floor, or fewer clears.
  for (const [key, runs] of group(sweep.runs.filter((r) => r.scenario.bot === 'average'), (r) => `${r.scenario.dungeon}/p${r.scenario.party}`)) {
    const easy = runs.filter((r) => r.scenario.tier === 'easy');
    const nightmare = runs.filter((r) => r.scenario.tier === 'nightmare');
    if (!easy.length || !nightmare.length) continue;
    const lossOf = (rs: RunResult[]) => median(rs.flatMap((r) => r.floors.map((f) => f.damage / f.maxHp)));
    const clearOf = (rs: RunResult[]) => rs.filter(runCleared).length / rs.length;
    const harder = lossOf(nightmare) > lossOf(easy) || clearOf(nightmare) < clearOf(easy);
    const [dungeon, party] = key.split('/') as [DungeonId, string];
    push('nightmare-harder', `${dungeon}/easy→nightmare/average/${party}`, dungeon, harder, `HP lost ${pct(lossOf(easy))} → ${pct(lossOf(nightmare))}, clears ${pct(clearOf(easy))} → ${pct(clearOf(nightmare))}`, 'more HP lost or fewer clears');
  }
  return checks;
}

export const failures = (checks: readonly BandCheck[]): BandCheck[] => checks.filter((c) => c.status === 'fail');
