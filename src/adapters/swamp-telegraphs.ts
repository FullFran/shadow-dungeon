import type { EnemyState } from '../core/state';
import { downpourCircles, floodPockets, hazePockets, tendrilLanes, tendrilRows } from '../core/swamp-bosses';
import type { Vec2 } from '../core/vec';
import type { QueenDef, UltraDef } from '../data/swamp-enemies';

/**
 * Telegraphs of the Toxic Swamp's bosses (presentation only), all drawn
 * from the boss state a guest also has: tendril lanes across the rift, the
 * safe pockets of the haze and the flood (bright rings, the rest of the
 * arena tinted), the Ultra wormhole's mouth, the downpour's circles, the
 * spiral wind-up and the dance lane. Positional attacks that a roll does
 * not save from (`pierceRoll`) get a violet zone with a dashed edge.
 */
const EDGE = 'rgba(255, 90, 90, 0.85)';
const STRIKE = 'rgba(255, 230, 120, 0.45)';
const ZONE = (alpha: number) => `rgba(150, 60, 200, ${alpha})`;
const SAFE = 'rgba(200, 255, 170, 0.9)';

interface Arena {
  width: number;
  height: number;
}

function lane(ctx: CanvasRenderingContext2D, origin: Vec2, dir: Vec2, length: number, width: number, fill: string, progress: number): void {
  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.rotate(Math.atan2(dir.y, dir.x));
  ctx.fillStyle = fill;
  ctx.fillRect(0, -width / 2, length, width);
  ctx.fillStyle = EDGE;
  ctx.fillRect(0, -width / 2, length * Math.min(1, progress), 2);
  ctx.fillRect(0, width / 2 - 2, length * Math.min(1, progress), 2);
  ctx.restore();
}

function ring(ctx: CanvasRenderingContext2D, at: Vec2, radius: number, stroke: string, width = 2, dashed = false): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  if (dashed) ctx.setLineDash([]);
}

/** The whole arena tinted (a zone that fills it) with bright safe pockets cut out of it. */
function zoneWithPockets(ctx: CanvasRenderingContext2D, arena: Arena, pockets: readonly Vec2[], radius: number, alpha: number, timeMs: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, arena.width, arena.height);
  for (const p of pockets) {
    ctx.moveTo(p.x + radius, p.y);
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, true);
  }
  ctx.fillStyle = ZONE(alpha);
  ctx.fill('evenodd');
  ctx.restore();
  const pulse = 0.6 + 0.4 * Math.sin(timeMs / 160);
  for (const p of pockets) {
    ring(ctx, p, radius, SAFE, 3);
    ctx.fillStyle = `rgba(200, 255, 170, ${0.12 * pulse})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawQueenTelegraph(ctx: CanvasRenderingContext2D, enemy: EnemyState, def: QueenDef, arena: Arena, pos: Vec2, timeMs: number): void {
  const { ai } = enemy;
  const stance = enemy.boss?.stance;
  const winding = ai.mode === 'telegraph';
  const striking = ai.mode === 'attack';
  const progress = ai.modeDurationMs > 0 ? ai.modeMs / ai.modeDurationMs : 1;
  if (stance === 'dance' && (winding || striking)) {
    const locked = winding && ai.modeDurationMs - ai.modeMs <= def.dance.lockMs;
    lane(ctx, pos, ai.attackDir, def.dance.dashDistance, enemy.radius * 2 + 6, locked || striking ? STRIKE : 'rgba(155, 79, 201, 0.3)', winding ? progress : 1);
  } else if (stance === 'spiral' && winding) {
    ring(ctx, pos, enemy.radius + 8 + 40 * (1 - progress), EDGE, 2);
  } else if (stance === 'haze' && ai.aimPoint && (winding || striking)) {
    zoneWithPockets(ctx, arena, hazePockets(arena, ai.aimPoint), def.haze.pocketRadius, striking ? 0.45 : 0.1 + 0.22 * progress, timeMs);
  } else if (stance === 'escort' && winding) {
    ring(ctx, pos, enemy.radius + 12 + 10 * Math.sin(timeMs / 90), 'rgba(255, 160, 90, 0.8)', 2);
  }
}

export function drawUltraTelegraph(ctx: CanvasRenderingContext2D, enemy: EnemyState, def: UltraDef, arena: Arena, pos: Vec2, timeMs: number): void {
  const { ai } = enemy;
  const boss = enemy.boss;
  if (!boss) return;
  const winding = ai.mode === 'telegraph';
  const striking = ai.mode === 'attack';
  const progress = ai.modeDurationMs > 0 ? ai.modeMs / ai.modeDurationMs : 1;
  if (ai.mode === 'transform' && boss.stance === 'ultra') {
    // The awakening: rings of light pouring out of it.
    for (let i = 0; i < 3; i++) ring(ctx, pos, enemy.radius + 10 + 90 * ((progress + i / 3) % 1), 'rgba(230, 200, 255, 0.75)', 2);
    return;
  }
  if (!winding && !striking) return;
  const stance = boss.stance;
  if (stance === 'tendrils') {
    const rows = tendrilRows(ai.attackDir);
    for (const [from, to] of tendrilLanes(arena, rows, def.tendrils.lanes, boss.comboIndex)) {
      ctx.fillStyle = striking ? STRIKE : `rgba(150, 230, 120, ${0.12 + 0.25 * progress})`;
      if (rows) ctx.fillRect(0, from, arena.width, to - from);
      else ctx.fillRect(from, 0, to - from, arena.height);
      ctx.fillStyle = EDGE;
      if (rows) {
        ctx.fillRect(0, from, arena.width * progress, 2);
        ctx.fillRect(0, to - 2, arena.width * progress, 2);
      } else {
        ctx.fillRect(from, 0, 2, arena.height * progress);
        ctx.fillRect(to - 2, 0, 2, arena.height * progress);
      }
      if (striking) {
        // The tendrils themselves: wavy strands down the lane.
        ctx.strokeStyle = 'rgba(220, 255, 190, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const mid = (from + to) / 2;
        for (let t = 0; t <= (rows ? arena.width : arena.height); t += 12) {
          const wave = Math.sin(t / 18 + timeMs / 60) * (to - from) * 0.3;
          if (rows) ctx.lineTo(t, mid + wave);
          else ctx.lineTo(mid + wave, t);
        }
        ctx.stroke();
      }
    }
  } else if (stance === 'spores' || stance === 'shards') {
    if (winding) ring(ctx, pos, enemy.radius + 8 + 50 * (1 - progress), EDGE, 2);
  } else if (stance === 'wormhole' && ai.aimPoint) {
    const at = striking ? pos : ai.aimPoint;
    const swirl = timeMs / 200;
    ctx.fillStyle = ZONE(striking ? 0.5 : 0.15 + 0.3 * progress);
    ctx.beginPath();
    ctx.arc(at.x, at.y, def.wormhole.radius, 0, Math.PI * 2);
    ctx.fill();
    ring(ctx, at, def.wormhole.radius, EDGE, 2, true);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255, 220, 255, ${0.6 - i * 0.15})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(at.x, at.y, def.wormhole.radius * (0.25 + 0.2 * i) * (winding ? progress : 1), swirl + i, swirl + i + Math.PI * 1.2);
      ctx.stroke();
    }
    if (winding) ring(ctx, at, def.wormhole.pullRange, 'rgba(200, 150, 255, 0.25)', 1, true);
  } else if (stance === 'flood' && ai.aimPoint) {
    zoneWithPockets(ctx, arena, floodPockets(arena, ai.aimPoint), def.flood.pocketRadius, striking ? 0.5 : 0.1 + 0.25 * progress, timeMs);
  } else if (stance === 'downpour') {
    for (const c of downpourCircles(arena, def.downpour.cols, def.downpour.rows, boss.comboIndex)) {
      ctx.fillStyle = striking ? STRIKE : `rgba(155, 79, 201, ${0.15 + 0.3 * progress})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, def.downpour.radius * (striking ? 1 : 0.3 + 0.7 * progress), 0, Math.PI * 2);
      ctx.fill();
      ring(ctx, c, def.downpour.radius, EDGE, 1);
    }
  }
}
