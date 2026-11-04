import { describe, expect, it } from 'vitest';
import { createMemory, revealAround, type MinimapMemory } from '../../src/adapters/minimap';
import { generateFloor } from '../../src/core/dungeon';
import { loadFloor } from '../../src/core/floor';
import { startRun } from '../../src/core/run';
import { SHRINE_BOSSES } from '../../src/core/shrine';
import { simaBandAt } from '../../src/core/sima';
import type { Rect, WorldState } from '../../src/core/state';
import { TILE } from '../../src/core/tiles';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { CHALLENGES, DUNGEONS, ECLIPSE, floorsOf } from '../../src/data/dungeons';
import { buildPauseMap, cropPauseMap, kindAt, legendOf, MAP_KINDS, mapColor, mapScale, MARKER_KINDS, paintPauseMap, planScale, type MapPen } from '../../src/app/pause-map';

const VIEW: Rect = { x: 0, y: 0, width: 640, height: 360 };
const everything: Rect = { x: -1e6, y: -1e6, width: 2e6, height: 2e6 };

class Recorder implements MapPen {
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  rects: { color: string; x: number; y: number; w: number; h: number }[] = [];
  fillRect(x: number, y: number, w: number, h: number): void {
    this.rects.push({ color: String(this.fillStyle), x, y, w, h });
  }
}

const floor = generateFloor(11, 2);
const base = (): WorldState => loadFloor(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), floor);
const tileIndex = (x: number, y: number) => y * floor.cols + x;

/** A world that shows every tile kind: the start room seen, with water, a toxic pool and rubble in it. */
function everyKind(): { world: WorldState; memory: MinimapMemory } {
  const memory = createMemory(floor);
  revealAround(memory, floor, floor.rooms, floor.start);
  const room = floor.rooms[floor.startRoom]!;
  const water = new Array<number>(floor.cols * floor.rows).fill(0);
  water[tileIndex(room.x, room.y)] = 1;
  const dist = new Array<number>(floor.cols * floor.rows).fill(-1);
  dist[tileIndex(room.x + room.width - 1, room.y + room.height - 1)] = 0;
  const w = base();
  const world: WorldState = {
    ...w,
    arena: { ...w.arena, water },
    pools: [{ x: (room.x + 1.5) * TILE, y: (room.y + 1.5) * TILE, radius: TILE / 3 }],
    collapse: { dist, elapsedMs: 600_000, damageMs: 0 },
  };
  return { world, memory };
}

describe('pause map model', () => {
  it('renders every tile kind', () => {
    const { world, memory } = everyKind();
    const model = buildPauseMap(world, memory, VIEW);
    const kinds = new Set<string>();
    for (let y = 0; y < model.rows; y++) for (let x = 0; x < model.cols; x++) kinds.add(kindAt(model, x, y));
    for (const kind of MAP_KINDS) expect(kinds.has(kind), kind).toBe(true);
  });

  it('keeps the unexplored floor dark: nothing seen, nothing drawn but the player', () => {
    const away: Rect = { x: -9e6, y: -9e6, width: 10, height: 10 };
    const model = buildPauseMap(base(), createMemory(floor), away);
    for (let y = 0; y < model.rows; y++) for (let x = 0; x < model.cols; x++) expect(['unknown', 'fog']).toContain(kindAt(model, x, y));
    expect(model.markers.map((m) => m.kind)).toEqual(['player']);
  });

  it('veils only the frontier of what is explored in fog', () => {
    const { world, memory } = everyKind();
    const model = buildPauseMap(world, memory, VIEW);
    let fog = 0;
    for (let y = 0; y < model.rows; y++) {
      for (let x = 0; x < model.cols; x++) {
        if (kindAt(model, x, y) !== 'fog') continue;
        fog++;
        const next = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => memory.seen[(y + dy) * floor.cols + x + dx] === 1 && floor.tiles[(y + dy) * floor.cols + x + dx] === 1));
        expect(next, `${x},${y}`).toBe(true);
      }
    }
    expect(fog).toBeGreaterThan(0);
  });

  it('marks the player, each partner, the seen stairs and berries, and on-screen enemies only', () => {
    const { world, memory } = everyKind();
    const partner = { id: 'p2', player: { ...world.player, pos: vec(5 * TILE, 5 * TILE) }, projectiles: [] };
    const withPartner: WorldState = { ...world, remotes: [partner, { ...partner, id: 'p3' }] };
    const model = buildPauseMap(withPartner, memory, VIEW);
    expect(model.markers.filter((m) => m.kind === 'player')).toHaveLength(1);
    expect(model.markers.filter((m) => m.kind === 'partner')).toHaveLength(2);
    for (const m of model.markers) expect(MARKER_KINDS).toContain(m.kind);
    // The stairs tile is not seen yet: no stairs marker.
    expect(model.markers.some((m) => m.kind === 'stairs')).toBe(false);
    const all = new Uint8Array(memory.seen).fill(1);
    const seenAll = buildPauseMap(world, { ...memory, seen: all }, VIEW);
    expect(seenAll.markers.some((m) => m.kind === 'stairs')).toBe(true);
  });

  it('lists in the legend only what the map really shows', () => {
    const { world, memory } = everyKind();
    const legend = legendOf(buildPauseMap(world, memory, VIEW));
    expect(legend.tiles).toEqual(expect.arrayContaining(['floorA', 'wall', 'water', 'pool', 'rubble', 'fog']));
    expect(legend.markers).toContain('player');
    expect(legend.markers).not.toContain('partner');
  });

  it('fits the whole floor in a box with whole pixels per tile', () => {
    const model = buildPauseMap(base(), createMemory(floor), VIEW);
    for (const [w, h] of [[560, 400], [400, 240], [100, 60]] as const) {
      const s = mapScale(model, w, h);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
      if (s > 1) {
        expect(model.cols * s).toBeLessThanOrEqual(w);
        expect(model.rows * s).toBeLessThanOrEqual(h);
        expect(model.cols * (s + 1) > w || model.rows * (s + 1) > h).toBe(true);
      }
    }
  });
});

describe('pause map plan scale', () => {
  const box = [[493, 444], [548, 560], [330, 200], [260, 150]] as const;
  const sizes = [[12, 8], [24, 14], [40, 30], [90, 60], [200, 120]] as const;

  it('makes the plan fill at least 60% of the panel along its limiting side, whatever the explored size', () => {
    for (const [bw, bh] of box) {
      for (const [cols, rows] of sizes) {
        const plan = planScale({ cols, rows }, bw, bh);
        expect(plan.width, `${cols}x${rows} in ${bw}x${bh}`).toBeLessThanOrEqual(bw + 0.5);
        expect(plan.height).toBeLessThanOrEqual(bh + 0.5);
        expect(Math.max(plan.width / bw, plan.height / bh), `${cols}x${rows} in ${bw}x${bh}`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it('stays on whole pixels per tile unless a whole scale would leave over 35% of the panel empty', () => {
    for (const [bw, bh] of box) {
      for (const [cols, rows] of sizes) {
        const raw = Math.min(bw / cols, bh / rows);
        const plan = planScale({ cols, rows }, bw, bh);
        if (Math.floor(raw) >= 1 && Math.floor(raw) / raw >= 0.65) expect(plan.scale).toBe(Math.floor(raw));
        expect(Number.isInteger(plan.paintScale)).toBe(true);
        expect(plan.paintScale).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('picks the biggest crisp scale for a small explored area', () => {
    expect(planScale({ cols: 12, rows: 8 }, 480, 320).scale).toBe(40);
    expect(planScale({ cols: 12, rows: 8 }, 493, 444).scale).toBe(41);
  });

  it('goes fractional only when the whole scale would leave the panel mostly empty', () => {
    const plan = planScale({ cols: 100, rows: 60 }, 190, 180);
    expect(plan.scale).toBeCloseTo(1.9, 5);
    expect(plan.paintScale).toBe(2);
  });
});

describe('pause map crop and legend', () => {
  it('trims to the explored floor plus a margin and keeps every marker on its tile', () => {
    const { world, memory } = everyKind();
    const full = buildPauseMap(world, memory, VIEW);
    const crop = cropPauseMap(full, 2, { cols: 10, rows: 8 });
    expect(crop.cols).toBeLessThan(full.cols);
    expect(crop.rows).toBeLessThan(full.rows);
    for (let y = 0; y < crop.rows; y++) for (let x = 0; x < crop.cols; x++) expect(kindAt(crop, x, y)).toBe(kindAt(full, x + crop.origin.x, y + crop.origin.y));
    const player = full.markers.find((m) => m.kind === 'player')!;
    const moved = crop.markers.find((m) => m.kind === 'player');
    if (moved) {
      expect(moved.x + crop.origin.x).toBeCloseTo(player.x, 5);
      expect(moved.y + crop.origin.y).toBeCloseTo(player.y, 5);
    }
  });

  it('never goes below the minimum size and never past the floor', () => {
    const { world, memory } = everyKind();
    const crop = cropPauseMap(buildPauseMap(world, memory, VIEW), 0, { cols: 30, rows: 20 });
    expect(crop.cols).toBeGreaterThanOrEqual(30);
    expect(crop.rows).toBeGreaterThanOrEqual(20);
    expect(crop.origin.x + crop.cols).toBeLessThanOrEqual(floor.cols);
    expect(crop.origin.y + crop.rows).toBeLessThanOrEqual(floor.rows);
  });

  it('an unexplored floor is left whole', () => {
    const away: Rect = { x: -9e6, y: -9e6, width: 10, height: 10 };
    const full = buildPauseMap(base(), createMemory(floor), away);
    expect(cropPauseMap({ ...full, cells: new Uint8Array(full.cells.length) }).cols).toBe(full.cols);
  });

  it('names every legend entry in every language', () => {
    for (const language of LANGUAGES) {
      for (const kind of [...MAP_KINDS, ...MARKER_KINDS]) expect(catalog(language)[`pause.legend.${kind}`] !== undefined || ['unknown', 'floorB', 'face', 'rock'].includes(kind), `${language} ${kind}`).toBe(true);
    }
  });
});

describe('pause map paints every dungeon', () => {
  const ALL = [...DUNGEONS, ...CHALLENGES];

  it('builds and paints the first floor and every boss floor of every dungeon and challenge', () => {
    let built = 0;
    for (const def of ALL) {
      const floors = Number.isFinite(floorsOf(def)) ? Array.from({ length: floorsOf(def) }, (_, i) => i + 1) : [1, 5, 22];
      for (const n of floors) {
        const { world } = startRun(3, {}, n, def.id);
        const memory = world.arena.tiles ? createMemory(world.arena.tiles) : null;
        if (memory && world.arena.tiles) revealAround(memory, world.arena.tiles, world.arena.rooms ?? [], { x: Math.floor(world.player.pos.x / TILE), y: Math.floor(world.player.pos.y / TILE) });
        const model = buildPauseMap(world, memory, everything);
        const pen = new Recorder();
        expect(() => paintPauseMap(pen, model, def.palette, 4), `${def.id} floor ${n}`).not.toThrow();
        expect(pen.rects.length, `${def.id} floor ${n}`).toBeGreaterThan(0);
        expect(model.markers.some((m) => m.kind === 'player')).toBe(true);
        built++;
      }
    }
    expect(built).toBeGreaterThan(ALL.length);
  });

  it('paints every shrine arena', () => {
    for (const stop of SHRINE_BOSSES) {
      const { world } = startRun(3, {}, stop.floor, stop.dungeon);
      const model = buildPauseMap(world, null, everything);
      const def = ALL.find((d) => d.id === stop.dungeon)!;
      expect(() => paintPauseMap(new Recorder(), model, def.palette, 3), stop.boss).not.toThrow();
      expect(model.cols * model.rows).toBeGreaterThan(0);
    }
  });

  it("paints the Sima's every depth band in its own palette", () => {
    const bands = ECLIPSE.endless!.bands!;
    for (const band of bands) {
      const palette = typeof band.palette === 'string' ? DUNGEONS.find((d) => d.id === band.palette)!.palette : band.palette;
      const kinds = new Set(MAP_KINDS.map((k) => mapColor(k, palette)));
      expect(kinds.size).toBeGreaterThan(4);
    }
    expect(simaBandAt(bands, 1)).toBeDefined();
  });

  it('uses the tileset of the dungeon: two dungeons paint different floors', () => {
    const [a, b] = [DUNGEONS[0]!, DUNGEONS[1]!];
    expect(mapColor('floorA', a.palette)).toMatch(/^#[0-9a-f]{6}$/);
    expect(mapColor('floorA', b.palette)).not.toBe(mapColor('floorA', a.palette));
    // Stone reads in three tones (lit top, shaded face, deep rock), all derived from this dungeon's tileset.
    const stone = (['wall', 'face', 'rock'] as const).map((k) => mapColor(k, a.palette));
    expect(new Set(stone).size).toBe(3);
    expect(mapColor('wall', a.palette)).not.toBe(mapColor('wall', b.palette));
  });
});
