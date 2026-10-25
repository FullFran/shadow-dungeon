import { describe, expect, it } from 'vitest';
import { ITEM_EFFECTS, ITEM_IDS, ITEM_OFFER, ITEMS, type ItemId } from '../../src/data/items';
import { MOVES, type MoveId } from '../../src/data/moves';
import { TUNING } from '../../src/data/tuning';
import { computeDamage } from '../../src/core/damage';
import { addItem, itemCount, offerItems, playerStats } from '../../src/core/items';
import { classifyHit } from '../../src/core/player';
import { chooseItem, progressRun, startRun, type RunProgress } from '../../src/core/run';
import type { EnemyState, GameEvent, PlayerInput, PlayerState, WorldState } from '../../src/core/state';
import { hitPlayer, step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, enterRoom, spawnEnemy } from '../../src/core/world';
import type { SpeciesId } from '../../src/data/species';
import { IDLE, ticksFor } from './helpers';

const SEED = 20261025;
const PLAYER = vec(400, 300);

function arena(items: ItemId[] = [], enemies: [SpeciesId, Vec2][] = [], loadout: [MoveId, MoveId] = ['shadow-claw', 'play-rough']): WorldState {
  let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, loadout });
  for (const [species, pos] of enemies) state = spawnEnemy(state, species, pos, { dormant: true });
  return { ...state, player: items.reduce(addItem, state.player) };
}

const withPlayer = (state: WorldState, changes: Partial<PlayerState>): WorldState => ({ ...state, player: { ...state.player, ...changes } });

/** Presses a slot once (aimed right), then idles for `ms`, collecting events. */
function use(state: WorldState, slot: number, ms = 900, holdMs = FIXED_DT_MS): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const pressed = [slot === 0, slot === 1];
  const press: PlayerInput = { ...IDLE, aim: vec(600, 300), slots: pressed, slotMouse: pressed };
  const release: PlayerInput = { ...press, slots: [false, false], slotMouse: [false, false] };
  const holdTicks = Math.max(1, ticksFor(holdMs));
  for (let i = 0; i < holdTicks + ticksFor(ms); i++) {
    current = step(current, i < holdTicks ? press : release, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const firstHit = (events: GameEvent[]) => {
  const hit = events.find((e) => e.type === 'enemyHit');
  return hit?.type === 'enemyHit' ? hit.damage : 0;
};

const toStairs = (world: WorldState): WorldState => ({
  ...world,
  player: { ...world.player, pos: vec(world.arena.stairs!.x + 16, world.arena.stairs!.y + 16) },
});

describe('item offers', () => {
  it('offer three different items, the same for the same run seed, floor and player', () => {
    const offer = offerItems(SEED, 2, 'p1', []);
    expect(offer).toHaveLength(ITEM_OFFER.size);
    expect(new Set(offer).size).toBe(offer.length);
    expect(offerItems(SEED, 2, 'p1', [])).toEqual(offer);
    const others = [offerItems(SEED, 3, 'p1', []), offerItems(SEED, 2, 'p2', []), offerItems(SEED + 1, 2, 'p1', [])];
    expect(others.some((o) => o.join() !== offer.join())).toBe(true);
  });

  it('never offer an item already at its stack cap, and offer fewer when few are left', () => {
    const capped: ItemId[] = ITEM_IDS.flatMap((id) => (id === 'leftovers' ? [] : Array<ItemId>(ITEMS[id].maxStacks).fill(id)));
    for (let floor = 2; floor < 30; floor++) {
      const offer = offerItems(SEED, floor, 'p1', ['choice-band']);
      expect(offer).not.toContain('choice-band');
    }
    expect(offerItems(SEED, 2, 'p1', capped)).toEqual(['leftovers']);
  });

  it('follow the rarity weights: commons show up more than rares', () => {
    const counts = { common: 0, uncommon: 0, rare: 0 };
    for (let seed = 0; seed < 400; seed++) for (const id of offerItems(seed, 2, 'p1', [])) counts[ITEMS[id].rarity]++;
    expect(counts.common).toBeGreaterThan(counts.uncommon);
    expect(counts.uncommon).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(0);
  });

  it('come on entering every floor after the first, fixed rooms included (the vault on 3), and picking one holds it', () => {
    let progress: RunProgress = { ...startRun(SEED, {}), entered: false, outcome: null };
    expect(progress.run.offer).toBeNull();
    for (const floor of [2, 3]) {
      progress = progressRun(progress.run, toStairs(progress.world));
      expect(progress.run.floor).toBe(floor);
      expect(progress.run.offer).toEqual(offerItems(SEED, floor, 'p1', progress.world.player.items));
      const choice = progress.run.offer![1]!;
      const picked = chooseItem(progress.run, progress.world, 1);
      expect(picked.run.offer).toBeNull();
      expect(picked.world.player.items.at(-1)).toBe(choice);
      progress = { ...progress, ...picked };
      if (floor === 3) break;
    }
  });

  it('ignore a pick with no offer or out of range', () => {
    const { run, world } = startRun(SEED, {}, 2);
    expect(chooseItem(run, world, 5)).toEqual({ run, world });
    const picked = chooseItem(run, world, 0);
    expect(chooseItem(picked.run, picked.world, 0)).toEqual(picked);
  });

  it('stack up to the cap', () => {
    let player = arena().player;
    for (let i = 0; i < 5; i++) player = addItem(player, 'scope-lens');
    expect(itemCount(player, 'scope-lens')).toBe(ITEMS['scope-lens'].maxStacks);
  });
});

describe('item effects', () => {
  it('Choice Band: more damage, dearer moves and rolls', () => {
    const plain = use(arena([], [['poochyena', vec(425, 300)]]), 1);
    const band = use(arena(['choice-band'], [['poochyena', vec(425, 300)]]), 1);
    expect(firstHit(band.events)).toBeGreaterThan(firstHit(plain.events));
    const cost = (state: WorldState) => {
      const pressed = step(state, { ...IDLE, aim: vec(600, 300), slots: [false, true], slotMouse: [false, true] }, FIXED_DT_MS);
      return state.player.stamina - pressed.player.stamina;
    };
    expect(cost(arena(['choice-band']))).toBeCloseTo(MOVES['play-rough'].staminaCost * 1.3);
    const rolled = step(arena(['choice-band']), { ...IDLE, move: vec(1, 0), roll: true }, FIXED_DT_MS);
    expect(TUNING.stamina.max - rolled.player.stamina).toBeCloseTo(TUNING.roll.staminaCost * 1.3);
  });

  it('Leftovers: slow regeneration, never above max HP', () => {
    const hurt = withPlayer(arena(['leftovers']), { hp: 50 });
    let state = hurt;
    for (let i = 0; i < ticksFor(1000); i++) state = step(state, IDLE, FIXED_DT_MS);
    expect(state.player.hp).toBeCloseTo(50 + ITEM_EFFECTS.leftoversPerSecond * state.player.maxHp, 1);
    let full = arena(['leftovers']);
    for (let i = 0; i < 10; i++) full = step(full, IDLE, FIXED_DT_MS);
    expect(full.player.hp).toBe(full.player.maxHp);
  });

  it('Quick Claw: moves finish sooner', () => {
    const ticksToFinish = (state: WorldState) => {
      let current = step(state, { ...IDLE, aim: vec(600, 300), slots: [true, false], slotMouse: [true, false] }, FIXED_DT_MS);
      let ticks = 1;
      while (current.player.action && ticks < 200) {
        current = step(current, IDLE, FIXED_DT_MS);
        ticks++;
      }
      return ticks;
    };
    expect(ticksToFinish(arena(['quick-claw']))).toBeLessThan(ticksToFinish(arena()));
  });

  it('Sitrus Berry: one big heal under half HP, once per stack per floor', () => {
    const state = withPlayer(arena(['sitrus-berry']), { hp: 40, disguiseBroken: true });
    const healed = step(state, IDLE, FIXED_DT_MS);
    expect(healed.player.hp).toBeCloseTo(40 + ITEM_EFFECTS.sitrusHeal * state.player.maxHp);
    expect(healed.events).toContainEqual({ type: 'itemTriggered', item: 'sitrus-berry' });
    const again = step(withPlayer(healed, { hp: 30 }), IDLE, FIXED_DT_MS);
    expect(again.player.hp).toBe(30);
    const nextFloor = step(withPlayer(enterRoom(again), { hp: 30 }), IDLE, FIXED_DT_MS);
    expect(nextFloor.player.hp).toBeCloseTo(30 + ITEM_EFFECTS.sitrusHeal * state.player.maxHp);
    expect(step(withPlayer(arena(['sitrus-berry']), { hp: 60 }), IDLE, FIXED_DT_MS).player.hp).toBe(60);
  });

  it('Scope Lens: some hits are critical, at the crit multiplier', () => {
    const damages = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const state = { ...arena(['scope-lens', 'scope-lens', 'scope-lens'], [['poochyena', vec(425, 300)]]), rng: seed * 7919 };
      damages.add(firstHit(use(state, 0, 300).events));
    }
    const claw = { power: MOVES['shadow-claw'].power, moveType: 'ghost' as const, attackerTypes: ['ghost', 'fairy'] as const, defenderTypes: ['dark'] as const };
    expect(damages).toEqual(new Set([computeDamage(claw).damage, computeDamage({ ...claw, multiplier: ITEM_EFFECTS.critMultiplier }).damage]));
  });

  it('Focus Sash: a lethal attack leaves 1 HP, once per floor', () => {
    const state = withPlayer(arena(['focus-sash']), { hp: 20, disguiseBroken: true });
    const saved = hitPlayer(state, { damage: 50 });
    expect(saved.player.hp).toBe(1);
    expect(saved.events).toContainEqual({ type: 'itemTriggered', item: 'focus-sash' });
    expect(hitPlayer(saved, { damage: 50 }).player.hp).toBe(0);
    expect(hitPlayer(withPlayer(arena(), { hp: 20, disguiseBroken: true }), { damage: 50 }).player.hp).toBe(0);
  });

  it('Shell Bell: heals a share of the damage dealt', () => {
    const { state, events } = use(withPlayer(arena(['shell-bell'], [['poochyena', vec(425, 300)]]), { hp: 50 }), 0, 300);
    expect(state.player.hp).toBeCloseTo(50 + ITEM_EFFECTS.shellBellHeal * firstHit(events));
  });

  it('Muscle Band: only the heavy slot hits harder', () => {
    const enemy: [SpeciesId, Vec2][] = [['poochyena', vec(425, 300)]];
    expect(firstHit(use(arena(['muscle-band'], enemy), 1).events)).toBeGreaterThan(firstHit(use(arena([], enemy), 1).events));
    expect(firstHit(use(arena(['muscle-band'], enemy), 0, 300).events)).toBe(firstHit(use(arena([], enemy), 0, 300).events));
  });

  it('Expert Belt: only super effective hits hit harder', () => {
    // Shadow Claw (Ghost) is super effective on Gastly and not very effective on Poochyena.
    const gastly: [SpeciesId, Vec2][] = [['gastly', vec(425, 300)]];
    const poochyena: [SpeciesId, Vec2][] = [['poochyena', vec(425, 300)]];
    expect(firstHit(use(arena(['expert-belt'], gastly), 0, 300).events)).toBeGreaterThan(firstHit(use(arena([], gastly), 0, 300).events));
    expect(firstHit(use(arena(['expert-belt'], poochyena), 0, 300).events)).toBe(firstHit(use(arena([], poochyena), 0, 300).events));
  });

  it('Bright Powder: a longer perfect-dodge window', () => {
    const late = TUNING.roll.iframesStartMs + TUNING.perfectDodge.windowMs + 20;
    const rolling = (items: ItemId[]) => ({ ...arena(items).player, roll: { elapsedMs: late, dir: vec(1, 0) } });
    expect(classifyHit(rolling([]), { damage: 5 })).toBe('dodged');
    expect(classifyHit(rolling(['bright-powder']), { damage: 5 })).toBe('perfectDodge');
  });

  it('Wide Lens: reaches an enemy just out of range', () => {
    const reach = MOVES['shadow-claw'].hitbox.kind === 'arc' ? MOVES['shadow-claw'].hitbox.range : 0;
    const far: [SpeciesId, Vec2][] = [['poochyena', vec(400 + reach + 11 + 3, 300)]];
    expect(firstHit(use(arena([], far), 0, 300).events)).toBe(0);
    expect(firstHit(use(arena(['wide-lens'], far), 0, 300).events)).toBeGreaterThan(0);
  });

  it('Rocky Helmet: an enemy whose bite lands takes damage (host), or the guest claims it', () => {
    const biting = (role: 'host' | 'guest', items: ItemId[]): WorldState => {
      const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, role, localId: role === 'host' ? 'p1' : 'p2' });
      const spawned = spawnEnemy(base, 'poochyena', vec(415, 300));
      const enemy: EnemyState = {
        ...spawned.enemies[0]!,
        ai: { ...spawned.enemies[0]!.ai, mode: 'attack', modeMs: 0, modeDurationMs: 300, attackDir: vec(-1, 0), contact: 'none' },
      };
      return { ...spawned, enemies: [enemy], player: items.reduce(addItem, { ...spawned.player, disguiseBroken: true }) };
    };
    const maxHp = biting('host', []).enemies[0]!.maxHp;
    const host = step(biting('host', ['rocky-helmet']), IDLE, FIXED_DT_MS);
    expect(host.player.hp).toBeLessThan(host.player.maxHp);
    expect(host.enemies[0]!.hp).toBe(maxHp - ITEM_EFFECTS.rockyHelmetDamage);
    expect(host.events).toContainEqual({ type: 'itemTriggered', item: 'rocky-helmet', enemyId: 'e1' });
    expect(step(biting('host', []), IDLE, FIXED_DT_MS).enemies[0]!.hp).toBe(maxHp);

    const guest = step(biting('guest', ['rocky-helmet']), IDLE, FIXED_DT_MS);
    const claim = guest.events.find((e) => e.type === 'hitClaim');
    expect(claim?.type === 'hitClaim' && claim.claim).toMatchObject({ playerId: 'p2', enemyId: 'e1', damage: ITEM_EFFECTS.rockyHelmetDamage, blocked: false });
  });
});

describe('stats pipeline', () => {
  it('compounds multipliers per stack and adds the additive ones', () => {
    const stats = playerStats(arena(['muscle-band', 'muscle-band', 'scope-lens', 'bright-powder']).player);
    expect(stats.heavyDamage).toBeCloseTo(1.2 * 1.2);
    expect(stats.critChance).toBeCloseTo(0.1);
    expect(stats.perfectWindowMs).toBe(TUNING.perfectDodge.windowMs + 40);
    expect(playerStats(arena().player)).toMatchObject({ damage: 1, heavyDamage: 1, staminaCost: 1, actionTime: 1, critChance: 0, reach: 1 });
  });
});
