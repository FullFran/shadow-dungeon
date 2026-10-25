import { TUNING } from '../data/tuning';
import type { WorldState } from './state';

/**
 * Time scale for enemies and their projectiles: slowed during perfect-dodge
 * slow-mo, solo only. In a shared run (a guest, or a host with other players
 * in the world) the enemies are the same for everyone, so one player's
 * perfect dodge must not slow them for the others: the dodger keeps the
 * flash, sound, tint and next-hit buff, the enemies keep their pace.
 */
export function enemyTimeScale(state: WorldState): number {
  const shared = state.role === 'guest' || state.remotes.length > 0;
  return state.slowMoMs > 0 && !shared ? TUNING.perfectDodge.slowMoScale : 1;
}
