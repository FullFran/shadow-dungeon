import { describe, expect, it } from 'vitest';
import { DECIDUEYE, TREVENANT, type ShotDef } from '../../src/data/enemies';
import { scaledTelegraphMs, TELEGRAPH_FLOOR, type Difficulty } from '../../src/data/difficulty';
import { spawnShot } from '../../src/core/brain';
import { isInvulnerable } from '../../src/core/player';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { pierceZone } from '../../src/core/victim';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE, input, run, ticksFor } from './helpers';

/**
 * Integration of the forest remaster with the difficulty tiers: the forest's
 * positional attacks use the one `pierceRoll` rule (solo and on guests), and
 * the tier table's telegraph scaling reaches forest wind-ups without going
 * under the readable floor.
 */

const ARENA = { width: 800, height: 600 };
const PLAYER_AT = vec(400, 300);
const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt');

/** The forest shots under test, as data: Trevenant's root spike (still) and Decidueye's rain arrow (falling). */
const FOREST_SHOTS: readonly { name: string; shot: ShotDef; dir: Vec2; from: (p: Vec2) => Vec2 }[] = [
  { name: 'TREVENANT.roots.spike', shot: { ...TREVENANT.roots.spike, speed: 0 }, dir: vec(0, 1), from: (p) => p },
  { name: 'DECIDUEYE.phase2.rain.arrow', shot: DECIDUEYE.phase2.rain.arrow, dir: vec(0, 1), from: (p) => vec(p.x, p.y - 30) },
];

const withoutPierce = ({ pierceRoll: _pierce, ...plain }: ShotDef): ShotDef => plain;

/** A world with a dormant forest shooter far away, from the point of view of `role`. */
function world(role: 'host' | 'guest' = 'host', localId = 'p1'): WorldState {
  const w = createWorld({ seed: 1, arena: ARENA, playerPos: PLAYER_AT, localId, role });
  return spawnEnemy({ ...w, player: { ...w.player, disguiseBroken: true } }, 'gastly', vec(60, 60), { dormant: true });
}

/** The local player mid-roll (in place: rolling along the shot's lane), inside its i-frames. */
function rolling(w: WorldState): WorldState {
  const next = run(w, input({ move: vec(0, -1), roll: true }), ticksFor(60));
  expect(isInvulnerable(next.player)).toBe(true);
  return next;
}

function fire(w: WorldState, shot: ShotDef, dir: Vec2, at: Vec2): WorldState {
  return spawnShot(w, w.enemies[0]!, shot, dir, at);
}

function stepEvents(w: WorldState, ms: number): GameEvent[] {
  let current = w;
  const seen: GameEvent[] = [];
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step(current, IDLE, FIXED_DT_MS);
    seen.push(...current.events);
  }
  return seen;
}

describe('forest pierceRoll shots', () => {
  it('the forest data uses the shared pierceRoll rule', () => {
    expect(TREVENANT.roots.spike.pierceRoll).toBe(true);
    expect(DECIDUEYE.phase2.rain.arrow.pierceRoll).toBe(true);
  });

  for (const { name, shot, dir, from } of FOREST_SHOTS) {
    it(`${name} hits a rolling player solo (and the same shot without the flag does not)`, () => {
      const solo = (s: ShotDef) => {
        const w = rolling(world());
        return hurt(stepEvents(fire(w, s, dir, from(w.player.pos)), 150));
      };
      expect(solo(shot)).toBe(true);
      expect(solo(withoutPierce(shot))).toBe(false);
    });

    it(`${name} hits a rolling guest after the host snapshot crosses the wire`, () => {
      const asGuest = (s: ShotDef) => {
        const guest = rolling(world('guest', 'p2'));
        const host = fire(world(), s, dir, from(guest.player.pos));
        const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 1, s: hostSnapshot(host) }));
        if (!wire || wire.t !== 'snap') throw new Error('snapshot did not decode');
        expect(wire.s.projectiles[0]!.pierceRoll === true).toBe(s.pierceRoll === true);
        return hurt(stepEvents(applyHostSnapshot(guest, wire.s), 150));
      };
      expect(asGuest(shot)).toBe(true);
      expect(asGuest(withoutPierce(shot))).toBe(false);
    });
  }
});

/** Real lengths (ms) of every telegraph the first enemy goes through, in order, with the attack each one winds up. */
function telegraphLengths(state: WorldState, ms: number): { attack: string; ms: number; planned: number }[] {
  let current = state;
  const out: { attack: string; ms: number; planned: number }[] = [];
  let open: { attack: string; ticks: number; planned: number } | null = null;
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
    const e: EnemyState | undefined = current.enemies[0];
    const tele = current.events.find((ev) => ev.type === 'enemyTelegraph' && ev.attack !== 'declare');
    if (tele && tele.type === 'enemyTelegraph') {
      if (open) out.push({ attack: open.attack, ms: open.ticks * FIXED_DT_MS, planned: open.planned });
      open = { attack: tele.attack, ticks: 0, planned: tele.durationMs };
    }
    if (open && e?.ai.mode === 'telegraph') open.ticks++;
    else if (open) {
      out.push({ attack: open.attack, ms: open.ticks * FIXED_DT_MS, planned: open.planned });
      open = null;
    }
  }
  return out;
}

const arena = (species: EnemyState['species'], pos: Vec2, difficulty: Difficulty, size = ARENA, playerPos = PLAYER_AT): WorldState =>
  ({ ...spawnEnemy(createWorld({ seed: 1, arena: size, playerPos }), species, pos), difficulty });

describe('tier telegraph scaling on forest attacks', () => {
  it('nightmare shortens a forest boss wind-up as the table says (Trevenant), never under the floor', () => {
    const tele = (d: Difficulty) => telegraphLengths(arena('trevenant', vec(400, 230), d, { width: 800, height: 600 }, vec(400, 520)), 12000);
    const easy = tele('easy');
    const night = tele('nightmare');
    expect(easy.length).toBeGreaterThan(0);
    for (const t of night) {
      // Within one tick of the scaled length.
      expect(Math.abs(t.ms - scaledTelegraphMs(t.planned, 'nightmare')), t.attack).toBeLessThanOrEqual(FIXED_DT_MS + 0.001);
      expect(t.ms + FIXED_DT_MS, t.attack).toBeGreaterThanOrEqual(Math.max(t.planned * TELEGRAPH_FLOOR.share, Math.min(t.planned, TELEGRAPH_FLOOR.minMs)));
    }
    const firstEasy = easy[0]!;
    const firstNight = night.find((t) => t.attack === firstEasy.attack)!;
    expect(firstNight.ms).toBeLessThan(firstEasy.ms);
  });

  it("a short forest trick wind-up (Phantump's hard second grab, 320 ms) stops at the 280 ms floor on nightmare", () => {
    const night = telegraphLengths(arena('phantump', vec(470, 300), 'nightmare'), 6000);
    const second = night.find((t) => t.attack === 'lunge2');
    expect(second, JSON.stringify(night)).toBeDefined();
    expect(second!.planned).toBe(320);
    expect(scaledTelegraphMs(320, 'nightmare')).toBe(TELEGRAPH_FLOOR.minMs);
    expect(second!.ms + FIXED_DT_MS).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);
    expect(second!.ms).toBeLessThan(320);
  });

  it('forest tricks stay gated on hard+: normal plays none, hard plays them', () => {
    const lunges = (d: Difficulty) => telegraphLengths(arena('phantump', vec(470, 300), d), 6000).map((t) => t.attack);
    expect(lunges('normal')).not.toContain('lunge2');
    expect(lunges('hard')).toContain('lunge2');
  });
});

describe('forest pierce telegraph', () => {
  it("Trevenant's roots and Decidueye's rain wind up as positional attacks (zone warning and the violet mark)", () => {
    const tree = arena('trevenant', vec(400, 230), 'easy', { width: 800, height: 600 }, vec(400, 520));
    let current = tree;
    let roots: GameEvent | undefined;
    for (let i = 0; i < ticksFor(20000) && !roots; i++) {
      current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
      roots = current.events.find((e) => e.type === 'enemyTelegraph' && e.attack === 'roots');
    }
    expect(roots && roots.type === 'enemyTelegraph' && roots.pierceRoll).toBe(true);
    expect(pierceZone(current.enemies[0]!, 'easy')).toEqual({ kind: 'lanes' });
    const owl = { ...current.enemies[0]!, species: 'decidueye' as const, boss: { ...current.enemies[0]!.boss!, stance: 'rain' as const } };
    expect(pierceZone(owl, 'easy')).toEqual({ kind: 'lanes' });
    expect(pierceZone({ ...owl, boss: { ...owl.boss, stance: 'volley' as const } }, 'easy')).toBeNull();
  });
});
