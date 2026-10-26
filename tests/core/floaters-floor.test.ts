import { describe, expect, it } from 'vitest';
import { ENEMY_BEHAVIOUR, floatsOf } from '../../src/data/enemies';
import type { SpeciesId } from '../../src/data/species';
import type { Arena, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { isWall, lineOfSight, TILE, tileCenter, tileOf, type TileGrid } from '../../src/core/tiles';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { input, run } from './helpers';

/**
 * Floaters always on usable floor (odd/tasks/floaters-usable-floor.md): two
 * rooms split by a three-tile wall, open only along the bottom row. A floater
 * in the right room has to go round, like a walker, to reach a player in the
 * left one; it never rests, winds up or casts inside the rock.
 */
const MAP = [
  '######################',
  '#.......###..........#',
  '#.......###..........#',
  '#.......###..........#',
  '#.......###..........#',
  '#.......###..........#',
  '#.......###..........#',
  '#.......###..........#',
  '#....................#',
  '######################',
];
const GRID: TileGrid = { cols: MAP[0]!.length, rows: MAP.length, tiles: MAP.join('').split('').map((c) => (c === '#' ? 0 : 1)) };
const ARENA: Arena = { width: GRID.cols * TILE, height: GRID.rows * TILE, tiles: GRID };
const at = (x: number, y: number): Vec2 => tileCenter({ x, y });
const inRock = (p: Vec2) => isWall(GRID, tileOf(p).x, tileOf(p).y);

/** Every species that floats (the regular roster and the evolved forms). */
const FLOATERS = (Object.keys(ENEMY_BEHAVIOUR) as SpeciesId[]).filter((s) => floatsOf(s) && ENEMY_BEHAVIOUR[s]!.kind !== 'eclipse');
/** Arena bosses that float: positional cards need no line of sight, only floor under them. */
const ARENA_BOSSES: readonly SpeciesId[] = ['nihilego', 'sima-herald'];

function across(species: SpeciesId, seed: number): WorldState {
  // The player in the left room, the floater across the wall in the right one, both awake.
  const w = createWorld({ seed, arena: ARENA, playerPos: at(3, 3) });
  return spawnEnemy({ ...w, player: { ...w.player, hp: 1e9, maxHp: 1e9 } }, species, at(14, 3));
}

describe('floaters on usable floor', () => {
  it('covers the floaters of the roster', () => {
    expect(FLOATERS).toEqual(expect.arrayContaining(['gastly', 'haunter', 'gengar', 'duskull', 'dusclops', 'drifloon', 'drifblim', 'phantump', 'hoothoot', 'noctowl', 'zubat', 'golbat', 'tentacool', 'koffing', 'weezing']));
  });

  for (const species of FLOATERS) {
    it(`${species} chasing across a wall-split room never enters a wall tile, and winds up only on floor in sight`, () => {
      for (const seed of [1, 2, 3]) {
        let w = across(species, seed);
        const id = w.enemies.at(-1)!.id;
        for (let i = 0; i < 900; i++) {
          w = step(w, input(), FIXED_DT_MS);
          const e = w.enemies.find((x) => x.id === id);
          if (!e || !e.alive) break;
          expect(inRock(e.pos), `${species} seed ${seed} tick ${i} at ${e.pos.x},${e.pos.y}`).toBe(false);
          for (const ev of w.events) {
            if (!ARENA_BOSSES.includes(species) && (ev.type === 'enemyTelegraph' || ev.type === 'enemyAttack') && ev.enemyId === id) {
              expect(lineOfSight(GRID, e.pos, w.player.pos), `${species} seed ${seed} ${ev.type} tick ${i} out of sight`).toBe(true);
            }
          }
        }
      }
    });
  }

  it('a caster across the wall goes round and casts from the player\'s room', () => {
    let w = across('gastly', 1);
    let castFrom: Vec2 | null = null;
    for (let i = 0; i < 900 && !castFrom; i++) {
      w = step(w, input(), FIXED_DT_MS);
      if (w.events.some((ev) => ev.type === 'enemyAttack')) castFrom = w.enemies[0]!.pos;
    }
    expect(castFrom).not.toBeNull();
    expect(lineOfSight(GRID, castFrom!, w.player.pos)).toBe(true);
  });

  it('a knockback does not carry a floater into or across the wall', () => {
    let w = spawnEnemy(createWorld({ seed: 1, arena: ARENA, playerPos: at(3, 3) }), 'gastly', at(12, 3), { dormant: true });
    w = { ...w, enemies: w.enemies.map((e) => ({ ...e, knockback: vec(-6 * TILE, 0) })) };
    const later = run(w, input(), 60).enemies[0]!;
    expect(tileOf(later.pos).x).toBeGreaterThanOrEqual(11);
  });

  it('the safety net brings a floater found inside the rock out to floor the player can reach', () => {
    const w = spawnEnemy(createWorld({ seed: 1, arena: ARENA, playerPos: at(3, 3) }), 'duskull', at(9, 4), { dormant: true });
    const later = step(w, input(), FIXED_DT_MS).enemies[0]!;
    expect(inRock(later.pos)).toBe(false);
  });

  it('is deterministic', () => {
    const a = run(across('drifloon', 7), input(), 400);
    const b = run(across('drifloon', 7), input(), 400);
    expect(a.enemies).toEqual(b.enemies);
    expect(a.projectiles).toEqual(b.projectiles);
  });
});
