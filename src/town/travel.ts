import type { KeyValueStore } from '../adapters/storage';
import type { TownNpc } from '../data/town';
import { HUB, WORLD, type WorldMap, type WorldMapId } from '../data/world';
import type { TilePoint } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import { buildTownGrid } from './map';

/**
 * Fast travel (odd/tasks/fast-travel.md): every overworld map has a waystone
 * (src/data/world.ts `waystone`), and the "Viajar" window lists the maps
 * visited on this device, each with what is there, plus shortcuts that land
 * next to a service NPC (Phantump). Pure rules: the visited maps per device,
 * the destination list and where each one lands. Travel only exists in the
 * town scene; a run never reaches this module (tests/town/travel.test.ts).
 */

/** Maps visited on this browser, under their own key next to the settings: a device flag, never part of the synced profile. */
export const VISITED_KEY = 'mazmorra-sombria.visitedMaps';

const isMapId = (id: unknown): id is WorldMapId => typeof id === 'string' && Object.hasOwn(WORLD, id);

/** The visited maps in world order; the hub always counts as visited (a broken or missing entry reads as the hub alone). */
export function readVisited(store: KeyValueStore): WorldMapId[] {
  let raw: unknown = null;
  try {
    raw = JSON.parse(store.get(VISITED_KEY) ?? 'null');
  } catch {
    raw = null;
  }
  const seen = new Set<WorldMapId>([HUB, ...(Array.isArray(raw) ? raw.filter(isMapId) : [])]);
  return (Object.keys(WORLD) as WorldMapId[]).filter((id) => seen.has(id));
}

/** Records a visit of `map` (no write when it was already known). */
export function markVisited(store: KeyValueStore, map: WorldMapId): void {
  const visited = readVisited(store);
  if (visited.includes(map) && store.get(VISITED_KEY) !== null) return;
  store.set(VISITED_KEY, JSON.stringify([...new Set([...visited, map])]));
}

/** The services an NPC window opens, as the travel window names them. */
export type NpcService = NonNullable<TownNpc['opens']>;

/** One line of what a map holds: an i18n key, and the dungeon id for an entrance line. */
export interface TravelDetail {
  key: string;
  dungeon?: string;
  /** Name key shown while the dungeon is not in the registry. */
  nameKey?: string;
}

export interface TravelDestination {
  id: string;
  map: WorldMapId;
  /** i18n key of the row's name. */
  nameKey: string;
  /** The tile the walker lands on, and the way it faces. */
  tile: TilePoint;
  facing: Vec2;
  details: TravelDetail[];
}

/** The tile a traveller lands on at a map's waystone: the one just below its reading point. */
export const waystoneLanding = (map: Pick<WorldMap, 'waystone'>): TilePoint => ({ x: Math.floor(map.waystone.x), y: Math.floor(map.waystone.y) + 1 });

/** What a map holds, for the travel window: its service NPCs, the hub's places, its dungeon mouths. */
export function mapDetails(map: WorldMap): TravelDetail[] {
  return [
    ...map.npcs.flatMap((npc): TravelDetail[] => (npc.opens ? [{ key: `travel.service.${npc.opens}` }] : [])),
    ...(map.id === HUB ? [{ key: 'travel.service.dungeons' }] : []),
    ...(map.board ? [{ key: 'travel.service.board' }] : []),
    ...(map.shrine ? [{ key: 'travel.service.shrine' }] : []),
    ...(map.beacon ? [{ key: 'travel.service.beacon' }] : []),
    ...map.entrances.map((e): TravelDetail => ({ key: 'travel.entrance', dungeon: e.dungeon, nameKey: e.nameKey })),
  ];
}

/** NPCs with a shortcut of their own in the travel list (the owner, 2026-10-26: walking to Phantump is a chore). */
export const TRAVEL_SHORTCUTS: readonly { id: string; map: WorldMapId; npc: string; nameKey: string }[] = [{ id: 'oracle', map: 'lago', npc: 'oracle', nameKey: 'travel.oracle' }];

/** The first walkable tile beside an NPC (east, south, west, north), facing it; null when it is walled in. */
export function besideNpc(map: WorldMap, npcId: string): { tile: TilePoint; facing: Vec2 } | null {
  const npc = map.npcs.find((n) => n.id === npcId);
  if (!npc) return null;
  const grid = buildTownGrid(map);
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const) {
    const x = npc.x + dx;
    const y = npc.y + dy;
    if (x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.tiles[y * grid.cols + x] === 1) return { tile: { x, y }, facing: { x: -dx, y: -dy } };
  }
  return null;
}

/** The travel list: one row per visited map (in world order, landing at its waystone), then the shortcuts of visited maps. */
export function travelDestinations(visited: readonly WorldMapId[]): TravelDestination[] {
  const known = new Set(visited.filter(isMapId));
  const maps = (Object.values(WORLD) as WorldMap[])
    .filter((m) => known.has(m.id))
    .map((m): TravelDestination => ({ id: m.id, map: m.id, nameKey: m.nameKey, tile: waystoneLanding(m), facing: { x: 0, y: 1 }, details: mapDetails(m) }));
  const shortcuts = TRAVEL_SHORTCUTS.filter((s) => known.has(s.map)).flatMap((s): TravelDestination[] => {
    const map = WORLD[s.map];
    const spot = besideNpc(map, s.npc);
    const opens = map.npcs.find((n) => n.id === s.npc)?.opens;
    return spot ? [{ id: s.id, map: s.map, nameKey: s.nameKey, ...spot, details: [...(opens ? [{ key: `travel.service.${opens}` }] : []), { key: 'travel.at', nameKey: map.nameKey }] }] : [];
  });
  return [...maps, ...shortcuts];
}
