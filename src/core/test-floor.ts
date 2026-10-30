import { ENEMY_BEHAVIOUR } from '../data/enemies';
import type { SpeciesId } from '../data/species';
import type { WorldState } from './state';
import { add, clamp, fromAngle, scale, vec } from './vec';
import { enterRoom, spawnEnemy } from './world';

/**
 * Development test floor (`?spawn=koffing,grimer` on the dev server): an
 * open arena with the listed enemies awake on an arc in front of the
 * player, to look at any behaviour without finding it on a floor.
 */
export const TEST_FLOOR = {
  width: 960,
  height: 640,
  playerStart: { x: 220, y: 320 },
  /** Distance from the player to the arc of enemies. */
  spread: 300,
  margin: 40,
  maxEnemies: 12,
} as const;

/** Species ids from a comma list; anything without a behaviour is dropped, and the list is capped. */
export function parseSpawnList(text: string | null | undefined): SpeciesId[] {
  if (!text) return [];
  const ids = text
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((id): id is SpeciesId => id !== '' && Object.prototype.hasOwnProperty.call(ENEMY_BEHAVIOUR, id));
  return ids.slice(0, TEST_FLOOR.maxEnemies);
}

/** Replaces the current floor with the test arena and the listed enemies (awake), facing the player. */
export function loadTestFloor(state: WorldState, species: readonly SpeciesId[]): WorldState {
  const entered = enterRoom(state);
  const start = vec(TEST_FLOOR.playerStart.x, TEST_FLOOR.playerStart.y);
  let next: WorldState = {
    ...entered,
    arena: { width: TEST_FLOOR.width, height: TEST_FLOOR.height },
    flow: undefined,
    simaEvent: undefined,
    player: { ...entered.player, pos: start, roll: null, facing: vec(1, 0) },
  };
  const count = Math.min(species.length, TEST_FLOOR.maxEnemies);
  for (let i = 0; i < count; i++) {
    const angle = ((-70 + (140 * (i + 0.5)) / count) * Math.PI) / 180;
    const at = add(start, scale(fromAngle(angle), TEST_FLOOR.spread));
    const pos = vec(clamp(at.x, TEST_FLOOR.margin, TEST_FLOOR.width - TEST_FLOOR.margin), clamp(at.y, TEST_FLOOR.margin, TEST_FLOOR.height - TEST_FLOOR.margin));
    next = spawnEnemy(next, species[i]!, pos);
  }
  return next;
}
