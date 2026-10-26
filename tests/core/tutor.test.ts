import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { loadSave, migrate, parseSave, sanitize, SAVE_KEY, SAVE_VERSION, writeSave } from '../../src/app/save';
import { tutorPurchase, tutorRows } from '../../src/app/tutor';
import { startTrial } from '../../src/core/shrine';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { buyMove, knownLoadout, knownMoves, moveRank, rankUp, runRanks, tutorLock, tutorPrice, type TutorWallet } from '../../src/core/tutor';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { MOVES, type MoveId } from '../../src/data/moves';
import { originalKit, SPECIES } from '../../src/data/species';
import { movePrice, RANK_COSTS, RANK_COSTS_BY_TIER } from '../../src/data/tutor';
import { IDLE } from './helpers';

describe('move tutor: learning', () => {
  it('a starter knows its original kit for free and nothing else', () => {
    expect(knownMoves({}, 'mimikyu')).toEqual(originalKit('mimikyu'));
    expect(tutorPrice('mimikyu', 'shadow-claw')).toBe(0);
    expect(tutorPrice('mimikyu', 'wood-hammer')).toBe(movePrice(MOVES['wood-hammer']));
    // Not in Mimikyu's learnset.
    expect(tutorPrice('mimikyu', 'earthquake')).toBeNull();
  });

  it('buying pays the price once and the move becomes known; refused buys change nothing', () => {
    const price = movePrice(MOVES['wood-hammer']);
    const bought = buyMove({ coins: price + 5 }, 'mimikyu', 'wood-hammer');
    expect(bought?.coins).toBe(5);
    expect(knownMoves(bought!, 'mimikyu')).toContain('wood-hammer');
    expect(buyMove(bought!, 'mimikyu', 'wood-hammer')).toBeNull();
    expect(buyMove({ coins: price - 1 }, 'mimikyu', 'wood-hammer')).toBeNull();
    expect(buyMove({ coins: 9999 }, 'mimikyu', 'shadow-claw')).toBeNull();
    expect(buyMove({ coins: 9999 }, 'zorua', 'wood-hammer')).toBeNull();
    // Learned per species: Zorua learning Shadow Claw does not touch Mimikyu.
    expect(knownMoves(buyMove({ coins: 9999 }, 'zorua', 'shadow-claw')!, 'mimikyu')).toEqual(originalKit('mimikyu'));
  });

  it('a Maestro move locked behind a dungeon is refused until its guardian falls', () => {
    expect(tutorLock({}, 'mimikyu', 'thunder')).toBe('misty-forest');
    expect(buyMove({ coins: 9999 }, 'mimikyu', 'thunder')).toBeNull();
    expect(buyMove({ coins: 9999, cleared: ['crypt-of-the-sword-king'] }, 'mimikyu', 'thunder')).toBeNull();
    const wallet = buyMove({ coins: 9999, cleared: ['crypt-of-the-sword-king', 'misty-forest'] }, 'mimikyu', 'thunder');
    expect(knownMoves(wallet!, 'mimikyu')).toContain('thunder');
    expect(wallet!.coins).toBe(9999 - movePrice(MOVES.thunder));
    // Unlocked Maestro and Avanzado moves have no lock.
    expect(tutorLock({}, 'mimikyu', 'wood-hammer')).toBeNull();
    expect(tutorLock({}, 'mimikyu', 'slash')).toBeNull();
  });

  it('a run only takes known moves: an unknown one falls back to the default of its slot', () => {
    expect(knownLoadout({}, 'mimikyu', ['slash', 'wood-hammer', 'curse', 'thunder'])).toEqual(SPECIES.mimikyu.defaultLoadout);
    expect(knownLoadout({ learned: { mimikyu: ['wood-hammer'] } }, 'mimikyu', ['shadow-sneak', 'wood-hammer', null, 'shadow-force'])).toEqual(['shadow-sneak', 'wood-hammer', null, 'shadow-force']);
  });
});

describe('move tutor: Mejoras', () => {
  it('ranks a move up twice, then it is maxed; rank prices scale with the tier', () => {
    let wallet: TutorWallet = { coins: RANK_COSTS[0]! + RANK_COSTS[1]! };
    wallet = rankUp(wallet, 'cubone', 'bone-club')!;
    wallet = rankUp(wallet, 'cubone', 'bone-club')!;
    expect(wallet.coins).toBe(0);
    expect(moveRank(wallet, 'cubone', 'bone-club')).toBe(2);
    expect(rankUp({ ...wallet, coins: 9999 }, 'cubone', 'bone-club')).toBeNull();
    // Only a known move can be ranked: an unlearned tutor move cannot, a learned one can (at its tier's price).
    expect(rankUp({ coins: 9999 }, 'cubone', 'knock-off')).toBeNull();
    expect(rankUp({ coins: 9999, learned: { cubone: ['knock-off'] } }, 'cubone', 'knock-off')?.coins).toBe(9999 - RANK_COSTS_BY_TIER.advanced[0]!);
    expect(runRanks(wallet, 'cubone')).toEqual({ 'bone-club': 2 });
    expect(rankUp({ coins: 9999, learned: { cubone: ['focus-punch'] } }, 'cubone', 'focus-punch')?.coins).toBe(9999 - RANK_COSTS_BY_TIER.master[0]!);
    expect(runRanks(wallet, 'mimikyu')).toBeUndefined();
  });

  const press = (slot: number): PlayerInput => ({ ...IDLE, aim: vec(424, 300), slots: [0, 1, 2, 3].map((i) => i === slot), slotMouse: [0, 1, 2, 3].map((i) => i === slot) });
  function hitDamage(state: WorldState): number {
    let current = step(state, press(0), FIXED_DT_MS);
    const events: GameEvent[] = [...current.events];
    for (let i = 0; i < 40; i++) {
      current = step(current, { ...IDLE, aim: vec(424, 300) }, FIXED_DT_MS);
      events.push(...current.events);
    }
    const hit = events.find((e) => e.type === 'enemyHit');
    if (hit?.type !== 'enemyHit') throw new Error('no hit');
    return hit.damage;
  }
  const arena = (moveRanks?: Partial<Record<MoveId, number>>): WorldState => {
    const w = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species: 'cubone', ...(moveRanks ? { moveRanks } : {}) });
    const spawned = spawnEnemy(w, 'gastly', vec(424, 300), { dormant: true });
    return { ...spawned, enemies: spawned.enemies.map((e) => ({ ...e, hp: 9999, maxHp: 9999 })) };
  };

  it('a ranked move hits 10 % harder per rank in a run; an unranked run has no ranks field', () => {
    expect(arena().player.moveRanks).toBeUndefined();
    const base = hitDamage(arena());
    const ranked = hitDamage(arena({ 'bone-club': 2 }));
    // Rounded damage: within one point of 1.2 times the unranked hit.
    expect(Math.abs(ranked - base * 1.2)).toBeLessThanOrEqual(1);
    expect(ranked).toBeGreaterThan(base);
  });

  it('a ranked boost or area move comes back sooner', () => {
    const w = arena({ 'bulk-up': 1 });
    let current = step({ ...w, enemies: [] }, { ...IDLE, slots: [false, false, true, false] }, FIXED_DT_MS);
    current = step(current, IDLE, FIXED_DT_MS);
    expect(current.player.cooldowns?.['bulk-up']).toBeLessThanOrEqual(MOVES['bulk-up'].cooldownMs! * 0.9);
  });

  it('a shrine trial keeps the Mejoras (progression counts everywhere) but still drops the shop upgrades', () => {
    const trial = startTrial(1, { species: 'cubone', moveRanks: { 'bone-club': 2 }, upgrades: { vitality: 2 } }, [{ dungeon: 'crypt-of-the-sword-king', floor: 6, boss: 'aegislash', role: 'guardian' }]);
    expect(trial.world.player.moveRanks).toEqual({ 'bone-club': 2 });
    expect(trial.world.player.upgrades).toBeUndefined();
  });
});

describe('save v2: learned moves and ranks', () => {
  it('migrates a v1 save with nothing learned and keeps its coins and upgrades', () => {
    const v1 = { version: 1, coins: 300, upgrades: { vitality: 2 } };
    expect(SAVE_VERSION).toBe(2);
    expect(migrate(v1)).toEqual({ ...v1, version: 2 });
    expect(sanitize(migrate(v1))).toEqual({ version: 2, coins: 300, upgrades: { vitality: 2 } });
  });

  it('keeps only moves the tutor teaches that species, and only ranks of moves it can know', () => {
    const save = parseSave(
      JSON.stringify({
        version: 2,
        coins: 10,
        upgrades: {},
        learned: { mimikyu: ['wood-hammer', 'earthquake', 'shadow-claw', 'wood-hammer', 42], zorua: 'x', bogus: ['slash'] },
        ranks: { cubone: { 'bone-club': 9, 'knock-off': 1, slash: 1, bonemerang: 1.5, earthquake: 1 }, litwick: [] },
      }),
    );
    expect(save.learned).toEqual({ mimikyu: ['wood-hammer'] });
    expect(save.ranks).toEqual({ cubone: { 'bone-club': 2, earthquake: 1, 'knock-off': 1 } });
  });

  it('a purchase through the window helper persists, and a refused one writes nothing', () => {
    const store = memoryStore();
    writeSave(store, { version: SAVE_VERSION, coins: 1000, upgrades: {} });
    const row = tutorRows(loadSave(store), 'litwick').find((r) => r.move === 'fire-blast')!;
    expect(row.cost).toBe(movePrice(MOVES['fire-blast']));
    const after = tutorPurchase(store, 'litwick', row);
    expect(after?.learned).toEqual({ litwick: ['fire-blast'] });
    expect(loadSave(store).coins).toBe(1000 - row.cost!);
    const raw = store.get(SAVE_KEY);
    expect(tutorPurchase(store, 'litwick', row)).toBeNull();
    expect(store.get(SAVE_KEY)).toBe(raw);
    expect(tutorRows(loadSave(store), 'litwick').find((r) => r.move === 'fire-blast')!.cost).toBeNull();
  });
});
