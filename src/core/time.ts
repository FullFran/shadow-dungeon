import { TUNING } from '../data/tuning';
import type { WorldState } from './state';

/** Time scale for enemies and their projectiles: slowed during perfect-dodge slow-mo. */
export function enemyTimeScale(state: WorldState): number {
  return state.slowMoMs > 0 ? TUNING.perfectDodge.slowMoScale : 1;
}
