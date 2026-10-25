import { describe, expect, it } from 'vitest';
import { SWAMP } from '../../src/data/dungeons';
import { HUB, WORLD, type WorldMapId } from '../../src/data/world';
import { unlockedDungeons } from '../../src/core/dungeon-select';
import { entranceState } from '../../src/town/overworld';

describe('the Ciénaga del Cielo Roto', () => {
  it('lies east of the Black Lake, linked both ways, and holds the only Toxic Swamp entrance', () => {
    expect(WORLD.lago.links.find((l) => l.id === 'east')).toMatchObject({ to: 'cienaga', toLink: 'west' });
    expect(WORLD.cienaga.links.find((l) => l.id === 'west')).toMatchObject({ to: 'lago', toLink: 'east' });
    const entrances = Object.values(WORLD).flatMap((m) => m.entrances.filter((e) => e.dungeon === SWAMP.id).map(() => m.id));
    expect(entrances).toEqual(['cienaga']);
  });

  it('is reached from the hub through the lake', () => {
    const path = new Map<WorldMapId, WorldMapId | null>([[HUB, null]]);
    const queue: WorldMapId[] = [HUB];
    while (queue.length > 0) {
      const at = queue.shift()!;
      for (const link of WORLD[at].links) if (!path.has(link.to)) path.set(link.to, at) && queue.push(link.to);
    }
    expect(path.get('cienaga')).toBe('lago');
  });

  it('keeps the swamp sealed until the Flooded Caves are cleared', () => {
    const registry = [...unlockedDungeons(new Set(['flooded-caves', 'crypt-of-the-sword-king', 'misty-forest'])).map((d) => d.id)];
    expect(entranceState(SWAMP.id, ['crypt-of-the-sword-king', 'misty-forest'], [SWAMP.id])).toBe('locked');
    expect(entranceState(SWAMP.id, registry, [SWAMP.id])).toBe('open');
  });
});
