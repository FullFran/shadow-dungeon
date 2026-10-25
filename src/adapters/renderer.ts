import { AEGISLASH, ENEMY_BEHAVIOUR } from '../data/enemies';
import { FOG } from '../data/dungeon';
import { fogRadiusTiles } from '../core/fog';
import { DIVE_LOCK_MS } from '../core/archer';
import { MOVES } from '../data/moves';
import { SPRITES } from '../data/sprites';
import { TUNING } from '../data/tuning';
import { t } from '../i18n';
import { collapseFront, type CollapseState } from '../core/collapse';
import type { EnemyState, ProjectileState, Rect, WorldState } from '../core/state';
import { isWall, type TileGrid } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import { sheetKey, type SheetStore } from './assets';
import { drawFloorCard, type FloorCard } from './card';
import { drawDungeonIntro, drawNowPlaying, drawSpellBanner, type DungeonIntro, type NowPlaying, type SpellBanner } from './intro-card';
import { CRYPT, type TilePalette } from '../data/dungeons';
import { drawMinimap, type MinimapMemory } from './minimap';
import { drawHud } from './hud';
import { drawMessageLog, visibleMessages, type MessageLog } from './message-log';
import { canvasFont, FONT } from '../ui/tokens';
import { JUICE, rumbleOffset, shakeOffset, type FloatingNumber, type JuiceState } from './juice';
import { enemyAnim, playerAnim, type AnimChoice } from './sprite-anim';
import { drawEnemyShotVfx, drawPlayerVfx, drawProjectileVfx, enemyAttackType, enemyShotLook, playerVfx, telegraphFill, type DrawnProjectile } from './move-vfx';
import { ringRadius } from '../core/roster';
import { illusionActive } from '../core/passives';
import { interpolatedPositions, visibleTiles } from './view';

/** Everything one rendered frame needs; the renderer keeps no game state of its own. */
export interface RenderFrame {
  prev: WorldState;
  current: WorldState;
  /** Fraction of a fixed step elapsed since `current` (interpolation). */
  alpha: number;
  juice: JuiceState;
  view: Rect;
  pixelScale: number;
  /** Current floor of the run (1-based), for the HUD. */
  floor: number;
  exit: Rect | null;
  exitOpen: boolean;
  /** Real time, for looping animations. */
  timeMs: number;
  sinceHurtMs: number;
  /** Real time at which each enemy was defeated. */
  defeatedAt: ReadonlyMap<string, number>;
  moving: boolean;
  /** Enemy under the cursor that a click would lock (click-to-lock on, not the current target). */
  hoverId: string | null;
  /** Floor title card, while it shows. */
  card: FloorCard | null;
  /** Collapse rumble level 0..1 (`rumbleLevel`), a light continuous screen shake. */
  rumble: number;
  /** Seen tiles of the current floor; null hides the minimap (Tab, or no tile map). */
  minimap: MinimapMemory | null;
  /** Message log at the bottom left (lines fade with `timeMs`). */
  log?: MessageLog;
  /** Pokémonedas earned so far this run (HUD). */
  coins?: number;
  /** Tile and arena colours of the dungeon (the Crypt's by default). */
  palette?: TilePalette;
  /** Floor 1: the dungeon's name and subtitle, while they show. */
  intro?: DungeonIntro | null;
  /** The track that started last ("♪ title"), while it shows. */
  nowPlaying?: NowPlaying | null;
  /** On-screen touch controls are up: HUD notes keep clear of the action buttons. */
  touchUi?: boolean;
  /** The boss spell card just announced, while it shows. */
  spell?: SpellBanner | null;
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
  hover: 'rgba(255, 107, 154, 0.45)',
  slowMo: 'rgba(110, 80, 200, 0.18)',
  exitClosed: '#3a3350',
  tileFloorA: '#2b2533',
  tileFloorB: '#2f2938',
  /** Wall tops are lighter than the void outside the map and carry a block pattern, so the two never blur together. */
  tileWallTop: '#1a1523',
  tileWallBlock: '#211b2c',
  mapVoid: '#000000',
  mapRim: '#4b4163',
  tileWallFace: '#433a57',
  tileWallLip: '#5a4f73',
  tileShadow: 'rgba(0, 0, 0, 0.35)',
  stairsPit: '#0b0910',
  stairsStep: '#8f84b0',
  stairsGlow: 'rgba(170, 140, 255, 0.35)',
  exitOpen: 'rgba(170, 120, 255, 0.55)',
  voidFloor: '#040306',
  rubbleA: '#2a2431',
  rubbleB: '#3d3546',
  crack: '#0a080d',
  dust: '#9a8fae',
};

/** Rubble tiles fade into the void over this many tiles behind the front. */
const RUBBLE_FADE_TILES = 2;
/** Cracks and dust show on standing tiles this close ahead of the front. */
const CRACK_TILES = 1.5;

/** Small deterministic per-tile hash in [0, 1), so rubble does not flicker between frames. */
function tileHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + salt * 2246822519, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const NUMBER_COLORS: Record<FloatingNumber['style'], string> = {
  super: '#ffb347',
  normal: '#ffffff',
  weak: '#9aa0a6',
  blocked: '#8fb3ff',
  hurt: '#ff5a5a',
  heal: '#6ee07a',
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

  /**
   * Generated floors, visible tiles only: floor checker, wall tops, a lit
   * front face on walls above floor (so walls read as raised) and a soft
   * shadow on the floor right under a wall.
   */
  /** A collapsed tile: void with scattered rubble that thins out further behind the front. */
  function rubbleTile(x: number, y: number, tx: number, ty: number, behind: number): void {
    ctx.fillStyle = COLORS.voidFloor;
    ctx.fillRect(x, y, TILE, TILE);
    const keep = Math.max(0.25, 1 - behind / RUBBLE_FADE_TILES);
    for (let i = 0; i < 5; i++) {
      if (tileHash(tx, ty, i + 10) > keep) continue;
      const size = 3 + Math.floor(tileHash(tx, ty, i) * 6);
      ctx.fillStyle = i % 2 === 0 ? COLORS.rubbleA : COLORS.rubbleB;
      ctx.fillRect(x + Math.floor(tileHash(tx, ty, i + 20) * (TILE - size)), y + Math.floor(tileHash(tx, ty, i + 30) * (TILE - size)), size, size - 1);
    }
  }

  /** Standing ground about to go: dark cracks that deepen and dust motes that jitter as the front nears. */
  function crackedTile(x: number, y: number, tx: number, ty: number, ahead: number, timeMs: number): void {
    const near = 1 - ahead / CRACK_TILES;
    ctx.fillStyle = COLORS.crack;
    ctx.globalAlpha = 0.35 + 0.6 * near;
    const cx = x + 6 + Math.floor(tileHash(tx, ty, 1) * 20);
    ctx.fillRect(cx, y + 4, 1, 10 + Math.floor(near * 14));
    ctx.fillRect(cx - 5, y + 12 + Math.floor(tileHash(tx, ty, 2) * 10), 11, 1);
    ctx.globalAlpha = near;
    ctx.fillStyle = COLORS.dust;
    for (let i = 0; i < 3; i++) {
      const wobble = Math.sin(timeMs / 90 + i * 2 + tx) * 2;
      ctx.fillRect(x + Math.floor(tileHash(tx, ty, i + 40) * TILE), y + Math.floor(tileHash(tx, ty, i + 50) * TILE + wobble), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function tiles(grid: TileGrid, view: Rect, collapse: CollapseState | undefined, timeMs: number): void {
    const { x0, y0, x1, y1 } = visibleTiles(view, grid);
    const front = collapse ? collapseFront(collapse) : 0;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const x = tx * TILE;
        const y = ty * TILE;
        if (isWall(grid, tx, ty)) {
          ctx.fillStyle = COLORS.tileWallTop;
          ctx.fillRect(x, y, TILE, TILE);
          // Staggered stone blocks on the wall tops.
          ctx.fillStyle = COLORS.tileWallBlock;
          const shift = ty % 2 === 0 ? 0 : 8;
          ctx.fillRect(x + 2 + shift, y + 3, 12, 10);
          ctx.fillRect(x + 18 - shift, y + 19, 12, 10);
          if (!isWall(grid, tx, ty + 1)) {
            ctx.fillStyle = COLORS.tileWallFace;
            ctx.fillRect(x, y + TILE - 12, TILE, 12);
            ctx.fillStyle = COLORS.tileWallLip;
            ctx.fillRect(x, y + TILE - 12, TILE, 2);
          }
          ctx.fillStyle = COLORS.tileWallLip;
          if (!isWall(grid, tx - 1, ty)) ctx.fillRect(x, y, 1, TILE);
          if (!isWall(grid, tx + 1, ty)) ctx.fillRect(x + TILE - 1, y, 1, TILE);
          if (!isWall(grid, tx, ty - 1)) ctx.fillRect(x, y, TILE, 1);
        } else {
          const d = collapse ? (collapse.dist[ty * grid.cols + tx] ?? -1) : -1;
          if (front > 0 && d >= 0 && d < front) {
            rubbleTile(x, y, tx, ty, front - d);
            continue;
          }
          ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.tileFloorA : COLORS.tileFloorB;
          ctx.fillRect(x, y, TILE, TILE);
          if (isWall(grid, tx, ty - 1)) {
            ctx.fillStyle = COLORS.tileShadow;
            ctx.fillRect(x, y, TILE, 6);
          }
          if (front > 0 && d >= 0 && d - front < CRACK_TILES) crackedTile(x, y, tx, ty, d - front, timeMs);
        }
      }
    }
  }

  /** Stairs down: a dark pit with steps fading into it and a soft pulse so it is easy to spot. */
  function stairsTile(rect: Rect, timeMs: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 260);
    ctx.fillStyle = COLORS.stairsGlow;
    ctx.globalAlpha = 0.4 + 0.6 * pulse;
    ctx.fillRect(rect.x - 3, rect.y - 3, rect.width + 6, rect.height + 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.stairsPit;
    ctx.fillRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 1 - i * 0.22;
      ctx.fillStyle = COLORS.stairsStep;
      ctx.fillRect(rect.x + 4 + i * 2, rect.y + 5 + i * 6, rect.width - 8 - i * 4, 3);
    }
    ctx.globalAlpha = 1;
  }

  function floor(state: WorldState, view: Rect, timeMs: number): void {
    if (state.arena.tiles) {
      const grid = state.arena.tiles;
      ctx.fillStyle = COLORS.mapVoid;
      ctx.fillRect(view.x - 16, view.y - 16, view.width + 32, view.height + 32);
      tiles(grid, view, state.collapse, timeMs);
      // A thin rim marks where the map ends and the void begins.
      ctx.strokeStyle = COLORS.mapRim;
      ctx.lineWidth = 1;
      ctx.strokeRect(-0.5, -0.5, grid.cols * TILE + 1, grid.rows * TILE + 1);
      return;
    }
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

  /** An Oran Berry, drawn (no sprite asset): a blue berry with a leaf, bobbing a little. */
  function berry(pos: Vec2, timeMs: number): void {
    const bob = Math.round(Math.sin(timeMs / 300 + pos.x) * 1.5);
    const x = Math.round(pos.x);
    const y = Math.round(pos.y) + bob;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, Math.round(pos.y) + 6, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f5fd0';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7fb0ff';
    ctx.fillRect(x - 3, y - 3, 2, 2);
    ctx.fillStyle = '#4fbf5a';
    ctx.fillRect(x, y - 8, 4, 3);
    ctx.fillStyle = '#2e7a35';
    ctx.fillRect(x - 1, y - 6, 1, 2);
  }

  function exitGate(exit: Rect, open: boolean, timeMs: number): void {
    if (open) {
      const pulse = 0.6 + 0.4 * Math.sin(timeMs / 180);
      ctx.fillStyle = COLORS.exitOpen;
      ctx.globalAlpha = pulse;
      ctx.fillRect(exit.x, exit.y, exit.width, exit.height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8e4f0';
      ctx.font = canvasFont(FONT.hudPx, true);
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

  function groundArc(origin: Vec2, dir: Vec2, radius: number, arcDegrees: number, fill: string, edge?: string): void {
    const angle = Math.atan2(dir.y, dir.x);
    const half = (arcDegrees * DEG) / 2;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, radius, angle - half, angle + half);
    ctx.closePath();
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, radius - 1, angle - half, angle + half);
      ctx.stroke();
    }
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
    const def = ENEMY_BEHAVIOUR[enemy.species];
    if (ai.mode === 'transform' && def?.kind === 'boss') {
      ctx.strokeStyle = COLORS.transform;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 6 + 30 * progress, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (def?.kind === 'beam' && def.guard && ai.mode !== 'recover') {
      // The crab's shell: hits from this side are blocked (it opens while recovering).
      ctx.strokeStyle = COLORS.guard;
      ctx.lineWidth = 3;
      const angle = Math.atan2(enemy.facing.y, enemy.facing.x);
      const half = (def.guard.arcDegrees * DEG) / 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 5, angle - half, angle + half);
      ctx.stroke();
    }
    if (!winding && !striking) return;
    // Tinted by the attack's type; the red edges keep the warning readable.
    const fill = telegraphFill(enemyAttackType(enemy), winding);
    const lockedFor = (lockMs: number | undefined) => winding && lockMs !== undefined && ai.modeDurationMs - ai.modeMs <= lockMs;
    if (def?.kind === 'lunger') {
      // Ekans' coil: the lane turns solid once the aim is locked.
      const locked = lockedFor(def.lockMs) || (striking && def.lockMs !== undefined);
      groundLane(pos, ai.attackDir, def.lungeDistance, enemy.radius * 2, locked ? COLORS.strike : fill, winding ? progress : 1);
    } else if (def?.kind === 'beam') {
      const locked = lockedFor(def.lockMs) || striking;
      groundLane(pos, ai.attackDir, def.length, def.width, locked ? COLORS.strike : fill, winding ? progress : 1);
    } else if (def?.kind === 'pulse') {
      if (winding) groundCircle(pos, def.radius, fill, progress);
      else {
        ctx.strokeStyle = COLORS.telegraphEdge;
        ctx.lineWidth = def.width;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ringRadius(enemy, def), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (def?.kind === 'cone') {
      groundArc(pos, ai.attackDir, def.reach, def.arcDegrees, fill, winding ? COLORS.telegraphEdge : undefined);
    } else if (def?.kind === 'mortar' && ai.aimPoint) {
      // The landing circle: it follows the player during the wind-up and fills up during the flight.
      groundCircle(ai.aimPoint, def.radius, fill, striking ? progress : 0.15);
    } else if (def?.kind === 'bomber') {
      if (ai.attack === 'explode') groundCircle(pos, def.explode.radius, fill, striking ? 1 : progress);
      else if (winding) groundCircle(pos, def.cloud.radius, fill, progress);
    } else if (def?.kind === 'counter') {
      if (winding && ai.attack === 'stance') {
        // The stance: a guard ring all around (hitting it now is answered).
        ctx.strokeStyle = COLORS.guard;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, enemy.radius + 6 + 2 * Math.sin(ai.modeMs / 90), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const blow = ai.attack === 'counter' ? def.counter : def.jab;
        groundLane(pos, ai.attackDir, blow.lungeDistance, enemy.radius * 2, ai.attack === 'counter' ? COLORS.strike : fill, winding ? progress : 1);
      }
    } else if (def?.kind === 'caster' && winding) {
      ctx.strokeStyle = COLORS.telegraphEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 4 + 16 * (1 - progress), 0, Math.PI * 2);
      ctx.stroke();
      groundLane(pos, ai.attackDir, 50, def.projectile.radius * 2, fill, progress);
    } else if (def?.kind === 'slammer' || def?.kind === 'spore') {
      // The area that will be hit: its edge from the start, filling in as the wind-up runs.
      const radius = def.kind === 'slammer' ? def.radius : def.cloud.radius;
      if (winding || def.kind === 'slammer') groundCircle(pos, radius, fill, winding ? progress : 1);
    } else if (def?.kind === 'archer') {
      const card = enemy.boss?.stance;
      if (card === 'dive') {
        // Locked aim (the last moments): the lane turns solid and stops following.
        const locked = winding && ai.modeDurationMs - ai.modeMs <= DIVE_LOCK_MS;
        groundLane(pos, ai.attackDir, def.dive.distance, (enemy.radius + def.dive.reach) * 2, locked || striking ? COLORS.strike : fill, winding ? progress : 1);
      } else if (winding) {
        groundLane(pos, ai.attackDir, 150, 4, fill, progress);
      }
    } else if (enemy.boss?.stance === 'shield') {
      groundLane(pos, ai.attackDir, AEGISLASH.shield.bashDistance, enemy.radius * 2, fill, winding ? progress : 1);
    } else if (enemy.boss?.stance === 'blade') {
      const blow = AEGISLASH.blade.combo[enemy.boss.comboIndex] ?? AEGISLASH.blade.combo[0]!;
      groundArc(pos, ai.attackDir, blow.range + blow.lungeDistance * (winding ? progress : 1), blow.arcDegrees, fill, winding ? COLORS.telegraphEdge : undefined);
    }
  }

  /** A filled ground circle with a solid edge; `progress` (0..1) fills it from the centre. */
  function groundCircle(origin: Vec2, radius: number, fill: string, progress: number): void {
    ctx.strokeStyle = COLORS.telegraphEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, Math.max(1, radius * progress), 0, Math.PI * 2);
    ctx.fill();
  }

  /** Enemy shots in their type colours (move-vfx.ts): spore clouds, leaves, threads, arrows; anything else the projectile orb. */
  function enemyShot(p: Pick<ProjectileState, 'type' | 'radius' | 'vel' | 'remainingMs'>, pos: Vec2, timeMs: number): Drawable | null {
    const look = enemyShotLook(p);
    if (!look) return null;
    if (look.kind === 'cloud') return { y: pos.y - 40, draw: () => drawEnemyShotVfx(ctx, look, p, pos, timeMs) };
    return {
      y: pos.y,
      draw: () => {
        shadow({ x: pos.x, y: pos.y + 8 }, p.radius * 0.7);
        drawEnemyShotVfx(ctx, look, p, pos, timeMs);
      },
    };
  }

  /** Niebla: mist over everything outside the sight circle around the player (world units). */
  function fogVeil(center: Vec2, view: Rect, radiusPx: number): void {
    const edge = FOG.edgeTiles * TILE;
    const gradient = ctx.createRadialGradient(center.x, center.y, Math.max(0, radiusPx - edge), center.x, center.y, radiusPx);
    gradient.addColorStop(0, 'rgba(150, 164, 162, 0)');
    gradient.addColorStop(1, 'rgba(150, 164, 162, 0.97)');
    ctx.fillStyle = gradient;
    ctx.fillRect(view.x - 40, view.y - 40, view.width + 80, view.height + 80);
  }

  /** Projectiles are drawn in their move type's colours (move-vfx.ts). */
  function projectile(p: DrawnProjectile, pos: Vec2, timeMs: number): Drawable {
    return {
      y: pos.y,
      draw: () => {
        shadow({ x: pos.x, y: pos.y + 10 }, p.radius * 0.8);
        drawProjectileVfx(ctx, p, pos, timeMs);
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

  /** Faint dashed ring under the hovered enemy: what a click would lock. */
  function hoverMarker(pos: Vec2, radius: number): void {
    ctx.strokeStyle = COLORS.hover;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, radius + 4, (radius + 4) * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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

  /** Over a remote player: its tag ("P2"), a small HP bar, and "fainted" once down. */
  function nameTag(id: string, hp: number, maxHp: number, pos: Vec2): void {
    const x = Math.round(pos.x);
    const y = Math.round(pos.y - 30);
    ctx.textAlign = 'center';
    ctx.font = canvasFont(FONT.hudPx, true);
    const text = hp > 0 ? id.toUpperCase() : `${id.toUpperCase()} ${t('net.fainted')}`;
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = hp > 0 ? '#9fd8ff' : '#9aa0a6';
    ctx.fillText(text, x, y);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 12, y + 3, 24, 3);
    ctx.fillStyle = hp / maxHp > 0.3 ? '#5ad16a' : '#e0524a';
    ctx.fillRect(x - 12, y + 3, Math.round(24 * Math.max(0, Math.min(1, hp / maxHp))), 3);
  }

  function numbers(list: readonly FloatingNumber[]): void {
    ctx.textAlign = 'center';
    for (const n of list) {
      const life = n.ageMs / JUICE.numberLifeMs;
      ctx.globalAlpha = 1 - life * life;
      ctx.font = canvasFont(n.big ? 16 : FONT.hudPx, true);
      // Fraction-of-max-HP hazards (collapse, fog chill) are not whole numbers: show them rounded.
      const text = n.style === 'blocked' ? t('hud.blocked') : String(Math.round(n.value));
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
    // The dungeon's tile and arena colours replace the defaults for this frame.
    Object.assign(COLORS, frame.palette ?? CRYPT.palette);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const event = shakeOffset(juice, random);
    const rumble = rumbleOffset(frame.rumble, random);
    const shake = { x: event.x + rumble.x, y: event.y + rumble.y };
    const ox = Math.round((view.x + shake.x) * pixelScale);
    const oy = Math.round((view.y + shake.y) * pixelScale);
    ctx.setTransform(pixelScale, 0, 0, pixelScale, -ox, -oy);

    floor(current, view, timeMs);
    if (current.arena.stairs) stairsTile(current.arena.stairs, timeMs);
    if (frame.exit) exitGate(frame.exit, frame.exitOpen, timeMs);
    for (const b of current.berries) berry(b.pos, timeMs);

    const positions = interpolatedPositions(frame.prev, current, frame.alpha);
    const posOf = (id: string, fallback: Vec2) => positions.get(id) ?? fallback;

    // Ground layer: telegraphs and shadows under everything.
    for (const enemy of current.enemies) if (enemy.alive) telegraphs(enemy, posOf(enemy.id, enemy.pos));
    drawPlayerVfx(ctx, playerVfx(current.player), posOf('player', current.player.pos), timeMs);

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
          const flicker = enemy.alive ? (enemy.hitstunMs > 0 && Math.floor(timeMs / 50) % 2 === 0 ? 0.55 : 1) : Math.max(0, 1 - sinceDefeatMs / 1100);
          // Decidueye fading into the fog before it reappears at the edge.
          const vanishing = enemy.alive && enemy.ai.mode === 'transform' && ENEMY_BEHAVIOUR[enemy.species]?.kind === 'archer';
          const fade = vanishing ? flicker * Math.max(0.1, 1 - enemy.ai.modeMs / Math.max(1, enemy.ai.modeDurationMs)) : flicker;
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
        // Under Illusion (Zorua) the player shimmers, half see-through.
        const veiled = illusionActive(current.player) ? 0.55 + 0.15 * Math.sin(timeMs / 180) : 1;
        drawSprite(playerAnim(current.player, { timeMs, sinceHurtMs: frame.sinceHurtMs, moving: frame.moving }), playerPos, veiled);
      },
    });
    for (const remote of current.remotes) {
      const pos = posOf(`remote:${remote.id}`, remote.player.pos);
      const before = frame.prev.remotes.find((r) => r.id === remote.id)?.player.pos;
      const moving = before !== undefined && (before.x !== remote.player.pos.x || before.y !== remote.player.pos.y);
      drawables.push({
        y: pos.y,
        draw: () => {
          shadow(pos, TUNING.player.radius);
          // Remote hurt flashes are not sent: no hurt animation, a fainted player keeps the last Faint frame.
          drawSprite(playerAnim(remote.player, { timeMs, sinceHurtMs: Number.POSITIVE_INFINITY, moving }), pos, remote.player.hp > 0 ? 1 : 0.7);
          nameTag(remote.id, remote.player.hp, remote.player.maxHp, pos);
        },
      });
    }
    for (const p of current.projectiles) {
      const pos = posOf(p.id, p.pos);
      drawables.push((p.owner === 'enemy' ? enemyShot(p, pos, timeMs) : null) ?? projectile(p, pos, timeMs));
    }
    // Other players' projectiles: drawn only, as reported (they hit nothing here).
    for (const remote of current.remotes) for (const p of remote.projectiles) drawables.push(projectile({ owner: 'player', radius: p.radius }, p.pos, timeMs));
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    const hovered = current.enemies.find((e) => e.id === frame.hoverId && e.alive);
    if (hovered) hoverMarker(posOf(hovered.id, hovered.pos), hovered.radius);
    const target = current.enemies.find((e) => e.id === current.lock.targetId);
    if (target) lockMarker(posOf(target.id, target.pos), target.radius, timeMs);
    numbers(juice.numbers);
    if (current.fog) fogVeil(playerPos, view, fogRadiusTiles(current.fog) * TILE);

    // Screen space: slow-mo tint and HUD.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (current.slowMoMs > 0) {
      ctx.fillStyle = COLORS.slowMo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawHud(ctx, current, juice, view, frame.floor, frame.coins);
    if (frame.minimap) drawMinimap(ctx, current, frame.minimap, view, timeMs);
    if (frame.log) drawMessageLog(ctx, frame.log, timeMs, view.height);
    if (frame.card) drawFloorCard(ctx, frame.card, timeMs, view.width, view.height);
    if (frame.intro) drawDungeonIntro(ctx, frame.intro, timeMs, view.width, view.height);
    if (frame.nowPlaying) {
      // Touch: above the message log, clear of the action buttons in the bottom-right corner.
      const logLines = frame.touchUi && frame.log ? visibleMessages(frame.log, timeMs).length : 0;
      const at = frame.touchUi ? { x: 8, y: view.height - 18 - (logLines > 0 ? logLines * 13 + 15 : 0) } : undefined;
      drawNowPlaying(ctx, frame.nowPlaying, timeMs, view.width, view.height, at);
    }
    if (frame.spell) drawSpellBanner(ctx, frame.spell, timeMs, view.width);
  }

  return { draw };
}
