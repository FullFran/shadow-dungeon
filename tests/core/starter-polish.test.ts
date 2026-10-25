import { describe, expect, it } from 'vitest';
import type { GameEvent, PlayerInput, ProjectileState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { length, vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { MOVES, type MoveId } from '../../src/data/moves';
import type { SpeciesId } from '../../src/data/species';
import { TUNING } from '../../src/data/tuning';
import { IDLE } from './helpers';

const world = (species: SpeciesId, loadout: [MoveId, MoveId]): WorldState =>
  createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species, loadout });

function runFor(state: WorldState, ms: number, input: PlayerInput = IDLE): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.ceil(ms / FIXED_DT_MS); i++) {
    current = step(current, input, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const returningBone = (pos = vec(520, 300)): ProjectileState => ({
  id: 'p99',
  owner: 'player',
  type: 'ground',
  attackerTypes: ['ground'],
  power: MOVES.bonemerang.power,
  damageMultiplier: 1,
  pos,
  vel: vec(200, 0),
  radius: 8,
  remainingMs: 2000,
  hitstunMs: 300,
  knockback: 40,
  hitIds: [],
  pierce: true,
  moveId: 'bonemerang',
});

describe('Bonemerang homing', () => {
  it('flies back towards where Cubone is now, not along its outward line', () => {
    const start = world('cubone', ['bone-club', 'bonemerang']);
    const moved = { ...start, player: { ...start.player, pos: vec(520, 450) }, projectiles: [returningBone()] };
    const { state } = runFor(moved, 2 * FIXED_DT_MS);
    const bone = state.projectiles[0]!;
    expect(bone.vel.y).toBeGreaterThan(0);
    expect(Math.abs(bone.vel.x)).toBeLessThan(Math.abs(bone.vel.y));
    expect(length(bone.vel)).toBeCloseTo(200, 0);
  });

  it('is caught when it gets back to Cubone, long before its lifetime ends', () => {
    const start = world('cubone', ['bone-club', 'bonemerang']);
    const { state } = runFor({ ...start, projectiles: [returningBone()] }, 900);
    expect(state.projectiles).toEqual([]);
  });

  it('still flies straight on the way out and leaves other projectiles alone', () => {
    const start = world('cubone', ['bone-club', 'bonemerang']);
    const outward = { ...returningBone(vec(450, 300)), returnAtMs: 100 };
    const ember = { ...returningBone(vec(450, 300)), id: 'p98', moveId: 'ember' as const, type: 'fire' as const, pierce: undefined };
    const { state } = runFor({ ...start, player: { ...start.player, pos: vec(400, 450) }, projectiles: [outward, ember] }, 2 * FIXED_DT_MS);
    for (const p of state.projectiles) expect(p.vel).toEqual(vec(200, 0));
  });
});

describe('Flash Fire kindling (Litwick)', () => {
  const fire = (state: WorldState) => {
    const pressed = runFor(state, FIXED_DT_MS, { ...IDLE, aim: vec(600, 300), slots: [true, false], slotMouse: [true, false] });
    const after = runFor(pressed.state, MOVES.ember.windupMs + MOVES.ember.activeMs + MOVES.ember.recoveryMs + 400, { ...IDLE, aim: vec(600, 300) });
    return { state: after.state, events: [...pressed.events, ...after.events] };
  };
  const target = (species: SpeciesId, loadout: [MoveId, MoveId]) => spawnEnemy(world(species, loadout), 'aegislash', vec(470, 300), { dormant: true });

  it("powers up the next heavy move after enough of Litwick's own Fire hits", () => {
    let state = target('litwick', ['ember', 'hex']);
    const triggers: GameEvent[] = [];
    for (let i = 0; i < TUNING.passives.flashFireKindle; i++) {
      expect(state.player.flashFire).toBe(false);
      const out = fire(state);
      state = { ...out.state, enemies: out.state.enemies.map((e) => ({ ...e, hp: e.maxHp })) };
      triggers.push(...out.events.filter((e) => e.type === 'passiveTriggered'));
    }
    expect(state.player.flashFire).toBe(true);
    expect(triggers).toEqual([{ type: 'passiveTriggered', passive: 'flash-fire', kindled: true }]);
  });

  it('does not count non-Fire hits', () => {
    let state = target('litwick', ['astonish', 'hex']);
    for (let i = 0; i < TUNING.passives.flashFireKindle + 1; i++) state = fire(state).state;
    expect(state.player.flashFire).toBe(false);
  });
});
