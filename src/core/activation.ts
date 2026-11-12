import { DUNGEON } from '../data/dungeon';
import type { DisguiseDef } from '../data/crypt-enemies';
import { ENEMY_BEHAVIOUR } from '../data/enemies';
import type { SpeciesId } from '../data/species';
import { enterMode } from './brain';
import { insideRect } from './geometry';
import { illusionActive, touchesUnderIllusion } from './passives';
import type { AiMode, EnemyState, PlayerState, WorldState } from './state';
import { lineOfSight } from './tiles';
import { distance, type Vec2 } from './vec';

/**
 * Floor enemies sleep until a player enters their room, comes within
 * `DUNGEON.wakeRadius` with a clear line of sight, or hits them. Once awake
 * they hunt for good (casters keep their distance band, walkers close in).
 * A player under Illusion (Zorua) is only noticed by touch.
 */
function wokenBy(state: WorldState, enemy: EnemyState, player: Vec2, hidden: boolean): boolean {
  if (hidden) return touchesUnderIllusion(enemy, distance(enemy.pos, player));
  // A mimic (Yamask) passes for decor: only a player right beside it wakes it, never entering its room.
  const disguise = disguiseOf(enemy.species);
  if (disguise) return distance(enemy.pos, player) <= disguise.wakeRadius;
  if (enemy.wakeRoom && insideRect(player, enemy.wakeRoom)) return true;
  if (distance(enemy.pos, player) > DUNGEON.wakeRadius) return false;
  return !state.arena.tiles || lineOfSight(state.arena.tiles, enemy.pos, player);
}

function shouldWake(state: WorldState, enemy: EnemyState): boolean {
  if (enemy.hp < enemy.maxHp) return true;
  const players: PlayerState[] = [state.player, ...state.remotes.map((r) => r.player)];
  return players.some((p) => p.hp > 0 && wokenBy(state, enemy, p.pos, illusionActive(p)));
}

/** A mimic's disguise (data/crypt-enemies.ts), if its species has one. */
export function disguiseOf(species: SpeciesId): DisguiseDef | undefined {
  const def = ENEMY_BEHAVIOUR[species];
  return def && 'disguise' in def ? def.disguise : undefined;
}

/** The mode a woken enemy hunts in: casters keep their distance band, walkers close in. */
export const huntMode = (species: SpeciesId): AiMode => (ENEMY_BEHAVIOUR[species]?.kind === 'caster' ? 'reposition' : 'approach');

/**
 * Wakes one sleeping enemy: it hunts at once, or, a mimic, first rises from
 * its disguise (a short `wake` wind-up, core/enemies.ts `risen`).
 */
export function wakeEnemy(enemy: EnemyState): EnemyState {
  const disguise = disguiseOf(enemy.species);
  if (disguise) return { ...enemy, ai: { ...enterMode(enemy.ai, 'telegraph', disguise.wakeMs), attack: 'wake' } };
  return { ...enemy, ai: enterMode(enemy.ai, huntMode(enemy.species)) };
}

export function wakeEnemies(state: WorldState): WorldState {
  if (!state.enemies.some((e) => e.alive && e.ai.mode === 'asleep')) return state;
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.alive || enemy.ai.mode !== 'asleep' || !shouldWake(state, enemy)) return enemy;
    return wakeEnemy(enemy);
  });
  return { ...state, enemies };
}
