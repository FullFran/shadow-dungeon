import { AEGISLASH, ENEMY_BEHAVIOUR, type ArcherDef, type SlammerDef, type ThiefDef } from '../data/enemies';
import { TUNING } from '../data/tuning';
import { contactPlayer, replaceEnemy } from './brain';
import { isRosterDef, rosterAttack } from './roster';
import { bladeBlow, midnightAttack } from './boss';
import { worldDifficulty } from './difficulty';
import type { Difficulty } from '../data/difficulty';
import { stealItem } from './stolen';
import { burstActive, burstTouches } from './thief';
import { cardDef, danmakuMelee } from './danmaku';
import { behaviourFor } from './tricks';
import { isSwampDef, swampAttack } from './swamp-brains';
import { floodPockets, hazePockets } from './swamp-bosses';
import type { Arena, EnemyState, GameEvent, WorldState } from './state';
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

/** A tank's ground slam: anywhere within `radius` of its body. */
export const slamTouches = (enemy: EnemyState, player: Vec2, radius: number): boolean => distance(enemy.pos, player) <= radius + PLAYER_RADIUS;

/** A slammer's hit: the ring around it, or only the frontal sector along the locked aim (Golett). */
export function slammerTouches(enemy: EnemyState, player: Vec2, def: Pick<SlammerDef, 'radius' | 'arcDegrees'>): boolean {
  if (!slamTouches(enemy, player, def.radius)) return false;
  if (def.arcDegrees === undefined) return true;
  const offset = sub(player, enemy.pos);
  return length(offset) <= enemy.radius + PLAYER_RADIUS || angleBetween(enemy.ai.attackDir, offset) <= (def.arcDegrees * DEG) / 2;
}

/** Sableye's slash: body contact with a little reach. */
export const thiefTouches = (enemy: EnemyState, player: Vec2, def: ThiefDef): boolean => distance(enemy.pos, player) <= enemy.radius + PLAYER_RADIUS + def.blink.reach;

/** Decidueye's dive: body contact with the dive's extra reach. */
export const diveTouches = (enemy: EnemyState, player: Vec2, def: ArcherDef): boolean => distance(enemy.pos, player) <= enemy.radius + PLAYER_RADIUS + def.dive.reach;

/** Aegislash's shield bash: body contact with a small margin. */
export const bashTouches = (enemy: EnemyState, player: Vec2): boolean => distance(enemy.pos, player) <= enemy.radius + PLAYER_RADIUS + 4;

/** The current blow of Aegislash's blade combo: reach and arc along the committed attack direction. */
export function bladeTouches(enemy: EnemyState, player: Vec2): boolean {
  const blow = bladeBlow(enemy.boss?.comboIndex ?? 0);
  const offset = sub(player, enemy.pos);
  const reach = length(offset) <= blow.range + PLAYER_RADIUS;
  const inArc = length(offset) <= enemy.radius || angleBetween(enemy.ai.attackDir, offset) <= (blow.arcDegrees * DEG) / 2;
  return reach && inArc;
}

/** Where a positional (`pierceRoll`) wind-up will land, for its own telegraph: a circle around the enemy, a sweeping wall, the attack's own shape, the arena lanes the forest bosses mark (Trevenant's roots, Decidueye's rain), or a marked circle elsewhere (a danmaku zone `at: 'target'`). */
export type PierceZone =
  | { kind: 'circle'; radius: number }
  | { kind: 'wall' }
  | { kind: 'shape' }
  | { kind: 'lanes' }
  /** A marked circle away from the enemy (Dhelmise's riptide: where it will surface; Nihilego's wormhole mouth). */
  | { kind: 'mark'; center: Vec2; radius: number }
  /** The whole arena but a few safe pockets (Salazzle's haze, Nihilego's flood): the edges mark the pockets to walk into. */
  | { kind: 'pockets'; centers: readonly Vec2[]; radius: number };

/**
 * The positional attack this enemy is winding up (or throwing) at tier `d`,
 * if any: Aegislash's Shadow and Judgement walls and (hard+) Midnight,
 * Sableye's gem burst, Trevenant's roots and Decidueye's arrow rain, and any
 * other enemy whose attack data says `pierceRoll`.
 */
export function pierceZone(enemy: EnemyState, d: Difficulty, arena: Pick<Arena, 'width' | 'height'> = { width: 0, height: 0 }): PierceZone | null {
  const def = ENEMY_BEHAVIOUR[enemy.species];
  const live = enemy.alive && (enemy.ai.mode === 'telegraph' || enemy.ai.mode === 'attack');
  if (!def || !live) return null;
  const stance = enemy.boss?.stance;
  if (def.kind === 'boss') {
    if (stance === 'shadow' || stance === 'judgement') return def.phase2.shadow.sword.pierceRoll ? { kind: 'wall' } : null;
    if (stance === 'midnight') return midnightAttack(def, d).pierceRoll ? { kind: 'circle', radius: def.phase2.midnight.radius } : null;
    return null;
  }
  if (def.kind === 'thief') return stance === 'gems' && (enemy.ai.mode === 'telegraph' || burstActive(enemy, def)) && def.gems.burst.attack.pierceRoll ? { kind: 'circle', radius: def.gems.burst.radius } : null;
  if (def.kind === 'treant') return stance === 'roots' && def.roots.spike.pierceRoll ? { kind: 'lanes' } : null;
  if (def.kind === 'archer') return stance === 'rain' && def.phase2.rain.arrow.pierceRoll ? { kind: 'lanes' } : null;
  if (def.kind === 'danmaku') {
    // The caves' and swamp's bullet-hell bosses: a sweep is a circle of its reach around the boss; a zone at the boss or on its mark.
    const p = stance ? cardDef(behaviourFor(enemy.species, d) as typeof def, stance)?.pattern : undefined;
    if (p?.kind === 'sweep') return p.attack.pierceRoll ? { kind: 'circle', radius: p.radius } : null;
    if (p?.kind === 'zone' && p.attack.pierceRoll) return p.at === 'self' ? { kind: 'circle', radius: p.radius } : { kind: 'mark', center: enemy.ai.aimPoint ?? enemy.pos, radius: p.radius };
    return null;
  }
  // The swamp's bosses: the haze and the flood leave pockets (they need the arena); the wormhole bites around its mouth.
  if (def.kind === 'queen') return stance === 'haze' && enemy.ai.aimPoint && def.haze.attack.pierceRoll ? { kind: 'pockets', centers: hazePockets(arena, enemy.ai.aimPoint), radius: def.haze.pocketRadius } : null;
  if (def.kind === 'ultra') {
    if (stance === 'flood' && enemy.ai.aimPoint && def.flood.attack.pierceRoll) return { kind: 'pockets', centers: floodPockets(arena, enemy.ai.aimPoint), radius: def.flood.pocketRadius };
    if (stance === 'wormhole' && def.wormhole.attack.pierceRoll) return { kind: 'mark', center: enemy.ai.mode === 'telegraph' ? (enemy.ai.aimPoint ?? enemy.pos) : enemy.pos, radius: def.wormhole.radius };
    return null;
  }
  if (isRosterDef(def)) return rosterAttack(enemy, def, enemy.pos)?.attack.pierceRoll ? { kind: 'shape' } : null;
  if (def.kind === 'slammer') return def.attack.pierceRoll ? { kind: 'circle', radius: def.radius } : null;
  if (def.kind === 'lunger') return def.attack.pierceRoll ? { kind: 'shape' } : null;
  return null;
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
    if (!def || def.kind === 'caster' || def.kind === 'spore') continue;
    let hit;
    // Impidimp's sidestep and Shroomish in the air never touch.
    if (def.kind === 'lunger' && enemy.ai.attack === 'sidestep') continue;
    if (def.kind === 'slammer' && def.leap && enemy.ai.modeMs < def.leap.airMs) continue;
    if (def.kind === 'lunger') hit = contactPlayer(current, enemy, def.attack, lungeTouches(enemy, current.player.pos), events);
    else if (def.kind === 'slammer') hit = contactPlayer(current, enemy, def.attack, slammerTouches(enemy, current.player.pos, def), events);
    else if (def.kind === 'thief') {
      // The Glint slash touches (and steals), and the gem burst as the first ring leaves; the rings are projectiles.
      if (burstActive(enemy, def)) {
        hit = contactPlayer(current, enemy, def.gems.burst.attack, burstTouches(enemy, current.player.pos, def), events);
        if (hit.contact !== enemy.ai.contact) current = replaceEnemy(hit.state, { ...enemy, ai: { ...enemy.ai, contact: hit.contact } });
        continue;
      }
      if (enemy.boss?.stance !== 'glint') continue;
      hit = contactPlayer(current, enemy, def.blink.attack, thiefTouches(enemy, current.player.pos, def), events);
      if (hit.contact === 'hit') hit = { ...hit, state: { ...hit.state, player: stealItem(hit.state.player, enemy.id, def.stealMs, events) } };
    }
    else if (def.kind === 'treant') {
      // Only the slam touches; roots, leaves and curses are projectiles.
      if (enemy.boss?.stance !== 'slam') continue;
      hit = contactPlayer(current, enemy, def.slam.attack, slamTouches(enemy, current.player.pos, def.slam.radius), events);
    } else if (def.kind === 'archer') {
      // Only the dive touches; arrows and leaves are projectiles.
      if (enemy.boss?.stance !== 'dive') continue;
      hit = contactPlayer(current, enemy, def.dive.attack, diveTouches(enemy, current.player.pos, def), events);
    } else if (def.kind === 'danmaku') {
      // Only the anchor sweep and the bursting zones touch; bubbles, sparks and kelp are projectiles.
      const active = danmakuMelee(enemy, behaviourFor(enemy.species, worldDifficulty(current)) as typeof def, current.player.pos);
      if (!active) continue;
      hit = contactPlayer(current, enemy, active.attack, active.touches, events);
    } else if (isSwampDef(def)) {
      const active = swampAttack(current.arena, enemy, behaviourFor(enemy.species, worldDifficulty(current)) as typeof def, current.player.pos);
      if (!active) continue;
      hit = contactPlayer(current, enemy, active.attack, active.touches, events);
    } else if (isRosterDef(def)) {
      const active = rosterAttack(enemy, def, current.player.pos);
      if (!active) continue;
      hit = contactPlayer(current, enemy, active.attack, active.touches, events);
    } else if (enemy.boss?.stance === 'midnight') {
      hit = contactPlayer(current, enemy, midnightAttack(def, worldDifficulty(current)), slamTouches(enemy, current.player.pos, def.phase2.midnight.radius), events);
    } else if (enemy.boss && enemy.boss.stance !== 'shield' && enemy.boss.stance !== 'blade') {
      // Oaths and Shadow only throw (projectiles); the unsheathing never attacks.
      continue;
    } else if (enemy.boss?.stance === 'blade') {
      const blow = bladeBlow(enemy.boss.comboIndex, def);
      hit = contactPlayer(current, enemy, blow.attack, bladeTouches(enemy, current.player.pos), events);
    } else hit = contactPlayer(current, enemy, def.shield.bash, bashTouches(enemy, current.player.pos), events);
    if (hit.contact === enemy.ai.contact) continue;
    current = replaceEnemy(hit.state, { ...enemy, ai: { ...enemy.ai, contact: hit.contact } });
  }
  return current;
}
