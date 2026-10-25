import type { SpawnTuning } from '../data/dungeon';
import type { DungeonDef } from '../data/dungeons';
import type { EndlessDef } from '../data/endless';
import type { UpgradeLevels } from '../data/upgrades';
import type { CoinBreakdown } from './coins';
import { deriveSeed } from './rng';

/**
 * Rules of the endless dungeon (docs/gdd.md §3 "La Sima del Eclipse"),
 * pure: the run clock, enemy scaling by depth, the enemy pool of a depth,
 * the daily seed, modo puro and the scaled-down Pokémonedas.
 */

/** Enemy HP and damage multipliers on a floor (1 on floor 1, rising per floor, capped). */
export interface EnemyScale {
  hp: number;
  damage: number;
  /**
   * A guardian echo's floor: the guardian fights its first phase only
   * (Aegislash never unsheathes in an echo; the echo is shorter and hits
   * harder with depth, and the clock is running).
   */
  echo?: true;
}

export function depthScale(scaling: EndlessDef['scaling'], floor: number, echo = false): EnemyScale {
  const past = Math.max(0, Math.floor(floor) - 1);
  const hp = Math.min(scaling.maxHp, 1 + scaling.hpPerFloor * past);
  const damage = Math.min(scaling.maxDamage, 1 + scaling.damagePerFloor * past);
  return echo ? { hp: hp * scaling.echoHp, damage, echo: true } : { hp, damage };
}

/** The spawn tuning of one endless floor: every pool entry whose `minDepth` is reached, with its weight. */
export function endlessSpawns(endless: Pick<EndlessDef, 'pool' | 'spawns'>, depth: number): SpawnTuning {
  const pool = endless.pool.filter((e) => e.minDepth <= depth && e.weight > 0).map((e) => ({ species: e.species, weights: [e.weight], ...(e.pack ? { pack: e.pack } : {}) }));
  return { ...endless.spawns, pool };
}

/** The clock after `dtMs` more of play: never below 0. */
export const tickClock = (msLeft: number, dtMs: number): number => Math.max(0, msLeft - Math.max(0, dtMs));

/** Time added: never negative, never on a clock that already ran out (the eclipse has swallowed the floor). */
export const addTime = (msLeft: number, bonusMs: number): number => (msLeft <= 0 ? 0 : msLeft + Math.max(0, bonusMs));

/** Time gained on entering floor `floor` (2 and deeper): shrinking with depth, down to a minimum. */
export const descendBonusMs = (clock: EndlessDef['clock'], floor: number): number =>
  floor < 2 ? 0 : Math.max(clock.descendMinMs, clock.descendMs - clock.descendShrinkMs * (floor - 2));

/**
 * Whether the run clock stands still this frame: only a paused solo run
 * (Esc menu, item pick, a cinematic); a shared run never pauses, so its
 * clock never does either.
 */
export const clockPaused = (state: { shared: boolean; menuOpen: boolean; pickOpen: boolean; cinematic?: boolean }): boolean =>
  !state.shared && (state.menuOpen || state.pickOpen || state.cinematic === true);

/** "YYYY-MM-DD" of a time in UTC: the day of the daily challenge, the same everywhere on Earth. */
export const utcDateKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const DAILY_SALT = 0xec1195e;

/** The daily challenge's seed: a function of the UTC date only (a positive 31-bit integer). */
export function dailySeed(dateKey: string): number {
  const digits = Number.parseInt(dateKey.replace(/\D/g, '').slice(0, 8), 10);
  return deriveSeed(Number.isFinite(digits) ? digits : 0, DAILY_SALT) >>> 1;
}

/** The two ways into the endless dungeon: the daily challenge (everyone gets the day's layout) or a free run. */
export type EndlessMode = 'daily' | 'free';

/** The modes in the order the entry card and the host's Enter rows show them. */
export const ENDLESS_MODES: readonly EndlessMode[] = ['daily', 'free'];

/** The run seed of a mode: the UTC day's for the daily challenge, `randomSeed` for a free run. */
export const endlessSeed = (mode: EndlessMode, dateKey: string, randomSeed: number): number => (mode === 'daily' ? dailySeed(dateKey) : randomSeed);

/** Which mode a seed plays on a day (a guest only receives the host's seed): the day's seed is the daily challenge. */
export const modeOfSeed = (seed: number, dateKey: string): EndlessMode => (seed === dailySeed(dateKey) ? 'daily' : 'free');

/** Modo puro: the shop's permanent upgrades do not reach a pure dungeon's runs (other dungeons keep them). */
export const runUpgrades = (dungeon: Pick<DungeonDef, 'endless'>, upgrades: UpgradeLevels | undefined): UpgradeLevels | undefined =>
  dungeon.endless?.pure ? undefined : upgrades;

/** The Pokémonedas of a run scaled by `scale` (the endless dungeon pays less): the multiplier line shows it. */
export function scaleCoins(coins: CoinBreakdown, scale: number): CoinBreakdown {
  if (scale === 1) return coins;
  const multiplier = coins.multiplier * scale;
  return { ...coins, multiplier, total: Math.floor(coins.subtotal * coins.share * multiplier) };
}

/** "7:59", "0:05": minutes and seconds left, rounded up so 0:00 only shows once time is out. */
export function clockText(msLeft: number): string {
  const seconds = Math.ceil(Math.max(0, msLeft) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
