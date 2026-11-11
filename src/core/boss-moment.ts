import { PHASE_STANCES } from '../data/boss-lore';
import { TUNING } from '../data/tuning';
import { showsBar } from './boss';
import { spellOf } from './cards';
import type { EnemyState, WorldState } from './state';

/**
 * The two moments of a boss fight the player must not miss: it changes phase (it recovers its strength and
 * changes its attacks) and it falls for good. Pure: read from two consecutive worlds, so the host, a solo run
 * and a guest (whose world comes from host snapshots, where `boss.phase` is not sent but the stance is) all
 * see the same moment.
 */
export interface BossMoment {
  kind: 'phase' | 'finale';
  enemyId: string;
  species: string;
  /** The stance that names a phase change (never set for a finale). */
  stance?: string;
}

const isPhaseStance = (stance: string | undefined): boolean => stance !== undefined && (PHASE_STANCES as readonly string[]).includes(stance);

/** The first boss of `after` that changed phase or fell since `before`, if any (a phase change wins over a finale). */
export function bossMoment(before: WorldState, after: WorldState): BossMoment | null {
  let finale: BossMoment | null = null;
  for (const enemy of after.enemies) {
    if (!showsBar(enemy)) continue;
    const was: EnemyState | undefined = before.enemies.find((e) => e.id === enemy.id);
    if (!was?.alive) continue;
    if (!enemy.alive) {
      finale ??= { kind: 'finale', enemyId: enemy.id, species: enemy.species };
      continue;
    }
    const stance = enemy.boss?.stance;
    const entered = stance !== undefined && stance !== was.boss?.stance && isPhaseStance(stance);
    const awakened = was.boss?.phase !== 2 && enemy.boss?.phase === 2 && spellOf(enemy.boss) === undefined;
    if (entered || awakened) return { kind: 'phase', enemyId: enemy.id, species: enemy.species, stance: isPhaseStance(stance) ? stance! : 'awaken' };
  }
  return finale;
}

/** The slow-down the host gives its enemies after a boss moment (time.ts `enemyTimeScale`: solo only, so a shared run's pace stays the same for everyone). */
export const momentSlowMoMs = (moment: BossMoment | null): number => (moment ? TUNING.bossMoment.slowMoMs : 0);
