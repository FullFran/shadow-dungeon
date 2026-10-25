import type { TileRect } from '../core/dungeon';
import { gasDepth, gasFront, type GasState } from '../core/gas';
import type { Obstacle, Rect } from '../core/state';
import { isWall, type TileGrid, type TilePoint } from '../core/tiles';
import type { ToxicPool } from '../core/toxic';
import { GAS } from '../data/swamp';
import { decorHash } from './crypt-decor';

/**
 * The Toxic Swamp drawn in code (presentation only, nothing collides with
 * it): dead trees leaning over the lit faces of walls, reed tufts and moss
 * on the room floors, the toxic pools bubbling, glowing spores drifting, a
 * low toxic mist, and the gas of Gas tóxico rolling in behind its front.
 * Placement is a fixed hash of the tile, so a floor always looks the same.
 */
export interface SwampDecor {
  trees: TilePoint[];
  reeds: TilePoint[];
}

const TILE = 32;
const TREE_CHANCE = 0.11;
const REED_CHANCE = 0.06;

const same = (a: TilePoint | undefined, x: number, y: number) => a !== undefined && a.x === x && a.y === y;

export function swampDecor(floor: TileGrid & { rooms?: readonly TileRect[]; stairs?: TilePoint; start?: TilePoint }): SwampDecor {
  const trees: TilePoint[] = [];
  for (let y = 0; y < floor.rows - 1; y++) {
    for (let x = 0; x < floor.cols; x++) {
      if (isWall(floor, x, y) && !isWall(floor, x, y + 1) && decorHash(x, y, 21) < TREE_CHANCE) trees.push({ x, y });
    }
  }
  const reeds: TilePoint[] = [];
  for (const room of floor.rooms ?? []) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (same(floor.stairs, x, y) || same(floor.start, x, y) || isWall(floor, x, y)) continue;
        if (decorHash(x, y, 23) < REED_CHANCE) reeds.push({ x, y });
      }
    }
  }
  return { trees, reeds };
}

/** A dead tree rooted on a wall's lit face: a bare grey trunk and crooked branches, a hanging strand of moss. */
export function drawDeadTree(ctx: CanvasRenderingContext2D, x: number, y: number, look: number, timeMs: number): void {
  const cx = x + 8 + Math.round(look * 16);
  const base = y + TILE - 2;
  const lean = look < 0.5 ? -1 : 1;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(cx - 5, base, 12, 3);
  ctx.fillStyle = '#3d3a33';
  ctx.fillRect(cx - 2, base - 26, 4, 26);
  ctx.fillRect(cx - 3, base - 4, 6, 4);
  ctx.fillStyle = '#56514a';
  ctx.fillRect(cx - 2, base - 26, 1, 24);
  // Branches.
  ctx.fillStyle = '#3d3a33';
  ctx.fillRect(cx + lean * 2, base - 22, lean * 9, 2);
  ctx.fillRect(cx + lean * 10, base - 27, lean * 2, 6);
  ctx.fillRect(cx - lean * 2, base - 16, -lean * 7, 2);
  ctx.fillRect(cx - lean * 9, base - 20, -lean * 2, 5);
  // A strand of moss sways.
  const sway = Math.round(Math.sin(timeMs / 700 + look * 9) * 1.5);
  ctx.fillStyle = 'rgba(120, 150, 70, 0.8)';
  ctx.fillRect(cx + lean * 7 + sway, base - 20, 1, 8);
}

/** A tuft of reeds and moss on the floor. */
export function drawReeds(ctx: CanvasRenderingContext2D, x: number, y: number, look: number): void {
  const ox = x + 6 + Math.round(look * 18);
  const oy = y + 20 + Math.round(look * 8);
  ctx.fillStyle = 'rgba(70, 95, 45, 0.7)';
  ctx.fillRect(ox - 4, oy + 2, 10, 2);
  ctx.fillStyle = '#5d7a3a';
  ctx.fillRect(ox, oy - 8, 1, 10);
  ctx.fillRect(ox + 2, oy - 11, 1, 13);
  ctx.fillRect(ox + 4, oy - 6, 1, 8);
  ctx.fillStyle = '#8a7a44';
  ctx.fillRect(ox + 2, oy - 12, 1, 3);
}

/** A toxic pool: dark sludge with a glowing rim, bubbles rising and popping, a faint vapour over it. */
export function drawPool(ctx: CanvasRenderingContext2D, pool: ToxicPool, timeMs: number): void {
  const { x, y, radius } = pool;
  ctx.fillStyle = 'rgba(10, 20, 8, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, radius + 3, radius * 0.75 + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
  glow.addColorStop(0, 'rgba(120, 60, 150, 0.95)');
  glow.addColorStop(0.75, 'rgba(70, 120, 40, 0.95)');
  glow.addColorStop(1, 'rgba(150, 220, 70, 0.9)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 255, 110, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Bubbles: each grows for a while and pops.
  const count = Math.max(3, Math.round(radius / 9));
  for (let i = 0; i < count; i++) {
    const seed = Math.floor(x * 7 + y * 13) + i * 31;
    const period = 900 + decorHash(seed, i, 1) * 900;
    const phase = ((timeMs + decorHash(seed, i, 2) * period) % period) / period;
    const bx = x + (decorHash(seed, i, 3) - 0.5) * radius * 1.3;
    const by = y + (decorHash(seed, i, 4) - 0.5) * radius * 0.9;
    const size = 1 + phase * 3;
    ctx.fillStyle = phase > 0.9 ? 'rgba(230, 255, 180, 0.8)' : 'rgba(180, 235, 110, 0.75)';
    ctx.fillRect(Math.round(bx - size / 2), Math.round(by - size / 2), Math.max(1, Math.round(size)), Math.max(1, Math.round(size)));
  }
  // Vapour.
  const rise = (timeMs / 40) % 24;
  ctx.fillStyle = `rgba(160, 220, 110, ${0.12 * (1 - rise / 24)})`;
  ctx.fillRect(Math.round(x - radius * 0.5), Math.round(y - rise - 6), Math.round(radius), 3);
}

/** Glowing spores drifting over the view (deterministic from time). */
export function drawSpores(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number, count = 26): void {
  for (let i = 0; i < count; i++) {
    const speed = 6 + decorHash(i, 0, 31) * 10;
    const span = view.height + 40;
    const fy = (decorHash(i, 1, 32) * span - (timeMs / 1000) * speed) % span;
    const y = view.y - 20 + (fy < 0 ? fy + span : fy);
    const x = view.x + decorHash(i, 2, 33) * view.width + Math.sin(timeMs / 1300 + i) * 12;
    const twinkle = 0.45 + 0.55 * Math.max(0, Math.sin(timeMs / 380 + i * 1.7));
    ctx.fillStyle = `rgba(190, 255, 130, ${0.35 * twinkle})`;
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
    ctx.fillStyle = `rgba(235, 255, 200, ${0.85 * twinkle})`;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

/** A low toxic mist drifting across the view in a few soft bands. */
export function drawToxicMist(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number): void {
  for (let i = 0; i < 4; i++) {
    const y = view.y + view.height * (0.2 + 0.22 * i) + Math.sin(timeMs / 2600 + i * 2) * 14;
    const drift = ((timeMs / (60 + i * 15)) % (view.width + 300)) - 150;
    const gradient = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    gradient.addColorStop(0, 'rgba(120, 170, 90, 0)');
    gradient.addColorStop(0.5, 'rgba(120, 170, 90, 0.07)');
    gradient.addColorStop(1, 'rgba(120, 170, 90, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(view.x + drift - view.width, y - 30, view.width * 2 + 300, 60);
  }
}

/** Gas tóxico: a thick green-violet cloud over the tiles behind its front, rolling at the edge. */
export function drawGas(ctx: CanvasRenderingContext2D, grid: TileGrid, gas: GasState, view: Rect, timeMs: number): void {
  if (gasFront(gas) <= 0) return;
  const x0 = Math.max(0, Math.floor(view.x / TILE));
  const y0 = Math.max(0, Math.floor(view.y / TILE));
  const x1 = Math.min(grid.cols - 1, Math.floor((view.x + view.width) / TILE));
  const y1 = Math.min(grid.rows - 1, Math.floor((view.y + view.height) / TILE));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isWall(grid, tx, ty)) continue;
      const depth = gasDepth(gas, grid.cols, { x: tx, y: ty });
      if (depth <= 0) continue;
      const thick = depth / GAS.edgeTiles;
      const swirl = 0.08 * Math.sin(timeMs / 500 + tx * 0.9 + ty * 1.3);
      ctx.fillStyle = `rgba(110, 170, 60, ${0.18 + 0.32 * thick + swirl})`;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      if (decorHash(tx, ty, 41) < 0.35) {
        const puff = 6 + Math.round(4 * Math.sin(timeMs / 420 + tx + ty));
        ctx.fillStyle = `rgba(160, 110, 190, ${0.18 * thick})`;
        ctx.fillRect(tx * TILE + 8, ty * TILE + 8, puff + 8, puff);
      }
    }
  }
}

/** The swamp's fixed arenas: moss patches and reeds scattered over the floor. */
export function drawSwampArena(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  for (let y = 0; y < height; y += TILE) {
    for (let x = 0; x < width; x += TILE) {
      const h = decorHash(x / TILE, y / TILE, 51);
      if (h < 0.12) {
        ctx.fillStyle = 'rgba(80, 110, 50, 0.35)';
        ctx.fillRect(x + 4, y + 6, 20, 14);
      } else if (h < 0.17) drawReeds(ctx, x, y, decorHash(x, y, 52));
    }
  }
}

/** An obstacle in a swamp arena: a crystal spire from the rift (cover) or a knot of dead roots. */
export function drawSwampBlock(ctx: CanvasRenderingContext2D, rect: Obstacle, timeMs: number): void {
  const { x, y, width: w, height: h } = rect;
  if (rect.cover) {
    const pulse = 0.6 + 0.4 * Math.sin(timeMs / 600 + x);
    const glow = ctx.createRadialGradient(x + w / 2, y, 2, x + w / 2, y, 50);
    glow.addColorStop(0, `rgba(200, 150, 255, ${0.25 * pulse})`);
    glow.addColorStop(1, 'rgba(200, 150, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x + w / 2 - 50, y - 50, 100, 100);
    ctx.fillStyle = '#2e2a3e';
    ctx.fillRect(x, y + h * 0.4, w, h * 0.6);
    ctx.fillStyle = '#6f5ea0';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + h * 0.6);
    ctx.lineTo(x + w * 0.35, y - h * 0.7);
    ctx.lineTo(x + w * 0.55, y + h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a796de';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y + h * 0.6);
    ctx.lineTo(x + w * 0.7, y - h * 0.35);
    ctx.lineTo(x + w - 4, y + h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255, 240, 255, ${0.7 * pulse})`;
    ctx.fillRect(Math.round(x + w * 0.35) - 1, Math.round(y - h * 0.5), 2, 6);
    return;
  }
  ctx.fillStyle = '#2a261f';
  ctx.fillRect(x, y + h * 0.3, w, h * 0.7);
  ctx.fillStyle = '#4a4436';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * (w / 4), y + (i % 2) * 6, 4, h * 0.8);
  ctx.fillStyle = '#5d7a3a';
  ctx.fillRect(x + 2, y + h * 0.3, w - 4, 3);
}
