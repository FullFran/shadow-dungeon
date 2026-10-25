import { describe, expect, it } from 'vitest';
import { DHELMISE, ENEMY_SHOT_CAP, KRABBY, LANTURN, PHANTUMP, type DanmakuCard, type DanmakuDef, type EnemyAttackDef } from '../../src/data/enemies';
import { scaledTelegraphMs, TELEGRAPH_FLOOR, type Difficulty } from '../../src/data/difficulty';
import { spawnShot } from '../../src/core/brain';
import { isInvulnerable } from '../../src/core/player';
import type { EnemyState, GameEvent, ProjectileState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { pierceZone } from '../../src/core/victim';
import { add, vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE, input, run, ticksFor } from './helpers';

/**
 * Integration of the Flooded Caves with the difficulty tiers: the caves'
 * positional spell cards use the one `pierceRoll` rule (solo and on guests,
 * with the pierce telegraph), their tricks come through the shared
 * `behaviourFor`, the tier's telegraph scaling reaches their bosses through
 * `tickAiAt` (never under the floor), and the per-boss shot caps sit under the
 * global `ENEMY_SHOT_CAP`.
 */

const ARENA = { width: 800, height: 640 };
const PLAYER_AT = vec(400, 320);
const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt');

/** The positional cards under test: where the boss stands and how its attack state is set so it lands on the player. */
interface PierceCase {
  name: string;
  species: 'lanturn' | 'dhelmise';
  def: DanmakuDef;
  card: DanmakuCard;
  /** Boss position for a player at `p`. */
  at: (p: Vec2) => Vec2;
  /** The attack state at the start of its window. */
  ai: (boss: Vec2, p: Vec2) => Partial<EnemyState['ai']>;
}

export const CAVES_PIERCE: readonly PierceCase[] = [
  { name: "Lanturn's Descarga (surge)", species: 'lanturn', def: LANTURN, card: 'surge', at: (p) => add(p, vec(0, -90)), ai: (b) => ({ aimPoint: b, attackDir: vec(0, 1) }) },
  // Halfway through the sweep the arm points down the aim: at the player.
  { name: "Dhelmise's Resaca (undertow)", species: 'dhelmise', def: DHELMISE, card: 'undertow', at: (p) => add(p, vec(0, -90)), ai: () => ({ attackDir: vec(0, 1), modeMs: 450 }) },
  { name: "Dhelmise's Corriente (riptide)", species: 'dhelmise', def: DHELMISE, card: 'riptide', at: (p) => p, ai: (_b, p) => ({ aimPoint: p, attackDir: vec(0, 1) }) },
];

const attackOf = (c: PierceCase): EnemyAttackDef => {
  const p = c.def.patterns[c.card]!.pattern;
  if (p.kind !== 'zone' && p.kind !== 'sweep') throw new Error(`${c.card} is not positional`);
  return p.attack;
};

/** Runs `body` with the card's attack temporarily without the flag (the control), restoring it after. */
function withoutPierce<T>(c: PierceCase, body: () => T): T {
  const attack = attackOf(c) as { pierceRoll?: boolean };
  const was = attack.pierceRoll;
  attack.pierceRoll = false;
  try {
    return body();
  } finally {
    attack.pierceRoll = was;
  }
}

function baseWorld(role: 'host' | 'guest' = 'host', localId = 'p1', difficulty: Difficulty = 'easy'): WorldState {
  const w = createWorld({ seed: 1, arena: ARENA, playerPos: PLAYER_AT, localId, role });
  return { ...w, difficulty, player: { ...w.player, disguiseBroken: true } };
}

/** The local player mid-roll (in place), inside its i-frames. */
function rolling(w: WorldState): WorldState {
  const next = run(w, input({ move: vec(0, -1), roll: true }), ticksFor(60));
  expect(isInvulnerable(next.player)).toBe(true);
  return next;
}

/** `w` with the case's boss in the attack window of its positional card, aimed at a player at `p`. */
function striking(w: WorldState, c: PierceCase, p: Vec2): WorldState {
  const spawned = spawnEnemy(w, c.species, c.at(p));
  const e = spawned.enemies[spawned.enemies.length - 1]!;
  const window = c.def.patterns[c.card]!.pattern;
  const durationMs = window.kind === 'sweep' ? window.sweepMs : window.kind === 'zone' ? window.impactMs : 0;
  const enemy: EnemyState = {
    ...e,
    ai: { ...e.ai, mode: 'attack', modeMs: 0, modeDurationMs: durationMs, contact: 'none', attack: c.card, ...c.ai(e.pos, p) },
    boss: { ...e.boss!, stance: c.card },
  };
  return { ...spawned, enemies: [...spawned.enemies.slice(0, -1), enemy] };
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

describe('caves pierceRoll cards', () => {
  for (const c of CAVES_PIERCE) {
    it(`${c.name} hits a rolling player solo (and the same card without the flag does not)`, () => {
      const solo = () => {
        const w = rolling(baseWorld());
        return hurt(stepEvents(striking(w, c, w.player.pos), 120));
      };
      expect(attackOf(c).pierceRoll).toBe(true);
      expect(solo()).toBe(true);
      expect(withoutPierce(c, solo)).toBe(false);
    });

    it(`${c.name} hits a rolling guest after the host snapshot crosses the wire`, () => {
      const asGuest = () => {
        const guest = rolling(baseWorld('guest', 'p2'));
        const host = striking(baseWorld(), c, guest.player.pos);
        const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 1, s: hostSnapshot(host) }));
        if (!wire || wire.t !== 'snap') throw new Error('snapshot did not decode');
        return hurt(stepEvents(applyHostSnapshot(guest, wire.s), 120));
      };
      expect(asGuest()).toBe(true);
      expect(withoutPierce(c, asGuest)).toBe(false);
    });
  }
});

describe('caves pierce telegraph', () => {
  it('positional cards wind up with the zone warning and a pierce zone; bullet cards do not', () => {
    const w = baseWorld();
    for (const c of CAVES_PIERCE) {
      const s = striking(w, c, PLAYER_AT);
      const e = s.enemies[0]!;
      const zone = pierceZone({ ...e, ai: { ...e.ai, mode: 'telegraph' } }, 'easy');
      expect(zone, c.name).not.toBeNull();
      if (c.card === 'riptide') expect(zone).toEqual({ kind: 'mark', center: PLAYER_AT, radius: 72 });
      else expect(zone).toMatchObject({ kind: 'circle', radius: 150 });
      expect(pierceZone({ ...e, boss: { ...e.boss!, stance: c.def.cards.find((k) => k !== 'surge' && k !== 'undertow')! } }, 'easy'), c.name).toBeNull();
    }
    // The real wind-up event of Lanturn's surge carries the flag (audio plays the zone warning).
    let current = spawnEnemy(w, 'lanturn', vec(400, 220));
    current = { ...current, enemies: [{ ...current.enemies[0]!, ai: { ...current.enemies[0]!.ai, mode: 'approach', cooldownMs: 0 }, boss: { ...current.enemies[0]!.boss!, combosDone: 2 } }] };
    current = step(current, IDLE, FIXED_DT_MS);
    const tele = current.events.find((e) => e.type === 'enemyTelegraph');
    expect(tele && tele.type === 'enemyTelegraph' && tele.attack === 'surge' && tele.pierceRoll).toBe(true);
  });
});

/** Real lengths (ms) of every telegraph the first enemy goes through, with the planned length of each. */
function telegraphLengths(state: WorldState, ms: number): { attack: string; ms: number; planned: number }[] {
  let current = state;
  const out: { attack: string; ms: number; planned: number }[] = [];
  let open: { attack: string; ticks: number; planned: number } | null = null;
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
    const e: EnemyState | undefined = current.enemies[0];
    const tele = current.events.find((ev) => ev.type === 'enemyTelegraph');
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

const fight = (species: EnemyState['species'], d: Difficulty, at = vec(400, 220)): WorldState => {
  const w = spawnEnemy(baseWorld('host', 'p1', d), species, at);
  return { ...w, player: { ...w.player, hp: 1e6, maxHp: 1e6 } };
};

describe('tier telegraph scaling on caves bosses', () => {
  for (const species of ['lanturn', 'dhelmise'] as const) {
    it(`nightmare shortens ${species}'s card wind-ups as the table says, never under the floor`, () => {
      const easy = telegraphLengths(fight(species, 'easy'), 14000);
      const night = telegraphLengths(fight(species, 'nightmare'), 14000);
      expect(night.length).toBeGreaterThan(1);
      for (const t of night) {
        expect(Math.abs(t.ms - scaledTelegraphMs(t.planned, 'nightmare')), t.attack).toBeLessThanOrEqual(FIXED_DT_MS + 0.001);
        expect(t.ms + FIXED_DT_MS, t.attack).toBeGreaterThanOrEqual(Math.max(t.planned * TELEGRAPH_FLOOR.share, Math.min(t.planned, TELEGRAPH_FLOOR.minMs)));
      }
      const first = night.find((t) => t.attack === easy[0]!.attack)!;
      expect(first.ms).toBeLessThan(easy[0]!.ms);
    });
  }
});

describe('one trick mechanism for forest and caves', () => {
  it('behaviourFor serves both tables, gated hard+ (normal plays none)', () => {
    expect(behaviourFor('krabby', 'normal')).toBe(KRABBY);
    expect(behaviourFor('krabby', 'hard')).toMatchObject({ followUp: { telegraphMs: 320 } });
    expect(behaviourFor('phantump', 'normal')).toBe(PHANTUMP);
    expect(behaviourFor('phantump', 'hard')).toMatchObject({ followUp: { telegraphMs: 320 } });
    expect((behaviourFor('lanturn', 'nightmare') as DanmakuDef).cards).toContain('deep');
    expect((behaviourFor('lanturn', 'hard') as DanmakuDef).cards).not.toContain('deep');
  });
});

describe('shot caps', () => {
  const filler = (n: number): ProjectileState[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `f${i}`,
      owner: 'enemy',
      type: 'water',
      attackerTypes: ['water'],
      power: 1,
      damageMultiplier: 1,
      pos: vec(20 + (i % 10), 20),
      vel: vec(0, 0),
      radius: 2,
      remainingMs: 60000,
      hitstunMs: 0,
      knockback: 0,
      hitIds: [],
    }));

  /** Enemy shots after the boss opens its bubble rings with `already` enemy shots in the room. */
  const afterRings = (species: 'lanturn' | 'dhelmise', card: DanmakuCard, already: number) => {
    const w = fight(species, 'easy');
    const e = w.enemies[0]!;
    const def = species === 'lanturn' ? LANTURN : DHELMISE;
    const ready: WorldState = {
      ...w,
      projectiles: filler(already),
      enemies: [{ ...e, ai: { ...e.ai, mode: 'telegraph', modeMs: 0, modeDurationMs: 30, attack: card, attackDir: vec(0, 1) }, boss: { ...e.boss!, stance: card } }],
    };
    let current = ready;
    let most = 0;
    for (let i = 0; i < ticksFor(def.patterns[card]!.pattern.kind === 'rings' ? 3000 : 2000); i++) {
      current = step(current, IDLE, FIXED_DT_MS);
      most = Math.max(most, current.projectiles.filter((p) => p.owner === 'enemy').length);
    }
    return most;
  };

  it("honours Lanturn's own cap (90) and Dhelmise's (110), both under the global cap", () => {
    expect(LANTURN.maxShots).toBe(90);
    expect(DHELMISE.maxShots).toBe(110);
    expect(LANTURN.maxShots).toBeLessThan(ENEMY_SHOT_CAP);
    expect(DHELMISE.maxShots).toBeLessThan(ENEMY_SHOT_CAP);
    // With 95 shots in the room Lanturn adds none, while Dhelmise still fills up to its own 110.
    expect(afterRings('lanturn', 'bubbles', 95)).toBe(95);
    expect(afterRings('dhelmise', 'bell', 95)).toBe(DHELMISE.maxShots);
  });

  it('the global cap stops any enemy shot once the room holds ENEMY_SHOT_CAP', () => {
    const w = fight('krabby', 'easy');
    const full = { ...w, projectiles: filler(ENEMY_SHOT_CAP) };
    const shot = { power: 1, type: 'water' as const, speed: 10, radius: 2, lifetimeMs: 100 };
    expect(spawnShot(full, w.enemies[0]!, shot, vec(1, 0)).projectiles).toHaveLength(ENEMY_SHOT_CAP);
    expect(spawnShot({ ...w, projectiles: filler(ENEMY_SHOT_CAP - 1) }, w.enemies[0]!, shot, vec(1, 0)).projectiles).toHaveLength(ENEMY_SHOT_CAP);
  });
});
