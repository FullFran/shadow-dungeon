import { xpScaleOf } from '../data/encounters';
import { PROGRESSION } from '../data/progression';
import type { SpeciesId } from '../data/species';
import { TUNING } from '../data/tuning';
import { leaderXp } from './leaders';
import { gateBonus } from './gates';
import type { EnemyState, GameEvent, PlayerState, WorldState } from './state';
import { upgradeBonuses } from './upgrades';

/**
 * In-run levels (docs/gdd.md §3 "Progresión dentro de la partida"): every
 * defeated enemy gives experience by species and depth; levels add max HP
 * (healed at once) and damage. Mystery Dungeon style, every standing player
 * of a shared run gains the experience of every defeat, so each peer credits
 * its own player: whatever ends an enemy (its own hit, a host-applied claim,
 * a snapshot showing it down, the collapse) pays once per enemy id.
 */
export function xpFor(species: SpeciesId, depth: number): number {
  // Fewer enemies that matter (data/encounters.ts): a floor enemy pays its role's scale on top of its species' experience.
  return PROGRESSION.xpBySpecies[species] * xpScaleOf(species) * (1 + PROGRESSION.xpPerDepth * Math.max(0, depth - 1));
}

/** Experience of one defeated enemy at a depth: its species' (and role's), times a leader's bonus (core/leaders.ts). */
export const enemyXp = (enemy: Pick<EnemyState, 'species' | 'leader'>, depth: number): number => xpFor(enemy.species, depth) * leaderXp(enemy);

const LEVELS = PROGRESSION.levelXp;
export const MAX_LEVEL = LEVELS.length;

/** Level reached with `xp` total experience (1-based, capped). */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= LEVELS[level]!) level++;
  return level;
}

/** Level and how far into it (0..1) `xp` is, for the XP bar; full at the cap. */
export function levelProgress(xp: number): { level: number; fill: number } {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, fill: 1 };
  const from = LEVELS[level - 1]!;
  const to = LEVELS[level]!;
  return { level, fill: (xp - from) / (to - from) };
}

export const levelMaxHp = (level: number): number => TUNING.player.maxHp + PROGRESSION.hpPerLevel * (level - 1);

/** Damage multiplier of a level. */
export const levelDamage = (level: number): number => 1 + PROGRESSION.damagePerLevel * (level - 1);

/** Adds experience; each level reached raises max HP, heals the HP gained and is announced. */
export function gainXp(player: PlayerState, amount: number, events: GameEvent[]): PlayerState {
  const xp = player.xp + amount;
  const level = levelForXp(xp);
  if (level <= player.level) return { ...player, xp };
  for (let reached = player.level + 1; reached <= level; reached++) events.push({ type: 'levelUp', level: reached });
  const gained = levelMaxHp(level) - levelMaxHp(player.level);
  return { ...player, xp, level, maxHp: player.maxHp + gained, hp: player.hp + gained };
}

/**
 * Credits the local player with every enemy of the floor seen down for the
 * first time. A fainted player is credited nothing (a level-up must not
 * revive it), but the enemy still counts as paid. An enemy `spent` by its
 * own blast is never credited: no experience, and so no Pokémonedas.
 */
export function creditDefeats(state: WorldState, events: GameEvent[]): WorldState {
  const fresh = state.enemies.filter((e) => !e.alive && !e.spent && !state.credited.includes(e.id));
  if (fresh.length === 0) return state;
  const credited = [...state.credited, ...fresh.map((e) => e.id)];
  if (state.player.hp <= 0) return { ...state, credited };
  // The Insight upgrade scales every defeat's experience.
  // The floor's gate enemy pays its bonus too (core/gates.ts), unless its gate broke.
  const amount = fresh.reduce((sum, e) => sum + enemyXp(e, state.depth) * gateBonus(state, e), 0) * upgradeBonuses(state.player.upgrades).xpGain;
  return { ...state, credited, player: gainXp(state.player, amount, events) };
}
