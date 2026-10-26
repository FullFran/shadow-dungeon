import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { EMPTY_SAVE, loadSave, sanitize, writeSave } from '../../src/app/save';
import { rosterOf, type Collection } from '../../src/core/collection';
import { awakeningOf, canEvolve, evolutionOf, evolve, stageBonus } from '../../src/core/evolution';
import { playerStats } from '../../src/core/items';
import { knownMoves } from '../../src/core/tutor';
import { vec } from '../../src/core/vec';
import { createPlayer, createWorld } from '../../src/core/world';
import { awakeningsOf, PLAYER_AWAKENINGS, PLAYER_EVOLUTIONS, STAGE_BONUS_CAP } from '../../src/data/player-evolutions';
import { PLAYABLE_SPECIES, SPECIES, STARTER_SPECIES } from '../../src/data/species';

/** Mimikyu's awakening (user decision 2026-10-26, odd/tasks/roster-parity.md): it never evolves, but grows like a three-form line. */
const SECOND = PLAYER_EVOLUTIONS.find((e) => e.from === 'abra')!;
const THIRD = PLAYER_EVOLUTIONS.find((e) => e.from === 'kadabra')!;

describe('awakening: data', () => {
  it('only Mimikyu awakens, the one playable species without an evolution line', () => {
    expect(Object.keys(PLAYER_AWAKENINGS)).toEqual(['mimikyu']);
    const lineless = PLAYABLE_SPECIES.filter((id) => !PLAYER_EVOLUTIONS.some((e) => e.from === id || e.to === id));
    expect(lineless).toEqual(['mimikyu']);
    expect(evolutionOf('mimikyu')).toBeNull();
  });

  it('two steps at a three-form line\'s prices and bonuses, each making a Maestro move of its pool known', () => {
    const [one, two] = awakeningsOf('mimikyu');
    expect({ coins: one!.coins, materials: one!.materials, bonus: one!.bonus }).toEqual({ coins: SECOND.coins, materials: SECOND.materials, bonus: SECOND.bonus });
    expect({ coins: two!.coins, materials: two!.materials, bonus: two!.bonus }).toEqual({ coins: THIRD.coins, materials: THIRD.materials, bonus: THIRD.bonus });
    for (const step of [one!, two!]) expect(SPECIES.mimikyu.movepool, step.move).toContain(step.move);
    expect(one!.move).not.toBe(two!.move);
  });
});

describe('awakening: rules', () => {
  const rich: Collection = { coins: 10_000, materials: { mimikyu: { normal: 3, hard: 5, nightmare: 2 } } };

  it('awakens twice, paying like an evolution, then stops; the id and the roster stay the same', () => {
    expect(awakeningOf(rich, 'mimikyu')).toEqual(awakeningsOf('mimikyu')[0]);
    expect(canEvolve(rich, 'mimikyu')).toBe(true);
    const once = evolve(rich, 'mimikyu')!;
    expect(once.awakened).toEqual({ mimikyu: 1 });
    expect(once.coins).toBe(rich.coins - SECOND.coins);
    expect(once.materials?.mimikyu).toEqual({ hard: 3, nightmare: 2 });
    expect(once.owned).toBeUndefined();
    expect(rosterOf(once)).toEqual(STARTER_SPECIES);
    const twice = evolve(once, 'mimikyu')!;
    expect(twice.awakened).toEqual({ mimikyu: 2 });
    expect(twice.materials?.mimikyu).toEqual({});
    expect(awakeningOf(twice, 'mimikyu')).toBeNull();
    expect(evolve({ ...twice, materials: rich.materials }, 'mimikyu')).toBeNull();
  });

  it('needs Pesadilla for the second step, like a final evolution', () => {
    expect(canEvolve({ coins: 10_000, awakened: { mimikyu: 1 }, materials: { mimikyu: { normal: 9, hard: 9 } } }, 'mimikyu')).toBe(false);
  });

  it('each step makes its move known (free, no dungeon lock)', () => {
    const [one, two] = awakeningsOf('mimikyu');
    expect(knownMoves({}, 'mimikyu')).not.toContain(one!.move);
    expect(knownMoves({ awakened: { mimikyu: 1 } }, 'mimikyu')).toContain(one!.move);
    expect(knownMoves({ awakened: { mimikyu: 1 } }, 'mimikyu')).not.toContain(two!.move);
    expect(knownMoves({ awakened: { mimikyu: 2 } }, 'mimikyu')).toEqual(expect.arrayContaining([one!.move, two!.move]));
  });

  it('gives the stage bonus of its step in a run, capped like an evolution (lower in a party)', () => {
    expect(stageBonus('mimikyu', 1)).toEqual({ hp: 0, damage: 0 });
    expect(stageBonus('mimikyu', 1, 1)).toEqual(SECOND.bonus);
    expect(stageBonus('mimikyu', 1, 2)).toEqual(THIRD.bonus);
    expect(stageBonus('mimikyu', 1, 9)).toEqual(THIRD.bonus);
    expect(stageBonus('mimikyu', 2, 2).damage).toBeLessThanOrEqual(STAGE_BONUS_CAP.party);
    const plain = createPlayer(vec(0, 0), 'mimikyu');
    const awake = createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), species: 'mimikyu', awakened: 2 }).player;
    expect(awake.maxHp).toBe(Math.round(SPECIES.mimikyu.maxHp * (1 + THIRD.bonus.hp)));
    expect(playerStats(awake).damage).toBeCloseTo(playerStats(plain).damage * (1 + THIRD.bonus.damage));
    // Another species ignores an awakening count.
    expect(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), species: 'zorua', awakened: 2 }).player.maxHp).toBe(SPECIES.zorua.maxHp);
  });
});

describe('awakening: save', () => {
  it('keeps whole steps of species that awaken, clamped to their steps', () => {
    expect(sanitize({ coins: 0, upgrades: {}, awakened: { mimikyu: 7, zorua: 1, abra: 2 } }).awakened).toEqual({ mimikyu: 2 });
    expect(sanitize({ coins: 0, upgrades: {}, awakened: { mimikyu: 0 } }).awakened).toBeUndefined();
    expect(sanitize({ coins: 0, upgrades: {}, awakened: { mimikyu: 1.5 } }).awakened).toEqual({ mimikyu: 1 });
  });

  it('round-trips through the store', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, awakened: { mimikyu: 1 }, materials: { mimikyu: { hard: 3 } } });
    expect(loadSave(store)).toMatchObject({ awakened: { mimikyu: 1 }, materials: { mimikyu: { hard: 3 } } });
  });
});
