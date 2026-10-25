import { DUNGEON } from '../data/dungeon';
import { ENEMY_BEHAVIOUR } from '../data/enemies';
import { enterMode } from './brain';
import { insideRect } from './geometry';
import { illusionActive, touchesUnderIllusion } from './passives';
import type { EnemyState, PlayerState, WorldState } from './state';
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
  if (enemy.wakeRoom && insideRect(player, enemy.wakeRoom)) return true;
  if (distance(enemy.pos, player) > DUNGEON.wakeRadius) return false;
  return !state.arena.tiles || lineOfSight(state.arena.tiles, enemy.pos, player);
}

function shouldWake(state: WorldState, enemy: EnemyState): boolean {
  if (enemy.hp < enemy.maxHp) return true;
  const players: PlayerState[] = [state.player, ...state.remotes.map((r) => r.player)];
  return players.some((p) => p.hp > 0 && wokenBy(state, enemy, p.pos, illusionActive(p)));
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
