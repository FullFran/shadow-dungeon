import { collapseFront } from '../core/collapse';
import type { WorldState } from '../core/state';
import { isWall, TILE, tileOf, type TileGrid } from '../core/tiles';
import type { TilePalette } from '../data/dungeons';
import { isSeen, minimapMarks, type MinimapMemory } from '../adapters/minimap';
import type { Rect } from '../core/state';
import { PALETTE, RELIC, TYPE_COLORS } from '../ui/tokens';

/**
 * The floor map of the pause menu (owner, 2026-11-04: "un mapa mucho más realista y visible"): the explored
 * floor drawn as real dungeon tiles from the game's own data (the minimap's memory of seen tiles, the floor's
 * wall grid, water, toxic pools and collapse), in the colours of the current dungeon's tileset. Pure and
 * tested: `buildPauseMap` makes the tile grid and the markers, `paintPauseMap` draws it on any 2D context.
 * Nothing here knows more than the minimap does: unexplored rooms stay dark, enemies show only on screen.
 */

/** Tile kinds in draw order; the model stores indexes into this list. */
export const MAP_KINDS = ['unknown', 'fog', 'rock', 'wall', 'face', 'floorA', 'floorB', 'water', 'pool', 'rubble'] as const;
export type MapKind = (typeof MAP_KINDS)[number];

/** Markers drawn over the tiles as pixel icons, and listed in the legend. */
export const MARKER_KINDS = ['player', 'partner', 'stairs', 'item', 'enemy', 'event', 'gate'] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

export interface MapMarker {
  kind: MarkerKind;
  /** Tile units, fractional (the centre of the thing). */
  x: number;
  y: number;
}

export interface PauseMapModel {
  cols: number;
  rows: number;
  /** Tile of the floor this model's top-left corner is (0,0 until `cropPauseMap` trims it). */
  origin: { x: number; y: number };
  /** Index into `MAP_KINDS` per tile, row by row. */
  cells: Uint8Array;
  markers: MapMarker[];
}

const KIND_INDEX = Object.fromEntries(MAP_KINDS.map((k, i) => [k, i])) as Record<MapKind, number>;

/** The kind of a tile of the model. */
export const kindAt = (model: PauseMapModel, x: number, y: number): MapKind => MAP_KINDS[model.cells[y * model.cols + x] ?? 0]!;

/** Which tile kinds and marker kinds the model really uses: the legend lists exactly these. */
export function legendOf(model: PauseMapModel): { tiles: MapKind[]; markers: MarkerKind[] } {
  const used = new Set<number>(model.cells);
  const tiles = MAP_KINDS.filter((k, i) => used.has(i) && k !== 'unknown' && k !== 'floorB' && k !== 'face' && k !== 'rock');
  const markers = MARKER_KINDS.filter((k) => model.markers.some((m) => m.kind === k));
  return { tiles, markers };
}

/** A fixed arena (a boss floor, a shrine arena) has no wall grid: its rectangle with the obstacles as walls. */
function arenaGrid(world: WorldState): TileGrid {
  const { width, height, obstacles = [] } = world.arena;
  const cols = Math.max(1, Math.ceil(width / TILE));
  const rows = Math.max(1, Math.ceil(height / TILE));
  const tiles = new Array<number>(cols * rows).fill(1);
  for (const o of obstacles) {
    if (o.cover) continue;
    for (let y = Math.floor(o.y / TILE); y < Math.ceil((o.y + o.height) / TILE); y++) {
      for (let x = Math.floor(o.x / TILE); x < Math.ceil((o.x + o.width) / TILE); x++) if (x >= 0 && y >= 0 && x < cols && y < rows) tiles[y * cols + x] = 0;
    }
  }
  return { cols, rows, tiles };
}

export function buildPauseMap(world: WorldState, memory: MinimapMemory | null, view: Rect): PauseMapModel {
  const generated = world.arena.tiles;
  const grid = generated ?? arenaGrid(world);
  // A fixed arena is seen whole; a generated floor only where the player has been.
  const seen = (x: number, y: number): boolean => (generated && memory ? isSeen(memory, x, y) : true);
  const { cols, rows } = grid;
  const cells = new Uint8Array(cols * rows);
  const collapse = world.collapse;
  const front = collapse ? collapseFront(collapse) : 0;
  const floorSeen = (x: number, y: number): boolean => !isWall(grid, x, y) && seen(x, y);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let kind: MapKind;
      if (!seen(x, y)) {
        // The edge of the explored floor: a veil of fog; farther out, nothing known.
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (floorSeen(x + dx, y + dy)) near = true;
        kind = near ? 'fog' : 'unknown';
      } else if (isWall(grid, x, y)) {
        // Rock is solid stone with no floor beside it; the rim next to a floor is the wall you see, its south side the lit face.
        const beside = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => floorSeen(x + dx, y + dy)));
        kind = floorSeen(x, y + 1) ? 'face' : beside ? 'wall' : 'rock';
      } else if (world.arena.water?.[i] === 1) {
        kind = 'water';
      } else if (world.pools?.some((p) => Math.hypot((x + 0.5) * TILE - p.x, (y + 0.5) * TILE - p.y) <= p.radius)) {
        kind = 'pool';
      } else if (collapse && front > 0 && (collapse.dist[i] ?? -1) >= 0 && (collapse.dist[i] ?? -1) < front) {
        kind = 'rubble';
      } else {
        kind = (x + y) % 2 === 0 ? 'floorA' : 'floorB';
      }
      cells[i] = KIND_INDEX[kind];
    }
  }

  const markers: MapMarker[] = [];
  if (generated && memory) {
    const marks = minimapMarks(world, memory, view);
    if (marks.stairs) markers.push({ kind: 'stairs', x: marks.stairs.x + 0.5, y: marks.stairs.y + 0.5 });
    for (const b of marks.berries) markers.push({ kind: 'item', x: b.x + 0.5, y: b.y + 0.5 });
    if (marks.event) markers.push({ kind: 'event', x: marks.event.tile.x + 0.5, y: marks.event.tile.y + 0.5 });
    for (const d of marks.gate?.doors ?? []) markers.push({ kind: 'gate', x: d.x + 0.5, y: d.y + 0.5 });
    for (const e of marks.enemies) markers.push({ kind: 'enemy', x: e.x, y: e.y });
  } else {
    for (const e of world.enemies) if (e.alive) markers.push({ kind: 'enemy', x: e.pos.x / TILE, y: e.pos.y / TILE });
    const stairs = world.arena.stairs;
    if (stairs) {
      const t = tileOf({ x: stairs.x + 1, y: stairs.y + 1 });
      markers.push({ kind: 'stairs', x: t.x + 0.5, y: t.y + 0.5 });
    }
  }
  for (const remote of world.remotes) markers.push({ kind: 'partner', x: remote.player.pos.x / TILE, y: remote.player.pos.y / TILE });
  markers.push({ kind: 'player', x: world.player.pos.x / TILE, y: world.player.pos.y / TILE });
  return { cols, rows, origin: { x: 0, y: 0 }, cells, markers };
}

/**
 * Trims the map to what is known (explored floor and its fog) plus a margin, never smaller than `min` tiles, so
 * a floor explored in one corner still fills the panel at a readable scale. Markers keep their place.
 */
export function cropPauseMap(model: PauseMapModel, margin = 2, min = { cols: 24, rows: 14 }): PauseMapModel {
  let x0 = model.cols;
  let y0 = model.rows;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < model.rows; y++) {
    for (let x = 0; x < model.cols; x++) {
      if (kindAt(model, x, y) === 'unknown') continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return model;
  const grow = (lo: number, hi: number, size: number, floor: number): [number, number] => {
    let a = Math.max(0, lo - margin);
    let b = Math.min(size - 1, hi + margin);
    const missing = floor - (b - a + 1);
    if (missing > 0) {
      a = Math.max(0, a - Math.ceil(missing / 2));
      b = Math.min(size - 1, a + floor - 1);
      a = Math.max(0, b - floor + 1);
    }
    return [a, b];
  };
  const [ax, bx] = grow(x0, x1, model.cols, Math.min(min.cols, model.cols));
  const [ay, by] = grow(y0, y1, model.rows, Math.min(min.rows, model.rows));
  const cols = bx - ax + 1;
  const rows = by - ay + 1;
  const cells = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells[y * cols + x] = model.cells[(y + ay) * model.cols + x + ax] ?? 0;
  const markers = model.markers.filter((m) => m.x >= ax && m.x <= bx + 1 && m.y >= ay && m.y <= by + 1).map((m) => ({ ...m, x: m.x - ax, y: m.y - ay }));
  return { cols, rows, origin: { x: model.origin.x + ax, y: model.origin.y + ay }, cells, markers };
}

/** A colour lifted towards bone: the dungeon's dark floors read against the dark panel without leaving their hue. */
function lift(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const to = Number.parseInt(PALETTE.text.slice(1), 16);
  const mix = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount) + ((to >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((sh) => mix(sh).toString(16).padStart(2, '0')).join('')}`;
}

/** The colour a tile kind is painted in: the dungeon's tileset for floor and wall, the type colours for water, poison and rubble. */
export function mapColor(kind: MapKind, palette: TilePalette): string {
  switch (kind) {
    case 'unknown':
      return PALETTE.ink;
    case 'fog':
      return PALETTE.barBack;
    case 'rock':
      return palette.tileWallTop;
    case 'wall':
      return palette.tileWallFace;
    case 'face':
      return lift(palette.tileWallFace, 0.12);
    case 'floorA':
      return lift(palette.tileFloorA, 0.22);
    case 'floorB':
      return lift(palette.tileFloorB, 0.15);
    case 'water':
      return TYPE_COLORS.water.core;
    case 'pool':
      return TYPE_COLORS.poison.core;
    case 'rubble':
      return RELIC.emberDeep;
  }
}

/** The part of a 2D context the painter uses (a real canvas context, or a recorder in tests). */
export interface MapPen {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}

/** Largest whole pixels-per-tile that fits the whole floor in a box (never below 1: the box may then scroll the canvas by CSS scale). */
export const mapScale = (model: Pick<PauseMapModel, 'cols' | 'rows'>, boxW: number, boxH: number): number => Math.max(1, Math.floor(Math.min(boxW / model.cols, boxH / model.rows)));

/**
 * Paints the tiles at `scale` pixels per tile (crisp: only whole-pixel rectangles). Walls get an edge shade on the
 * floor side, the faces a darker lip, fog a dithered veil; floors alternate two tones like the game's own floor.
 */
export function paintPauseMap(pen: MapPen, model: PauseMapModel, palette: TilePalette, scale: number): void {
  const s = Math.max(1, Math.floor(scale));
  const lip = Math.max(1, Math.floor(s / 4));
  for (let y = 0; y < model.rows; y++) {
    for (let x = 0; x < model.cols; x++) {
      const kind = kindAt(model, x, y);
      if (kind === 'unknown') continue;
      pen.fillStyle = mapColor(kind, palette);
      pen.fillRect(x * s, y * s, s, s);
      if (kind === 'face') {
        // The lit lip at the top of a wall face, like the game's wall tiles.
        pen.fillStyle = palette.tileWallLip;
        pen.fillRect(x * s, y * s, s, lip);
      } else if (kind === 'fog') {
        // Dither: every other pixel pair stays clear, so the fog reads as mist and not as a block.
        pen.fillStyle = PALETTE.ink;
        for (let j = 0; j < s; j += 2) for (let i = (j / 2) % 2 === 0 ? 0 : 1; i < s; i += 2) pen.fillRect(x * s + i, y * s + j, 1, 1);
      } else if (kind === 'wall' || kind === 'rock') {
        // A thin shade at the foot of stone that borders the unknown, so the edge of the map reads as an edge.
        if (y + 1 < model.rows && kindAt(model, x, y + 1) === 'unknown') {
          pen.fillStyle = PALETTE.ink;
          pen.fillRect(x * s, (y + 1) * s - lip, s, lip);
        }
      }
    }
  }
}
