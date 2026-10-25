import { AEGISLASH, ENEMY_BEHAVIOUR } from '../data/enemies';
import { TUNING } from '../data/tuning';
import { contactPlayer, replaceEnemy } from './brain';
import type { EnemyState, GameEvent, WorldState } from './state';
import { distance, dot, length, normalize, sub, type Vec2 } from './vec';

/**
 * Enemy melee hitboxes against one player position, shared by the host's
 * brains and a guest's victim-side check (docs/gdd.md §12): every peer checks
 * enemy attacks only against its own player, so a roll that dodged on screen
 * always dodged.
 */
const PLAYER_RADIUS = TUNING.player.radius;
const DEG = Math.PI / 180;

function angleBetween(a: Vec2, b: Vec2): number {
  const cos = dot(normalize(a), normalize(b));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/** Poochyena's lunge: body contact. */
export const lungeTouches = (enemy: EnemyState, player: Vec2): boolean => distance(enemy.pos, player) <= enemy.radius + PLAYER_RADIUS;

/** Aegislash's shield bash: body contact with a small margin. */
export const bashTouches = (enemy: EnemyState, player: Vec2): boolean => distance(enemy.pos, player) <= enemy.radius + PLAYER_RADIUS + 4;

/** The current blow of Aegislash's blade combo: reach and arc along the committed attack direction. */
export function bladeTouches(enemy: EnemyState, player: Vec2): boolean {
  const blow = AEGISLASH.blade.combo[enemy.boss?.comboIndex ?? 0]!;
  const offset = sub(player, enemy.pos);
  const reach = length(offset) <= blow.range + PLAYER_RADIUS;
  const inArc = length(offset) <= enemy.radius || angleBetween(enemy.ai.attackDir, offset) <= (blow.arcDegrees * DEG) / 2;
  return reach && inArc;
}

/**
 * Guest side: the melee attacks in progress (from host snapshots, see
 * sync.ts) land on the local player, once per attack. Casters hit with
 * projectiles, which combat.ts already checks against the local player.
 */
export function guestEnemyContacts(state: WorldState, events: GameEvent[]): WorldState {
  let current = state;
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.ai.mode !== 'attack' || enemy.ai.contact !== 'none' || enemy.hitstunMs > 0) continue;
    const def = ENEMY_BEHAVIOUR[enemy.species];
    if (!def || def.kind === 'caster') continue;
    let hit;
    if (def.kind === 'lunger') hit = contactPlayer(current, enemy, def.attack, lungeTouches(enemy, current.player.pos), events);
    else if (enemy.boss?.stance === 'blade') {
      const blow = def.blade.combo[enemy.boss.comboIndex]!;
      hit = contactPlayer(current, enemy, blow.attack, bladeTouches(enemy, current.player.pos), events);
    } else hit = contactPlayer(current, enemy, def.shield.bash, bashTouches(enemy, current.player.pos), events);
    if (hit.contact === enemy.ai.contact) continue;
    current = replaceEnemy(hit.state, { ...enemy, ai: { ...enemy.ai, contact: hit.contact } });
  }
  return current;
}
