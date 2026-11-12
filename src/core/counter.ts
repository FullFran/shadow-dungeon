import type { Difficulty } from '../data/difficulty';
import { TUNING } from '../data/tuning';
import type { EnemyState, IncomingHit, PlayerState, ProjectileState } from './state';
import { distance, dot, length, normalize, scale, sub, type Vec2 } from './vec';

/**
 * The counterstep (Contrapaso; docs/gdd.md §9, odd/tasks/perilous-counter.md):
 * a perilous (`pierceRoll`) attack is one the roll's i-frames do not avoid,
 * but rolling INTO it counters it when the hit lands within a short window
 * from the roll's start (shorter on harder tiers). Countered: no damage, the
 * shot is destroyed, and the attacker is staggered and struck like a perfect
 * dodge's reward. Mistimed (late, or rolling away): the full hit as before.
 * Pure: hits.ts decides, combat.ts strikes; every peer decides for its own
 * player (victim side), and a guest's strike is a claim like any other hit.
 */
const COUNTER = TUNING.counter;
const PLAYER_RADIUS = TUNING.player.radius;

/** How long after a roll starts a perilous hit may land and still be countered, at tier `d`. */
export const counterWindowMs = (d: Difficulty): number => COUNTER.windowMs[d];

/** Whether `hit`, landing now on `player`, is countered: a counterable perilous hit, inside the window, met head on. */
export function countersHit(player: Pick<PlayerState, 'pos' | 'roll'>, hit: IncomingHit, d: Difficulty): boolean {
  if (!hit.pierceRoll || !hit.counter || !hit.from || !player.roll) return false;
  if (player.roll.elapsedMs > counterWindowMs(d)) return false;
  const toward = sub(hit.from, player.pos);
  if (length(toward) === 0 || length(player.roll.dir) === 0) return false;
  return dot(normalize(player.roll.dir), normalize(toward)) >= Math.cos((COUNTER.maxAngleDeg * Math.PI) / 180);
}

/** A strike can be countered only within reach of its attacker's body: a zone landing away from it is ground, not a strike. */
export const strikeInReach = (player: Vec2, enemy: Pick<EnemyState, 'pos' | 'radius'>): boolean =>
  distance(player, enemy.pos) <= enemy.radius + PLAYER_RADIUS + COUNTER.meleeReachPx;

/**
 * Who fired `shot`, as any peer can tell from its world (no shooter travels on
 * the wire): of the living enemies behind the shot, a boss first, then the
 * one closest to its line of flight, then the nearest. Null when none is (a
 * still shot has no line; nothing to strike back).
 */
export function shotShooter(shot: Pick<ProjectileState, 'pos' | 'vel'>, enemies: readonly EnemyState[]): EnemyState | null {
  if (length(shot.vel) === 0) return null;
  const back = scale(normalize(shot.vel), -1);
  let best: { enemy: EnemyState; key: [number, number, number] } | null = null;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const rel = sub(enemy.pos, shot.pos);
    const along = dot(rel, back);
    if (along <= 0) continue;
    const off = length(sub(rel, scale(back, along)));
    const key: [number, number, number] = [enemy.boss ? 0 : 1, Math.round(off), Math.round(along)];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) best = { enemy, key };
  }
  return best?.enemy ?? null;
}
