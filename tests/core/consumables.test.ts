import { describe, expect, it } from 'vitest';
import { CONSUMABLE_EFFECTS, CONSUMABLE_IDS } from '../../src/data/consumables';
import { TURN_FLOOR } from '../../src/data/difficulty';
import { bossSpecies } from '../../src/data/boss-lore';
import { armSprout, consumableActive, settleConsumables, useConsumable, type UseContext } from '../../src/core/consumables';
import { playerStats } from '../../src/core/items';
import { cardHpFloor } from '../../src/core/cards';
import type { GameEvent, ProjectileState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { spawnEnemy } from '../../src/core/world';
import type { SpeciesId } from '../../src/data/species';
import { IDLE, world } from './helpers';
import '../../src/data/guardian-tricks';

const SOLO: UseContext = { bossArena: false, guest: false };

const hurt = (state: WorldState, hp: number): WorldState => ({ ...state, player: { ...state.player, hp } });

function steps(state: WorldState, ms: number): WorldState {
  let current = state;
  for (let t = 0; t < ms; t += FIXED_DT_MS) current = step(current, IDLE, FIXED_DT_MS);
  return current;
}

const shot = (id: string, owner: 'enemy' | 'player', remainingMs = 4000): ProjectileState =>
  ({ id, owner, type: 'ghost', attackerTypes: ['ghost'], power: 10, damageMultiplier: 1, pos: vec(10, 10), vel: vec(0, 0), radius: 4, remainingMs, hitstunMs: 0, knockback: 0, hitIds: [] }) as unknown as ProjectileState;

describe('consumables in a run: a player who never uses one is unchanged', () => {
  it('no consumable state, no change to the step (golden runs keep their digest)', () => {
    const state = world();
    expect(state.player.consumables).toBeUndefined();
    expect(steps(state, 500).player.consumables).toBeUndefined();
  });
});

describe('consumables in a run: every kind does its thing', () => {
  it('dew-tonic heals tonicHeal of max HP over tonicMs', () => {
    const start = hurt(world(), 10);
    const used = useConsumable(start, 'dew-tonic', SOLO);
    expect(used.refused).toBeUndefined();
    const after = steps(used.state, CONSUMABLE_EFFECTS.tonicMs + 100);
    expect(after.player.hp).toBeCloseTo(10 + start.player.maxHp * CONSUMABLE_EFFECTS.tonicHeal, 0);
    expect(after.player.consumables).toBeUndefined();
  });

  it('dew-tonic stops when the player is hurt', () => {
    const used = useConsumable(hurt(world(), 10), 'dew-tonic', SOLO).state;
    const mid = steps(used, 200);
    // A step in which the player lost HP (any hit): the tonic is gone.
    const after = settleConsumables(mid.player, { ...mid, player: { ...mid.player, hp: mid.player.hp - 1 } }, FIXED_DT_MS, []);
    expect(consumableActive(after.player, 'dew-tonic')).toBe(false);
    expect(after.player.hp).toBe(mid.player.hp - 1);
  });

  it('dew-tonic is refused at full HP (nothing to heal)', () => {
    expect(useConsumable(world(), 'dew-tonic', SOLO).refused).toBe('nothing');
  });

  it('clear-salt cures poison and keeps it away for saltMs', () => {
    const poisoned = { ...world(), player: { ...world().player, poison: { remainingMs: 3000, tickMs: 500 } } };
    const used = useConsumable(poisoned, 'clear-salt', SOLO);
    expect(used.state.player.poison).toBeUndefined();
    expect(consumableActive(used.state.player, 'clear-salt')).toBe(true);
    expect(consumableActive(steps(used.state, CONSUMABLE_EFFECTS.saltMs + 50).player, 'clear-salt')).toBe(false);
  });

  it('ember-dust multiplies damage by dustDamage while it lasts', () => {
    const state = world();
    const used = useConsumable(state, 'ember-dust', SOLO).state;
    expect(playerStats(used.player).damage).toBeCloseTo(playerStats(state.player).damage * CONSUMABLE_EFFECTS.dustDamage);
    expect(playerStats(steps(used, CONSUMABLE_EFFECTS.dustMs + 50).player).damage).toBeCloseTo(playerStats(state.player).damage);
  });

  it('wind-feather multiplies stamina regen by featherRegen while it lasts', () => {
    const state = world();
    const used = useConsumable(state, 'wind-feather', SOLO).state;
    expect(playerStats(used.player).staminaRegen).toBeCloseTo(playerStats(state.player).staminaRegen * CONSUMABLE_EFFECTS.featherRegen);
  });

  it('hush-lantern fades every enemy shot (not the player\'s) and forfeits the card under way', () => {
    const state: WorldState = { ...world(), projectiles: [shot('e1', 'enemy'), shot('p1', 'player')], capture: { enemyId: 'b', card: 'x' as never, hit: false } };
    const used = useConsumable(state, 'hush-lantern', SOLO).state;
    expect(used.projectiles.find((p) => p.id === 'e1')!.remainingMs).toBeLessThanOrEqual(TURN_FLOOR.fadeMs);
    expect(used.projectiles.find((p) => p.id === 'p1')!.remainingMs).toBe(4000);
    expect(used.capture?.hit).toBe(true);
  });

  it('hush-lantern on a guest: the host\'s shots stop counting for this player (victim side, no protocol change)', () => {
    const state: WorldState = { ...world(), role: 'guest', localId: 'p2', projectiles: [shot('e1', 'enemy'), shot('e2', 'enemy')] };
    const used = useConsumable(state, 'hush-lantern', { bossArena: false, guest: true }).state;
    expect(used.spentShots).toEqual(expect.arrayContaining(['e1', 'e2']));
  });

  it('spore-bomb stuns ordinary enemies in reach and leaves those out of reach alone', () => {
    let state = spawnEnemy(world(vec(400, 300)), 'poochyena', vec(420, 300), { dormant: true });
    state = spawnEnemy(state, 'poochyena', vec(700, 300), { dormant: true });
    const used = useConsumable(state, 'spore-bomb', SOLO).state;
    const [near, far] = used.enemies;
    expect(near!.hitstunMs).toBeGreaterThanOrEqual(CONSUMABLE_EFFECTS.sporeStunMs);
    expect(near!.hp).toBeLessThan(state.enemies[0]!.hp);
    expect(far!.hitstunMs).toBe(0);
    expect(far!.hp).toBe(state.enemies[1]!.hp);
  });

  it('spore-bomb on a guest claims its hits through the existing hit-claim path', () => {
    const state = { ...spawnEnemy(world(vec(400, 300)), 'poochyena', vec(420, 300), { dormant: true }), role: 'guest' as const, localId: 'p2' };
    const used = useConsumable(state, 'spore-bomb', { bossArena: false, guest: true });
    const claims = used.events.filter((e) => e.type === 'hitClaim');
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ claim: { enemyId: state.enemies[0]!.id, hitstunMs: CONSUMABLE_EFFECTS.sporeStunMs } });
  });

  it('spore-bomb never stuns a boss, and never takes a spell card below its floor (every boss)', () => {
    for (const species of bossSpecies()) {
      const spawned = spawnEnemy(world(vec(400, 300)), species as SpeciesId, vec(420, 300), { dormant: true });
      const atFloor = { ...spawned, enemies: spawned.enemies.map((e) => ({ ...e, hp: Math.max(1, cardHpFloor(e)) })) };
      const used = useConsumable(atFloor, 'spore-bomb', SOLO).state;
      const boss = used.enemies[0]!;
      expect(boss.hitstunMs, species).toBe(atFloor.enemies[0]!.hitstunMs);
      expect(boss.hp, species).toBeGreaterThanOrEqual(Math.min(atFloor.enemies[0]!.hp, cardHpFloor(atFloor.enemies[0]!)));
    }
  });

  it('second-sprout is not used by hand: armed, it stands the player up once with sproutHp on fainting', () => {
    expect(useConsumable(world(), 'second-sprout', SOLO).refused).toBe('passive');
    const armed = armSprout(world());
    const events: GameEvent[] = [];
    const fainted = { ...armed, player: { ...armed.player, hp: 0 } };
    const up = settleConsumables(armed.player, fainted, FIXED_DT_MS, events);
    expect(up.player.hp).toBe(Math.round(armed.player.maxHp * CONSUMABLE_EFFECTS.sproutHp));
    expect(events).toContainEqual({ type: 'consumableUsed', item: 'second-sprout' });
    // Spent: the next faint is a faint.
    const again = settleConsumables(up.player, { ...up, player: { ...up.player, hp: 0 } }, FIXED_DT_MS, []);
    expect(again.player.hp).toBe(0);
    // Unarmed, nothing happens.
    expect(settleConsumables(world().player, { ...world(), player: { ...world().player, hp: 0 } }, FIXED_DT_MS, []).player.hp).toBe(0);
  });

  it('the exit cord is refused in a boss arena and for a guest', () => {
    expect(useConsumable(world(), 'exit-cord', { bossArena: true, guest: false }).refused).toBe('boss-arena');
    expect(useConsumable(world(), 'exit-cord', { bossArena: false, guest: true }).refused).toBe('guest');
    expect(useConsumable(world(), 'exit-cord', SOLO).refused).toBeUndefined();
  });

  it('a fainted player uses nothing; every kind reports a use event when it works', () => {
    for (const id of CONSUMABLE_IDS) expect(useConsumable(hurt(world(), 0), id, SOLO).refused, id).toBeDefined();
    for (const id of CONSUMABLE_IDS.filter((i) => i !== 'second-sprout')) {
      const used = useConsumable(hurt(world(), 10), id, SOLO);
      if (!used.refused) expect(used.events, id).toContainEqual({ type: 'consumableUsed', item: id });
    }
  });
});
