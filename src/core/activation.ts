import { DUNGEON } from '../data/dungeon';
import { ENEMY_BEHAVIOUR } from '../data/enemies';
import { enterMode } from './brain';
import { insideRect } from './geometry';
import { presentPlayers } from './party';
import type { EnemyState, WorldState } from './state';
import { lineOfSight } from './tiles';
import { distance, type Vec2 } from './vec';

/**
 * Floor enemies sleep until a player enters their room, comes within
 * `DUNGEON.wakeRadius` with a clear line of sight, or hits them. Once awake
 * they hunt for good (casters keep their distance band, walkers close in).
 */
function wokenBy(state: WorldState, enemy: EnemyState, player: Vec2): boolean {
  if (enemy.wakeRoom && insideRect(player, enemy.wakeRoom)) return true;
  if (distance(enemy.pos, player) > DUNGEON.wakeRadius) return false;
  return !state.arena.tiles || lineOfSight(state.arena.tiles, enemy.pos, player);
}

function shouldWake(state: WorldState, enemy: EnemyState): boolean {
  if (enemy.hp < enemy.maxHp) return true;
  return presentPlayers(state).some((p) => wokenBy(state, enemy, p.pos));
}

export function wakeEnemies(state: WorldState): WorldState {
  if (!state.enemies.some((e) => e.alive && e.ai.mode === 'asleep')) return state;
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.alive || enemy.ai.mode !== 'asleep' || !shouldWake(state, enemy)) return enemy;
    const mode = ENEMY_BEHAVIOUR[enemy.species]?.kind === 'caster' ? 'reposition' : 'approach';
    return { ...enemy, ai: enterMode(enemy.ai, mode) };
  });
  return { ...state, enemies };
}
