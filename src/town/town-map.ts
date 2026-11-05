import type { WorldMap } from '../data/world';
import { NPC_SERVICE, PLACE_SERVICES, serviceAboutKey, serviceLabelKey, TOWN_SERVICES, type TownService } from './town-menu';

/**
 * The town's Esc menu as a map (odd/tasks/menu-redesign.md S8: "que se vea
 * como un minimapa moviendote entre los distintos npc para usar su menu"):
 * one marker per NPC with a service and per place, at its tile, and the
 * cursor jumps between them by direction. Services with no place in the
 * town (Pokémon, settings, account...) are listed beside the map.
 */
export interface TownMapMarker {
  /** The NPC's id or the place's name. */
  id: string;
  service: TownService;
  /** Centre, in tiles. */
  x: number;
  y: number;
}

const PLACES = ['waystone', 'board', 'shrine', 'beacon'] as const;

/** The markers of `map` whose service is wired here (`available`), NPCs first, then the places. */
export function townMapMarkers(map: WorldMap, available: ReadonlySet<TownService>): TownMapMarker[] {
  const npcs = map.npcs.flatMap((npc): TownMapMarker[] => (npc.opens && available.has(NPC_SERVICE[npc.opens]) ? [{ id: npc.id, service: NPC_SERVICE[npc.opens], x: npc.x + 0.5, y: npc.y + 0.5 }] : []));
  const places = PLACES.flatMap((place): TownMapMarker[] => {
    const at = map[place];
    const service = PLACE_SERVICES[place][0]!;
    return at && available.has(service) ? [{ id: place, service, x: at.x, y: at.y }] : [];
  });
  return [...npcs, ...places];
}

/**
 * The services listed beside the map: every available one no marker opens
 * (the waystone's other rows, challenges and travel, open from its own window), in menu order.
 */
export function looseServices(markers: readonly TownMapMarker[], available: ReadonlySet<TownService>): TownService[] {
  const placed = new Set<TownService>(markers.map((m) => m.service));
  if (markers.some((m) => m.id === 'waystone')) for (const s of PLACE_SERVICES.waystone) placed.add(s);
  return TOWN_SERVICES.filter((s) => available.has(s) && !placed.has(s));
}

/**
 * The marker the cursor moves to from `from` for a direction (arrows or a
 * stick): the nearest one within 60 degrees of it, distance weighted by how
 * far off the axis it lies; `from` when nothing lies that way.
 */
export function stepMarker(markers: readonly TownMapMarker[], from: number, dir: { x: number; y: number }): number {
  const origin = markers[from];
  const length = Math.hypot(dir.x, dir.y);
  if (!origin || length === 0) return from;
  const ux = dir.x / length;
  const uy = dir.y / length;
  let best = from;
  let bestScore = Infinity;
  markers.forEach((m, i) => {
    if (i === from) return;
    const dx = m.x - origin.x;
    const dy = m.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    const cos = (dx * ux + dy * uy) / distance;
    if (cos < 0.5) return;
    const score = distance * (2 - cos);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** What a pin's card says (owner, 2026-11-04: hover shows what is there): the service, who keeps it, and what you can do. */
export interface PlaceCard {
  /** The pin's id (an NPC id or a place name). */
  id: string;
  service: TownService;
  labelKey: string;
  aboutKey: string;
  /** i18n key of the NPC or place that keeps the service. */
  whoKey: string;
}

const PLACE_WHO: Record<(typeof PLACES)[number], string> = {
  waystone: 'townMenu.place.waystone',
  board: 'town.name.board',
  shrine: 'world.lore.shrine.name',
  beacon: 'town.name.beacon',
};

/** The card of every marker, in the markers' order. */
export function placeCards(markers: readonly TownMapMarker[], map: WorldMap): PlaceCard[] {
  return markers.map((m) => {
    const npc = map.npcs.find((n) => n.id === m.id);
    const whoKey = npc ? `town.name.${npc.role}` : PLACE_WHO[m.id as (typeof PLACES)[number]];
    return { id: m.id, service: m.service, labelKey: serviceLabelKey(m.service), aboutKey: serviceAboutKey(m.service), whoKey };
  });
}
