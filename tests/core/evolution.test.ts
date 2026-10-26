import { describe, expect, it } from 'vitest';
import { rosterOf } from '../../src/core/collection';
import { canEvolve, evolutionOf, evolve, lineOf, stageBonus, stageOf } from '../../src/core/evolution';
import { playerStats } from '../../src/core/items';
import { validateLoadout } from '../../src/core/loadout';
import { budgetRatio } from '../../src/core/move-power';
import { createPlayer, createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { sanitize } from '../../src/app/save';
import { catalog } from '../../src/i18n';
import { MOVES } from '../../src/data/moves';
import { PLAYER_EVOLUTIONS, STAGE_BONUS_CAP } from '../../src/data/player-evolutions';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { isPlayable, isStarter, PLAYABLE_SPECIES, SPECIES, STARTER_SPECIES, type SpeciesId } from '../../src/data/species';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';

const LINES: readonly (readonly [SpeciesId, SpeciesId, SpeciesId])[] = [
  ['abra', 'kadabra', 'alakazam'],
  ['piplup', 'prinplup', 'empoleon'],
  ['shinx', 'luxio', 'luxray'],
  ['axew', 'fraxure', 'haxorus'],
];
const FIRST_FORMS = LINES.map((line) => line[0]);
const GACHA_FORMS = LINES.flat();

describe('evolution lines: data', () => {
  it('every form of the four lines is playable, after the starters', () => {
    expect(PLAYABLE_SPECIES).toEqual([...STARTER_SPECIES, ...GACHA_FORMS]);
    for (const id of GACHA_FORMS) expect(isPlayable(id) && !isStarter(id), id).toBe(true);
  });

  it('chains each line first -> second -> third, and only player lines', () => {
    expect(PLAYER_EVOLUTIONS.map((e) => [e.from, e.to])).toEqual(LINES.flatMap(([a, b, c]) => [[a, b], [b, c]]));
    for (const [a, b, c] of LINES) {
      expect([lineOf(a), lineOf(b), lineOf(c)]).toEqual([a, a, a]);
      expect([stageOf(a), stageOf(b), stageOf(c)]).toEqual([0, 1, 2]);
      expect(evolutionOf(c)).toBeNull();
    }
  });

  it.each(FIRST_FORMS)('%s has one move per slot, equipped by default, inside the starters\' budget', (id) => {
    const species = SPECIES[id];
    expect(species.movepool.map((m) => MOVES[m].slot)).toEqual(PLAYER_SLOT_LAYOUT);
    expect(species.defaultLoadout).toEqual(species.movepool);
    expect(validateLoadout(species, PLAYER_SLOT_LAYOUT, species.defaultLoadout)).toEqual([]);
    for (const m of species.movepool.filter((x) => MOVES[x].slot !== 'boost')) expect(budgetRatio(MOVES[m]), m).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('each evolution keeps the kit and loadout, and unlocks exactly its one new (non-boost) move', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const from = SPECIES[e.from];
      const to = SPECIES[e.to];
      expect(from.movepool).not.toContain(e.move);
      expect(to.movepool).toEqual([...from.movepool, e.move]);
      expect(to.defaultLoadout).toEqual(from.defaultLoadout);
      expect(MOVES[e.move].slot, e.move).not.toBe('boost');
      expect(to.maxHp).toBe(from.maxHp);
      expect(e.coins).toBeGreaterThan(0);
      expect(Object.values(e.materials).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });

  it('a later stage costs more and gives more, but never above the hard ceiling', () => {
    for (const [, b, c] of LINES) {
      const second = evolutionOf(lineOf(b))!;
      const third = evolutionOf(b)!;
      expect(third.coins).toBeGreaterThan(second.coins);
      // User decision 2026-10-26: the first step needs Normal and Difícil, the final one Difícil and Pesadilla.
      expect(second.materials).toEqual({ normal: 3, hard: 2 });
      expect(third.materials).toEqual({ hard: 3, nightmare: 2 });
      expect(third.bonus.hp).toBeGreaterThan(second.bonus.hp);
      expect(third.bonus.damage).toBeGreaterThan(second.bonus.damage);
      expect(stageBonus(c, 1)).toEqual(third.bonus);
    }
    for (const e of PLAYER_EVOLUTIONS) {
      expect(e.bonus.hp, e.to).toBeLessThanOrEqual(STAGE_BONUS_CAP.solo);
      expect(e.bonus.damage, e.to).toBeLessThanOrEqual(STAGE_BONUS_CAP.solo);
    }
    expect(STAGE_BONUS_CAP.party).toBeLessThan(STAGE_BONUS_CAP.solo);
  });

  it('every form has its own sprite with the core sheets, and a name in both languages', () => {
    const sprites = new Set(GACHA_FORMS.map((id) => SPRITE_KEYS[SPECIES[id].sprite]));
    expect(sprites.size).toBe(GACHA_FORMS.length);
    for (const key of sprites) expect(SPRITES.sprites[key], key).toBeDefined();
    for (const lang of ['es', 'en'] as const) for (const id of GACHA_FORMS) expect(catalog(lang)[`species.${id}`], `${lang} ${id}`).toBeTruthy();
  });
});

describe('evolution: stage bonus in a run', () => {
  it('starters and first forms get none: their players are exactly as before', () => {
    for (const id of [...STARTER_SPECIES, ...FIRST_FORMS]) expect(stageBonus(id, 1)).toEqual({ hp: 0, damage: 0 });
    const plain = createPlayer(vec(0, 0), 'mimikyu');
    expect(plain.maxHp).toBe(SPECIES.mimikyu.maxHp);
    expect('stageDamage' in plain).toBe(false);
  });

  it('raises max HP and every hit of an evolved form', () => {
    const abra = createPlayer(vec(0, 0), 'abra');
    const alakazam = createPlayer(vec(0, 0), 'alakazam');
    const { hp, damage } = stageBonus('alakazam', 1);
    expect(alakazam.maxHp).toBe(Math.round(SPECIES.alakazam.maxHp * (1 + hp)));
    expect(alakazam.maxHp).toBeGreaterThan(abra.maxHp);
    expect(playerStats(alakazam).damage).toBeCloseTo(playerStats(abra).damage * (1 + damage));
  });

  it('is capped lower in a party, so co-op stays fair', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const party = stageBonus(e.to, 2);
      expect(party.hp).toBeLessThanOrEqual(STAGE_BONUS_CAP.party);
      expect(party.damage).toBeLessThanOrEqual(STAGE_BONUS_CAP.party);
    }
    const solo = createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), species: 'haxorus' }).player;
    const duo = createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), species: 'haxorus', party: 2 }).player;
    expect(duo.maxHp).toBeLessThan(solo.maxHp);
    expect(playerStats(duo).damage).toBeLessThan(playerStats(solo).damage);
  });
});

describe('evolution: evolving an owned species', () => {
  const ready = { coins: 10_000, owned: ['shinx', 'abra'] as SpeciesId[], materials: { abra: { normal: 20, hard: 20, nightmare: 20 } } };

  it('pays its Pokémonedas and materials and replaces the form where it was', () => {
    const cost = evolutionOf('abra')!;
    const next = evolve(ready, 'abra')!;
    expect(next.owned).toEqual(['shinx', 'kadabra']);
    expect(next.coins).toBe(ready.coins - cost.coins);
    expect(next.materials?.abra).toEqual({ normal: 20 - cost.materials.normal!, hard: 20 - cost.materials.hard!, nightmare: 20 });
    expect(rosterOf(next)).toEqual([...STARTER_SPECIES, 'shinx', 'kadabra']);
    const final = evolve(next, 'kadabra')!;
    expect(final.owned).toEqual(['shinx', 'alakazam']);
    expect(evolve(final, 'alakazam')).toBeNull();
  });

  it('carries the Mejoras over to the new form', () => {
    const next = evolve({ ...ready, ranks: { abra: { swift: 2 } } }, 'abra')!;
    expect(next.ranks).toEqual({ kadabra: { swift: 2 } });
  });

  it('refuses without the species, the coins or the materials, changing nothing', () => {
    expect(canEvolve(ready, 'abra')).toBe(true);
    expect(canEvolve(ready, 'piplup')).toBe(false);
    expect(canEvolve(ready, 'shinx')).toBe(false);
    expect(canEvolve({ ...ready, coins: 0 }, 'abra')).toBe(false);
    expect(canEvolve(ready, 'mimikyu')).toBe(false);
    expect(evolve({ ...ready, coins: 0 }, 'abra')).toBeNull();
  });

  it('a higher tier never stands in for a lower one, and the final form needs Pesadilla', () => {
    expect(canEvolve({ ...ready, materials: { abra: { hard: 99, nightmare: 99 } } }, 'abra')).toBe(false);
    const kadabra = { coins: 10_000, owned: ['kadabra'] as SpeciesId[] };
    expect(canEvolve({ ...kadabra, materials: { abra: { normal: 999, hard: 999 } } }, 'kadabra')).toBe(false);
    expect(canEvolve({ ...kadabra, materials: { abra: { hard: 3, nightmare: 1 } } }, 'kadabra')).toBe(false);
    expect(canEvolve({ ...kadabra, materials: { abra: { hard: 3, nightmare: 2 } } }, 'kadabra')).toBe(true);
    expect(evolve({ ...kadabra, materials: { abra: { hard: 3, nightmare: 2 } } }, 'kadabra')!.materials).toEqual({ abra: {} });
  });
});

describe('evolution: the save keeps the collection', () => {
  it('keeps owned forms (one per line), their Mejoras, and materials of first forms only, per tier', () => {
    const save = sanitize({ coins: 0, upgrades: {}, owned: ['kadabra', 'abra', 'axew'], materials: { abra: { normal: 3, hard: 2, easy: 4, nightmare: -1 }, kadabra: { normal: 2 }, axew: { hard: 1.5 }, shinx: {} }, ranks: { kadabra: { swift: 1 } } });
    expect(save.owned).toEqual(['kadabra', 'axew']);
    expect(save.materials).toEqual({ abra: { normal: 3, hard: 2 }, axew: { hard: 1 } });
    expect(save.ranks).toEqual({ kadabra: { swift: 1 } });
  });

  it('an early v3 save\'s flat count per line reads as Normal materials', () => {
    expect(sanitize({ coins: 0, upgrades: {}, materials: { abra: 3, piplup: 0 } }).materials).toEqual({ abra: { normal: 3 } });
  });
});
