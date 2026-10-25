import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { isInvulnerable } from '../../src/core/player';
import { enemyTimeScale, hitPlayer, step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { input, run, ticksFor, world } from './helpers';

const { roll, stamina, perfectDodge, player: playerTuning } = TUNING;

describe('movement', () => {
  it('moves at moveSpeed along the WASD vector and faces that way', () => {
    const after = run(world(), input({ move: vec(1, 0) }), 60);
    expect(after.player.pos.x).toBeCloseTo(400 + playerTuning.moveSpeed, 0);
    expect(after.player.pos.y).toBeCloseTo(300);
    expect(after.player.facing).toEqual(vec(1, 0));
  });

  it('normalizes diagonals so they are not faster', () => {
    const after = run(world(), input({ move: vec(1, 1) }), 60);
    const travelled = Math.hypot(after.player.pos.x - 400, after.player.pos.y - 300);
    expect(travelled).toBeCloseTo(playerTuning.moveSpeed, 0);
  });

  it('stays inside the arena', () => {
    const after = run(world(vec(20, 300)), input({ move: vec(-1, 0) }), 60);
    expect(after.player.pos.x).toBe(playerTuning.radius);
  });
});

describe('roll', () => {
  it('spends stamina and travels the roll distance in the WASD direction', () => {
    const started = run(world(), input({ move: vec(0, 1), roll: true }), 1);
    expect(started.player.stamina).toBe(stamina.max - roll.staminaCost);
    expect(started.events).toContainEqual({ type: 'rollStarted' });

    const finished = run(started, input({ move: vec(0, 1) }), ticksFor(roll.durationMs));
    expect(finished.player.roll).toBeNull();
    // Roll distance plus a few ticks of walking that may overlap the last frame.
    expect(finished.player.pos.y - 300).toBeGreaterThan(roll.distance - 3);
    expect(finished.player.pos.y - 300).toBeLessThan(roll.distance + 8);
  });

  it('keeps its committed direction even if WASD changes mid-roll', () => {
    const started = run(world(), input({ move: vec(1, 0), roll: true }), 1);
    const later = run(started, input({ move: vec(0, -1) }), 5);
    expect(later.player.pos.y).toBeCloseTo(300);
    expect(later.player.pos.x).toBeGreaterThan(started.player.pos.x);
  });

  it('rolls towards the facing direction when no movement key is held', () => {
    const facingLeft = run(world(), input({ move: vec(-1, 0) }), 1);
    const rolled = run(facingLeft, input({ roll: true }), ticksFor(roll.durationMs));
    expect(rolled.player.pos.x).toBeLessThan(facingLeft.player.pos.x - roll.distance + 5);
  });

  it('is invulnerable only inside the i-frames window', () => {
    let state = run(world(), input({ move: vec(1, 0), roll: true }), 1);
    const seen: boolean[] = [];
    for (let elapsed = FIXED_DT_MS; elapsed < roll.durationMs; elapsed += FIXED_DT_MS) {
      seen.push(isInvulnerable(state.player));
      state = run(state, input(), 1);
    }
    const firstOn = seen.indexOf(true);
    const lastOn = seen.lastIndexOf(true);
    expect(seen[0]).toBe(false);
    expect((firstOn + 1) * FIXED_DT_MS).toBeGreaterThanOrEqual(roll.iframesStartMs);
    expect((lastOn + 1) * FIXED_DT_MS).toBeLessThan(roll.iframesEndMs + FIXED_DT_MS);
    expect(seen.slice(firstOn, lastOn + 1).every(Boolean)).toBe(true);
    expect(isInvulnerable(state.player)).toBe(false);
  });

  it('cannot start without enough stamina, and cannot chain while rolling', () => {
    const tired = world();
    const exhausted = { ...tired, player: { ...tired.player, stamina: roll.staminaCost - 1 } };
    const denied = run(exhausted, input({ roll: true }), 1);
    expect(denied.player.roll).toBeNull();
    expect(denied.player.stamina).toBeLessThan(roll.staminaCost);
    expect(denied.events).toContainEqual({ type: 'rollDenied' });

    const rolling = run(world(), input({ roll: true }), 1);
    const again = run(rolling, input({ roll: true }), 1);
    expect(again.player.stamina).toBe(rolling.player.stamina);
  });
});

describe('stamina regen', () => {
  it('waits for the regen delay, then regenerates up to max', () => {
    const base = world();
    const spent = { ...base, player: { ...base.player, stamina: 10, staminaRegenDelayMs: stamina.regenDelayMs } };
    const beforeDelay = run(spent, input(), ticksFor(stamina.regenDelayMs) - 1);
    expect(beforeDelay.player.stamina).toBe(10);

    const oneSecondLater = run(beforeDelay, input(), 1 + ticksFor(1000));
    expect(oneSecondLater.player.stamina).toBeCloseTo(10 + stamina.regenPerSecond, -1);

    const full = run(oneSecondLater, input(), 600);
    expect(full.player.stamina).toBe(stamina.max);
  });
});

describe('incoming hits and perfect dodge', () => {
  const rollFor = (ms: number) => {
    const started = run(world(), input({ move: vec(1, 0), roll: true }), 1);
    return run(started, input(), ticksFor(ms) - 1);
  };

  it('hurts a player who is not rolling (once the Disguise is gone)', () => {
    const base = world();
    const hurt = hitPlayer({ ...base, player: { ...base.player, disguiseBroken: true } }, { damage: 12 });
    expect(hurt.player.hp).toBe(playerTuning.maxHp - 12);
    expect(hurt.events).toContainEqual({ type: 'playerHurt', damage: 12 });
  });

  it('turns a hit right after the i-frames start into a perfect dodge', () => {
    const state = rollFor(roll.iframesStartMs + perfectDodge.windowMs / 2);
    const dodged = hitPlayer(state, { damage: 12 });
    expect(dodged.player.hp).toBe(playerTuning.maxHp);
    expect(dodged.events).toContainEqual({ type: 'perfectDodge' });
    expect(dodged.slowMoMs).toBe(perfectDodge.slowMoDurationMs);
    expect(enemyTimeScale(dodged)).toBe(perfectDodge.slowMoScale);
    expect(dodged.player.nextHitBuff).toEqual({
      multiplier: perfectDodge.damageMultiplier,
      remainingMs: perfectDodge.buffDurationMs,
    });
  });

  it('treats a hit late in the i-frames as a plain dodge without slow-mo', () => {
    const state = rollFor(roll.iframesStartMs + perfectDodge.windowMs + 50);
    const dodged = hitPlayer(state, { damage: 12 });
    expect(dodged.player.hp).toBe(playerTuning.maxHp);
    expect(dodged.events).toContainEqual({ type: 'hitDodged' });
    expect(dodged.slowMoMs).toBe(0);
    expect(enemyTimeScale(dodged)).toBe(1);
    expect(dodged.player.nextHitBuff).toBeNull();
  });

  it('ends slow-mo after its real-time duration and expires an unused buff', () => {
    const dodged = hitPlayer(rollFor(roll.iframesStartMs + 20), { damage: 12 });
    const afterSlowMo = run(dodged, input(), ticksFor(perfectDodge.slowMoDurationMs) + 1);
    expect(afterSlowMo.slowMoMs).toBe(0);
    expect(enemyTimeScale(afterSlowMo)).toBe(1);
    expect(afterSlowMo.player.nextHitBuff).not.toBeNull();

    const afterBuff = run(afterSlowMo, input(), ticksFor(perfectDodge.buffDurationMs));
    expect(afterBuff.player.nextHitBuff).toBeNull();
  });
});

describe('determinism', () => {
  it('produces identical states for identical seeds and inputs', () => {
    const script = (state: ReturnType<typeof world>) => {
      let s = state;
      for (let i = 0; i < 300; i++) {
        s = step(s, input({ move: vec(Math.sign(Math.sin(i / 17)), Math.sign(Math.cos(i / 23))), roll: i % 45 === 0 }), FIXED_DT_MS);
      }
      return s;
    };
    expect(script(world(vec(400, 300), 7))).toEqual(script(world(vec(400, 300), 7)));
  });

  it('does not mutate the input state', () => {
    const before = world();
    const snapshot = JSON.parse(JSON.stringify(before));
    step(before, input({ move: vec(1, 0), roll: true }), FIXED_DT_MS);
    expect(before).toEqual(snapshot);
  });
});
