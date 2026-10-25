import { describe, expect, it } from 'vitest';
import { AEGISLASH } from '../../src/data/enemies';
import { bossBar } from '../../src/core/boss';
import type { BossState, EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { angleOf, vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE, input, ticksFor } from './helpers';

const BOSS = vec(400, 200);
const { shield: SHIELD, blade: BLADE } = AEGISLASH;

/** Aegislash at BOSS facing down (+y), the player at `playerPos`. */
function arena(playerPos: Vec2, options: { dormant?: boolean; boss?: Partial<BossState> } = {}): WorldState {
  let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos });
  state = spawnEnemy(state, 'aegislash', BOSS, { dormant: options.dormant });
  const boss = state.enemies[0]!;
  return { ...state, enemies: [{ ...boss, boss: { ...boss.boss!, ...options.boss } }] };
}

const boss = (state: WorldState): EnemyState => state.enemies[0]!;

function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 1200, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

function advance(state: WorldState, ms: number, playerInput: PlayerInput = IDLE) {
  let ticks = ticksFor(ms);
  return stepUntil(state, () => ticks-- <= 0, Number.POSITIVE_INFINITY, playerInput);
}

/** Taps Shadow Claw at the boss and lets the swing finish. */
function claw(state: WorldState) {
  const first = step(state, input({ aim: boss(state).pos, slots: [true, false] }), FIXED_DT_MS);
  const rest = advance(first, 400, input({ aim: boss(state).pos }));
  return { state: rest.state, events: [...first.events, ...rest.events] };
}

const telegraphs = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'enemyTelegraph' ? [e] : []));
const playerDamaged = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');
const angleBetween = (a: Vec2, b: Vec2) => {
  const d = Math.abs(angleOf(a) - angleOf(b)) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

describe('Aegislash setup', () => {
  it('starts in Shield stance and exposes boss bar data', () => {
    const state = arena(vec(400, 500));
    expect(boss(state).boss?.stance).toBe('shield');
    expect(bossBar(state)).toEqual({ enemyId: boss(state).id, species: 'aegislash', hp: boss(state).maxHp, maxHp: boss(state).maxHp, stance: 'shield' });
    expect(bossBar({ ...state, enemies: [] })).toBeNull();
  });
});

describe('Shield stance', () => {
  it('blocks hits that arrive from the front', () => {
    // Slightly off-axis, so the guard has to cover an actual arc.
    const { state, events } = claw(arena(vec(412, 233), { dormant: true }));
    expect(events.some((e) => e.type === 'hitBlocked')).toBe(true);
    expect(events.some((e) => e.type === 'enemyHit')).toBe(false);
    expect(boss(state).hp).toBe(boss(state).maxHp);
  });

  it('takes full, super-effective damage when flanked, without being staggered', () => {
    let state = step(arena(vec(400, 165), { dormant: true }), input({ aim: BOSS, slots: [true, false] }), FIXED_DT_MS);
    let hit: GameEvent | undefined;
    for (let i = 0; i < 30 && !hit; i++) {
      state = step(state, input({ aim: BOSS }), FIXED_DT_MS);
      hit = state.events.find((e) => e.type === 'enemyHit');
    }
    expect(hit?.type === 'enemyHit' && hit.effectiveness).toBe(2);
    expect(boss(state).hp).toBeLessThan(boss(state).maxHp);
    expect(boss(state).hitstunMs).toBe(0);
  });

  it('turns slowly towards a player behind it', () => {
    const start = arena(vec(400, 80));
    const after = advance(start, 500).state;
    const turned = angleBetween(boss(after).facing, vec(0, 1));
    expect(turned).toBeCloseTo(((SHIELD.turnRateDegPerSec * Math.PI) / 180) * 0.5, 1);
    // Half a second later the guard still points well away from the player: the flank stays open.
    expect(angleBetween(boss(after).facing, vec(0, -1))).toBeGreaterThan(Math.PI / 2);
  });

  it('telegraphs a shield bash at a player in front, then hits one who stays put', () => {
    const start = arena(vec(400, 260));
    const { state, events } = stepUntil(start, (s) => boss(s).ai.mode === 'recover');
    expect(telegraphs(events)[0]).toEqual({ type: 'enemyTelegraph', enemyId: boss(start).id, attack: 'bash', durationMs: SHIELD.bashTelegraphMs });
    expect(playerDamaged(events)).toBe(true);
    expect(boss(state).ai.modeDurationMs).toBe(SHIELD.bashRecoverMs);
  });
});

describe('stance changes', () => {
  it('turns into Blade once flank hits add up, with a telegraphed transformation that does not block', () => {
    // One flank hit short of breaking the stance; the boss is busy turning towards the player behind it.
    const start = arena(vec(400, 165), { boss: { stanceDamage: SHIELD.damageToBreak - 1 } });
    const flanked = claw(start);
    expect(flanked.events.some((e) => e.type === 'enemyHit')).toBe(true);
    // Well before the Shield time limit.
    const { state, events } = stepUntil(flanked.state, (s) => boss(s).ai.mode === 'transform', ticksFor(1000));
    expect(boss(state).ai.mode).toBe('transform');
    expect(telegraphs([...flanked.events, ...events])).toContainEqual({
      type: 'enemyTelegraph',
      enemyId: boss(start).id,
      attack: 'transform',
      durationMs: AEGISLASH.transformMs,
    });

    // Mid-transformation a frontal hit lands.
    const near = { ...state, player: { ...state.player, pos: vec(boss(state).pos.x + 5, boss(state).pos.y + 35) } };
    const struck = claw(near);
    expect(struck.events.some((e) => e.type === 'enemyHit')).toBe(true);
    expect(struck.events.some((e) => e.type === 'hitBlocked')).toBe(false);

    const done = stepUntil(struck.state, (s) => boss(s).boss?.stance === 'blade');
    expect(done.events).toContainEqual({ type: 'bossStance', enemyId: boss(start).id, stance: 'blade' });
    expect(boss(done.state).boss?.stanceDamage).toBe(0);
  });

  it('keeps the Shield stance while the damage stays under the threshold', () => {
    const start = arena(vec(400, 165), { boss: { stanceDamage: 0 } });
    const after = advance(claw(start).state, 1000).state;
    expect(boss(after).boss?.stance).toBe('shield');
    expect(boss(after).ai.mode).not.toBe('transform');
  });

  it('turns into Blade after a while in Shield even without damage', () => {
    const start = arena(vec(400, 560));
    const { state } = stepUntil(start, (s) => boss(s).ai.mode === 'transform', ticksFor(SHIELD.maxMs + 1000));
    expect(boss(state).ai.mode).toBe('transform');
    expect(boss(state).boss!.stanceMs).toBeGreaterThanOrEqual(SHIELD.maxMs);
  });
});

describe('Blade stance', () => {
  it('chains a telegraphed combo and then stays open for a long recovery', () => {
    const start = arena(vec(400, 260), { boss: { stance: 'blade' } });
    const { state, events } = stepUntil(start, (s) => boss(s).ai.mode === 'recover');
    expect(telegraphs(events).map((e) => [e.attack, e.durationMs])).toEqual(BLADE.combo.map((hit, i) => [`combo${i + 1}`, hit.telegraphMs]));
    expect(playerDamaged(events)).toBe(true);
    expect(boss(state).ai.modeDurationMs).toBe(BLADE.recoverMs);
    expect(BLADE.recoverMs).toBeGreaterThan(Math.max(...BLADE.combo.map((hit) => hit.telegraphMs)));
  });

  it('does not block frontal hits', () => {
    const { events } = claw(arena(vec(400, 235), { dormant: true, boss: { stance: 'blade' } }));
    expect(events.some((e) => e.type === 'hitBlocked')).toBe(false);
    expect(events.some((e) => e.type === 'enemyHit')).toBe(true);
  });

  it('goes back to Shield after its last combo', () => {
    const start = arena(vec(400, 260), { boss: { stance: 'blade', combosDone: BLADE.combosPerStance - 1 } });
    const { events } = stepUntil(start, (s) => boss(s).boss?.stance === 'shield');
    expect(telegraphs(events).map((e) => e.attack)).toEqual([...BLADE.combo.map((_, i) => `combo${i + 1}`), 'transform']);
    expect(events).toContainEqual({ type: 'bossStance', enemyId: boss(start).id, stance: 'shield' });
  });
});
