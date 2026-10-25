import { AEGISLASH, ENEMY_BEHAVIOUR } from '../data/enemies';
import { MOVES, type MoveId } from '../data/moves';
import type { PokemonType } from '../data/types';
import { bladeBlow } from '../core/boss';
import { playerStats } from '../core/items';
import type { EnemyState, PlayerState, ProjectileState } from '../core/state';
import type { Vec2 } from '../core/vec';
import { TYPE_COLORS, type TypeColors } from '../ui/tokens';

/**
 * Visual effects of attacks, coloured by move type (`TYPE_COLORS`): what the
 * player's moves look like on the ground (fading swing arcs, 360 rings, dash
 * trails, multi-hit swipe marks), projectile looks per type and move, and
 * the type tint of enemy telegraphs. `playerVfx` is pure (what to draw);
 * the draw functions are thin canvas code.
 */

/** After the active window a swing's mark lingers this long, fading out. */
export const VFX_TAIL_MS = 140;

export type PlayerVfx =
  | { kind: 'arc'; type: PokemonType; dir: Vec2; radius: number; arcDegrees: number; alpha: number }
  | { kind: 'ring'; type: PokemonType; radius: number; alpha: number }
  | { kind: 'trail'; type: PokemonType; dir: Vec2; length: number; width: number; alpha: number }
  | { kind: 'swipe'; type: PokemonType; dir: Vec2; reach: number; index: number; alpha: number };

/** `#rrggbb` with an alpha, as a canvas colour. */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/**
 * What the player's current move leaves on the ground: nothing before the
 * active window; during it and for `VFX_TAIL_MS` after, an arc, a ring, a
 * dash trail and one swipe mark per multi-hit part so far, fading out.
 */
export function playerVfx(player: Pick<PlayerState, 'action' | 'items' | 'upgrades' | 'level'>): PlayerVfx[] {
  const action = player.action;
  if (!action || (action.phase !== 'active' && action.phase !== 'recovery')) return [];
  const move = MOVES[action.moveId];
  const stats = playerStats(player);
  const activeMs = move.activeMs * stats.actionTime;
  const progress = action.phase === 'active' ? Math.min(1, action.phaseMs / Math.max(1, activeMs)) : 1;
  const tail = action.phase === 'recovery' ? action.phaseMs / VFX_TAIL_MS : 0;
  if (tail >= 1) return [];
  // Full while active, then fades over the tail.
  const alpha = action.phase === 'active' ? 1 - 0.3 * progress : 0.7 * (1 - tail);
  const size = (move.charge?.[action.chargeLevel]?.sizeMultiplier ?? 1) * stats.reach;
  const { type } = move;
  const dir = action.aimDir;
  const out: PlayerVfx[] = [];
  const hitbox = move.hitbox;
  if (hitbox.kind === 'arc' && hitbox.arcDegrees >= 360) {
    // The ring sweeps out to its reach during the active window.
    out.push({ kind: 'ring', type, radius: hitbox.range * size * (0.35 + 0.65 * progress), alpha });
  } else if (hitbox.kind === 'arc') {
    out.push({ kind: 'arc', type, dir, radius: hitbox.range * size, arcDegrees: hitbox.arcDegrees, alpha });
  } else if (hitbox.kind === 'dash') {
    out.push({ kind: 'trail', type, dir, length: hitbox.distance * progress, width: hitbox.radius * size * 1.6, alpha });
  }
  if (move.multiHit && move.multiHit > 1 && hitbox.kind !== 'projectile') {
    const reach = hitbox.kind === 'arc' ? hitbox.range * size : hitbox.radius * size * 1.4;
    const parts = action.phase === 'active' ? (action.hitWindow ?? 0) + 1 : move.multiHit;
    for (let index = 0; index < parts; index++) out.push({ kind: 'swipe', type, dir, reach, index, alpha });
  }
  return out;
}

/**
 * Type of the attack an enemy is winding up or throwing, for its telegraph
 * tint: read from its behaviour (Hoothoot is Normal/Flying but dives as
 * Flying; Foongus is Grass/Poison but its cloud is Poison), Decidueye's from
 * the spell card it is playing; species without a behaviour use their first type.
 */
export function enemyAttackType(enemy: Pick<EnemyState, 'species' | 'types' | 'boss'> & { ai?: Pick<EnemyState['ai'], 'attack'> }): PokemonType {
  const def = ENEMY_BEHAVIOUR[enemy.species];
  switch (def?.kind) {
    case 'boss': {
      const stance = enemy.boss?.stance;
      if (stance === 'midnight') return AEGISLASH.phase2.midnight.attack.type;
      if (stance === 'oaths') return AEGISLASH.phase2.oaths.blade.type;
      if (stance === 'shadow' || stance === 'judgement') return AEGISLASH.phase2.shadow.sword.type;
      if (stance !== 'blade') return AEGISLASH.shield.bash.type;
      const blow = bladeBlow(enemy.boss?.comboIndex ?? 0);
      return blow.attack.type;
    }
    case 'archer': {
      const card = enemy.boss?.stance;
      if (card === 'fan') return def.fan.leaf.type;
      if (card === 'dive') return def.dive.attack.type;
      return def.volley.arrow.type;
    }
    case 'thief':
      return enemy.boss?.stance === 'gems' ? def.gems.gem.type : def.blink.attack.type;
    case 'lunger':
    case 'slammer':
      return def.attack.type;
    case 'caster':
      return def.projectile.type;
    case 'spore':
      return def.cloud.type;
    case 'beam':
    case 'pulse':
    case 'cone':
    case 'mortar':
      return def.attack.type;
    case 'bomber':
      return enemy.ai?.attack === 'explode' ? def.explode.attack.type : def.cloud.type;
    case 'counter':
      return enemy.ai?.attack === 'jab' ? def.jab.attack.type : def.counter.attack.type;
    default:
      return enemy.types[0] ?? 'normal';
  }
}

/** Ground fill of an enemy telegraph (winding) or strike, tinted by its attack type; the red warning edge is drawn on top by the renderer. */
export function telegraphFill(type: PokemonType, winding: boolean): string {
  const colours = TYPE_COLORS[type];
  return winding ? withAlpha(colours.glow, 0.24) : withAlpha(colours.core, 0.5);
}

const DEG = Math.PI / 180;

/** Draws the player's move effects on the ground layer, around `pos`. */
export function drawPlayerVfx(ctx: CanvasRenderingContext2D, vfx: readonly PlayerVfx[], pos: Vec2, timeMs: number): void {
  for (const v of vfx) {
    const c = TYPE_COLORS[v.type];
    if (v.kind === 'arc') {
      const angle = Math.atan2(v.dir.y, v.dir.x);
      const half = (v.arcDegrees * DEG) / 2;
      ctx.fillStyle = withAlpha(c.glow, 0.32 * v.alpha);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, v.radius, angle - half, angle + half);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(c.core, 0.9 * v.alpha);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, v.radius - 1.5, angle - half, angle + half);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(c.edge, 0.8 * v.alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, v.radius + 0.5, angle - half, angle + half);
      ctx.stroke();
    } else if (v.kind === 'ring') {
      ctx.fillStyle = withAlpha(c.glow, 0.18 * v.alpha);
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, v.radius, v.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(c.core, 0.95 * v.alpha);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, v.radius, v.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(c.edge, 0.9 * v.alpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, v.radius + 2, v.radius * 0.6 + 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (v.kind === 'trail') {
      // Afterimages fading towards where the dash started.
      const steps = 6;
      for (let i = steps; i >= 1; i--) {
        const f = i / steps;
        const at = { x: pos.x - v.dir.x * v.length * f, y: pos.y - v.dir.y * v.length * f };
        ctx.fillStyle = withAlpha(i % 2 === 0 ? c.core : c.glow, 0.5 * v.alpha * (1 - f * 0.8));
        ctx.beginPath();
        ctx.ellipse(at.x, at.y - 6, (v.width / 2) * (1 - f * 0.5), (v.width / 2) * 0.55 * (1 - f * 0.5), Math.atan2(v.dir.y, v.dir.x), 0, Math.PI * 2);
        ctx.fill();
      }
      if (v.length > 2) {
        ctx.strokeStyle = withAlpha(c.edge, 0.7 * v.alpha);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pos.x - v.dir.x * v.length, pos.y - 6 - v.dir.y * v.length);
        ctx.lineTo(pos.x, pos.y - 6);
        ctx.stroke();
      }
    } else {
      // A claw/bone swipe: a short slash across the front, alternating its tilt per part.
      const angle = Math.atan2(v.dir.y, v.dir.x);
      const tilt = (v.index % 2 === 0 ? 1 : -1) * 0.9;
      const centre = { x: pos.x + Math.cos(angle) * v.reach * 0.7, y: pos.y - 6 + Math.sin(angle) * v.reach * 0.7 };
      const half = v.reach * 0.45;
      const slash = angle + Math.PI / 2 + tilt * 0.5;
      const dx = Math.cos(slash) * half;
      const dy = Math.sin(slash) * half;
      const shift = (v.index - 1) * 3;
      ctx.strokeStyle = withAlpha(c.edge, 0.9 * v.alpha);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centre.x - dx + shift, centre.y - dy);
      ctx.lineTo(centre.x + dx + shift, centre.y + dy);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(c.glow, v.alpha);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  void timeMs;
}

/**
 * Look of an enemy shot: a still shot is a spore cloud (Poison puffs with
 * Grass specks: Foongus, Koffing, Grimer's sludge) or a puddle in its type
 * colours (Slugma's lava, Wooper's mud), Bug threads, Ghost arrows and Grass leaves are
 * streaks in their type colours; anything else (Gastly's Poison ball) keeps
 * the orb of `drawProjectileVfx` (null).
 */
export type EnemyShotLook = { kind: 'streak'; colors: TypeColors } | { kind: 'cloud'; puff: string; speck: string; edge: string };

const STREAK_TYPES: readonly PokemonType[] = ['bug', 'ghost', 'grass', 'flying', 'steel'];

export function enemyShotLook(p: Pick<ProjectileState, 'type' | 'vel'>): EnemyShotLook | null {
  if (p.vel.x === 0 && p.vel.y === 0) {
    // Poison keeps Foongus' spore look; other still shots are puddles in their type colours (lava, mud, water).
    if (p.type === 'poison') return { kind: 'cloud', puff: TYPE_COLORS.poison.core, speck: TYPE_COLORS.grass.glow, edge: TYPE_COLORS.poison.edge };
    const c = TYPE_COLORS[p.type];
    return { kind: 'cloud', puff: c.core, speck: c.glow, edge: c.edge };
  }
  return STREAK_TYPES.includes(p.type) ? { kind: 'streak', colors: TYPE_COLORS[p.type] } : null;
}

/** Draws an enemy shot with its look (lifted off the ground; the shadow is the renderer's). */
export function drawEnemyShotVfx(ctx: CanvasRenderingContext2D, look: EnemyShotLook, p: Pick<ProjectileState, 'radius' | 'vel' | 'remainingMs'>, pos: Vec2, timeMs: number): void {
  if (look.kind === 'cloud') {
    const fade = Math.min(1, p.remainingMs / 600);
    for (let i = 0; i < 5; i++) {
      const a = timeMs / 700 + i * 1.3;
      const at = { x: pos.x + Math.cos(a) * p.radius * 0.35, y: pos.y + Math.sin(a) * p.radius * 0.25 };
      ctx.fillStyle = withAlpha(look.puff, 0.45 * fade);
      ctx.beginPath();
      ctx.arc(at.x, at.y, p.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha(look.speck, 0.7 * fade);
      ctx.fillRect(Math.round(at.x + Math.sin(a * 2) * p.radius * 0.4), Math.round(at.y - p.radius * 0.3), 2, 2);
    }
    ctx.strokeStyle = withAlpha(look.edge, 0.5 * fade);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, p.radius, p.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const c = look.colors;
  ctx.save();
  ctx.translate(pos.x, pos.y - 6);
  ctx.rotate(Math.atan2(p.vel.y, p.vel.x));
  ctx.fillStyle = withAlpha(c.glow, 0.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, p.radius * 2.3, p.radius * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.core;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = withAlpha(c.edge, 0.6);
  ctx.fillRect(-p.radius * 1.4, -0.5, p.radius * 2.8, 1);
  ctx.restore();
}

/** Fields a projectile needs to be drawn (remote ones carry no type: they fall back to Ghost). */
export type DrawnProjectile = Pick<ProjectileState, 'owner' | 'radius'> & Partial<Pick<ProjectileState, 'type' | 'moveId' | 'vel'>>;

function orb(ctx: CanvasRenderingContext2D, at: Vec2, radius: number, type: PokemonType, pulse: number): void {
  const c = TYPE_COLORS[type];
  ctx.fillStyle = withAlpha(c.glow, 0.35);
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius * 1.6 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.core;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = type === 'dark' ? 2 : 1;
  ctx.stroke();
  ctx.fillStyle = withAlpha(c.glow, 0.9);
  ctx.beginPath();
  ctx.arc(at.x - radius * 0.3, at.y - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

/** A spinning bone (Bonemerang): a pale shaft with a knob at each end, outlined in the Ground colour. */
function bone(ctx: CanvasRenderingContext2D, at: Vec2, radius: number, timeMs: number): void {
  const c = TYPE_COLORS.ground;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(timeMs / 45);
  const half = radius * 1.3;
  const knob = radius * 0.45;
  ctx.fillStyle = '#f3ead2';
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = 1;
  ctx.fillRect(-half, -knob * 0.55, half * 2, knob * 1.1);
  ctx.strokeRect(-half, -knob * 0.55, half * 2, knob * 1.1);
  for (const end of [-half, half]) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(end, side * knob * 0.6, knob, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Embers falling behind a Fire projectile, flickering. */
function emberTrail(ctx: CanvasRenderingContext2D, at: Vec2, radius: number, vel: Vec2, timeMs: number): void {
  const speed = Math.hypot(vel.x, vel.y);
  if (speed === 0) return;
  const back = { x: -vel.x / speed, y: -vel.y / speed };
  const c = TYPE_COLORS.fire;
  for (let i = 1; i <= 5; i++) {
    const flicker = Math.sin(timeMs / 35 + i * 1.7);
    const d = radius * (0.9 + i * 0.9);
    ctx.fillStyle = withAlpha(i % 2 === 0 ? c.glow : c.core, 0.85 - i * 0.14);
    const size = Math.max(1, radius * (0.75 - i * 0.11) + flicker * 0.6);
    ctx.fillRect(Math.round(at.x + back.x * d + flicker * 1.5 - size / 2), Math.round(at.y + back.y * d - size / 2 - i * 0.6), size, size);
  }
}

/** Draws one projectile in its type's colours (lifted off the ground; the shadow is the renderer's). */
export function drawProjectileVfx(ctx: CanvasRenderingContext2D, p: DrawnProjectile, pos: Vec2, timeMs: number): void {
  const lifted = { x: pos.x, y: pos.y - 6 };
  const type: PokemonType = p.type ?? 'ghost';
  const pulse = 1 + 0.12 * Math.sin(timeMs / 60);
  if (p.moveId === ('bonemerang' satisfies MoveId)) {
    bone(ctx, lifted, p.radius, timeMs);
    return;
  }
  if (type === 'fire' && p.vel) emberTrail(ctx, lifted, p.radius, p.vel, timeMs);
  orb(ctx, lifted, p.radius, type, pulse);
  if (type === 'fire') {
    // A yellow-white heart that flickers.
    ctx.fillStyle = withAlpha('#fff3b0', 0.8 + 0.2 * Math.sin(timeMs / 40));
    ctx.beginPath();
    ctx.arc(lifted.x, lifted.y, p.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}
