import { AEGISLASH, GASTLY, POOCHYENA } from '../data/enemies';
import { MOVES } from '../data/moves';
import { SPRITES } from '../data/sprites';
import { TUNING } from '../data/tuning';
import { t } from '../i18n';
import type { EnemyState, ProjectileState, Rect, WorldState } from '../core/state';
import type { Vec2 } from '../core/vec';
import { sheetKey, type SheetStore } from './assets';
import { drawHud } from './hud';
import { JUICE, shakeOffset, type FloatingNumber, type JuiceState } from './juice';
import { enemyAnim, playerAnim, type AnimChoice } from './sprite-anim';
import { interpolatedPositions } from './view';

/** Everything one rendered frame needs; the renderer keeps no game state of its own. */
export interface RenderFrame {
  prev: WorldState;
  current: WorldState;
  /** Fraction of a fixed step elapsed since `current` (interpolation). */
  alpha: number;
  juice: JuiceState;
  view: Rect;
  pixelScale: number;
  exit: Rect | null;
  exitOpen: boolean;
  /** Real time, for looping animations. */
  timeMs: number;
  sinceHurtMs: number;
  /** Real time at which each enemy was defeated. */
  defeatedAt: ReadonlyMap<string, number>;
  moving: boolean;
}

const COLORS = {
  floorA: '#1d1a26',
  floorB: '#211d2c',
  wall: '#0d0b12',
  wallEdge: '#3a3350',
  pillarTop: '#4a4360',
  pillarSide: '#2c2740',
  telegraph: 'rgba(255, 70, 70, 0.22)',
  telegraphEdge: 'rgba(255, 90, 90, 0.85)',
  strike: 'rgba(255, 230, 120, 0.45)',
  guard: 'rgba(140, 180, 255, 0.55)',
  transform: 'rgba(200, 160, 255, 0.8)',
  shadow: 'rgba(0, 0, 0, 0.35)',
  lock: '#ff6b9a',
  slowMo: 'rgba(110, 80, 200, 0.18)',
  exitClosed: '#3a3350',
  exitOpen: 'rgba(170, 120, 255, 0.55)',
};

const NUMBER_COLORS: Record<FloatingNumber['style'], string> = {
  super: '#ffb347',
  normal: '#ffffff',
  weak: '#9aa0a6',
  blocked: '#8fb3ff',
  hurt: '#ff5a5a',
};

const TILE = 32;
const DEG = Math.PI / 180;

interface Drawable {
  y: number;
  draw: () => void;
}

export interface Renderer {
  draw(frame: RenderFrame): void;
}

export function createRenderer(canvas: HTMLCanvasElement, sheets: SheetStore): Renderer {
  const ctx = canvas.getContext('2d')!;
  const random = Math.random;

  function drawSprite(choice: AnimChoice, pos: Vec2, alpha = 1): void {
    const meta = SPRITES.sprites[choice.sprite]?.anims[choice.anim];
    const image = meta && sheets.get(sheetKey(choice.sprite, meta.file));
    if (!meta || !image) {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(Math.round(pos.x - 6), Math.round(pos.y - 16), 12, 16);
      return;
    }
    const anchor = meta.anchor ?? { x: meta.frameWidth / 2, y: meta.frameHeight * 0.75 };
    const row = Math.min(choice.row, meta.rows - 1);
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      image,
      choice.frame * meta.frameWidth,
      row * meta.frameHeight,
      meta.frameWidth,
      meta.frameHeight,
      Math.round(pos.x - anchor.x),
      Math.round(pos.y - anchor.y),
      meta.frameWidth,
      meta.frameHeight,
    );
    ctx.globalAlpha = 1;
  }

  function shadow(pos: Vec2, radius: number): void {
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(Math.round(pos.x), Math.round(pos.y), radius, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function floor(state: WorldState): void {
    const { width, height } = state.arena;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(-200, -200, width + 400, height + 400);
    for (let y = 0; y < height; y += TILE) {
      for (let x = 0; x < width; x += TILE) {
        ctx.fillStyle = ((x + y) / TILE) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(x, y, Math.min(TILE, width - x), Math.min(TILE, height - y));
      }
    }
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(-1, -1, width + 2, height + 2);
  }

  function exitGate(exit: Rect, open: boolean, timeMs: number): void {
    if (open) {
      const pulse = 0.6 + 0.4 * Math.sin(timeMs / 180);
      ctx.fillStyle = COLORS.exitOpen;
      ctx.globalAlpha = pulse;
      ctx.fillRect(exit.x, exit.y, exit.width, exit.height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8e4f0';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('hud.exitOpen'), exit.x + exit.width / 2, exit.y - 4);
    } else {
      ctx.strokeStyle = COLORS.exitClosed;
      ctx.lineWidth = 2;
      for (let y = exit.y + 6; y < exit.y + exit.height; y += 10) {
        ctx.beginPath();
        ctx.moveTo(exit.x + 4, y);
        ctx.lineTo(exit.x + exit.width - 4, y);
        ctx.stroke();
      }
    }
  }

  function pillar(rect: Rect): Drawable {
    const lift = 18;
    return {
      y: rect.y + rect.height,
      draw: () => {
        ctx.fillStyle = COLORS.pillarSide;
        ctx.fillRect(rect.x, rect.y - lift + rect.height - 4, rect.width, lift + 4);
        ctx.fillStyle = COLORS.pillarTop;
        ctx.fillRect(rect.x, rect.y - lift, rect.width, rect.height);
      },
    };
  }

  /** A rectangle lying on the ground from `origin` along `dir`. */
  function groundLane(origin: Vec2, dir: Vec2, length: number, width: number, fill: string, progress: number): void {
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(Math.atan2(dir.y, dir.x));
    ctx.fillStyle = fill;
    ctx.fillRect(0, -width / 2, length, width);
    ctx.fillStyle = COLORS.telegraphEdge;
    ctx.fillRect(0, -width / 2, length * Math.min(1, progress), 2);
    ctx.fillRect(0, width / 2 - 2, length * Math.min(1, progress), 2);
    ctx.restore();
  }

  function groundArc(origin: Vec2, dir: Vec2, radius: number, arcDegrees: number, fill: string): void {
    const angle = Math.atan2(dir.y, dir.x);
    const half = (arcDegrees * DEG) / 2;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, radius, angle - half, angle + half);
    ctx.closePath();
    ctx.fill();
  }

  /** Readable wind-ups: lanes, arcs and rings on the ground (docs/gdd.md §10: readable on a stream). */
  function telegraphs(enemy: EnemyState, pos: Vec2): void {
    const { ai } = enemy;
    const progress = ai.modeDurationMs > 0 ? ai.modeMs / ai.modeDurationMs : 1;
    const winding = ai.mode === 'telegraph';
    const striking = ai.mode === 'attack';
    if (enemy.boss && enemy.boss.stance === 'shield' && ai.mode !== 'transform') {
      ctx.strokeStyle = COLORS.guard;
      ctx.lineWidth = 3;
      const angle = Math.atan2(enemy.facing.y, enemy.facing.x);
      const half = (AEGISLASH.shield.blockArcDegrees * DEG) / 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 8, angle - half, angle + half);
      ctx.stroke();
    }
    if (ai.mode === 'transform') {
      ctx.strokeStyle = COLORS.transform;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 6 + 30 * progress, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (!winding && !striking) return;
    const fill = winding ? COLORS.telegraph : COLORS.strike;
    if (enemy.species === 'poochyena') {
      groundLane(pos, ai.attackDir, POOCHYENA.lungeDistance, enemy.radius * 2, fill, winding ? progress : 1);
    } else if (enemy.species === 'gastly' && winding) {
      ctx.strokeStyle = COLORS.telegraphEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 4 + 16 * (1 - progress), 0, Math.PI * 2);
      ctx.stroke();
      groundLane(pos, ai.attackDir, 50, GASTLY.projectile.radius * 2, fill, progress);
    } else if (enemy.boss?.stance === 'shield') {
      groundLane(pos, ai.attackDir, AEGISLASH.shield.bashDistance, enemy.radius * 2, fill, winding ? progress : 1);
    } else if (enemy.boss?.stance === 'blade') {
      const blow = AEGISLASH.blade.combo[enemy.boss.comboIndex] ?? AEGISLASH.blade.combo[0]!;
      groundArc(pos, ai.attackDir, blow.range + blow.lungeDistance * (winding ? progress : 1), blow.arcDegrees, fill);
    }
  }

  function projectile(p: ProjectileState, pos: Vec2, timeMs: number): Drawable {
    return {
      y: pos.y,
      draw: () => {
        shadow({ x: pos.x, y: pos.y + 10 }, p.radius * 0.8);
        const pulse = 1 + 0.12 * Math.sin(timeMs / 60);
        const lifted = { x: pos.x, y: pos.y - 6 };
        ctx.fillStyle = p.owner === 'player' ? 'rgba(150, 90, 220, 0.9)' : 'rgba(150, 220, 90, 0.9)';
        ctx.beginPath();
        ctx.arc(lifted.x, lifted.y, p.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.owner === 'player' ? '#2a1240' : '#3a1a4a';
        ctx.beginPath();
        ctx.arc(lifted.x, lifted.y, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      },
    };
  }

  function lockMarker(pos: Vec2, radius: number, timeMs: number): void {
    const r = radius + 10;
    const spin = timeMs / 400;
    ctx.strokeStyle = COLORS.lock;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - radius, r, a - 0.35, a + 0.35);
      ctx.stroke();
    }
  }

  function chargeRing(state: WorldState, pos: Vec2): void {
    const action = state.player.action;
    if (!action || action.phase !== 'charging') return;
    const levels = MOVES[action.moveId].charge ?? [];
    const maxHold = levels.at(-1)?.holdMs ?? 1;
    const progress = Math.min(1, action.chargeMs / maxHold);
    ctx.strokeStyle = ['#c9c2dd', '#ffd36b', '#ff8a3d'][action.chargeLevel] ?? '#ff8a3d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }

  function numbers(list: readonly FloatingNumber[]): void {
    ctx.textAlign = 'center';
    for (const n of list) {
      const life = n.ageMs / JUICE.numberLifeMs;
      ctx.globalAlpha = 1 - life * life;
      ctx.font = `bold ${n.big ? 12 : 9}px monospace`;
      const text = n.style === 'blocked' ? t('hud.blocked') : String(n.value);
      const x = Math.round(n.pos.x);
      const y = Math.round(n.pos.y - 28 - JUICE.numberRisePx * life);
      ctx.fillStyle = '#000000';
      ctx.fillText(text, x + 1, y + 1);
      ctx.fillStyle = NUMBER_COLORS[n.style];
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function draw(frame: RenderFrame): void {
    const { current, view, pixelScale, juice, timeMs } = frame;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shake = shakeOffset(juice, random);
    const ox = Math.round((view.x + shake.x) * pixelScale);
    const oy = Math.round((view.y + shake.y) * pixelScale);
    ctx.setTransform(pixelScale, 0, 0, pixelScale, -ox, -oy);

    floor(current);
    if (frame.exit) exitGate(frame.exit, frame.exitOpen, timeMs);

    const positions = interpolatedPositions(frame.prev, current, frame.alpha);
    const posOf = (id: string, fallback: Vec2) => positions.get(id) ?? fallback;

    // Ground layer: telegraphs and shadows under everything.
    for (const enemy of current.enemies) if (enemy.alive) telegraphs(enemy, posOf(enemy.id, enemy.pos));

    const drawables: Drawable[] = [];
    for (const rect of current.arena.obstacles ?? []) drawables.push(pillar(rect));
    for (const enemy of current.enemies) {
      const defeated = frame.defeatedAt.get(enemy.id);
      const sinceDefeatMs = defeated === undefined ? Number.POSITIVE_INFINITY : timeMs - defeated;
      if (!enemy.alive && sinceDefeatMs > 1100) continue;
      const pos = posOf(enemy.id, enemy.pos);
      drawables.push({
        y: pos.y,
        draw: () => {
          shadow(pos, enemy.radius);
          const fade = enemy.alive ? (enemy.hitstunMs > 0 && Math.floor(timeMs / 50) % 2 === 0 ? 0.55 : 1) : Math.max(0, 1 - sinceDefeatMs / 1100);
          drawSprite(enemyAnim(enemy, { timeMs, sinceDefeatMs: enemy.alive ? Number.POSITIVE_INFINITY : sinceDefeatMs }), pos, fade);
        },
      });
    }
    const playerPos = posOf('player', current.player.pos);
    drawables.push({
      y: playerPos.y,
      draw: () => {
        shadow(playerPos, TUNING.player.radius);
        chargeRing(current, playerPos);
        drawSprite(playerAnim(current.player, { timeMs, sinceHurtMs: frame.sinceHurtMs, moving: frame.moving }), playerPos);
      },
    });
    for (const p of current.projectiles) drawables.push(projectile(p, posOf(p.id, p.pos), timeMs));
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    const target = current.enemies.find((e) => e.id === current.lock.targetId);
    if (target) lockMarker(posOf(target.id, target.pos), target.radius, timeMs);
    numbers(juice.numbers);

    // Screen space: slow-mo tint and HUD.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (current.slowMoMs > 0) {
      ctx.fillStyle = COLORS.slowMo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawHud(ctx, current, juice, view);
  }

  return { draw };
}
