import type { FloorPlan } from '../data/dungeon';
import type { DungeonDef } from '../data/dungeons';
import { planAt } from '../data/dungeons';
import { isEchoFloor, isWoundFloor, type EndlessDef } from '../data/endless';
import { SIMA_SHADOWS, SIMA_STORY, SIMA_WOUNDS, type SimaStoryBoss, type SimaStoryDef } from '../data/sima-story';
import { deriveSeed, nextRandom } from './rng';

/**
 * Where the Sendas' bosses stand in the Sima (docs/sima-redesign.md §4),
 * pure. Everything here is a function of the run seed and the floor only:
 * every peer of a shared run, and everyone on the daily challenge, meets the
 * same boss on the same floor. The player's memory never reaches this file
 * (it only changes names: app/sima-lore.ts).
 */
const WOUND_SALT = 0x3a11d;
const STRAY_SALT = 0x57a9;
const STRAY_BAG_SALT = 0x5b4c;


/**
 * A bag over `pool`: one boss per sheet in each turn (Bisharp is in two
 * Sendas: never twice in one turn), shuffled per turn by the seed; the
 * `index`-th draw of the run. A sheet with several bosses shows the next one
 * of them on each turn.
 */
export function bagDraw(pool: readonly SimaStoryBoss[], seed: number, salt: number, index: number): SimaStoryBoss {
  const sheets = [...new Set(pool.map((b) => b.sprite))];
  const turn = Math.floor(index / sheets.length);
  const order = sheets.map((sprite, i) => ({ sprite, key: nextRandom(deriveSeed(deriveSeed(seed, salt + turn), i)).value })).sort((a, b) => a.key - b.key);
  const sprite = order[index % sheets.length]!.sprite;
  const same = pool.filter((b) => b.sprite === sprite);
  return same[turn % same.length]!;
}

/** The wound on a wound floor: the bag's draw for that floor's place in the run. */
export function woundAt(endless: Pick<EndlessDef, 'echoEvery' | 'wounds'>, seed: number, floor: number): SimaStoryBoss | null {
  if (!endless.wounds || !isWoundFloor(endless, floor)) return null;
  return bagDraw(SIMA_WOUNDS, seed, WOUND_SALT, (floor - endless.wounds.from) / endless.wounds.every);
}

/** Whether generated floor `floor` of a run is a lost shadow's floor (never floor 1..`fromFloor - 1`, an echo or a herald floor). */
export function isStrayFloor(endless: Pick<EndlessDef, 'echoEvery' | 'heralds'>, seed: number, floor: number, def: SimaStoryDef = SIMA_STORY): boolean {
  if (floor < def.strays.fromFloor || isEchoFloor(endless, floor)) return false;
  return nextRandom(deriveSeed(seed, floor + STRAY_SALT)).value < def.strays.chance;
}

/** The lost shadow of a stray floor: the bag's draw, counting the stray floors before it in this run. */
export function strayAt(endless: Pick<EndlessDef, 'echoEvery' | 'heralds'>, seed: number, floor: number, def: SimaStoryDef = SIMA_STORY): SimaStoryBoss | null {
  if (!isStrayFloor(endless, seed, floor, def)) return null;
  let index = 0;
  for (let f = def.strays.fromFloor; f < floor; f++) if (isStrayFloor(endless, seed, f, def)) index++;
  return bagDraw(SIMA_SHADOWS, seed, STRAY_BAG_SALT, index);
}

/**
 * The plan of a floor of a run: the dungeon's (data/dungeons.ts `planAt`),
 * and in the Sima a wound in the guardian echo's place on its floors and a
 * lost shadow's arena on a stray floor. Both stand as echoes (the echo's way
 * on at the top, never a fog wall but the stray's own, core/run.ts).
 */
export function runPlanAt(dungeon: DungeonDef, floor: number, seed: number | undefined): FloorPlan | undefined {
  const plan = planAt(dungeon, floor);
  const endless = dungeon.endless;
  if (!plan || !endless || seed === undefined) return plan;
  const wound = woundAt(endless, seed, floor);
  if (wound) return { kind: 'room', room: wound.room, role: 'echo' };
  const stray = plan.kind === 'generated' ? strayAt(endless, seed, floor) : null;
  return stray ? { kind: 'room', room: stray.room, role: 'echo' } : plan;
}
