import { describe, expect, it } from 'vitest';
import { sheetKey } from '../../src/adapters/asset-keys';
import { hubKeys, idlePrefetchKeys, runKeys, sheetsOfSprite } from '../../src/adapters/sprite-sets';
import { CHALLENGES, DUNGEONS } from '../../src/data/dungeons';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { lookKey, SPRITE_KEYS, SPRITES } from '../../src/data/sprites';

const everyKeyExists = (keys: readonly string[]) => {
  const known = new Set<string>();
  for (const [sprite, meta] of Object.entries(SPRITES.sprites)) for (const anim of Object.values(meta.anims)) known.add(sheetKey(sprite, anim.file));
  return keys.filter((k) => !known.has(k));
};

describe('which sheets a screen needs', () => {
  it('the hub needs the partner idle and the backdrop residents, a handful of sheets and no more', () => {
    for (const species of PLAYABLE_SPECIES) {
      const keys = hubKeys(species, false, false);
      const idle = SPRITES.sprites[lookKey(SPRITE_KEYS[SPECIES[species].sprite])]!.anims.Idle!;
      expect(keys, species).toContain(sheetKey(lookKey(SPRITE_KEYS[SPECIES[species].sprite]), idle.file));
      expect(keys.length, species).toBeLessThanOrEqual(8);
      expect(everyKeyExists(keys), species).toEqual([]);
    }
  });

  it('the hub follows the partner look: shiny and female sheets', () => {
    const plain = hubKeys('mimikyu', false, false);
    const shiny = hubKeys('mimikyu', true, false);
    expect(shiny).not.toEqual(plain);
    expect(everyKeyExists(shiny)).toEqual([]);
  });

  it('a whole sprite is every animation it has', () => {
    const key = SPRITE_KEYS.mimikyu;
    expect(sheetsOfSprite(key).length).toBe(new Set(Object.values(SPRITES.sprites[key]!.anims).map((a) => a.file)).size);
  });

  it('a run needs all of the player and, first, the species of floor 1; the rest of the pool comes after', () => {
    for (const dungeon of [...DUNGEONS, ...CHALLENGES]) {
      const { now, later } = runKeys(dungeon, 'mimikyu', false, false);
      expect(now.length, dungeon.id).toBeGreaterThan(0);
      expect(everyKeyExists([...now, ...later]), dungeon.id).toEqual([]);
      const player = sheetsOfSprite(SPRITE_KEYS.mimikyu);
      for (const key of player) expect(now, dungeon.id).toContain(key);
      expect(new Set([...now, ...later]).size, `${dungeon.id} has no repeated key across the two sets`).toBe(now.length + later.length);
    }
  });

  it('floor 1 of the Crypt asks for its floor-1 pool and not the deep species', () => {
    const crypt = DUNGEONS[0]!;
    const { now } = runKeys(crypt, 'mimikyu', false, false);
    const first = crypt.spawns.pool.filter((e) => e.weights[0]! > 0).map((e) => SPRITE_KEYS[SPECIES[e.species].sprite]);
    const deepOnly = crypt.spawns.pool.filter((e) => (e.weights[0] ?? 0) === 0).map((e) => SPRITE_KEYS[SPECIES[e.species].sprite]);
    for (const sprite of first) for (const key of sheetsOfSprite(sprite)) expect(now).toContain(key);
    const nowSprites = new Set(now.map((k) => k.split('/').slice(0, 2).join('/')));
    for (const sprite of deepOnly) if (!first.includes(sprite) && sprite !== SPRITE_KEYS.mimikyu) expect(nowSprites.has(sprite)).toBe(false);
  });

  it('the idle prefetch is the idle sheet of every playable species, each look included, and nothing else', () => {
    const keys = idlePrefetchKeys();
    expect(everyKeyExists(keys)).toEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.endsWith('Idle-Anim.png') || k.endsWith('-Anim.png'))).toBe(true);
    for (const species of PLAYABLE_SPECIES) {
      const sprite = SPRITE_KEYS[SPECIES[species].sprite];
      const idle = SPRITES.sprites[sprite]!.anims.Idle!;
      expect(keys, species).toContain(sheetKey(sprite, idle.file));
    }
  });
});
