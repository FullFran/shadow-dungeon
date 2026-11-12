import { describe, expect, it } from 'vitest';
import { generateFloor, hallSpan, tileDistances, type Floor } from '../../src/core/dungeon';
import { descendBonusMs } from '../../src/core/endless';
import { loadFloor } from '../../src/core/floor';
import { fogClosed } from '../../src/core/fog';
import { floodRisen } from '../../src/core/flood';
import { holdsWaveRoom } from '../../src/core/floor-spawns';
import { floorKind, startRun } from '../../src/core/run';
import { TILE } from '../../src/core/tiles';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { DIFFICULTIES, type Difficulty } from '../../src/data/difficulty';
import { COLLAPSE, FLOOD, FLOOR_SHAPES, FOG, WAVE_ROOM } from '../../src/data/dungeon';
import { CHALLENGES, DUNGEONS, floorsOf, planAt, roadFor, SENDA_ROADS, TUTORIAL, type DungeonDef } from '../../src/data/dungeons';
import { ENDLESS } from '../../src/data/endless';
import { GAS } from '../../src/data/swamp';
import { TUNING } from '../../src/data/tuning';
import { HUD_BOX, minimapTilePx } from '../../src/ui/hud-layout';

/** Floor size by tier and the wave room's hall (odd/tasks/map-size.md, docs/research/map-size.md). */

const ALL: readonly DungeonDef[] = [...DUNGEONS, TUTORIAL, ...CHALLENGES, ...SENDA_ROADS];
/** The Sima has no last floor: its first strata are enough to meet every event kind. */
const lastFloor = (def: DungeonDef) => Math.min(floorsOf(def), 40);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const stairsWalk = (floor: Floor) => tileDistances(floor, floor.start)[floor.stairs.y * floor.cols + floor.stairs.x]!;
const area = (d: Difficulty) => FLOOR_SHAPES[d].cols * FLOOR_SHAPES[d].rows;

describe('floor size by tier', () => {
  it('keeps Easy as it shipped (40x28, a 3x2 grid, 4 to 6 rooms) and grows the floor, the grid and the walk with the tier', () => {
    expect(FLOOR_SHAPES.easy).toMatchObject({ cols: 40, rows: 28, cellCols: 3, cellRows: 2, rooms: { min: 4, max: 6 }, roomWidth: { min: 5, max: 9 }, roomHeight: { min: 4, max: 8 } });
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const [a, b] = [DIFFICULTIES[i - 1]!, DIFFICULTIES[i]!];
      expect(area(b), b).toBeGreaterThan(area(a));
      expect(FLOOR_SHAPES[b].cellCols * FLOOR_SHAPES[b].cellRows).toBeGreaterThanOrEqual(FLOOR_SHAPES[a].cellCols * FLOOR_SHAPES[a].cellRows);
      expect(FLOOR_SHAPES[b].rooms.min).toBeGreaterThanOrEqual(FLOOR_SHAPES[a].rooms.min);
      expect(FLOOR_SHAPES[b].walkScale).toBeGreaterThan(FLOOR_SHAPES[a].walkScale);
    }
  });

  it('measures each tier\'s walkScale: the median start-to-stairs walk over Easy\'s, within 8 %', () => {
    const walk = (d: Difficulty) => median(Array.from({ length: 400 }, (_, i) => stairsWalk(generateFloor(i * 7919 + 1, 1 + (i % 6), undefined, { shape: FLOOR_SHAPES[d] }))));
    const easy = walk('easy');
    for (const d of DIFFICULTIES) expect(Math.abs(walk(d) / easy - FLOOR_SHAPES[d].walkScale), d).toBeLessThan(0.08 * FLOOR_SHAPES[d].walkScale);
  });

  it('every floor of every tier, with or without a hall, is one connected piece with the stairs reachable and the shape\'s size and rooms', () => {
    for (const d of DIFFICULTIES) {
      const shape = FLOOR_SHAPES[d];
      for (let seed = 1; seed <= 150; seed++) {
        for (const hall of [false, true]) {
          const floor = generateFloor(seed * 31, 1 + (seed % 7), undefined, { shape, hall });
          expect([floor.cols, floor.rows]).toEqual([shape.cols, shape.rows]);
          expect(floor.rooms.length).toBeGreaterThanOrEqual(Math.min(shape.rooms.min, shape.cellCols * shape.cellRows - (hall ? hallSpan(shape) - 1 : 0)));
          expect(floor.rooms.length).toBeLessThanOrEqual(shape.rooms.max);
          const dist = tileDistances(floor, floor.start);
          floor.tiles.forEach((t, i) => {
            if (t === 1) expect(dist[i], `${d} seed ${seed} hall ${hall}: tile ${i} cut off`).toBeGreaterThanOrEqual(0);
          });
          expect(stairsWalk(floor)).toBeGreaterThan(0);
          expect(floor.stairsRoom).not.toBe(floor.startRoom);
        }
      }
    }
  }, 60_000);

  it('is a pure function of the seed, the depth, the shape and the hall (every co-op peer draws the same floor from the host\'s tier)', () => {
    for (const d of DIFFICULTIES) {
      for (const seed of [3, 77, 4242]) {
        for (const hall of [false, true]) {
          const options = { shape: FLOOR_SHAPES[d], hall };
          expect(generateFloor(seed, 4, undefined, options)).toEqual(generateFloor(seed, 4, undefined, options));
        }
        expect(startRun(seed, { difficulty: d }, 3).world.arena.tiles).toEqual(startRun(seed, { difficulty: d }, 3).world.arena.tiles);
      }
    }
    expect(startRun(9, { difficulty: 'nightmare' }, 2).world.arena.tiles!.cols).toBe(FLOOR_SHAPES.nightmare.cols);
  });

  it('leaves the fixed arenas alone: a room floor is the same size on every tier', () => {
    for (const def of ALL) {
      const floor = def.plan.findIndex((p) => p.kind === 'room') + 1;
      if (floor <= 0) continue;
      const easy = startRun(5, { difficulty: 'easy' }, floor, def.id).world.arena;
      const nightmare = startRun(5, { difficulty: 'nightmare' }, floor, def.id).world.arena;
      if (planAt(roadFor(def, 'nightmare'), floor)?.kind !== 'room' || roadFor(def, 'nightmare') !== def) continue;
      expect([nightmare.width, nightmare.height], def.id).toEqual([easy.width, easy.height]);
    }
  });
});

describe('wave rooms have a hall', () => {
  it(`every wave room of every dungeon, Senda road, challenge and Sima stratum, on every tier, is at least ${WAVE_ROOM.minWidth}x${WAVE_ROOM.minHeight} tiles and neither the start nor the stairs room`, () => {
    let checked = 0;
    const met = new Set<string>();
    for (const def of ALL) {
      for (const d of DIFFICULTIES) {
        const road = roadFor(def, d);
        let found = 0;
        for (let floor = 1; floor <= lastFloor(road) && found < 2; floor++) {
          if (planAt(road, floor)?.kind !== 'generated' && !road.endless) continue;
          for (let seed = 1; seed <= 40 && found < 2; seed++) {
            if (!holdsWaveRoom(road, seed, floor, floorKind(seed, floor, road), d)) continue;
            const { world } = startRun(seed, { difficulty: d }, floor, def.id);
            const event = world.simaEvent;
            expect(event?.kind, `${def.id} ${d} floor ${floor} seed ${seed}`).toBe('waves');
            const room = world.arena.rooms![event!.room]!;
            expect(room.width, `${def.id} ${d} floor ${floor} seed ${seed}`).toBeGreaterThanOrEqual(WAVE_ROOM.minWidth);
            expect(room.height, `${def.id} ${d} floor ${floor} seed ${seed}`).toBeGreaterThanOrEqual(WAVE_ROOM.minHeight);
            expect(event!.room).not.toBe(world.arena.rooms!.findIndex((r) => world.arena.stairs!.x >= r.x * TILE && world.arena.stairs!.x < (r.x + r.width) * TILE && world.arena.stairs!.y >= r.y * TILE && world.arena.stairs!.y < (r.y + r.height) * TILE));
            met.add(def.id);
            found++;
            checked++;
          }
        }
      }
    }
    // Every dungeon whose rules can roll a wave room met one (the loop is never empty).
    const canWave = (def: DungeonDef) => [def, roadFor(def, 'nightmare')].some((r) => (r.events ?? r.endless?.events)?.kinds.some((k) => k.kind === 'waves' && k.weight > 0) || r.gates?.kinds.some((k) => k.kind === 'waves'));
    expect(ALL.filter(canWave).map((def) => def.id).filter((id) => !met.has(id))).toEqual([]);
    expect(checked).toBeGreaterThan(20);
  });

  it('every hall fits its shape and never is the start or the stairs room', () => {
    for (const d of DIFFICULTIES) {
      const shape = FLOOR_SHAPES[d];
      // The tallest hall fits one cell; the widest fits its span.
      expect(Math.floor((shape.rows - 2) / shape.cellRows) - 2).toBeGreaterThanOrEqual(WAVE_ROOM.minHeight);
      expect(hallSpan(shape) * Math.floor((shape.cols - 2) / shape.cellCols) - 2).toBeGreaterThanOrEqual(WAVE_ROOM.minWidth);
      for (let seed = 1; seed <= 200; seed++) {
        const floor = generateFloor(seed, 1 + (seed % 5), undefined, { shape, hall: true });
        const hall = floor.rooms[floor.hall!]!;
        expect(hall.width).toBeGreaterThanOrEqual(WAVE_ROOM.minWidth);
        expect(hall.height).toBeGreaterThanOrEqual(WAVE_ROOM.minHeight);
        expect(floor.hall).not.toBe(floor.startRoom);
        expect(floor.hall).not.toBe(floor.stairsRoom);
      }
    }
  });

  it('a floor without a wave room has no hall', () => {
    for (const d of DIFFICULTIES) for (let seed = 1; seed <= 30; seed++) expect(generateFloor(seed, 2, undefined, { shape: FLOOR_SHAPES[d] }).hall).toBeUndefined();
  });
});

describe('clocks follow the bigger floors', () => {
  const world = (d: Difficulty) => createWorld({ seed: 1, difficulty: d, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  const floor = (d: Difficulty) => generateFloor(11, 3, undefined, { shape: FLOOR_SHAPES[d] });

  it('the fog closes and the flood rises over their time stretched by the tier\'s walkScale (Easy unchanged)', () => {
    for (const d of DIFFICULTIES) {
      const scale = FLOOR_SHAPES[d].walkScale;
      const fog = loadFloor(world(d), floor(d), 'fog').fog!;
      expect(fogClosed({ ...fog, elapsedMs: FOG.graceMs + FOG.closeMs * scale - 1 })).toBe(false);
      expect(fogClosed({ ...fog, elapsedMs: FOG.graceMs + FOG.closeMs * scale })).toBe(true);
      const flood = loadFloor(world(d), floor(d), 'flood').flood!;
      expect(floodRisen({ ...flood, elapsedMs: FLOOD.graceMs + FLOOD.riseMs * scale - 1 })).toBe(false);
      expect(floodRisen({ ...flood, elapsedMs: FLOOD.graceMs + FLOOD.riseMs * scale })).toBe(true);
    }
    expect(loadFloor(world('easy'), floor('easy'), 'fog').fog).toEqual({ elapsedMs: 0, chillMs: FOG.chillIntervalMs });
  });

  it('the Sima\'s descent bonus stretches by the tier\'s walkScale', () => {
    for (const d of DIFFICULTIES) expect(descendBonusMs(ENDLESS.clock, 5, FLOOR_SHAPES[d].walkScale)).toBe(Math.round(descendBonusMs(ENDLESS.clock, 5) * FLOOR_SHAPES[d].walkScale));
    expect(descendBonusMs(ENDLESS.clock, 5)).toBe(ENDLESS.clock.descendMs - ENDLESS.clock.descendShrinkMs * 3);
  });

  it('the collapse and the gas, fronts along the walking distance, still reach the stairs no sooner than the safety factor times the walk on every tier', () => {
    const walkMsPerTile = (TILE / TUNING.player.moveSpeed) * 1000;
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 60; seed++) {
        const tiles = stairsWalk(generateFloor(seed, 2, undefined, { shape: FLOOR_SHAPES[d] }));
        expect((tiles / COLLAPSE.frontTilesPerSecond) * 1000).toBeGreaterThanOrEqual(tiles * walkMsPerTile * COLLAPSE.safetyFactor);
        expect((tiles / GAS.frontTilesPerSecond) * 1000).toBeGreaterThanOrEqual(tiles * walkMsPerTile * COLLAPSE.safetyFactor);
      }
    }
  });

  it('the minimap keeps Easy\'s footprint on every tier', () => {
    for (const touch of [false, true]) {
      const easyWidth = HUD_BOX.minimapMaxCols * minimapTilePx(touch);
      for (const d of DIFFICULTIES) {
        const { cols, rows } = FLOOR_SHAPES[d];
        const px = minimapTilePx(touch, cols, rows);
        expect(cols * px).toBeLessThanOrEqual(easyWidth + 1e-9);
        expect(rows * px).toBeLessThanOrEqual(HUD_BOX.minimapMaxRows * minimapTilePx(touch) + 1e-9);
      }
      expect(minimapTilePx(touch, 40, 28)).toBe(touch ? HUD_BOX.minimapTilePxTouch : HUD_BOX.minimapTilePx);
    }
  });
});
