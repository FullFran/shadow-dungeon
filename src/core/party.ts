import { ENEMY_BEHAVIOUR } from '../data/enemies';
import { clampParty, partyScaling } from '../data/party-scaling';
import type { SpeciesId } from '../data/species';
import type { EnemyState, WorldState } from './state';
import type { Vec2 } from './vec';

/**
 * The players sharing a world (docs/gdd.md §7): the local one (`state.player`,
 * simulated here) and the remote ones (`state.remotes`, as their peers report
 * them). Solo is just the local player, so every rule below reduces to the
 * single-player one.
 */
export interface PresentPlayer {
  id: string;
  pos: Vec2;
}

/** Players still standing (hp > 0), local first, then remotes by id: enemy targets, wakers and flow origins. */
export function presentPlayers(state: WorldState): PresentPlayer[] {
  const out: PresentPlayer[] = [];
  if (state.player.hp > 0) out.push({ id: state.localId, pos: state.player.pos });
  const remotes = [...state.remotes].filter((r) => r.player.hp > 0).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const remote of remotes) out.push({ id: remote.id, pos: remote.player.pos });
  return out;
}

/**
 * The player an enemy goes for: the nearest present one, ties broken by the
 * lower id so every peer and replay picks the same. With nobody standing it
 * keeps facing the local player (the run is ending anyway).
 */
export function targetOf(state: WorldState, enemy: EnemyState): PresentPlayer {
  let best: PresentPlayer | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of presentPlayers(state)) {
    const dx = candidate.pos.x - enemy.pos.x;
    const dy = candidate.pos.y - enemy.pos.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist || (d === bestDist && best !== null && candidate.id < best.id)) {
      best = candidate;
      bestDist = d;
    }
  }
  return best ?? { id: state.localId, pos: state.player.pos };
}

/** Everyone is down: the shared run is lost (solo: the player fainted). */
export const partyDefeated = (state: WorldState): boolean => state.player.hp <= 0 && state.remotes.every((r) => r.player.hp <= 0);

/**
 * Co-op scaling (docs/gdd.md §8, data/party-scaling.ts). The party size of a
 * floor is fixed when the floor is entered (`WorldState.party`, absent solo):
 * a player who leaves or joins mid-floor changes nothing until the next one,
 * and a fainted player still counts. The host's snapshot carries it, so every
 * peer scales the same.
 */
export const partySizeOf = (state: Pick<WorldState, 'party'>): number => clampParty(state.party ?? 1);

/** Players in the world right now, standing or fainted: the local one and every remote (a floor entry freezes this). */
export const presentPartySize = (state: Pick<WorldState, 'remotes'>): number => clampParty(1 + state.remotes.length);

/** The `party` field of a world entering a floor with `n` players: absent solo, so a solo world is unchanged. */
export const partyField = (n: number): { party?: number } => (clampParty(n) > 1 ? { party: clampParty(n) } : {});

const BOSS_KINDS: ReadonlySet<string> = new Set(['boss', 'archer', 'thief', 'treant', 'danmaku', 'queen', 'ultra', 'eclipse']);

/** Guardians, mid-bosses and echoes (the enemies with boss state): they scale as bosses. */
export const isBossClass = (species: SpeciesId): boolean => BOSS_KINDS.has(ENEMY_BEHAVIOUR[species]?.kind ?? '');

/** Max HP share at spawn of `species` for the floor's party. */
export function partyHpScale(state: Pick<WorldState, 'party'>, species: SpeciesId): number {
  const row = partyScaling(partySizeOf(state));
  return isBossClass(species) ? row.bossHp : row.enemyHp;
}

/** Share of a hit's stagger (hitstun and knockback) the enemy takes: less for a boss in a bigger party. */
export const partyStaggerOf = (state: Pick<WorldState, 'party'>, enemy: Pick<EnemyState, 'species'>): number =>
  isBossClass(enemy.species) ? partyScaling(partySizeOf(state)).bossStagger : 1;

/** Damage share of an enemy hit on a player (victim side): the boss row while a boss-class enemy stands on the floor. */
export function partyDamageScale(state: Pick<WorldState, 'party' | 'enemies'>): number {
  if (partySizeOf(state) <= 1) return 1;
  return state.enemies.some((e) => e.alive && isBossClass(e.species)) ? partyScaling(partySizeOf(state)).bossDamage : 1;
}
