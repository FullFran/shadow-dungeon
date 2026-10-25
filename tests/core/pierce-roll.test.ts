import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { TIERS } from '../../src/data/difficulty';
import { spawnShot } from '../../src/core/brain';
import { rollTierOf } from '../../src/core/difficulty';
import { landHitOnPlayer } from '../../src/core/hits';
import { isInvulnerable } from '../../src/core/player';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { input, run, ticksFor } from './helpers';

/**
 * Positional attacks (`pierceRoll`, user feedback 2026-10-25 "el roll está
 * super roto"): the roll's i-frames do not protect against them and they are
 * never a perfect dodge; only being out of their area avoids them.
 */
const base = (difficulty?: 'hard' | 'nightmare'): WorldState => {
  const w = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), ...(difficulty ? { difficulty } : {}) });
  return { ...w, player: { ...w.player, disguiseBroken: true } };
};

/** The player mid-roll, inside its i-frames. */
const rolling = (w: WorldState): WorldState => {
  const next = run(w, input({ move: vec(1, 0), roll: true }), ticksFor(80));
  expect(isInvulnerable(next.player)).toBe(true);
  return next;
};

/** An enemy shot coming at the player from the left (an enemy far away fires it). */
function shotAtPlayer(w: WorldState, pierceRoll: boolean, from = 40): WorldState {
  const shooter = spawnEnemy(w, 'gastly', vec(100, 300), { dormant: true });
  return spawnShot(shooter, shooter.enemies[0]!, { power: 30, type: 'ghost', speed: 300, radius: 10, lifetimeMs: 3000, ...(pierceRoll ? { pierceRoll } : {}) }, vec(1, 0), vec(w.player.pos.x - from, w.player.pos.y));
}

const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt');

function events(w: WorldState, ticks: number, move = vec(0, 0), roll = false): { state: WorldState; events: GameEvent[] } {
  let current = w;
  const seen: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    current = step(current, input({ move, roll: roll && i === 0 }), FIXED_DT_MS);
    seen.push(...current.events);
  }
  return { state: current, events: seen };
}

describe('pierceRoll: positional attacks', () => {
  it('a hit landing inside the i-frames is dodged, unless it is positional (then it hurts, and is never a perfect dodge)', () => {
    const w = rolling(base());
    const plain: GameEvent[] = [];
    expect(landHitOnPlayer(w, { damage: 20 }, plain).outcome).not.toBe('hurt');
    const zone: GameEvent[] = [];
    const landed = landHitOnPlayer(w, { damage: 20, pierceRoll: true }, zone);
    expect(landed.outcome).toBe('hurt');
    expect(zone.some((e) => e.type === 'perfectDodge')).toBe(false);
    expect(landed.state.player.hp).toBe(w.player.hp - 20);
  });

  it('rolling through a positional shot still hits; rolling through a plain one does not', () => {
    const through = (pierce: boolean) => events(shotAtPlayer(base(), pierce), ticksFor(400), vec(-1, 0), true).events;
    expect(hurt(through(false))).toBe(false);
    expect(hurt(through(true))).toBe(true);
  });

  it('walking out of its lane avoids a positional shot', () => {
    // Fired from 260 px away: the wind-up of a positional attack leaves time to step aside.
    const out = events(shotAtPlayer(base(), true, 260), ticksFor(1500), vec(0, 1));
    expect(hurt(events(shotAtPlayer(base(), true, 260), ticksFor(1500)).events)).toBe(true);
    expect(hurt(out.events)).toBe(false);
  });

  it('travels to guests: the shot keeps its flag on the wire (an older peer just ignores the extra slot)', () => {
    const w = shotAtPlayer(base(), true);
    const p = w.projectiles[0]!;
    const snap = { tick: 1, berries: [], enemies: [], projectiles: [{ id: p.id, type: p.type, attackerTypes: p.attackerTypes, power: p.power, pos: p.pos, vel: p.vel, radius: p.radius, remainingMs: p.remainingMs, pierceRoll: true }] };
    const back = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 1, s: snap }));
    expect(back && back.t === 'snap' && back.s.projectiles[0]!.pierceRoll).toBe(true);
    const plainSnap = { ...snap, projectiles: [{ ...snap.projectiles[0]!, pierceRoll: undefined }] };
    const plain = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 1, s: plainSnap }));
    expect(plain && plain.t === 'snap' && plain.s.projectiles[0]!.pierceRoll).toBeUndefined();
  });
});

describe('roll tuning per tier', () => {
  it('easy and normal keep the roll as tuned; hard and nightmare shorten the i-frames and raise the cost', () => {
    expect(rollTierOf('easy')).toBeNull();
    expect(rollTierOf('normal')).toBeNull();
    expect(base().player.rollTier).toBeUndefined();
    const { iframesStartMs, iframesEndMs, staminaCost } = TUNING.roll;
    expect(rollTierOf('nightmare')!.iframesEndMs).toBeCloseTo(iframesStartMs + (iframesEndMs - iframesStartMs) * TIERS.nightmare.roll.iframes);
    expect(rollTierOf('hard')!.iframesEndMs).toBeLessThan(iframesEndMs);
    const spent = (w: WorldState) => w.player.stamina - run(w, input({ move: vec(1, 0), roll: true }), 1).player.stamina;
    expect(spent(base())).toBeCloseTo(staminaCost, 0);
    expect(spent(base('nightmare'))).toBeCloseTo(staminaCost * TIERS.nightmare.roll.stamina, 0);
    // Late in the roll: still safe on easy, already exposed on nightmare.
    const late = (w: WorldState) => isInvulnerable(run(w, input({ move: vec(1, 0), roll: true }), ticksFor(iframesEndMs - 30)).player);
    expect(late(base())).toBe(true);
    expect(late(base('nightmare'))).toBe(false);
  });
});
