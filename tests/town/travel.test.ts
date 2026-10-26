import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { TOWN_PROPS } from '../../src/data/town';
import { HUB, WORLD, type WorldMap, type WorldMapId } from '../../src/data/world';
import { TILE, tileOf } from '../../src/core/tiles';
import { catalog, LANGUAGES } from '../../src/i18n';
import { INTERACT_RANGE } from '../../src/town/interact';
import { buildTownGrid, propSolidTiles, reachableFrom } from '../../src/town/map';
import { arrival } from '../../src/town/overworld';
import { besideNpc, mapDetails, markVisited, readVisited, TRAVEL_SHORTCUTS, travelDestinations, VISITED_KEY, waystoneLanding } from '../../src/town/travel';
import { detailText } from '../../src/town/travel-window';

const MAPS = Object.values(WORLD) as WorldMap[];
const IDS = Object.keys(WORLD) as WorldMapId[];

/** Floor tiles reachable from every arrival of a map (and its spawn). */
function reachOf(map: WorldMap): Set<number> {
  const grid = buildTownGrid(map);
  const starts = map.links.map((link) => tileOf(arrival(map, link, 0).pos));
  if (map.spawn) starts.push(map.spawn);
  const reach = new Set<number>();
  for (const s of starts) for (const i of reachableFrom(grid, s)) reach.add(i);
  return reach;
}

const cols = (map: WorldMap) => map.rows[0]!.length;

describe('waystones (odd/tasks/fast-travel.md)', () => {
  for (const map of MAPS) {
    describe(map.id, () => {
      it('has a waystone whose signpost stands right behind its reading point', () => {
        const ws = map.waystone;
        const post = map.props.find((p) => p.kind === 'notice-board' && p.x + TOWN_PROPS['notice-board'].width / 2 === ws.x && p.y + 0.5 === ws.y);
        expect(post, `${map.id}: notice-board under the waystone`).toBeDefined();
      });

      it('lands the traveller on reachable floor, within reach of the waystone and clear of links and entrances', () => {
        const tile = waystoneLanding(map);
        expect(reachOf(map).has(tile.y * cols(map) + tile.x), `${map.id} ${JSON.stringify(tile)}`).toBe(true);
        expect(Math.hypot((tile.x + 0.5) * TILE - map.waystone.x * TILE, (tile.y + 0.5) * TILE - map.waystone.y * TILE)).toBeLessThanOrEqual(INTERACT_RANGE);
        const inside = (r: { x: number; y: number; width: number; height: number }) => tile.x >= r.x && tile.x < r.x + r.width && tile.y >= r.y && tile.y < r.y + r.height;
        expect(map.links.some(inside) || map.entrances.some(inside)).toBe(false);
      });

      it('keeps its signpost off the other props', () => {
        const post = map.props.find((p) => p.kind === 'notice-board' && p.y + 0.5 === map.waystone.y && p.x + 1 === map.waystone.x)!;
        const mine = new Set(propSolidTiles(post).map((t) => `${t.x},${t.y}`));
        for (const other of map.props) if (other !== post) for (const t of propSolidTiles(other)) expect(mine.has(`${t.x},${t.y}`), `${map.id}: ${other.kind}`).toBe(false);
      });
    });
  }
});

describe('visited maps', () => {
  it('starts with the hub alone and a broken entry reads the same', () => {
    expect(readVisited(memoryStore())).toEqual([HUB]);
    const store = memoryStore();
    store.set(VISITED_KEY, '{nope');
    expect(readVisited(store)).toEqual([HUB]);
  });

  it('remembers each visit once, in world order, dropping unknown ids', () => {
    const store = memoryStore();
    markVisited(store, 'lago');
    markVisited(store, 'ruinas');
    markVisited(store, 'lago');
    expect(readVisited(store)).toEqual(['refugio', 'ruinas', 'lago']);
    store.set(VISITED_KEY, JSON.stringify(['crater', 'atlantis', 3]));
    expect(readVisited(store)).toEqual(['refugio', 'crater']);
  });

  it('is a device flag, not part of the synced profile', async () => {
    const { PROFILE_KEYS } = await import('../../src/app/profile');
    expect((PROFILE_KEYS as readonly string[]).includes(VISITED_KEY)).toBe(false);
  });
});

describe('destination list', () => {
  it('lists every map of the world once all are visited, then the shortcuts', () => {
    const list = travelDestinations(IDS);
    expect(list.map((d) => d.id)).toEqual([...IDS, ...TRAVEL_SHORTCUTS.map((s) => s.id)]);
    for (const dest of list) expect(dest.nameKey).toBe(dest.id === dest.map ? WORLD[dest.map].nameKey : TRAVEL_SHORTCUTS.find((s) => s.id === dest.id)!.nameKey);
  });

  it('lists only the visited maps, and the Phantump shortcut once the lake is known', () => {
    expect(travelDestinations(['refugio']).map((d) => d.id)).toEqual(['refugio']);
    expect(travelDestinations(['refugio', 'lago']).map((d) => d.id)).toEqual(['refugio', 'lago', 'oracle']);
  });

  it('lands every destination on reachable floor', () => {
    for (const dest of travelDestinations(IDS)) {
      const map = WORLD[dest.map];
      expect(reachOf(map).has(dest.tile.y * cols(map) + dest.tile.x), dest.id).toBe(true);
    }
  });

  it('lands the Phantump shortcut beside him, facing him, close enough to talk', () => {
    const oracle = WORLD.lago.npcs.find((n) => n.id === 'oracle')!;
    expect(oracle.species).toBe('phantump');
    const spot = besideNpc(WORLD.lago, 'oracle')!;
    expect(Math.abs(spot.tile.x - oracle.x) + Math.abs(spot.tile.y - oracle.y)).toBe(1);
    expect({ x: spot.tile.x + spot.facing.x, y: spot.tile.y + spot.facing.y }).toEqual({ x: oracle.x, y: oracle.y });
    expect(TILE).toBeLessThanOrEqual(INTERACT_RANGE);
    const dest = travelDestinations(IDS).find((d) => d.id === 'oracle')!;
    expect(dest.details[0]!.key).toBe('travel.service.evolve');
  });

  it('says what every map holds: each service NPC, the hub places and every dungeon mouth', () => {
    for (const map of MAPS) {
      const keys = mapDetails(map).map((d) => d.key);
      for (const npc of map.npcs) if (npc.opens) expect(keys, `${map.id} ${npc.id}`).toContain(`travel.service.${npc.opens}`);
      expect(keys.filter((k) => k === 'travel.entrance')).toHaveLength(map.entrances.length);
      if (map.shrine) expect(keys).toContain('travel.service.shrine');
    }
  });

  for (const language of LANGUAGES) {
    it(`"${language}" names every destination and detail line, placeholders filled, no em dash`, () => {
      const tr = (key: string) => catalog(language)[key] ?? key;
      for (const dest of travelDestinations(IDS)) {
        expect(tr(dest.nameKey)).not.toBe(dest.nameKey);
        for (const detail of dest.details) {
          const text = detailText(detail, tr);
          expect(text.startsWith('travel.'), text).toBe(false);
          expect(/[{}]|—/.test(text), text).toBe(false);
        }
      }
      for (const key of ['travel.title', 'travel.text', 'travel.pick', 'travel.here', 'travel.quiet']) expect(tr(key)).not.toBe(key);
    });
  }
});

describe('no travel during runs', () => {
  const ROOT = join(__dirname, '../..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
    });

  it('only the town scene opens the travel window; the run, its pause menu and the core never reach it', () => {
    const users = files(join(ROOT, 'src'))
      .filter((file) => /from '\.\/travel(-window)?'|from '\.\.\/town\/travel(-window)?'/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(ROOT.length + 1))
      .sort();
    expect(users.filter((f) => f !== 'src/town/travel-window.ts')).toEqual(['src/town/scene.ts']);
  });
});
