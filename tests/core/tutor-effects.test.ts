import { describe, expect, it } from 'vitest';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { DOTS, MOVES, type MoveId } from '../../src/data/moves';
import type { SpeciesId } from '../../src/data/species';
import { IDLE } from './helpers';

/**
 * The move tutor's generic effects (odd/tasks/movepools.md T2): drain,
 * recoil, damage over time, crit bonus, HP cost, the focus buff, lingering
 * zones and homing shots.
 */
const world = (loadout: (MoveId | null)[], species: SpeciesId = 'mimikyu', seed = 1): WorldState => {
  const w = createWorld({ seed, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species });
  return { ...w, player: { ...w.player, loadout, slotsHeld: loadout.map(() => false), disguiseBroken: true, illusionBroken: true } };
};

function runFor(state: WorldState, ms: number, input: PlayerInput = IDLE): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.ceil(ms / FIXED_DT_MS); i++) {
    current = step(current, input, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const press = (slot: number, aim: Vec2): PlayerInput => ({ ...IDLE, aim, slots: [0, 1, 2, 3].map((i) => i === slot), slotMouse: [0, 1, 2, 3].map((i) => i === slot) });
const moveTime = (id: MoveId) => MOVES[id].windupMs + MOVES[id].activeMs + MOVES[id].recoveryMs;

/** Taps `slot` (aimed at `aim`) and waits `extraMs` past the move's own time. */
function use(state: WorldState, slot: number, aim: Vec2, extraMs = 3 * FIXED_DT_MS): { state: WorldState; events: GameEvent[] } {
  const id = state.player.loadout[slot]!;
  const pressed = runFor(state, FIXED_DT_MS, press(slot, aim));
  const after = runFor(pressed.state, moveTime(id) + extraMs, { ...IDLE, aim });
  return { state: after.state, events: [...pressed.events, ...after.events] };
}

/** A dormant, very tough Gastly at `pos` (it never falls, so no XP changes the numbers). */
function withDummy(state: WorldState, pos: Vec2 = vec(424, 300), hp = 9999): WorldState {
  const spawned = spawnEnemy({ ...state, enemies: [] }, 'gastly', pos, { dormant: true });
  return { ...spawned, enemies: spawned.enemies.map((e) => ({ ...e, hp, maxHp: hp })) };
}

const hits = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { type: 'enemyHit' }> => e.type === 'enemyHit');

describe('tutor effects: drain and recoil', () => {
  it('a drain move heals the user by its share of the damage dealt', () => {
    const start = withDummy(world([null, 'drain-punch', null, null]));
    const hurt = { ...start, player: { ...start.player, hp: 40 } };
    const used = use(hurt, 1, vec(424, 300));
    const damage = hits(used.events)[0]!.damage;
    expect(damage).toBeGreaterThan(0);
    expect(used.state.player.hp).toBeCloseTo(40 + damage * MOVES['drain-punch'].drain!, 5);
  });

  it('a drain never heals past max HP', () => {
    const used = use(withDummy(world([null, 'drain-punch', null, null])), 1, vec(424, 300));
    expect(used.state.player.hp).toBe(used.state.player.maxHp);
  });

  it('a recoil move hurts the user by its share of the damage dealt, never below 1 HP', () => {
    const start = withDummy(world([null, 'wood-hammer', null, null]));
    const used = use(start, 1, vec(424, 300));
    const damage = hits(used.events)[0]!.damage;
    expect(used.state.player.hp).toBeCloseTo(start.player.maxHp - damage * MOVES['wood-hammer'].recoil!, 5);
    const low = use({ ...start, player: { ...start.player, hp: 2 } }, 1, vec(424, 300));
    expect(low.state.player.hp).toBe(1);
  });
});

describe('tutor effects: damage over time', () => {
  it('a burning hit deals its share again in ticks, without hitstop juice (dot-flagged hits)', () => {
    const used = use(withDummy(world(['fire-punch', null, null, null])), 0, vec(424, 300), DOTS.burn.ticks * DOTS.burn.everyMs + 200);
    const all = hits(used.events);
    const first = all[0]!;
    const ticks = all.filter((e) => e.dot === 'burn');
    expect(first.dot).toBeUndefined();
    expect(ticks).toHaveLength(DOTS.burn.ticks);
    const total = ticks.reduce((sum, e) => sum + e.damage, 0);
    expect(total).toBeGreaterThanOrEqual(Math.round(first.damage * DOTS.burn.share) - DOTS.burn.ticks);
    expect(total).toBeLessThanOrEqual(Math.round(first.damage * DOTS.burn.share) + DOTS.burn.ticks);
    expect(used.state.enemies[0]!.dot).toBeUndefined();
  });

  it('a damage over time can fell an enemy, which then counts as defeated', () => {
    // Just more HP than the punch itself deals: the burn finishes it.
    const punch = hits(use(withDummy(world(['fire-punch', null, null, null])), 0, vec(424, 300)).events)[0]!.damage;
    const start = withDummy(world(['fire-punch', null, null, null]), vec(424, 300), punch + 2);
    const used = use(start, 0, vec(424, 300), DOTS.burn.ticks * DOTS.burn.everyMs + 200);
    expect(hits(used.events)[0]!.damage).toBe(punch);
    expect(used.events.some((e) => e.type === 'enemyDefeated')).toBe(true);
    expect(used.state.enemies[0]?.alive ?? false).toBe(false);
  });
});

describe('tutor effects: crit bonus', () => {
  it('a high-crit move lands more critical hits than one without the bonus', () => {
    /** Hits over 60 seeds that dealt more than the plain (non-critical) damage. */
    const crits = (id: MoveId) => {
      const damages = Array.from({ length: 60 }, (_, i) => hits(use(withDummy(world([id, null, null, null], 'zorua', i + 1)), 0, vec(424, 300)).events)[0]!.damage);
      const plain = Math.min(...damages);
      return damages.filter((d) => d > plain).length;
    };
    expect(crits('night-slash')).toBeGreaterThan(crits('feint-attack') + 5);
  });
});

describe('tutor effects: HP cost and focus', () => {
  it('Curse costs a share of max HP on the cast, never below 1', () => {
    const start = world([null, null, 'curse', null]);
    const cast = use(start, 2, vec(500, 300));
    expect(cast.state.player.hp).toBeCloseTo(start.player.maxHp * (1 - MOVES.curse.hpCost!), 5);
    const low = use({ ...start, player: { ...start.player, hp: 3 } }, 2, vec(500, 300));
    expect(low.state.player.hp).toBe(1);
    expect(low.state.player.buff?.moveId).toBe('curse');
  });

  it('Calm Mind makes every hit stronger while it runs (not only the next few)', () => {
    const plain = world(['shadow-claw', null, 'calm-mind', null]);
    const base = hits(use(withDummy(plain), 0, vec(424, 300)).events)[0]!.damage;
    let focused = use(plain, 2, vec(500, 300)).state;
    const damages: number[] = [];
    for (let i = 0; i < 4; i++) {
      const used = use(withDummy(focused), 0, vec(424, 300));
      damages.push(hits(used.events)[0]!.damage);
      focused = { ...used.state, enemies: [] };
    }
    // Four hits in a row, all boosted (a power buff such as Swords Dance ends after its hits).
    for (const d of damages) {
      expect(d).toBeGreaterThanOrEqual(Math.floor(base * 1.2));
      expect(d).toBeLessThanOrEqual(Math.ceil(base * 1.3));
    }
  });
});

describe('tutor effects: zones and homing', () => {
  it('Fire Spin lingers where it was cast and hits an enemy standing in it again and again', () => {
    const used = use(withDummy(world([null, null, null, 'fire-spin'])), 3, vec(424, 300), 2600);
    const zoneHits = hits(used.events).filter((e) => e.moveId === 'fire-spin' && !e.dot);
    const hitbox = MOVES['fire-spin'].hitbox;
    if (hitbox.kind !== 'projectile' || !hitbox.linger) throw new Error('fire spin is a zone');
    expect(zoneHits.length).toBeGreaterThanOrEqual(3);
    expect(zoneHits.length).toBeLessThanOrEqual(Math.ceil(hitbox.lifetimeMs / hitbox.linger));
  });

  it('Swift bends towards an enemy off its line; a straight shot of the same aim misses', () => {
    // Aimed straight right; the enemy stands well below the line.
    const target = vec(560, 360);
    const swift = use(withDummy(world(['swift', null, null, null], 'zorua'), target), 0, vec(600, 300), 900);
    expect(hits(swift.events).length).toBe(1);
    const ember = use(withDummy(world(['ember', null, null, null], 'litwick'), target), 0, vec(600, 300), 900);
    expect(hits(ember.events).length).toBe(0);
  });
});
