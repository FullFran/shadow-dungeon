import { describe, expect, it } from 'vitest';
import { ENEMY_SHOT_CAP, type EnemyAttackDef } from '../../src/data/enemies';
import { scaledTelegraphMs, TELEGRAPH_FLOOR, type Difficulty } from '../../src/data/difficulty';
import { NIHILEGO, SALANDIT, SALAZZLE, SKRELP, SWAMP_SHOT_CAP, VENIPEDE, type QueenDef, type UltraDef } from '../../src/data/swamp-enemies';
import { spawnShot } from '../../src/core/brain';
import { isInvulnerable } from '../../src/core/player';
import type { EnemyState, GameEvent, ProjectileState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { floodPockets, hazePockets } from '../../src/core/swamp-bosses';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { pierceZone } from '../../src/core/victim';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE, input, run, ticksFor } from './helpers';

/**
 * Integration of the Toxic Swamp with the difficulty tiers: Salazzle's Haze
 * and Nihilego's wormhole bite and Flood use the one `pierceRoll` rule (solo
 * and on guests, with the pierce telegraph), the swamp's tricks come through
 * the shared `behaviourFor`, the tier's telegraph scaling reaches its bosses
 * (never under the floor), and their 140-shot cap sits under the global one.
 */

const ARENA = { width: 800, height: 600 };
const PLAYER_AT = vec(400, 300);
const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt');

/** Positional swamp cards: the boss's position and attack state so the card lands on a player at `p`. */
interface PierceCase {
  name: string;
  species: 'salazzle' | 'nihilego';
  card: 'haze' | 'flood' | 'wormhole';
  attack: EnemyAttackDef;
  activeMs: number;
  at: (p: Vec2) => Vec2;
  /** Where the safe pockets (or the mouth) are aimed. */
  aim: (p: Vec2) => Vec2;
}

// The pockets are aimed at the top-left cell, far from a player in the middle, so the player is outside all of them.
const SWAMP_PIERCE: readonly PierceCase[] = [
  { name: "Salazzle's Haze", species: 'salazzle', card: 'haze', attack: SALAZZLE.haze.attack, activeMs: SALAZZLE.haze.activeMs, at: () => vec(400, 120), aim: () => vec(133, 150) },
  { name: "Nihilego's Flood", species: 'nihilego', card: 'flood', attack: NIHILEGO.flood.attack, activeMs: NIHILEGO.flood.activeMs, at: () => vec(400, 120), aim: () => vec(133, 100) },
  { name: "Nihilego's wormhole bite", species: 'nihilego', card: 'wormhole', attack: NIHILEGO.wormhole.attack, activeMs: NIHILEGO.wormhole.strikeMs, at: (p) => p, aim: (p) => p },
];

function withoutPierce<T>(c: PierceCase, body: () => T): T {
  const attack = c.attack as { pierceRoll?: boolean };
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

function rolling(w: WorldState): WorldState {
  const next = run(w, input({ move: vec(0, -1), roll: true }), ticksFor(60));
  expect(isInvulnerable(next.player)).toBe(true);
  return next;
}

function striking(w: WorldState, c: PierceCase, p: Vec2): WorldState {
  const spawned = spawnEnemy(w, c.species, c.at(p));
  const e = spawned.enemies[spawned.enemies.length - 1]!;
  const enemy: EnemyState = {
    ...e,
    ai: { ...e.ai, mode: 'attack', modeMs: 0, modeDurationMs: c.activeMs, contact: 'none', attack: c.card, attackDir: vec(0, 1), aimPoint: c.aim(p) },
    boss: { ...e.boss!, stance: c.card, comboIndex: 0 },
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

describe('swamp pierceRoll cards', () => {
  for (const c of SWAMP_PIERCE) {
    it(`${c.name} hits a rolling player solo (and the same card without the flag does not)`, () => {
      const solo = () => {
        const w = rolling(baseWorld());
        return hurt(stepEvents(striking(w, c, w.player.pos), 120));
      };
      expect(c.attack.pierceRoll).toBe(true);
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

describe('swamp pierce telegraph', () => {
  it('haze and flood mark their safe pockets, the wormhole its mouth; bullet cards mark nothing', () => {
    const w = baseWorld();
    const haze = striking(w, SWAMP_PIERCE[0]!, PLAYER_AT).enemies[0]!;
    expect(pierceZone(haze, 'easy', ARENA)).toEqual({ kind: 'pockets', centers: hazePockets(ARENA, vec(133, 150)), radius: SALAZZLE.haze.pocketRadius });
    const flood = striking(w, SWAMP_PIERCE[1]!, PLAYER_AT).enemies[0]!;
    expect(pierceZone(flood, 'easy', ARENA)).toEqual({ kind: 'pockets', centers: floodPockets(ARENA, vec(133, 100)), radius: NIHILEGO.flood.pocketRadius });
    const mouth = striking(w, SWAMP_PIERCE[2]!, PLAYER_AT).enemies[0]!;
    const marked = { ...mouth, pos: vec(100, 100), ai: { ...mouth.ai, mode: 'telegraph' as const } };
    expect(pierceZone(marked, 'easy', ARENA)).toEqual({ kind: 'mark', center: PLAYER_AT, radius: NIHILEGO.wormhole.radius });
    expect(pierceZone({ ...flood, boss: { ...flood.boss!, stance: 'shards' } }, 'easy', ARENA)).toBeNull();
    expect(pierceZone({ ...haze, boss: { ...haze.boss!, stance: 'spiral' } }, 'easy', ARENA)).toBeNull();
  });

  it('the real wind-ups of the haze, the wormhole and the flood carry the flag (the zone warning plays)', () => {
    const windUp = (species: 'salazzle' | 'nihilego', combosDone: number, phase: 1 | 2) => {
      let current = spawnEnemy(baseWorld(), species, vec(400, 150));
      const e = current.enemies[0]!;
      current = { ...current, enemies: [{ ...e, ai: { ...e.ai, mode: 'approach', cooldownMs: 0 }, boss: { ...e.boss!, combosDone, ...(phase === 2 ? { phase: 2 as const } : {}) } }] };
      current = step(current, IDLE, FIXED_DT_MS);
      return current.events.find((ev) => ev.type === 'enemyTelegraph');
    };
    const flagged = (e: GameEvent | undefined, attack: string) => e?.type === 'enemyTelegraph' && e.attack === attack && e.pierceRoll === true;
    expect(flagged(windUp('salazzle', 2, 1), 'haze')).toBe(true);
    expect(flagged(windUp('salazzle', 0, 1), 'dance')).toBe(false);
    // Phase 2 order: wormhole, tendrils, spores, flood, shards.
    expect(flagged(windUp('nihilego', 0, 2), 'wormhole')).toBe(true);
    expect(flagged(windUp('nihilego', 3, 2), 'flood')).toBe(true);
    expect(flagged(windUp('nihilego', 1, 2), 'tendrils')).toBe(false);
  });
});

function telegraphLengths(state: WorldState, ms: number): { attack: string; ms: number; planned: number }[] {
  let current = state;
  const out: { attack: string; ms: number; planned: number }[] = [];
  let open: { attack: string; ticks: number; planned: number } | null = null;
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
    const e: EnemyState | undefined = current.enemies.find((x) => x.species === 'salazzle' || x.species === 'nihilego');
    const tele = current.events.find((ev) => ev.type === 'enemyTelegraph' && ev.enemyId === e?.id);
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

const fight = (species: EnemyState['species'], d: Difficulty, at = vec(400, 150)): WorldState => {
  const w = spawnEnemy(baseWorld('host', 'p1', d), species, at);
  return { ...w, player: { ...w.player, hp: 1e6, maxHp: 1e6 } };
};

describe('tier telegraph scaling on swamp bosses', () => {
  for (const species of ['salazzle', 'nihilego'] as const) {
    it(`nightmare shortens ${species}'s wind-ups as the table says, never under the floor`, () => {
      const easy = telegraphLengths(fight(species, 'easy'), 12000);
      const night = telegraphLengths(fight(species, 'nightmare'), 12000);
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

describe('swamp tricks through behaviourFor', () => {
  it('normal plays the data as written; hard adds each trick; nightmare adds each boss card', () => {
    for (const species of ['venipede', 'salandit', 'skrelp', 'salazzle', 'nihilego'] as const) {
      expect(behaviourFor(species, 'easy'), species).toBe(behaviourFor(species, 'normal'));
      expect(behaviourFor(species, 'hard'), species).not.toBe(behaviourFor(species, 'normal'));
    }
    expect(behaviourFor('venipede', 'hard')).toMatchObject({ bounces: VENIPEDE.bounces + 1 });
    expect(SALANDIT.returnDash).toBeUndefined();
    expect(behaviourFor('salandit', 'hard')).toMatchObject({ returnDash: { telegraphMs: 360 } });
    expect(SKRELP.fan).toBeUndefined();
    expect(behaviourFor('skrelp', 'hard')).toMatchObject({ fan: { count: 3 } });
    const queen = (d: Difficulty) => behaviourFor('salazzle', d) as QueenDef;
    expect(queen('hard').cards).not.toContain('escort');
    expect(queen('nightmare').cards).toContain('escort');
    expect(queen('hard').dance.dashes).toBe(SALAZZLE.dance.dashes + 1);
    const ultra = (d: Difficulty) => behaviourFor('nihilego', d) as UltraDef;
    expect(ultra('hard').phase2.cards).not.toContain('downpour');
    expect(ultra('nightmare').phase1).toContain('downpour');
    expect(ultra('nightmare').phase2.cards).toContain('downpour');
  });
});

describe('swamp shot cap', () => {
  const filler = (n: number): ProjectileState[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `f${i}`,
      owner: 'enemy',
      type: 'poison',
      attackerTypes: ['poison'],
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

  it('keeps its own 140 under the global cap: Nihilego adds no shards past 140 while another enemy still may', () => {
    expect(NIHILEGO.maxShots).toBe(SWAMP_SHOT_CAP);
    expect(SALAZZLE.maxShots).toBe(SWAMP_SHOT_CAP);
    expect(SWAMP_SHOT_CAP).toBeLessThan(ENEMY_SHOT_CAP);
    const w = fight('nihilego', 'easy');
    const e = w.enemies[0]!;
    const shards: WorldState = {
      ...w,
      projectiles: filler(SWAMP_SHOT_CAP + 5),
      enemies: [{ ...e, ai: { ...e.ai, mode: 'telegraph', modeMs: 0, modeDurationMs: 30, attack: 'shards', attackDir: vec(0, 1) }, boss: { ...e.boss!, stance: 'shards', comboIndex: 0 } }],
    };
    let current = shards;
    for (let i = 0; i < ticksFor(3000); i++) current = step(current, IDLE, FIXED_DT_MS);
    const count = (s: WorldState) => s.projectiles.filter((p) => p.owner === 'enemy').length;
    expect(count(current)).toBe(SWAMP_SHOT_CAP + 5);
    // An ordinary shot still goes up to the global cap.
    const shot = { power: 1, type: 'poison' as const, speed: 10, radius: 2, lifetimeMs: 100 };
    expect(spawnShot(shards, e, shot, vec(1, 0)).projectiles).toHaveLength(SWAMP_SHOT_CAP + 6);
  });
});
