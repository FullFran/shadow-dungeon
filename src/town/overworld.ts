import type { DungeonEntrance, LorePoint, MapLink, TileRect, WorldMap } from '../data/world';
import { TILE, tileOf } from '../core/tiles';
import type { Vec2 } from '../core/vec';

/**
 * Pure rules of the overworld: which edge a link sits on, where a walker
 * arrives through a link (one tile inside, keeping its offset along the
 * edge), whether a point stands on a trigger, and the fade between maps.
 */
export type Edge = 'west' | 'east' | 'north' | 'south';

export const mapCols = (map: Pick<WorldMap, 'rows'>): number => map.rows[0]?.length ?? 0;

/** The edge a link lies on, or null when it does not touch exactly one edge along its span. */
export function linkEdge(map: Pick<WorldMap, 'rows'>, link: TileRect): Edge | null {
  const cols = mapCols(map);
  const rows = map.rows.length;
  const edges: Edge[] = [];
  if (link.x === 0 && link.width === 1) edges.push('west');
  if (link.x + link.width === cols && link.width === 1) edges.push('east');
  if (link.y === 0 && link.height === 1) edges.push('north');
  if (link.y + link.height === rows && link.height === 1) edges.push('south');
  return edges.length === 1 ? edges[0]! : null;
}

/** Inward unit direction from an edge. */
export const INWARD: Record<Edge, Vec2> = { west: { x: 1, y: 0 }, east: { x: -1, y: 0 }, north: { x: 0, y: 1 }, south: { x: 0, y: -1 } };

export const OPPOSITE: Record<Edge, Edge> = { west: 'east', east: 'west', north: 'south', south: 'north' };

/** True when the tile of `pos` is inside `rect`. */
export function inRect(pos: Vec2, rect: TileRect): boolean {
  const tile = tileOf(pos);
  return tile.x >= rect.x && tile.x < rect.x + rect.width && tile.y >= rect.y && tile.y < rect.y + rect.height;
}

export const linkAt = (pos: Vec2, links: readonly MapLink[]): MapLink | null => links.find((link) => inRect(pos, link)) ?? null;

export const entranceAt = (pos: Vec2, entrances: readonly DungeonEntrance[]): DungeonEntrance | null => entrances.find((e) => inRect(pos, e)) ?? null;

/**
 * What a dungeon's mouth does: opens when the dungeon exists and is
 * unlocked on this device, stays sealed while locked, and stays shut (a
 * "not yet") while the registry does not have it at all.
 */
export type EntranceState = 'open' | 'locked' | 'missing';

export function entranceState(dungeon: string, unlocked: readonly string[], registry: readonly string[]): EntranceState {
  if (!registry.includes(dungeon)) return 'missing';
  return unlocked.includes(dungeon) ? 'open' : 'locked';
}

/** The i18n keys a lore point shows: its base lines, plus each line whose dungeon has been cleared on this device. */
export const loreLines = (point: Pick<LorePoint, 'lines'>, cleared: ReadonlySet<string>): string[] =>
  point.lines.filter((line) => line.after === undefined || cleared.has(line.after)).map((line) => line.key);

/** Offset of `pos` along the edge of `link`, in px from the link's start (0 .. span). */
export function offsetAlong(pos: Vec2, link: TileRect, edge: Edge): number {
  return edge === 'west' || edge === 'east' ? pos.y - link.y * TILE : pos.x - link.x * TILE;
}

/**
 * Where a walker arrives through `link` (on `map`): the centre of the tile
 * one step inside it, at `offset` px along the edge (clamped to the link's
 * tiles), facing inward.
 */
export function arrival(map: Pick<WorldMap, 'rows'>, link: TileRect, offset: number): { pos: Vec2; facing: Vec2 } {
  const edge = linkEdge(map, link) ?? 'west';
  const inward = INWARD[edge];
  const along = edge === 'west' || edge === 'east' ? link.height : link.width;
  const clamped = Math.min(along * TILE - TILE / 2, Math.max(TILE / 2, offset));
  // Snap to the centre of the chosen tile along the edge, so the walker lands on a known floor tile.
  const lane = Math.floor(clamped / TILE) * TILE + TILE / 2;
  if (edge === 'west' || edge === 'east') {
    const x = edge === 'west' ? link.x + link.width : link.x - 1;
    return { pos: { x: (x + 0.5) * TILE, y: link.y * TILE + lane }, facing: inward };
  }
  const y = edge === 'north' ? link.y + link.height : link.y - 1;
  return { pos: { x: link.x * TILE + lane, y: (y + 0.5) * TILE }, facing: inward };
}

/** Length of each half of the black fade between maps. */
export const FADE_MS = 220;

export interface Fade {
  phase: 'out' | 'in';
  ms: number;
}

/** Opacity of the black over the view during a fade. */
export const fadeAlpha = (fade: Fade | null): number => (fade ? Math.min(1, Math.max(0, fade.phase === 'out' ? fade.ms / FADE_MS : 1 - fade.ms / FADE_MS)) : 0);

/** How long the map name stays up on arrival, and its fade at the end. */
export const BANNER_MS = 2600;
export const bannerAlpha = (ms: number): number => (ms < 0 || ms >= BANNER_MS ? 0 : Math.min(1, (BANNER_MS - ms) / 500, (ms + 1) / 200));
