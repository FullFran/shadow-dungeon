import { describe, expect, it } from 'vitest';
import { updateCapture } from '../../src/core/cards';
import { hitCap, speciesMaxHpAt } from '../../src/core/fairness';
import { landHitOnPlayer } from '../../src/core/hits';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { startRun } from '../../src/core/run';
import { MOVES } from '../../src/data/moves';
import { SPECIES } from '../../src/data/species';
import { IDLE } from './helpers';

/**
 * The four slots (feat/four-slots) on main's systems: the one-hit cap
 * (core/fairness.ts), spell-card captures (core/cards.ts), leaders and gates.
 */

/** Cubone (Bulk Up in its boost slot) on a floor whose expected level is `level`. */
function cubone(level: number, guarded: boolean): WorldState {
  const w = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species: 'cubone' });
  return { ...w, referenceLevel: level, player: { ...w.player, hp: 999, maxHp: 999, ...(guarded ? { buff: { moveId: 'bulk-up', remainingMs: 5000 } } : {}) } };
}

const hurtBy = (events: readonly GameEvent[]): number => events.reduce((n, e) => (e.type === 'playerHurt' ? n + e.damage : n), 0);

describe('Bulk Up and the one-hit cap', () => {
  it('the guard (x0.6) applies before the cap: a huge hit is still capped, a big one under the cap once guarded is not capped twice', () => {
    const cap = hitCap(speciesMaxHpAt('cubone', 5));
    const guard = MOVES['bulk-up'].buff!.kind === 'guard' ? MOVES['bulk-up'].buff!.damageTaken : 1;
    expect(guard).toBe(0.6);
    // A hit worth 1.5 caps: the guard brings it to 0.9 caps, under the cap (guard after the cap would have given 0.6 caps).
    const big = Math.round(cap * 1.5);
    const ev: GameEvent[] = [];
    landHitOnPlayer(cubone(5, true), { damage: big }, ev);
    expect(hurtBy(ev)).toBe(Math.min(cap, Math.max(1, Math.round(big * guard))));
    // A hit worth ten caps: capped after the guard.
    const ev2: GameEvent[] = [];
    landHitOnPlayer(cubone(5, true), { damage: cap * 10 }, ev2);
    expect(hurtBy(ev2)).toBe(cap);
    // Unguarded, the same hit is the cap.
    const ev3: GameEvent[] = [];
    landHitOnPlayer(cubone(5, false), { damage: big }, ev3);
    expect(hurtBy(ev3)).toBe(cap);
  });

  it('a guarded hit is still a hit: it spoils a spell-card capture', () => {
    const ev: GameEvent[] = [];
    landHitOnPlayer(cubone(5, true), { damage: 4 }, ev);
    expect(ev.some((e) => e.type === 'playerHurt')).toBe(true);
    // A herald playing its first card, watched unhit; the guarded hit lands this step.
    const floor = startRun(5, {}, 22, 'eclipse-chasm').world;
    const playing: WorldState = { ...floor, enemies: floor.enemies.map((e) => (e.herald ? { ...e, boss: { ...e.boss!, stance: 'herald0' }, ai: { ...e.ai, mode: 'approach' } } : e)) };
    const watched = updateCapture(playing, []);
    expect(watched.capture).toMatchObject({ card: 'herald0', hit: false });
    expect(updateCapture(watched, ev).capture).toMatchObject({ card: 'herald0', hit: true });
  });
});

/** Mimikyu with an area move in slot 4, facing east, with dormant Gastlys at `at` (low HP: one area hit fells them). */
function areaArena(at: { x: number; y: number }[]): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species: 'mimikyu' });
  const loadout = [...SPECIES.mimikyu.defaultLoadout.slice(0, 3), 'dazzling-gleam' as const];
  let w: WorldState = { ...base, player: { ...base.player, loadout, facing: vec(1, 0), disguiseBroken: true } };
  for (const pos of at) w = spawnEnemy(w, 'gastly', vec(pos.x, pos.y), { dormant: true });
  return { ...w, enemies: w.enemies.map((e) => ({ ...e, hp: 1, maxHp: 1 })) };
}

const pressArea: PlayerInput = { ...IDLE, aim: vec(600, 300), slots: [false, false, false, true], slotMouse: [false, false, false, false] };

function useArea(state: WorldState): { state: WorldState; events: GameEvent[] } {
  const m = MOVES['dazzling-gleam'];
  let w = step(state, pressArea, FIXED_DT_MS);
  const events: GameEvent[] = [...w.events];
  for (let t = 0; t < m.windupMs + m.activeMs + m.recoveryMs + 200; t += FIXED_DT_MS) {
    w = step(w, IDLE, FIXED_DT_MS);
    events.push(...w.events);
  }
  return { state: w, events };
}

describe('area moves, leaders and gates', () => {
  it('an area move fells a seal gate\'s marked enemy and the gate opens', () => {
    const w = areaArena([{ x: 440, y: 300 }]);
    const target = w.enemies[0]!.id;
    const out = useArea({ ...w, gate: { kind: 'seal', target, done: false, stuckMs: 0 } });
    expect(out.state.enemies.find((e) => e.id === target)!.alive).toBe(false);
    expect(out.events).toContainEqual({ type: 'gateOpened', kind: 'seal', outcome: 'opened' });
    expect(out.state.gate?.done).toBe(true);
  });

  it('an area move that fells a leader breaks its band', () => {
    const w = areaArena([{ x: 440, y: 300 }, { x: 700, y: 120 }]);
    const [leader, follower] = w.enemies;
    const banded: WorldState = {
      ...w,
      enemies: w.enemies.map((e) => (e.id === leader!.id ? { ...e, leader: { rallyMs: 99_999 } } : e.id === follower!.id ? { ...e, band: leader!.id, hp: 50, maxHp: 50 } : e)),
    };
    const out = useArea(banded);
    expect(out.events.some((e) => e.type === 'leaderFell' && e.enemyId === leader!.id)).toBe(true);
    const f = out.state.enemies.find((e) => e.id === follower!.id)!;
    expect(f.alive).toBe(true);
    expect(f.band).toBeUndefined();
  });
});
