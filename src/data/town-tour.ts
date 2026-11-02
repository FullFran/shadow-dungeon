import type { NpcSpecies } from './town';

/**
 * The welcome tour of the Refugio (odd/tasks/tutorial-dungeon.md S9-S10,
 * owner 2026-11-02: «veas como llegas al pueblo y que ahi te hagan un tour
 * o algo, tienes que hacer que lo lleven a las mazmorras»). The first time
 * the town opens after the Sunken Way, Gastly the storyteller floats over
 * to the player at the spawn, then leads it to each key place in turn: the
 * shop, the move tutor, the notice board, the Santuario and last the
 * waystone, which opens the dungeons window with the Crypt first. At each
 * stop it says one or two lines (`town.tour.<id>.<n>`). Scripted like the
 * Sima pleas (src/town/tour.ts moves the actors, src/town/scene.ts draws
 * them and opens the dialogs).
 *
 * Every point is in tiles of the hub (data/world.ts `REFUGIO`; a point is
 * `x * TILE` world px, so 15.5 is the middle of tile 15). Each stop has the
 * guide's route and the player's: both walk their waypoints in order (the
 * player trails the guide), and the last waypoint is where each stands
 * while the guide speaks. Every route crosses open ground only
 * (tests/town/tour.test.ts).
 */
export interface TourPoint {
  x: number;
  y: number;
}

export type TourStopId = 'welcome' | 'shop' | 'tutor' | 'board' | 'shrine' | 'waystone';

export interface TourStop {
  id: TourStopId;
  /** The guide's waypoints to this stop (the last one is where it speaks). */
  guide: readonly TourPoint[];
  /** The player's waypoints (none: it stays where it is). */
  player: readonly TourPoint[];
  /** Where the guide and the player look while it speaks (the place itself). */
  look: TourPoint;
  /** How many lines the guide says here. */
  lines: number;
}

export interface TownTour {
  /** The town NPC who leads the tour (its own sheet and name; it leaves its spot while it guides). */
  npcId: string;
  species: NpcSpecies;
  nameKey: string;
  /** Where it stands in the town (its NPC tile's middle): the tour starts from there. */
  home: TourPoint;
  stops: readonly TourStop[];
}

export const TOWN_TOUR: TownTour = {
  npcId: 'storyteller',
  species: 'gastly',
  nameKey: 'town.name.storyteller',
  home: { x: 24.5, y: 6.5 },
  stops: [
    // Gastly floats down from its corner to the player at the spawn (15.5, 9.5).
    { id: 'welcome', guide: [{ x: 24.5, y: 8.5 }, { x: 22, y: 9.6 }, { x: 16.9, y: 9.6 }], player: [], look: { x: 16.9, y: 9.6 }, lines: 2 },
    // Poochyena's stall, just north of the spawn.
    { id: 'shop', guide: [{ x: 17.6, y: 7.8 }], player: [{ x: 16.5, y: 7.8 }], look: { x: 16.5, y: 6.5 }, lines: 2 },
    // Smeargle by the stone house, down the long path to the west.
    { id: 'tutor', guide: [{ x: 17.6, y: 10.6 }, { x: 9.4, y: 10.6 }, { x: 8.5, y: 12.4 }], player: [{ x: 16.5, y: 10.4 }, { x: 7.8, y: 11.4 }], look: { x: 6.5, y: 11.5 }, lines: 2 },
    // The notice board, a few steps north-east.
    { id: 'board', guide: [{ x: 10.4, y: 10.4 }, { x: 12.6, y: 8.8 }], player: [{ x: 9.6, y: 9.6 }, { x: 11, y: 8.6 }], look: { x: 11, y: 7.5 }, lines: 2 },
    // The Santuario's altar on the south lawn.
    { id: 'shrine', guide: [{ x: 13.8, y: 10.6 }, { x: 20.6, y: 12.6 }, { x: 23.5, y: 13.4 }, { x: 23.6, y: 16.1 }], player: [{ x: 12.6, y: 10.4 }, { x: 19.8, y: 12.8 }, { x: 20.2, y: 16.4 }, { x: 22, y: 16.4 }], look: { x: 22, y: 15.5 }, lines: 2 },
    // Last, the waystone by the east road: the way into the dungeons.
    { id: 'waystone', guide: [{ x: 23.6, y: 12.6 }, { x: 27.5, y: 10.8 }, { x: 27.4, y: 9.7 }], player: [{ x: 22.9, y: 16.6 }, { x: 23.4, y: 12.6 }, { x: 28, y: 10.8 }, { x: 29, y: 9.6 }], look: { x: 29, y: 8.5 }, lines: 2 },
  ],
};

/** The i18n keys of a stop's lines, in order. */
export const tourKeys = (stop: TourStop): string[] => Array.from({ length: stop.lines }, (_, i) => `town.tour.${stop.id}.${i + 1}`);
