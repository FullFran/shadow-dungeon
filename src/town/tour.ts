import type { KeyValueStore } from '../adapters/storage';
import { TOWN_TOUR, type TourPoint, type TourStop } from '../data/town-tour';
import type { Vec2 } from '../core/vec';

/**
 * The welcome tour of the Refugio (data/town-tour.ts) as a little scripted
 * scene, pure, like the Sima pleas (town/plea.ts): after a short pause on
 * arrival (the town's name banner), the guide floats over to the player;
 * then, stop after stop, it walks its route with the player trailing behind,
 * and at each stop it speaks (the town scene opens the dialog and calls
 * `tourSpoken` when it closes). After the waystone's lines the tour is
 * `done`, and the town opens the dungeons window. Esc skips it (`skipTour`).
 */
export type TourPhase = 'wait' | 'walk' | 'talk' | 'done';

export interface TourState {
  /** The stop now being walked to or spoken at (index into the tour's stops). */
  stop: number;
  phase: TourPhase;
  /** Where the guide and the player are (world px). */
  guide: Vec2;
  player: Vec2;
  /** The next waypoint of each on this stop's routes. */
  guideLeg: number;
  playerLeg: number;
  /** Left of the pause before the guide sets off (`wait`). */
  waitMs: number;
  /** Whether each moved in the last step (their walking animation). */
  guideMoving: boolean;
  playerMoving: boolean;
}

/** Walking pace of the guide and the player during the tour (px per second). */
export const TOUR_SPEED = 130;
/** The pause on arrival before the guide comes, while the town's name shows. */
export const TOUR_ARRIVAL_MS = 1800;
/** The player keeps about this far behind the guide (in tiles) until the guide stops. */
export const TOUR_TRAIL = 1.3;

const px = (p: TourPoint, tile: number): Vec2 => ({ x: p.x * tile, y: p.y * tile });

/** The tour starts with the guide at home and the player where the town opened (the hub's spawn). */
export function startTour(tile: number, player: Vec2, tour = TOWN_TOUR): TourState {
  return { stop: 0, phase: 'wait', guide: px(tour.home, tile), player, guideLeg: 0, playerLeg: 0, waitMs: TOUR_ARRIVAL_MS, guideMoving: false, playerMoving: false };
}

/** The stop of the tour now (null once done). */
export const tourStop = (state: TourState, tour = TOWN_TOUR): TourStop | null => (state.phase === 'done' ? null : (tour.stops[state.stop] ?? null));

/** One step of `stride` px along `route` from `pos`, past every waypoint reached. */
function walk(pos: Vec2, leg: number, route: readonly TourPoint[], stride: number, tile: number): { pos: Vec2; leg: number } {
  let left = stride;
  let at = pos;
  let next = leg;
  while (next < route.length && left > 0) {
    const target = px(route[next]!, tile);
    const dx = target.x - at.x;
    const dy = target.y - at.y;
    const dist = Math.hypot(dx, dy);
    if (dist > left) return { pos: { x: at.x + (dx / dist) * left, y: at.y + (dy / dist) * left }, leg: next };
    at = target;
    left -= dist;
    next += 1;
  }
  return { pos: at, leg: next };
}

/** `dtMs` more of the tour: the pause runs out, then the guide walks its route and the player trails it; both arrived, the guide speaks. */
export function stepTour(state: TourState, dtMs: number, tile: number, tour = TOWN_TOUR): TourState {
  if (state.phase === 'talk' || state.phase === 'done') return { ...state, guideMoving: false, playerMoving: false };
  if (state.phase === 'wait') {
    const waitMs = state.waitMs - dtMs;
    return waitMs > 0 ? { ...state, waitMs } : { ...state, waitMs: 0, phase: 'walk' };
  }
  const stop = tour.stops[state.stop]!;
  const stride = (TOUR_SPEED * dtMs) / 1000;
  const g = walk(state.guide, state.guideLeg, stop.guide, stride, tile);
  const guideDone = g.leg >= stop.guide.length;
  // The player follows at a little distance, and catches up once the guide has stopped.
  const far = Math.hypot(g.pos.x - state.player.x, g.pos.y - state.player.y) > TOUR_TRAIL * tile;
  const p = guideDone || far ? walk(state.player, state.playerLeg, stop.player, stride, tile) : { pos: state.player, leg: state.playerLeg };
  const playerDone = p.leg >= stop.player.length;
  const moved = (a: Vec2, b: Vec2) => a.x !== b.x || a.y !== b.y;
  return {
    ...state,
    guide: g.pos,
    player: p.pos,
    guideLeg: g.leg,
    playerLeg: p.leg,
    phase: guideDone && playerDone ? 'talk' : 'walk',
    guideMoving: moved(g.pos, state.guide),
    playerMoving: moved(p.pos, state.player),
  };
}

/** The guide finished speaking at this stop: on to the next one, or, after the last (the waystone), the tour is over. */
export function tourSpoken(state: TourState, tour = TOWN_TOUR): TourState {
  if (state.phase !== 'talk') return state;
  const next = state.stop + 1;
  if (next >= tour.stops.length) return { ...state, phase: 'done' };
  return { ...state, stop: next, phase: 'walk', guideLeg: 0, playerLeg: 0 };
}

/** Esc: the whole tour is skipped (it still ends at the waystone, which opens the dungeons window). */
export const skipTour = (state: TourState): TourState => ({ ...state, phase: 'done', guideMoving: false, playerMoving: false });

/** Where the player stands once the tour is over: below the waystone (the last stop's spot). */
export function tourEndSpot(tile: number, tour = TOWN_TOUR): Vec2 {
  const last = tour.stops.at(-1)!;
  return px(last.player.at(-1) ?? last.look, tile);
}

/** Where someone at `from` looks at a stop: the place itself (`look`). */
export function tourLook(state: TourState, from: Vec2, tile: number, tour = TOWN_TOUR): Vec2 {
  const stop = tourStop(state, tour);
  if (!stop) return { x: 0, y: 1 };
  const look = px(stop.look, tile);
  return { x: look.x - from.x, y: look.y - from.y };
}

/** Where the guide looks: ahead while it walks, at the player while it waits for it or speaks. */
export function guideFacing(state: TourState, tile: number, tour = TOWN_TOUR): Vec2 {
  const stop = tourStop(state, tour);
  const next = stop?.guide[state.guideLeg];
  if (state.phase === 'walk' && state.guideMoving && next) return { x: next.x * tile - state.guide.x, y: next.y * tile - state.guide.y };
  return { x: state.player.x - state.guide.x, y: state.player.y - state.guide.y };
}

/** Where the player looks: ahead while it walks, at the guide while it waits, at the place while the guide speaks of it. */
export function playerFacing(state: TourState, tile: number, tour = TOWN_TOUR): Vec2 {
  const stop = tourStop(state, tour);
  const next = stop?.player[state.playerLeg];
  if (state.playerMoving && next) return { x: next.x * tile - state.player.x, y: next.y * tile - state.player.y };
  if (state.phase === 'talk' && stop && stop.id !== 'welcome') return tourLook(state, state.player, tile, tour);
  return { x: state.guide.x - state.player.x, y: state.guide.y - state.player.y };
}

const SEEN_KEY = 'mazmorra-sombria.townTourSeen';

/** Whether this device has had the welcome tour (or skipped it). A failing store reads as seen, so it never traps the player. */
export function hasSeenTour(store: KeyValueStore): boolean {
  try {
    return store.get(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(store: KeyValueStore): void {
  try {
    store.set(SEEN_KEY, '1');
  } catch {
    // Not persisted: worst case it plays again next time.
  }
}
