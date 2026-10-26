import { drawHerald, heraldScale } from './herald-vfx';
import { heraldOf } from '../core/herald/brain';
import { AEGISLASH, ENEMY_BEHAVIOUR, type ArcherDef, type TreantDef } from '../data/enemies';
import { ELITE_TRAIT_DEFS, type Difficulty } from '../data/difficulty';
import { LEADER } from '../data/encounters';
import { worldDifficulty } from '../core/difficulty';
import { pierceZone, type PierceZone } from '../core/victim';
import { behaviourFor } from '../core/tricks';
import { COOP_REVIVE } from '../data/party-scaling';
import { rootLanes } from '../core/treant';
import { TYPE_COLORS } from '../ui/tokens';
import { drawEclipseZones, ECHO_FILTER } from './eclipse-echo-view';
import { isWound, woundScale } from '../data/story-quests';
import { drawNest, drawSimaEvent, drawSimaHud } from './sima-events-view';
import { FOG } from '../data/dungeon';
import { fogRadiusTiles } from '../core/fog';
import { DIVE_LOCK_MS, rainSafeLane, stitchSources } from '../core/archer';
import { shadowGapX } from '../core/boss';
import { MOVES } from '../data/moves';
import { SPRITES } from '../data/sprites';
import { TUNING } from '../data/tuning';
import { t } from '../i18n';
import { collapseFront, type CollapseState } from '../core/collapse';
import type { EnemyState, Obstacle, ProjectileState, Rect, WorldState } from '../core/state';
import { isWall, tileOf, type TileGrid } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import { AIM_DRAG } from './touch';
import { sheetKey, type SheetStore } from './assets';
import { cardAlpha, drawFloorCard, type FloorCard } from './card';
import { drawGateLine, drawGateNotice, drawWaitLine, GATE_NOTICE_MS, gateNotice, type GateNotice } from './hud';
import { drawCaptureNotice, drawCardDeclaration, drawDungeonIntro, drawNowPlaying, drawSpellBanner, type CaptureNotice, type DungeonIntro, type NowPlaying, type SpellBanner } from './intro-card';
import { drawRunClock, type RunClock } from './clock-hud';
import { CRYPT, type DungeonDecor, type TilePalette } from '../data/dungeons';
import { caveCover, caveDecor, cavesArena, crystal, deepEdge, drip, floodVeil, waterTile, type CaveDecor } from './cave-decor';
import { floodLevel } from '../core/flood';
import { danmakuSinking, drawCardFight, drawDanmaku } from './danmaku-vfx';
import { cardGuard, fightOf, inTurn } from '../core/cards';
import { cardInfo } from '../data/cards';
import { drawMinimap, type MinimapMemory } from './minimap';
import { drawHud } from './hud';
import { hudSpace } from '../ui/hud-layout';
import { drawMessageLog, visibleMessages, type MessageLog } from './message-log';
import { canvasFont, FONT } from '../ui/tokens';
import { JUICE, rumbleOffset, shakeOffset, type FloatingNumber, type JuiceState } from './juice';
import { enemyAnim, playerAnim, type AnimChoice } from './sprite-anim';
import { drawEnemyShotVfx, drawPlayerVfx, drawProjectileVfx, enemyAttackType, enemyShotLook, playerVfx, telegraphFill, withAlpha, type DrawnProjectile } from './move-vfx';
import { ringRadius } from '../core/roster';
import { rollReach } from '../core/swamp-brains';
import { drawQueenTelegraph, drawUltraTelegraph } from './swamp-telegraphs';
import { illusionActive } from '../core/passives';
import { interpolatedPositions, visibleTiles } from './view';
import { cryptDecor, decorHash, type CryptDecor } from './crypt-decor';
import { forestDecor, wispGuide, type Firefly, type ForestDecor } from './forest-decor';
import { arenaFireflies, drawForestAir, drawForestArena, drawForestFloorDecor, drawForestTree, drawWisp } from './forest-draw';
import { tileDistances } from '../core/dungeon';
import { cacheLeft } from '../core/wisp';
import { drawDeadTree, drawGas, drawPool, drawReeds, drawSpores, drawSwampArena, drawSwampBlock, drawToxicMist, swampDecor, type SwampDecor } from './swamp-decor';
import { abyssRim, abyssWallTile, drawFallingLight, drawSimaBackdrop, eliteFilter, type SimaLook } from './sima-backdrop';

/** Everything one rendered frame needs; the renderer keeps no game state of its own. */
export interface RenderFrame {
  prev: WorldState;
  current: WorldState;
  /** Fraction of a fixed step elapsed since `current` (interpolation). */
  alpha: number;
  juice: JuiceState;
  view: Rect;
  pixelScale: number;
  /** Integer scale of the screen-space HUD (src/ui/hud-layout.ts); the pixel scale when absent. */
  hudScale?: number;
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
  /** The dungeon's decoration (the Crypt's candles, graves, braziers and treasure; the Forest's roots, mushrooms, trees and mist; the caves' water and crystals), if any. */
  decor?: Decor;
  /** Floor 1: the dungeon's name and subtitle, while they show. */
  intro?: DungeonIntro | null;
  /** The track that started last ("♪ title"), while it shows. */
  nowPlaying?: NowPlaying | null;
  /** On-screen touch controls are up: HUD notes keep clear of the action buttons. */
  touchUi?: boolean;
  /** Touch: the direction a slot button is being dragged to aim (src/ui/touch-controls.ts), drawn as an aim line from the player. */
  touchAim?: Vec2 | null;
  /** Shared runs: player id -> nickname for the tags over remote players (their id when absent). */
  names?: ReadonlyMap<string, string>;
  /** The boss spell card just announced, while it shows. */
  spell?: SpellBanner | null;
  /** The card this player just captured, while its notice shows. */
  capture?: CaptureNotice | null;
  /** The endless dungeon's run clock (absent elsewhere). */
  clock?: RunClock | null;
  /** The Sima del Eclipse: the eclipse backdrop beyond the map, and the abyss band's floating islands. */
  sima?: SimaLook | null;
  /** Co-op: this player is ready to leave the floor and the party still waits for others ("Esperando a 2"); after a wipe, waiting for the host. */
  waiting?: string | null;
  /** The mid-boss bonfire burning on this floor (core/bonfire.ts), where it stands. */
  bonfire?: Vec2 | null;
  /** A Senda's memory fragment lying on this floor (docs/story-quests.md), where it lies. */
  memory?: Vec2 | null;
  /** Co-op, fainted: the teammate the camera follows ("Mirando a Ana"). */
  spectating?: string | null;
  /**
   * The Sima as this player remembers it (app/sima-lore.ts): enemy id -> the
   * species whose name it goes by (a faceless guardian, someone's shadow) on
   * the boss bar; presentation only.
   */
  shownAs?: ReadonlyMap<string, string>;
  /** Enemies this player does not know the face of: drawn as a silhouette. */
  silhouettes?: ReadonlySet<string>;
}

/** A Sima boss the player does not know yet: black, with a pale rim (docs/sima-redesign.md). */
const SILHOUETTE_FILTER = 'brightness(0) drop-shadow(0 0 1px rgba(220, 200, 255, 0.9)) drop-shadow(0 0 4px rgba(120, 40, 70, 0.9))';

const COLORS = {
  aimLine: '#ffd447',
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
  /** The floor's gate: the seal over shut stairs and on its enemy, the locked door's bars. */
  gateSeal: '#e0463c',
  gateBars: '#6a6f7e',
  /** A group's leader: its crown and ring; a slowed follower's drop. */
  leader: '#f2c44c',
  leaderGem: '#d0402c',
  broken: '#7fb2ff',
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

/** The Sima's hunter: Houndour's sheets in the eclipse's shadow. */
const HUNTER_FILTER = 'brightness(0.35) sepia(1) hue-rotate(-50deg) saturate(4) drop-shadow(0 0 2px #ff2a3a)';

const TILE = 32;
const DEG = Math.PI / 180;

type Decor = DungeonDecor | null;

interface Drawable {
  y: number;
  draw: () => void;
}

export interface Renderer {
  draw(frame: RenderFrame): void;
}

export function createRenderer(canvas: HTMLCanvasElement, sheets: SheetStore): Renderer {
  /** The arena of the frame being drawn (the shadow-sword wall spans it). */
  let currentArena: { width: number; height: number } | null = null;
  /** The world being drawn (a herald's telegraphs read its def from it). */
  let currentWorld: WorldState | null = null;
  /** The world being drawn's tier (positional telegraphs depend on it). */
  let currentTier: Difficulty = 'easy';
  /** Real time of the frame being drawn (looping telegraph animations). */
  let currentTimeMs = 0;
  /** The floor's gate as last drawn, and the "gate opened" notice it raised (hud.ts `gateNotice`). */
  let lastGate: WorldState['gate'];
  let openedNotice: GateNotice | null = null;
  const ctx = canvas.getContext('2d')!;
  const random = Math.random;

  function drawSprite(choice: AnimChoice, pos: Vec2, alpha = 1, scaleBy = 1): void {
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
      Math.round(pos.x - anchor.x * scaleBy),
      Math.round(pos.y - anchor.y * scaleBy),
      meta.frameWidth * scaleBy,
      meta.frameHeight * scaleBy,
    );
    ctx.globalAlpha = 1;
  }

  /** Harder tiers: an elite glows in its trait's colour (a pulsing ring and a wash over its body), readable at a glance. */
  function eliteAura(enemy: EnemyState, pos: Vec2, timeMs: number): void {
    const tint = ELITE_TRAIT_DEFS[enemy.elite!].tint;
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 220);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.35 * pulse;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(Math.round(pos.x), Math.round(pos.y), enemy.radius + 4, (enemy.radius + 4) * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.18 + 0.12 * pulse;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(Math.round(pos.x), Math.round(pos.y - enemy.radius * 0.6), enemy.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** A wave enemy just brought back into its sealed room (core/bounds.ts): a grey puff ring that grows and fades. */
  function warpPoof(enemy: EnemyState, pos: Vec2): void {
    const t = 1 - (enemy.warpMs ?? 0) / TUNING.bounds.warpMs;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.7 * (1 - t));
    ctx.strokeStyle = '#d8d4e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(Math.round(pos.x), Math.round(pos.y - enemy.radius * 0.5), enemy.radius + 4 + t * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Meaningful encounters (core/leaders.ts): a leader wears a gold crown and
   * a gold ring that swells while it winds up its rally cry; a follower whose
   * leader fell shows its break (stars for a stagger, a blue drop for a slow).
   */
  function leaderMarks(enemy: EnemyState, pos: Vec2, timeMs: number): void {
    const x = Math.round(pos.x);
    const top = Math.round(pos.y - enemy.radius * 2 - 6);
    ctx.save();
    if (enemy.leader) {
      const calling = enemy.leader.rallying;
      const pulse = 0.5 + 0.5 * Math.sin(timeMs / 260);
      const swell = calling === undefined ? 0 : Math.min(1, calling / LEADER.rally.telegraphMs);
      ctx.globalAlpha = calling === undefined ? 0.35 + 0.25 * pulse : 0.5 + 0.5 * swell;
      ctx.strokeStyle = COLORS.leader;
      ctx.lineWidth = calling === undefined ? 2 : 3;
      ctx.beginPath();
      const r = enemy.radius + 7 + (calling === undefined ? 0 : swell * (LEADER.rally.radius - enemy.radius - 7));
      ctx.ellipse(x, Math.round(pos.y), r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      // The crown: three points over a band.
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.leader;
      ctx.fillRect(x - 6, top, 12, 3);
      for (const dx of [-6, -1, 4]) ctx.fillRect(x + dx, top - 3 - (dx === -1 ? 2 : 0), 2, 3 + (dx === -1 ? 2 : 0));
      ctx.fillStyle = COLORS.leaderGem;
      ctx.fillRect(x - 1, top + 1, 2, 1);
    } else if (enemy.broken?.rule === 'stagger') {
      ctx.fillStyle = COLORS.leader;
      for (let i = 0; i < 3; i++) {
        const a = timeMs / 180 + (i * Math.PI * 2) / 3;
        ctx.fillRect(Math.round(x + Math.cos(a) * 8) - 1, Math.round(top + 2 + Math.sin(a) * 3) - 1, 2, 2);
      }
    } else if (enemy.broken?.rule === 'slow') {
      ctx.fillStyle = COLORS.broken;
      ctx.fillRect(x - 1, top + ((timeMs / 60) % 6), 2, 3);
    }
    ctx.restore();
  }

  /** Touch drag-aim preview: a dashed line and a chevron along the aim, from the player's feet. */
  function aimLine(from: Vec2, dir: Vec2): void {
    const reach = AIM_DRAG.reach;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = COLORS.aimLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(Math.round(from.x + dir.x * 14), Math.round(from.y + dir.y * 14));
    ctx.lineTo(Math.round(from.x + dir.x * reach), Math.round(from.y + dir.y * reach));
    ctx.stroke();
    ctx.setLineDash([]);
    const tip = { x: from.x + dir.x * reach, y: from.y + dir.y * reach };
    const side = { x: -dir.y, y: dir.x };
    ctx.beginPath();
    ctx.moveTo(tip.x - dir.x * 8 + side.x * 6, tip.y - dir.y * 8 + side.y * 6);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x - dir.x * 8 - side.x * 6, tip.y - dir.y * 8 - side.y * 6);
    ctx.stroke();
    ctx.restore();
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

  function tiles(grid: TileGrid, view: Rect, collapse: CollapseState | undefined, timeMs: number, abyss = false): void {
    const { x0, y0, x1, y1 } = visibleTiles(view, grid);
    const front = collapse ? collapseFront(collapse) : 0;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const x = tx * TILE;
        const y = ty * TILE;
        if (isWall(grid, tx, ty) && abyss) {
          // The Sima's abyss: no wall, only the void and the underside of the island above.
          abyssWallTile(ctx, grid, tx, ty);
        } else if (isWall(grid, tx, ty)) {
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
          if (abyss) abyssRim(ctx, grid, tx, ty, COLORS.tileWallLip);
          else if (isWall(grid, tx, ty - 1)) {
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

  /**
   * The floor's gate (core/gates.ts) in the world: a red seal over shut
   * stairs, iron bars across a locked stairs room's doorways.
   */
  function gateMarks(state: WorldState, timeMs: number): void {
    const gate = state.gate;
    if (!gate || gate.done) return;
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 200);
    const stairs = state.arena.stairs;
    if (stairs) {
      const cx = stairs.x + stairs.width / 2;
      const cy = stairs.y + stairs.height / 2;
      ctx.save();
      ctx.globalAlpha = 0.65 + 0.35 * pulse;
      ctx.strokeStyle = COLORS.gateSeal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, stairs.width * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 7);
      ctx.lineTo(cx + 7, cy + 7);
      ctx.moveTo(cx + 7, cy - 7);
      ctx.lineTo(cx - 7, cy + 7);
      ctx.stroke();
      ctx.restore();
    }
    const grid = state.arena.tiles;
    if (gate.doors && grid) {
      ctx.fillStyle = COLORS.gateBars;
      for (const i of gate.doors) {
        const x = (i % grid.cols) * TILE;
        const y = Math.floor(i / grid.cols) * TILE;
        for (let b = 0; b < 4; b++) ctx.fillRect(x + 3 + b * 8, y + 2, 3, TILE - 4);
        ctx.fillRect(x + 1, y + TILE / 2 - 2, TILE - 2, 3);
      }
    }
  }

  /** A small gold key, over its bearer's head. */
  function keyGlyph(x: number, y: number): void {
    const rx = Math.round(x);
    const ry = Math.round(y);
    ctx.fillStyle = COLORS.leader;
    ctx.fillRect(rx - 5, ry - 3, 5, 5);
    ctx.fillRect(rx, ry - 1, 7, 2);
    ctx.fillRect(rx + 4, ry + 1, 2, 2);
    ctx.fillStyle = COLORS.stairsPit;
    ctx.fillRect(rx - 4, ry - 2, 2, 2);
  }

  /** The gate's enemy: a red seal (or the key it carries) over its head, readable from across the room. */
  function gateTargetMark(enemy: EnemyState, pos: Vec2, kind: string, timeMs: number): void {
    const x = Math.round(pos.x);
    const y = Math.round(pos.y - enemy.radius * 2 - (enemy.leader ? 16 : 8) - 2 * Math.sin(timeMs / 180));
    if (kind === 'key') {
      keyGlyph(x, y);
      return;
    }
    ctx.save();
    ctx.fillStyle = COLORS.gateSeal;
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Crypt decoration of a generated floor, worked out once per floor. */
  const decorOf = new WeakMap<TileGrid, CryptDecor>();
  function cryptFloorDecor(state: WorldState, view: Rect, timeMs: number): void {
    const grid = state.arena.tiles!;
    let decor = decorOf.get(grid);
    if (!decor) {
      const stairs = state.arena.stairs ? tileOf({ x: state.arena.stairs.x + 1, y: state.arena.stairs.y + 1 }) : undefined;
      decor = cryptDecor({ ...grid, rooms: state.arena.rooms ?? [], ...(stairs ? { stairs } : {}) });
      decorOf.set(grid, decor);
    }
    const front = state.collapse ? collapseFront(state.collapse) : 0;
    const fallen = (x: number, y: number) => {
      const d = state.collapse ? (state.collapse.dist[y * grid.cols + x] ?? -1) : -1;
      return front > 0 && d >= 0 && d < front;
    };
    const visible = (x: number, y: number) => x * TILE + TILE >= view.x && x * TILE <= view.x + view.width && y * TILE + TILE >= view.y && y * TILE <= view.y + view.height + TILE;
    for (const s of decor.slabs) if (visible(s.x, s.y) && !fallen(s.x, s.y)) graveSlab(s.x * TILE, s.y * TILE, decorHash(s.x, s.y, 3));
    for (const c of decor.candles) if (visible(c.x, c.y)) wallCandle(c.x * TILE, c.y * TILE, timeMs, decorHash(c.x, c.y, 5));
  }

  /** A grave slab set into the floor: a worn lid with a cross carved in it. */
  function graveSlab(x: number, y: number, look: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x + 5, y + 3, 23, 28);
    ctx.fillStyle = look < 0.5 ? '#3a3645' : '#363240';
    ctx.fillRect(x + 4, y + 2, 23, 27);
    ctx.fillStyle = '#4a4558';
    ctx.fillRect(x + 4, y + 2, 23, 2);
    ctx.fillStyle = '#25222d';
    ctx.fillRect(x + 14, y + 8, 3, 15);
    ctx.fillRect(x + 10, y + 12, 11, 3);
  }

  /** A candle on a lit wall face, flickering, with a warm pool of light on the floor below. */
  function wallCandle(x: number, y: number, timeMs: number, phase: number): void {
    const flicker = 0.75 + 0.25 * Math.sin(timeMs / 90 + phase * 40) * Math.sin(timeMs / 230 + phase * 13);
    const cx = x + 8 + Math.round(phase * 16);
    const glow = ctx.createRadialGradient(cx, y + TILE + 6, 1, cx, y + TILE + 6, 30);
    glow.addColorStop(0, `rgba(255, 180, 90, ${0.32 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 180, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 30, y + TILE - 24, 60, 60);
    ctx.fillStyle = '#d9d0b8';
    ctx.fillRect(cx - 2, y + TILE - 9, 4, 7);
    ctx.fillStyle = '#8c826a';
    ctx.fillRect(cx - 3, y + TILE - 3, 6, 2);
    ctx.fillStyle = `rgba(255, 210, 120, ${flicker})`;
    ctx.fillRect(cx - 1, y + TILE - 13 + Math.round(1 - flicker), 2, 4);
    ctx.fillStyle = 'rgba(255, 250, 220, 0.9)';
    ctx.fillRect(cx, y + TILE - 11, 1, 2);
  }

  /** The Crypt's fixed arenas: a worn red carpet up the middle and candles along the top edge. */
  function cryptArena(width: number, height: number, timeMs: number): void {
    ctx.fillStyle = 'rgba(110, 24, 36, 0.55)';
    ctx.fillRect(Math.round(width / 2 - 40), 0, 80, height);
    ctx.fillStyle = 'rgba(200, 160, 70, 0.35)';
    ctx.fillRect(Math.round(width / 2 - 40), 0, 2, height);
    ctx.fillRect(Math.round(width / 2 + 38), 0, 2, height);
    for (let x = 48; x < width - 32; x += 112) wallCandle(x - 16, -TILE, timeMs, decorHash(x, 0, 9));
  }

  /** Forest dressing of a generated floor, worked out once per floor (and the spirit light's walk). */
  const forestOf = new WeakMap<TileGrid, ForestDecor>();
  const wispWalkOf = new WeakMap<TileGrid, number[]>();
  function forestFloor(state: WorldState): ForestDecor {
    const grid = state.arena.tiles!;
    let decor = forestOf.get(grid);
    if (!decor) {
      const stairs = state.arena.stairs ? tileOf({ x: state.arena.stairs.x + 1, y: state.arena.stairs.y + 1 }) : undefined;
      decor = forestDecor({ ...grid, rooms: state.arena.rooms ?? [], ...(stairs ? { stairs } : {}) });
      forestOf.set(grid, decor);
    }
    return decor;
  }
  function fallenAt(state: WorldState): (x: number, y: number) => boolean {
    const front = state.collapse ? collapseFront(state.collapse) : 0;
    const cols = state.arena.tiles?.cols ?? 0;
    return (x, y) => {
      const d = state.collapse ? (state.collapse.dist[y * cols + x] ?? -1) : -1;
      return front > 0 && d >= 0 && d < front;
    };
  }
  /** The forest's fireflies and mist over everything (generated floors and arenas), then the spirit light. */
  const arenaFlies = new Map<string, Firefly[]>();
  function forestAir(state: WorldState, view: Rect, timeMs: number, playerPos: Vec2): void {
    const grid = state.arena.tiles;
    let flies: Firefly[];
    if (grid) flies = forestFloor(state).fireflies;
    else {
      const key = `${state.arena.width}x${state.arena.height}`;
      flies = arenaFlies.get(key) ?? arenaFireflies(state.arena.width, state.arena.height);
      arenaFlies.set(key, flies);
    }
    drawForestAir(ctx, flies, view, timeMs);
    if (!grid || !state.wisp || cacheLeft(state.berries) === 0) return;
    let walk = wispWalkOf.get(grid);
    if (!walk) {
      walk = tileDistances(grid, tileOf(state.wisp.cache));
      wispWalkOf.set(grid, walk);
    }
    const at = wispGuide(grid, state.wisp.cache, playerPos, walk);
    drawWisp(ctx, at, timeMs, at === state.wisp.cache);
  }

  /** Swamp decoration of a generated floor, worked out once per floor. */
  const swampOf = new WeakMap<TileGrid, SwampDecor>();
  function swampFloorDecor(state: WorldState, view: Rect, timeMs: number): void {
    const grid = state.arena.tiles!;
    let decor = swampOf.get(grid);
    if (!decor) {
      const stairs = state.arena.stairs ? tileOf({ x: state.arena.stairs.x + 1, y: state.arena.stairs.y + 1 }) : undefined;
      decor = swampDecor({ ...grid, rooms: state.arena.rooms ?? [], ...(stairs ? { stairs } : {}) });
      swampOf.set(grid, decor);
    }
    const visible = (x: number, y: number) => x * TILE + TILE >= view.x && x * TILE <= view.x + view.width && y * TILE + TILE >= view.y && y * TILE <= view.y + view.height + TILE;
    for (const r of decor.reeds) if (visible(r.x, r.y)) drawReeds(ctx, r.x * TILE, r.y * TILE, decorHash(r.x, r.y, 24));
    for (const t of decor.trees) if (visible(t.x, t.y)) drawDeadTree(ctx, t.x * TILE, t.y * TILE, decorHash(t.x, t.y, 22), timeMs);
  }

  function floor(state: WorldState, view: Rect, timeMs: number, decor: Decor, sima: SimaLook | null = null): void {
    if (state.arena.tiles) {
      const grid = state.arena.tiles;
      // The Sima draws its eclipse backdrop where the void would be.
      if (!sima) {
        ctx.fillStyle = COLORS.mapVoid;
        ctx.fillRect(view.x - 16, view.y - 16, view.width + 32, view.height + 32);
      }
      tiles(grid, view, state.collapse, timeMs, sima?.abyss === true);
      if (decor === 'crypt') cryptFloorDecor(state, view, timeMs);
      if (decor === 'forest') drawForestFloorDecor(ctx, forestFloor(state), view, timeMs, fallenAt(state));
      if (decor === 'caves') caveFloorDecor(state, view, timeMs);
      if (decor === 'swamp') swampFloorDecor(state, view, timeMs);
      // A thin rim marks where the map ends and the void begins.
      ctx.strokeStyle = COLORS.mapRim;
      ctx.lineWidth = 1;
      ctx.strokeRect(-0.5, -0.5, grid.cols * TILE + 1, grid.rows * TILE + 1);
      return;
    }
    const { width, height } = state.arena;
    if (!sima) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(-200, -200, width + 400, height + 400);
    }
    // The checker, visible tiles only (a tile of margin for the shake): one rect of the first colour,
    // then the second colour's squares. Tile edges sit on whole backing pixels (integer scale, rounded
    // offset), so this paints the same pixels as a rect per tile over the whole arena, at a quarter of the calls.
    const cx0 = Math.max(0, Math.floor((view.x - TILE) / TILE) * TILE);
    const cy0 = Math.max(0, Math.floor((view.y - TILE) / TILE) * TILE);
    const cx1 = Math.min(width, view.x + view.width + TILE);
    const cy1 = Math.min(height, view.y + view.height + TILE);
    if (cx1 > cx0 && cy1 > cy0) {
      ctx.fillStyle = COLORS.floorA;
      ctx.fillRect(cx0, cy0, Math.min(width, Math.ceil(cx1 / TILE) * TILE) - cx0, Math.min(height, Math.ceil(cy1 / TILE) * TILE) - cy0);
      ctx.fillStyle = COLORS.floorB;
      for (let y = cy0; y < cy1; y += TILE) {
        const first = ((cx0 + y) / TILE) % 2 === 0 ? cx0 + TILE : cx0;
        for (let x = first; x < cx1; x += 2 * TILE) ctx.fillRect(x, y, Math.min(TILE, width - x), Math.min(TILE, height - y));
      }
    }
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(-1, -1, width + 2, height + 2);
    if (decor === 'crypt') cryptArena(width, height, timeMs);
    if (decor === 'forest') drawForestArena(ctx, width, height, timeMs);
    if (decor === 'caves') cavesArena(ctx, width, height, timeMs);
    if (decor === 'swamp') drawSwampArena(ctx, width, height);
  }

  /** Caves decoration of a generated floor: pools (deep at the rock), crystals and drops; placement worked out once per floor. */
  const caveDecorOf = new WeakMap<TileGrid, CaveDecor>();
  function caveFloorDecor(state: WorldState, view: Rect, timeMs: number): void {
    const grid = state.arena.tiles!;
    let decor = caveDecorOf.get(grid);
    if (!decor) {
      decor = caveDecor(grid);
      caveDecorOf.set(grid, decor);
    }
    const { x0, y0, x1, y1 } = visibleTiles(view, grid);
    const water = state.arena.water;
    const front = state.collapse ? collapseFront(state.collapse) : 0;
    if (water) {
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (water[ty * grid.cols + tx] !== 1) continue;
          const d = state.collapse ? (state.collapse.dist[ty * grid.cols + tx] ?? -1) : -1;
          if (front > 0 && d >= 0 && d < front) continue;
          waterTile(ctx, tx * TILE, ty * TILE, tx, ty, timeMs, deepEdge(grid, tx, ty));
        }
      }
    }
    const visible = (x: number, y: number) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1;
    for (const c of decor.crystals) if (visible(c.x, c.y)) crystal(ctx, c.x * TILE, c.y * TILE, timeMs, decorHash(c.x, c.y, 5));
    for (const d of decor.drips) if (visible(d.x, d.y)) drip(ctx, d.x * TILE, d.y * TILE, timeMs, decorHash(d.x, d.y, 6));
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

  /**
   * A boss room's fog wall (core/fog-wall.ts), Dark Souls style: the room beyond
   * is veiled, and a band of drifting grey-white fog lies along its edge.
   */
  function fogWallVeil(line: number, width: number, timeMs: number): void {
    ctx.fillStyle = 'rgba(8, 6, 14, 0.55)';
    ctx.fillRect(0, 0, width, line);
    const band = 26;
    for (let x = 0; x < width; x += 8) {
      const wave = Math.sin(timeMs / 420 + x / 37) + Math.sin(timeMs / 270 - x / 23);
      const top = line - band + wave * 4;
      ctx.fillStyle = `rgba(214, 218, 232, ${0.42 + 0.12 * Math.sin(timeMs / 350 + x / 19)})`;
      ctx.fillRect(x, top, 8, band + 10 - wave * 2);
    }
    ctx.fillStyle = 'rgba(240, 242, 250, 0.35)';
    ctx.fillRect(0, line - 3 + Math.sin(timeMs / 300) * 2, width, 3);
  }

  /** A memory fragment: a small pale keepsake on the floor that breathes a soft light, with motes rising off it. */
  function memoryProp(at: Vec2, timeMs: number): void {
    const breath = 0.5 + 0.5 * Math.sin(timeMs / 420);
    const glow = ctx.createRadialGradient(at.x, at.y - 4, 1, at.x, at.y - 4, 30);
    glow.addColorStop(0, `rgba(255, 236, 170, ${0.35 + 0.25 * breath})`);
    glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(at.x - 30, at.y - 34, 60, 60);
    ctx.fillStyle = '#e8d48a';
    ctx.fillRect(at.x - 5, at.y - 4, 10, 6);
    ctx.fillStyle = '#fff6d0';
    ctx.fillRect(at.x - 3, at.y - 6, 6, 3);
    for (let i = 0; i < 4; i++) {
      const phase = ((timeMs / 1000) * 0.5 + i / 4) % 1;
      ctx.globalAlpha = (1 - phase) * 0.8;
      ctx.fillRect(Math.round(at.x - 6 + i * 4), Math.round(at.y - 8 - phase * 22), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** The mid-boss bonfire: a ring of stones, crossed logs and a flickering flame with its glow. */
  function bonfireProp(at: Vec2, timeMs: number): void {
    const flicker = Math.sin(timeMs / 90) * 1.5 + Math.sin(timeMs / 47);
    const glow = ctx.createRadialGradient(at.x, at.y - 6, 2, at.x, at.y - 6, 46);
    glow.addColorStop(0, 'rgba(255, 170, 70, 0.35)');
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(at.x - 46, at.y - 52, 92, 92);
    ctx.fillStyle = '#5b5560';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(Math.round(at.x + Math.cos(a) * 12) - 2, Math.round(at.y + Math.sin(a) * 6) - 2, 4, 4);
    }
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(at.x - 9, at.y - 2, 18, 3);
    ctx.fillRect(at.x - 2, at.y - 5, 4, 8);
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(at.x - 5, at.y - 12 - flicker, 10, 10 + flicker);
    ctx.fillStyle = '#ffd36a';
    ctx.fillRect(at.x - 2, at.y - 9 - flicker, 4, 6 + flicker);
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

  function pillar(rect: Obstacle, decor: Decor, timeMs: number): Drawable {
    const lift = 18;
    if (decor === 'swamp') return { y: rect.y + rect.height, draw: () => drawSwampBlock(ctx, rect, timeMs) };
    if (decor === 'crypt' && !rect.cover) return treasure(rect, timeMs);
    // The forest's arenas: old trees (the roost's thick ones stop arrows).
    if (decor === 'forest') return { y: rect.y + rect.height, draw: () => drawForestTree(ctx, rect, lift, rect.cover === true) };
    if (decor === 'caves') return { y: rect.y + rect.height, draw: () => caveCover(ctx, rect, lift, timeMs) };
    return {
      y: rect.y + rect.height,
      draw: () => {
        ctx.fillStyle = COLORS.pillarSide;
        ctx.fillRect(rect.x, rect.y - lift + rect.height - 4, rect.width, lift + 4);
        ctx.fillStyle = COLORS.pillarTop;
        ctx.fillRect(rect.x, rect.y - lift, rect.width, rect.height);
        if (decor === 'crypt') brazier(rect, lift, timeMs);
      },
    };
  }

  /** A brazier burning on top of a Crypt pillar. */
  function brazier(rect: Rect, lift: number, timeMs: number): void {
    const cx = rect.x + rect.width / 2;
    const top = rect.y - lift + 6;
    const flicker = 0.8 + 0.2 * Math.sin(timeMs / 80 + rect.x) * Math.sin(timeMs / 190 + rect.y);
    const glow = ctx.createRadialGradient(cx, top, 2, cx, top, 46);
    glow.addColorStop(0, `rgba(255, 160, 70, ${0.3 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 160, 70, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 46, top - 46, 92, 92);
    ctx.fillStyle = '#1f1b26';
    ctx.fillRect(cx - 11, top, 22, 6);
    ctx.fillStyle = '#6e5a3a';
    ctx.fillRect(cx - 11, top, 22, 2);
    const h = Math.round(8 + 4 * flicker);
    ctx.fillStyle = 'rgba(255, 120, 40, 0.95)';
    ctx.fillRect(cx - 7, top - h + 2, 14, h);
    ctx.fillStyle = 'rgba(255, 200, 90, 0.95)';
    ctx.fillRect(cx - 4, top - h + 4, 8, h - 3);
    ctx.fillStyle = 'rgba(255, 245, 210, 0.9)';
    ctx.fillRect(cx - 1, top - h + 6, 3, 3);
  }

  /** The king's treasure in Sableye's vault: a heap of gold with gems that catch the light. */
  function treasure(rect: Rect, timeMs: number): Drawable {
    return {
      y: rect.y + rect.height,
      draw: () => {
        const { x, y, width: w, height: h } = rect;
        ctx.fillStyle = '#5a4416';
        ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
        ctx.fillStyle = '#a07a22';
        ctx.fillRect(x + 4, y + h * 0.15, w - 8, h * 0.6);
        ctx.fillStyle = '#d9a93a';
        ctx.fillRect(x + 10, y, w - 20, h * 0.4);
        const gems = ['#7fd4ff', '#ff6b9a', '#8cf08c'];
        gems.forEach((colour, i) => {
          const twinkle = Math.sin(timeMs / 300 + i * 2 + x) > 0.6;
          ctx.fillStyle = twinkle ? '#ffffff' : colour;
          ctx.fillRect(Math.round(x + 8 + i * ((w - 18) / 2)), Math.round(y + h * 0.3 + (i % 2) * 6), 4, 4);
        });
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

  /**
   * A positional attack's own warning (pierceRoll: walk or roll OUT of it,
   * not through it): a pulsing white and violet double border on its area
   * and a "!" over the enemy.
   */
  function pierceMark(enemy: EnemyState, pos: Vec2, zone: PierceZone, timeMs: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 90);
    ctx.save();
    if (zone.kind === 'pockets') {
      // Everything but the pockets is struck: their edges get the double border (walk into one).
      for (const at of zone.centers) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + 0.4 * pulse})`;
        ctx.beginPath();
        ctx.arc(at.x, at.y, zone.radius - 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(176, 96, 255, ${0.6 + 0.4 * (1 - pulse)})`;
        ctx.beginPath();
        ctx.arc(at.x, at.y, zone.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (zone.kind === 'ring') {
      // A closing ring (the noose): both edges of its band get the double border.
      for (const r of [zone.radius - zone.width / 2, zone.radius + zone.width / 2]) {
        if (r <= 0) continue;
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + 0.4 * pulse})`;
        ctx.beginPath();
        ctx.arc(zone.center.x, zone.center.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(176, 96, 255, ${0.6 + 0.4 * (1 - pulse)})`;
        ctx.beginPath();
        ctx.arc(zone.center.x, zone.center.y, r + (r === zone.radius - zone.width / 2 ? -4 : 4), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (zone.kind === 'circle' || zone.kind === 'shape' || zone.kind === 'mark') {
      const radius = zone.kind === 'shape' ? enemy.radius + 12 : zone.radius;
      // A mark sits away from the enemy (where the riptide surfaces); circles and shapes around it.
      const at = zone.kind === 'mark' ? zone.center : pos;
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + 0.4 * pulse})`;
      ctx.beginPath();
      ctx.arc(at.x, at.y, radius + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(176, 96, 255, ${0.6 + 0.4 * (1 - pulse)})`;
      ctx.beginPath();
      ctx.arc(at.x, at.y, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The "!" badge: a violet diamond with a white mark, over the enemy.
    const x = Math.round(pos.x);
    const y = Math.round(pos.y - enemy.radius - 18 - 2 * pulse);
    ctx.fillStyle = '#b060ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 4, 2, 5);
    ctx.fillRect(x - 1, y + 2, 2, 2);
    ctx.restore();
  }

  /** A positional lane (pierceRoll: step out of it, a roll will not help): the pierce mark's pulsing white and violet double edge along both sides. */
  function pierceLane(x: number, w: number, height: number, timeMs: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 90);
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + 0.4 * pulse})`;
    ctx.fillRect(x + 3, 0, 1, height);
    ctx.fillRect(x + w - 4, 0, 1, height);
    ctx.fillStyle = `rgba(176, 96, 255, ${0.55 + 0.4 * (1 - pulse)})`;
    ctx.fillRect(x + 5, 0, 2, height);
    ctx.fillRect(x + w - 7, 0, 2, height);
    ctx.restore();
  }

  /** Readable wind-ups: lanes, arcs and rings on the ground (docs/gdd.md §10: readable on a stream). */
  function telegraphs(enemy: EnemyState, pos: Vec2, timeMs = 0): void {
    const { ai } = enemy;
    const progress = ai.modeDurationMs > 0 ? ai.modeMs / ai.modeDurationMs : 1;
    const winding = ai.mode === 'telegraph';
    const striking = ai.mode === 'attack';
    const zone = pierceZone(enemy, currentTier, currentArena ?? undefined);
    if (zone) pierceMark(enemy, pos, zone, timeMs);
    if (enemy.boss && ((enemy.boss.stance === 'shield' && ai.mode !== 'transform') || cardGuard(enemy) === 'front')) {
      ctx.strokeStyle = COLORS.guard;
      ctx.lineWidth = 3;
      const angle = Math.atan2(enemy.facing.y, enemy.facing.x);
      const half = (AEGISLASH.shield.blockArcDegrees * DEG) / 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 8, angle - half, angle + half);
      ctx.stroke();
    }
    // "Tu turno": the boss lowers its guard and breathes; a soft, dimming halo under it says "now" (no new threat comes until it ends).
    if (enemy.boss && inTurn(enemy)) {
      const left = 1 - progress;
      const breath = 0.5 + 0.5 * Math.sin(timeMs / 160);
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.22 * left * breath;
      ctx.fillStyle = 'rgba(255, 236, 170, 1)';
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + enemy.radius * 0.6, enemy.radius + 10, (enemy.radius + 10) * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5 * left;
      ctx.strokeStyle = 'rgba(255, 236, 170, 1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 6 + 4 * breath, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // A herald: its own telegraphs, from its generated def (adapters/herald-vfx.ts).
    if (enemy.herald && currentWorld) {
      const herald = heraldOf(currentWorld, enemy);
      if (herald) drawHerald(ctx, currentWorld, enemy, herald, pos, currentTimeMs);
      return;
    }
    // The behaviour at the world's tier, so the wind-ups show the tier's extra arms, waves and rings.
    const def = behaviourFor(enemy.species, currentTier);
    // A guardian's spell card (core/cards.ts): its declaration and its moves' telegraphs.
    const fight = cardInfo(enemy.boss?.stance) ? fightOf(def) : undefined;
    if (fight) {
      if (currentArena) drawCardFight(ctx, enemy, fight, pos, currentArena, currentTimeMs);
      return;
    }
    if (def?.kind === 'danmaku') {
      if (currentArena) drawDanmaku(ctx, enemy, def, pos, currentArena, currentTimeMs);
      return;
    }
    if (def?.kind === 'queen' || def?.kind === 'ultra') {
      const arena = currentArena ?? { width: 0, height: 0 };
      if (def.kind === 'queen') drawQueenTelegraph(ctx, enemy, def, arena, pos, currentTimeMs);
      else drawUltraTelegraph(ctx, enemy, def, arena, pos, currentTimeMs);
      return;
    }
    if (ai.mode === 'transform' && def?.kind === 'boss') {
      // The unsheathing (phase 2) is a bigger, double ring.
      const big = enemy.boss?.stance === 'unsheathe';
      ctx.strokeStyle = COLORS.transform;
      ctx.lineWidth = big ? 3 : 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 6 + (big ? 70 : 30) * progress, 0, Math.PI * 2);
      ctx.stroke();
      if (big) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, enemy.radius + 6 + 70 * ((progress + 0.5) % 1), 0, Math.PI * 2);
        ctx.stroke();
      }
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
    if (def?.kind === 'boss' && enemy.boss) {
      const stance = enemy.boss.stance;
      if (stance === 'oaths' && (winding || striking)) {
        // The planted shield guards every side.
        ctx.strokeStyle = COLORS.guard;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, enemy.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (stance === 'midnight' && (winding || striking)) {
        groundCircle(pos, def.phase2.midnight.radius, telegraphFill(enemyAttackType(enemy), winding), winding ? progress : 1);
        return;
      }
      if (stance === 'oaths' && winding) {
        const o = def.phase2.oaths;
        for (let i = 0; i < o.perVolley; i++) {
          const a = Math.atan2(ai.attackDir.y, ai.attackDir.x) + ((-o.spreadDegrees / 2 + (i * o.spreadDegrees) / (o.perVolley - 1)) * Math.PI) / 180;
          groundLane(pos, { x: Math.cos(a), y: Math.sin(a) }, 120, 3, telegraphFill(enemyAttackType(enemy), true), progress);
        }
        return;
      }
      if (stance === 'shadow' || stance === 'judgement') {
        if (winding) shadowWall(enemy, progress, timeMs);
        return;
      }
      if (stance === 'unsheathe' || stance === 'midnight' || stance === 'oaths') return;
    }
    if (def?.kind === 'treant' && enemy.boss) {
      treantTelegraph(enemy, def, pos, progress, winding, striking, zone !== null, timeMs);
      return;
    }
    if (!winding && !striking) return;
    // Tinted by the attack's type; the red edges keep the warning readable.
    const fill = telegraphFill(enemyAttackType(enemy), winding);
    const lockedFor = (lockMs: number | undefined) => winding && lockMs !== undefined && ai.modeDurationMs - ai.modeMs <= lockMs;
    if (def?.kind === 'lunger') {
      // Impidimp: no lane for the sidestep; its feint's lane shimmers (the tell), the real one is steady.
      if (ai.attack === 'sidestep') return;
      const feint = winding && ai.attack === 'feint';
      if (feint) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(ai.modeMs / 60));
      // Ekans' coil: the lane turns solid once the aim is locked.
      const locked = lockedFor(def.lockMs) || (striking && def.lockMs !== undefined);
      groundLane(pos, ai.attackDir, def.lungeDistance, enemy.radius * 2, locked ? COLORS.strike : fill, winding ? progress : 1);
      ctx.globalAlpha = 1;
    } else if (def?.kind === 'roller' || def?.kind === 'dasher') {
      // Venipede's roll and Salandit's dash: the lane turns solid once the aim locks.
      const locked = lockedFor(def.lockMs) || (striking && def.kind === 'dasher');
      const reach = def.kind === 'roller' ? rollReach(def) : def.dashDistance;
      if (winding || def.kind === 'dasher') groundLane(pos, ai.attackDir, reach, enemy.radius * 2, locked ? COLORS.strike : fill, winding ? progress : 1);
    } else if (def?.kind === 'sniper') {
      // Skrelp's ink line: thin and long, solid once locked.
      if (winding) groundLane(pos, ai.attackDir, 340, lockedFor(def.lockMs) ? 4 : 2, lockedFor(def.lockMs) ? COLORS.strike : fill, progress);
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
    } else if (def?.kind === 'slammer' && def.leap && ai.aimPoint) {
      // Shroomish: the landing spot, solid once the aim locks and while it is in the air.
      const locked = lockedFor(def.leap.lockMs) || striking;
      groundCircle(ai.aimPoint, def.radius, locked ? COLORS.strike : fill, winding ? progress : 1);
    } else if (def?.kind === 'slammer' && def.arcDegrees !== undefined) {
      // Golett: a frontal sector along the aim fixed at the start of the wind-up.
      groundArc(pos, ai.attackDir, def.radius * (winding ? 0.35 + 0.65 * progress : 1), def.arcDegrees, fill, COLORS.telegraphEdge);
    } else if (def?.kind === 'slammer' || def?.kind === 'spore') {
      // The area that will be hit: its edge from the start, filling in as the wind-up runs.
      const radius = def.kind === 'slammer' ? def.radius : def.cloud.radius;
      if (winding || def.kind === 'slammer') groundCircle(pos, radius, fill, winding ? progress : 1);
    } else if (def?.kind === 'thief') {
      if (enemy.boss?.stance === 'glint') {
        // The glint: where the slash will run, and a star twinkling on the thief.
        groundLane(pos, ai.attackDir, def.blink.slashDistance, (enemy.radius + def.blink.reach) * 2, striking ? COLORS.strike : fill, winding ? progress : 1);
        if (winding) glint(pos, enemy.radius, progress);
      } else if (winding) {
        groundCircle(pos, enemy.radius + 10 + 30 * (1 - progress), fill, progress);
      }
    } else if (def?.kind === 'archer') {
      const card = enemy.boss?.stance;
      if (card === 'rain' || card === 'stitch' || card === 'feathers') {
        archerPhase2Telegraph(enemy, def, pos, progress, winding, zone !== null, timeMs);
        return;
      }
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

  /** Trevenant: its slam ring, the lanes about to burst with roots, the spiral's arms, the curse ring and its gap. */
  function treantTelegraph(enemy: EnemyState, def: TreantDef, pos: Vec2, progress: number, winding: boolean, striking: boolean, pierce = false, timeMs = 0): void {
    const card = enemy.boss!.stance;
    const fill = telegraphFill(enemyAttackType(enemy), winding);
    if (card === 'slam') {
      if (winding || striking) groundCircle(pos, def.slam.radius, fill, winding ? progress : 1);
      return;
    }
    if (!winding || !currentArena) return;
    const { width, height } = currentArena;
    if (card === 'roots') {
      // The lanes about to burst: filling as the wind-up runs, red edges along both sides.
      for (const lane of rootLanes(enemy, width, def)) {
        const x = lane * def.roots.laneWidth;
        ctx.fillStyle = telegraphFill(def.roots.spike.type, true);
        ctx.fillRect(x, height * (1 - progress), def.roots.laneWidth, height * progress);
        ctx.fillStyle = 'rgba(90, 60, 30, 0.18)';
        ctx.fillRect(x, 0, def.roots.laneWidth, height);
        ctx.fillStyle = COLORS.telegraphEdge;
        ctx.fillRect(x, 0, 2, height);
        ctx.fillRect(x + def.roots.laneWidth - 2, 0, 2, height);
        if (pierce) pierceLane(x, def.roots.laneWidth, height, timeMs);
      }
      return;
    }
    if (card === 'curse' && enemy.ai.aimPoint) {
      const c = enemy.ai.aimPoint;
      const gap = Math.atan2(enemy.ai.attackDir.y, enemy.ai.attackDir.x);
      const half = (def.curse.gap * Math.PI) / def.curse.count;
      ctx.strokeStyle = COLORS.telegraphEdge;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, def.curse.radius, gap + half, gap + Math.PI * 2 - half);
      ctx.stroke();
      ctx.fillStyle = withAlpha(TYPE_COLORS.ghost.glow, 0.12 + 0.12 * progress);
      ctx.beginPath();
      ctx.arc(c.x, c.y, def.curse.radius, 0, Math.PI * 2);
      ctx.fill();
      // The way out, bright.
      ctx.strokeStyle = 'rgba(255, 230, 160, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, def.curse.radius, gap - half, gap + half);
      ctx.stroke();
      return;
    }
    // Spiral (and grove): a ring closing on the tree and the arms' first lanes.
    ctx.strokeStyle = COLORS.telegraphEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, enemy.radius + 8 + 40 * (1 - progress), 0, Math.PI * 2);
    ctx.stroke();
    const arms = card === 'grove' ? def.grove.arms : def.spiral.arms;
    const base = Math.atan2(enemy.ai.attackDir.y, enemy.ai.attackDir.x);
    for (let i = 0; i < arms; i++) {
      const a = base + (i * 2 * Math.PI) / arms;
      groundLane(pos, { x: Math.cos(a), y: Math.sin(a) }, 90, 4, fill, progress);
    }
  }

  /** Decidueye's phase-2 cards: the lanes the rain will pour into (the safe one bright), the stitch lines, the feather arms. */
  function archerPhase2Telegraph(enemy: EnemyState, def: ArcherDef, pos: Vec2, progress: number, winding: boolean, pierce = false, timeMs = 0): void {
    if (!currentArena) return;
    const { width, height } = currentArena;
    const card = enemy.boss!.stance;
    const fill = telegraphFill(enemyAttackType(enemy), true);
    if (card === 'rain') {
      if (!winding) return;
      const lanes = def.phase2.rain.lanes;
      const laneW = width / lanes;
      const safe = rainSafeLane(enemy, width, lanes);
      for (let lane = 0; lane < lanes; lane++) {
        if (lane === safe) {
          ctx.fillStyle = 'rgba(255, 230, 160, 0.14)';
          ctx.fillRect(lane * laneW, 0, laneW, height);
          continue;
        }
        // Marked from the first moment (a roll will not save you here), filling from the top as the arrows draw near.
        ctx.fillStyle = 'rgba(70, 30, 110, 0.24)';
        ctx.fillRect(lane * laneW + 2, 0, laneW - 4, height);
        ctx.fillStyle = fill;
        ctx.fillRect(lane * laneW + 2, 0, laneW - 4, height * progress);
        if (pierce) pierceLane(lane * laneW + 2, laneW - 4, height, timeMs);
      }
      ctx.fillStyle = COLORS.telegraphEdge;
      ctx.fillRect(safe * laneW, 0, 2, height);
      ctx.fillRect((safe + 1) * laneW - 2, 0, 2, height);
      return;
    }
    if (card === 'stitch') {
      const aim = enemy.ai.aimPoint;
      if (!aim || !winding) return;
      const locked = enemy.ai.modeDurationMs - enemy.ai.modeMs <= def.phase2.stitch.lockMs;
      for (const from of stitchSources(enemy, currentArena, def.phase2.stitch.inset)) {
        const dx = aim.x - from.x;
        const dy = aim.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) groundLane(from, { x: dx / len, y: dy / len }, len, 4, locked ? COLORS.strike : fill, progress);
      }
      return;
    }
    if (winding) {
      ctx.strokeStyle = COLORS.telegraphEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 8 + 40 * (1 - progress), 0, Math.PI * 2);
      ctx.stroke();
      const arms = def.phase2.feathers.arms;
      const base = Math.atan2(enemy.ai.attackDir.y, enemy.ai.attackDir.x);
      for (let i = 0; i < arms; i++) {
        const a = base + (i * 2 * Math.PI) / arms;
        groundLane(pos, { x: Math.cos(a), y: Math.sin(a) }, 80, 4, fill, progress);
      }
    }
  }

  /** Sableye's glint before a slash: a four-point star over its head, growing as the wind-up runs. */
  function glint(pos: Vec2, radius: number, progress: number): void {
    const size = 4 + 8 * progress;
    const at = { x: pos.x + radius * 0.6, y: pos.y - radius * 2 - 6 };
    ctx.fillStyle = 'rgba(190, 240, 255, 0.95)';
    ctx.fillRect(Math.round(at.x - size), Math.round(at.y - 1), Math.round(size * 2), 2);
    ctx.fillRect(Math.round(at.x - 1), Math.round(at.y - size), 2, Math.round(size * 2));
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillRect(Math.round(at.x - 2), Math.round(at.y - 2), 4, 4);
  }

  /** The shadow-sword wall about to sweep: a dark band along its starting end, the gap left bright, filling as the wind-up runs. */
  function shadowWall(enemy: EnemyState, progress: number, timeMs = 0): void {
    if (!currentArena) return;
    const { width, height } = currentArena;
    const shadow = AEGISLASH.phase2.shadow;
    const gap = shadowGapX(width, enemy.boss!.comboIndex, shadow.lanes);
    const down = enemy.ai.attackDir.y > 0;
    const band = 22;
    const y = down ? 0 : height - band;
    const left = gap - shadow.gapWidth / 2;
    const right = gap + shadow.gapWidth / 2;
    ctx.fillStyle = `rgba(60, 20, 90, ${0.35 + 0.35 * progress})`;
    ctx.fillRect(0, y, Math.max(0, left), band);
    ctx.fillRect(right, y, Math.max(0, width - right), band);
    ctx.fillStyle = COLORS.telegraphEdge;
    const edge = down ? y + band - 2 : y;
    ctx.fillRect(0, edge, Math.max(0, left) * progress, 2);
    ctx.fillRect(width - Math.max(0, width - right) * progress, edge, Math.max(0, width - right) * progress, 2);
    // Positional (pierceRoll): the band's inner edge pulses white and violet, a wall you cannot roll through.
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 90);
    const inner = down ? y + band + 1 : y - 3;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.4 * pulse})`;
    ctx.fillRect(0, inner, Math.max(0, left), 1);
    ctx.fillRect(right, inner, Math.max(0, width - right), 1);
    ctx.fillStyle = `rgba(176, 96, 255, ${0.6 + 0.4 * (1 - pulse)})`;
    ctx.fillRect(0, inner + (down ? 2 : -2), Math.max(0, left), 1);
    ctx.fillRect(right, inner + (down ? 2 : -2), Math.max(0, width - right), 1);
    // The safe lane, shown down the whole room.
    ctx.fillStyle = 'rgba(255, 230, 160, 0.08)';
    ctx.fillRect(left, 0, shadow.gapWidth, height);
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
      // A zone lies on the ground: under everything standing in it, and with no shadow.
      y: p.zone ? pos.y - p.radius : pos.y,
      draw: () => {
        if (!p.zone) shadow({ x: pos.x, y: pos.y + 10 }, p.radius * 0.8);
        drawProjectileVfx(ctx, p, pos, timeMs);
      },
    };
  }

  /** A rank mark (a violet diamond over the head, pulsing faster as it nears its burst) and a weakening (a grey ring at the feet). */
  function statusMarks(pos: Vec2, radius: number, markMs: number | null, weakened: boolean, timeMs: number): void {
    ctx.save();
    if (weakened) {
      ctx.strokeStyle = 'rgba(170, 170, 190, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 2, radius + 4, (radius + 4) * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (markMs !== null) {
      const pulse = 0.6 + 0.4 * Math.sin(timeMs / Math.max(40, markMs / 6));
      const y = pos.y - radius * 2 - 10;
      ctx.fillStyle = `rgba(178, 102, 255, ${pulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(pos.x, y - 6);
      ctx.lineTo(pos.x + 5, y);
      ctx.lineTo(pos.x, y + 6);
      ctx.lineTo(pos.x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
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

  /** Within reach to help a fainted ally up (a little wider than the revive radius, so the hint shows as one walks in). */
  const near = (a: Vec2, b: Vec2): boolean => Math.hypot(a.x - b.x, a.y - b.y) <= COOP_REVIVE.radius * 1.5;

  /** Co-op revive progress around a fainted player. */
  function reviveRing(pos: Vec2, ms: number): void {
    const progress = Math.min(1, ms / COOP_REVIVE.holdMs);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#5ad16a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
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

  /** Over a remote player: its nickname (else its id, "P2"), a small HP bar, and "fainted" once down; outlined so it reads on any floor. */
  function nameTag(id: string, hp: number, maxHp: number, pos: Vec2, names?: ReadonlyMap<string, string>, hint = false): void {
    const x = Math.round(pos.x);
    const y = Math.round(pos.y - 30);
    ctx.textAlign = 'center';
    ctx.font = canvasFont(FONT.hudPx, true);
    const name = names?.get(id) ?? id.toUpperCase();
    // A fainted ally next to the local player: how to get it up (core/revive.ts).
    const text = hp > 0 ? name : `${name} ${t('net.fainted')}${hint ? ` · ${t('coop.reviveHint')}` : ''}`;
    ctx.fillStyle = '#000000';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] as const) ctx.fillText(text, x + dx, y + dy);
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
    currentArena = current.arena;
    currentWorld = current;
    currentTier = worldDifficulty(current);
    currentTimeMs = timeMs;
    // A seal or key gate that just opened (host or guest): its notice, and its doorways flashing on the minimap.
    openedNotice = gateNotice(lastGate, current.gate, timeMs) ?? (current.gate?.done ? openedNotice : null);
    lastGate = current.gate;
    if (openedNotice && timeMs - openedNotice.atMs >= GATE_NOTICE_MS) openedNotice = null;
    // The dungeon's tile and arena colours replace the defaults for this frame.
    Object.assign(COLORS, frame.palette ?? CRYPT.palette);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (frame.sima) drawSimaBackdrop(ctx, view, pixelScale, frame.sima, timeMs);
    const event = shakeOffset(juice, random);
    const rumble = rumbleOffset(frame.rumble, random);
    const shake = { x: event.x + rumble.x, y: event.y + rumble.y };
    const ox = Math.round((view.x + shake.x) * pixelScale);
    const oy = Math.round((view.y + shake.y) * pixelScale);
    ctx.setTransform(pixelScale, 0, 0, pixelScale, -ox, -oy);

    floor(current, view, timeMs, frame.decor ?? null, frame.sima ?? null);
    if (frame.sima?.abyss) drawFallingLight(ctx, view, timeMs);
    if (current.arena.stairs) stairsTile(current.arena.stairs, timeMs);
    gateMarks(current, timeMs);
    if (frame.exit) exitGate(frame.exit, frame.exitOpen, timeMs);
    if (frame.bonfire) bonfireProp(frame.bonfire, timeMs);
    if (frame.memory) memoryProp(frame.memory, timeMs);
    // Inundación: the rising water lies over the floor, under everyone.
    if (current.flood) floodVeil(ctx, view, floodLevel(current.flood), timeMs);
    for (const pool of current.pools ?? []) drawPool(ctx, pool, timeMs);
    for (const b of current.berries) berry(b.pos, timeMs);
    // The Sima's floor event: its object (chest, altar, crystal, merchant), sealed doors, an ambush's tell.
    if (current.simaEvent) drawSimaEvent(ctx, current.simaEvent, timeMs, current.arena.tiles?.cols ?? 0);

    const positions = interpolatedPositions(frame.prev, current, frame.alpha);
    const posOf = (id: string, fallback: Vec2) => positions.get(id) ?? fallback;

    // Ground layer: telegraphs and shadows under everything.
    // The Eclipse Echo's halo and the marks of its cards (corona, noose, lanes), under the pierce marks drawn next.
    for (const enemy of current.enemies) if (enemy.species === 'eclipse-echo') drawEclipseZones(ctx, current, enemy, posOf(enemy.id, enemy.pos), timeMs);
    for (const enemy of current.enemies) if (enemy.alive) telegraphs(enemy, posOf(enemy.id, enemy.pos), timeMs);
    drawPlayerVfx(ctx, playerVfx(current.player), posOf('player', current.player.pos), timeMs);

    const drawables: Drawable[] = [];
    for (const rect of current.arena.obstacles ?? []) drawables.push(pillar(rect, frame.decor ?? null, timeMs));
    for (const enemy of current.enemies) {
      const defeated = frame.defeatedAt.get(enemy.id);
      const sinceDefeatMs = defeated === undefined ? Number.POSITIVE_INFINITY : timeMs - defeated;
      if (!enemy.alive && sinceDefeatMs > 1100) continue;
      const pos = posOf(enemy.id, enemy.pos);
      drawables.push({
        y: pos.y,
        draw: () => {
          shadow(pos, enemy.radius);
          if (enemy.elite && enemy.alive) eliteAura(enemy, pos, timeMs);
          if ((enemy.warpMs ?? 0) > 0 && enemy.alive) warpPoof(enemy, pos);
          const flicker = enemy.alive ? (enemy.hitstunMs > 0 && Math.floor(timeMs / 50) % 2 === 0 ? 0.55 : 1) : Math.max(0, 1 - sinceDefeatMs / 1100);
          // Decidueye fading into the fog before it reappears at the edge.
          const kind = ENEMY_BEHAVIOUR[enemy.species]?.kind;
          // (Sableye blinking out works the same way.)
          const danmaku = ENEMY_BEHAVIOUR[enemy.species];
          const sinking = danmaku?.kind === 'danmaku' && danmakuSinking(enemy, danmaku);
          // Dhelmise sinks before the riptide; Nihilego vanishes into its wormhole while it is marked.
          const wormhole = kind === 'ultra' && enemy.ai.mode === 'telegraph' && enemy.boss?.stance === 'wormhole';
          const vanishing = enemy.alive && ((enemy.ai.mode === 'transform' && (kind === 'archer' || kind === 'thief')) || sinking || wormhole);
          const fade = vanishing ? flicker * Math.max(0.1, 1 - enemy.ai.modeMs / Math.max(1, enemy.ai.modeDurationMs)) : flicker;
          // A Sima nest is drawn in code; it glows harder as its next hatching nears.
          if (enemy.species === 'eclipse-nest') {
            const nest = current.simaEvent?.kind === 'nest' && current.simaEvent.woke ? (current.simaEvent.remainingMs ?? null) : null;
            drawNest(ctx, pos, enemy.hp / enemy.maxHp, nest, fade, timeMs);
            return;
          }
          // A Sima elite glows in its trait's colour; the hunter is a shadow in the eclipse's red.
          if (enemy.elite && enemy.alive) ctx.filter = eliteFilter(ELITE_TRAIT_DEFS[enemy.elite].tint);
          if (enemy.species === 'eclipse-hunter') ctx.filter = HUNTER_FILTER;
          // The Eco del Eclipse and a Senda's wound: the eclipse's corruption on a Pokémon's own sheet (a wound drawn huge).
          if (enemy.species === 'eclipse-echo' || isWound(enemy.species)) ctx.filter = ECHO_FILTER;
          if (frame.silhouettes?.has(enemy.id)) ctx.filter = SILHOUETTE_FILTER;
          drawSprite(enemyAnim(enemy, { timeMs, sinceDefeatMs: enemy.alive ? Number.POSITIVE_INFINITY : sinceDefeatMs, ...(current.echoMimic ? { echoMimic: current.echoMimic } : {}) }), pos, fade, heraldScale(enemy) * (isWound(enemy.species) ? woundScale(worldDifficulty(current)) : 1));
          ctx.filter = 'none';
          if (enemy.alive && (enemy.leader || enemy.broken)) leaderMarks(enemy, pos, timeMs);
          if (enemy.alive && current.gate && !current.gate.done && current.gate.target === enemy.id) gateTargetMark(enemy, pos, current.gate.kind, timeMs);
        },
      });
      // Decidueye's stitch: two shadow clones in the far corners, drawn see-through.
      if (enemy.alive && enemy.boss?.stance === 'stitch' && (enemy.ai.mode === 'telegraph' || enemy.ai.mode === 'attack')) {
        for (const clone of stitchSources(enemy, current.arena).slice(1)) {
          drawables.push({ y: clone.y, draw: () => drawSprite(enemyAnim({ ...enemy, pos: clone }, { timeMs, sinceDefeatMs: Number.POSITIVE_INFINITY }), clone, 0.4 + 0.1 * Math.sin(timeMs / 120)) });
        }
      }
    }
    const playerPos = posOf('player', current.player.pos);
    drawables.push({
      y: playerPos.y,
      draw: () => {
        shadow(playerPos, TUNING.player.radius);
        chargeRing(current, playerPos);
        if (current.player.hp <= 0 && current.revive && current.revive.ms > 0) reviveRing(playerPos, current.revive.ms);
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
          nameTag(remote.id, remote.player.hp, remote.player.maxHp, pos, frame.names, remote.player.hp <= 0 && near(current.player.pos, pos) && current.player.hp > 0);
          // Co-op revive: the ally's progress as its peer reports it (core/revive.ts).
          if (remote.player.hp <= 0 && remote.revive) reviveRing(pos, remote.revive);
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
    // Rank effects on enemies: a shadow mark about to burst (pulsing faster), a weakened one's dim ring.
    for (const e of current.enemies) if (e.alive && (e.mark || e.weakened)) statusMarks(posOf(e.id, e.pos), e.radius, e.mark?.ms ?? null, Boolean(e.weakened), timeMs);
    if (frame.decor === 'forest') forestAir(current, view, timeMs, playerPos);
    if (current.fogWall) fogWallVeil(current.fogWall.line, current.arena.width, timeMs);
    if (frame.touchAim && !target) aimLine(playerPos, frame.touchAim);
    numbers(juice.numbers);
    if (current.fog) fogVeil(playerPos, view, fogRadiusTiles(current.fog) * TILE);
    if (current.gas && current.arena.tiles) drawGas(ctx, current.arena.tiles, current.gas, view, timeMs);
    if (frame.decor === 'swamp') {
      drawToxicMist(ctx, view, timeMs);
      drawSpores(ctx, view, timeMs);
    }

    // Screen space: slow-mo tint and HUD.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (current.slowMoMs > 0) {
      ctx.fillStyle = COLORS.slowMo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // The HUD has its own scale: on desktop a big window shows more HUD space, not bigger panels.
    const hudScale = frame.hudScale ?? pixelScale;
    const hud = hudSpace(canvas.width, canvas.height, hudScale);
    ctx.setTransform(hudScale, 0, 0, hudScale, 0, 0);
    drawHud(ctx, current, juice, hud, frame.floor, frame.coins, frame.touchUi ?? false, frame.shownAs);
    if (frame.minimap) drawMinimap(ctx, current, frame.minimap, view, timeMs, hud, openedNotice ? { doors: openedNotice.doors, ageMs: timeMs - openedNotice.atMs } : undefined);
    if (frame.log) drawMessageLog(ctx, frame.log, timeMs, hud.height);
    if (frame.card) drawFloorCard(ctx, frame.card, timeMs, hud.width, hud.height);
    if (frame.intro) drawDungeonIntro(ctx, frame.intro, timeMs, hud.width, hud.height);
    if (frame.nowPlaying) {
      // Touch: above the message log, clear of the action buttons in the bottom-right corner.
      const logLines = frame.touchUi && frame.log ? visibleMessages(frame.log, timeMs).length : 0;
      const at = frame.touchUi ? { x: 8, y: hud.height - 18 - (logLines > 0 ? logLines * 13 + 15 : 0) } : undefined;
      drawNowPlaying(ctx, frame.nowPlaying, timeMs, hud.width, hud.height, at);
    }
    if (frame.spell?.declare) drawCardDeclaration(ctx, frame.spell, timeMs, hud.width, hud.height);
    else if (frame.spell) drawSpellBanner(ctx, frame.spell, timeMs, hud.width);
    if (frame.capture) drawCaptureNotice(ctx, frame.capture, timeMs, hud.width, hud.height, t('card.mastered'), t('card.reward').replace('{coins}', String(frame.capture.coins)).replace('{heal}', String(frame.capture.heal)));
    if (frame.clock) drawRunClock(ctx, frame.clock, timeMs, hud.width);
    if (current.simaEvent || current.simaPact) drawSimaHud(ctx, current.simaEvent, current.simaPact, hud.width, timeMs, worldDifficulty(current));
    // The floor's gate, while it holds: one line under the floor card while the card shows, then at the top under the clock.
    const gateY = frame.card && cardAlpha(frame.card, timeMs - frame.card.shownAtMs) > 0 ? hud.height / 2 + 52 : current.simaEvent ? 132 : 78;
    if (current.gate && !current.gate.done) drawGateLine(ctx, current.gate, hud.width, gateY, timeMs);
    else if (openedNotice) drawGateNotice(ctx, openedNotice, hud.width, gateY, timeMs);
    if (frame.waiting) drawWaitLine(ctx, frame.waiting, hud.width, hud.height - 48);
    if (frame.spectating) drawWaitLine(ctx, frame.spectating, hud.width, hud.height - (frame.waiting ? 76 : 48));
  }

  return { draw };
}
