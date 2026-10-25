import { describe, expect, it } from 'vitest';
import {
  CHINCHOU,
  CLAUNCHER,
  CORPHISH,
  CROAGUNK,
  EKANS,
  ENEMY_BEHAVIOUR,
  EXPERIMENTAL_ENEMIES,
  GRIMER,
  HOUNDOUR,
  KOFFING,
  LITLEO,
  SLUGMA,
  STUNKY,
  TENTACOOL,
  WOOPER,
  ZUBAT,
} from '../../src/data/enemies';
import type { SpeciesId } from '../../src/data/species';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE, input, ticksFor } from './helpers';

const PLAYER = vec(400, 300);

function arena(species: SpeciesId, pos: Vec2, playerSpecies: SpeciesId = 'cubone', playerPos = PLAYER): WorldState {
  return spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos, species: playerSpecies }), species, pos);
}

const first = (state: WorldState): EnemyState => state.enemies[0]!;

function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 900, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const advance = (state: WorldState, ms: number, playerInput: PlayerInput = IDLE) => {
  let ticks = ticksFor(ms);
  return stepUntil(state, () => ticks-- <= 0, Number.POSITIVE_INFINITY, playerInput);
};

const hurtBy = (events: GameEvent[]) => events.filter((e) => e.type === 'playerHurt');
const telegraphs = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { type: 'enemyTelegraph' }> => e.type === 'enemyTelegraph');
const telegraphing = (attack: string) => (s: WorldState) => first(s).ai.mode === 'telegraph' && first(s).ai.attack === attack;

/** One fast-slot swing (Cubone's Bone Club) at `at`, played out. */
function swing(state: WorldState, at: Vec2) {
  const pressed = step(state, input({ aim: at, slots: [true, false], slotMouse: [true, false] }), FIXED_DT_MS);
  const rest = stepUntil(pressed, (s) => s.player.action === null, 60, input({ aim: at }));
  return { state: rest.state, events: [...pressed.events, ...rest.events] };
}

/** Where each species starts (the player at 400,300), what it winds up first and for how long. */
const OPENERS: readonly { species: SpeciesId; pos: Vec2; attack: string; ms: number }[] = [
  { species: 'zubat', pos: vec(500, 300), attack: 'lunge', ms: ZUBAT.telegraphMs },
  { species: 'ekans', pos: vec(520, 300), attack: 'lunge', ms: EKANS.telegraphMs },
  { species: 'tentacool', pos: vec(450, 300), attack: 'slam', ms: TENTACOOL.telegraphMs },
  { species: 'wooper', pos: vec(460, 300), attack: 'slam', ms: WOOPER.telegraphMs },
  { species: 'grimer', pos: vec(445, 300), attack: 'slam', ms: GRIMER.telegraphMs },
  { species: 'corphish', pos: vec(530, 300), attack: 'jet', ms: CORPHISH.telegraphMs },
  { species: 'clauncher', pos: vec(650, 300), attack: 'jet', ms: CLAUNCHER.telegraphMs },
  { species: 'chinchou', pos: vec(490, 300), attack: 'pulse', ms: CHINCHOU.telegraphMs },
  { species: 'houndour', pos: vec(470, 300), attack: 'breath', ms: HOUNDOUR.telegraphMs },
  { species: 'stunky', pos: vec(460, 300), attack: 'breath', ms: STUNKY.telegraphMs },
  { species: 'slugma', pos: vec(560, 300), attack: 'lob', ms: SLUGMA.telegraphMs },
  { species: 'litleo', pos: vec(560, 300), attack: 'ball', ms: LITLEO.telegraphMs },
  { species: 'koffing', pos: vec(460, 300), attack: 'puff', ms: KOFFING.telegraphMs },
  { species: 'croagunk', pos: vec(460, 300), attack: 'stance', ms: CROAGUNK.stanceMs },
];

describe('experimental roster: every species acts', () => {
  it('covers the whole roster', () => {
    expect(OPENERS.map((o) => o.species).sort()).toEqual(EXPERIMENTAL_ENEMIES.map((e) => e.species).sort());
    for (const { species } of OPENERS) expect(ENEMY_BEHAVIOUR[species]).toBeDefined();
  });

  for (const opener of OPENERS) {
    it(`${opener.species} telegraphs "${opener.attack}" for ${opener.ms} ms, then hurts a player who stands still`, () => {
      const { events } = advance(arena(opener.species, opener.pos), 6000);
      expect(telegraphs(events)[0]).toMatchObject({ attack: opener.attack, durationMs: opener.ms });
      const hurt = hurtBy(events);
      expect(hurt.length).toBeGreaterThan(0);
      // Never before its first wind-up is over.
      const firstHurtAt = events.findIndex((e) => e.type === 'playerHurt');
      const firstTelegraphAt = events.findIndex((e) => e.type === 'enemyTelegraph');
      expect(firstHurtAt).toBeGreaterThan(firstTelegraphAt);
    });
  }
});

describe('dodge windows', () => {
  it('Ekans: once the coil locks, stepping out of the lane makes the lunge miss and opens the long recovery', () => {
    const locked = stepUntil(arena('ekans', vec(520, 300)), (s) => telegraphing('lunge')(s) && first(s).ai.modeMs >= EKANS.telegraphMs - EKANS.lockMs! + 20).state;
    const lane = first(locked).ai.attackDir;
    const after = advance(locked, EKANS.lockMs! + EKANS.lungeMs + 60, input({ move: vec(0, -1) }));
    expect(hurtBy(after.events)).toEqual([]);
    expect(first(after.state).ai.attackDir).toEqual(lane);
    expect(first(after.state).ai.mode).toBe('recover');
    expect(first(after.state).ai.modeDurationMs).toBe(EKANS.missRecoverMs);
  });

  it('Corphish: the jet lane locks before firing; sidestepping it then is safe', () => {
    const locked = stepUntil(arena('corphish', vec(530, 300)), (s) => telegraphing('jet')(s) && first(s).ai.modeMs >= CORPHISH.telegraphMs - CORPHISH.lockMs + 20).state;
    const after = advance(locked, CORPHISH.lockMs + CORPHISH.beamMs + 50, input({ move: vec(0, -1) }));
    expect(hurtBy(after.events)).toEqual([]);
    expect(first(after.state).ai.mode).toBe('recover');
  });

  it('Chinchou: stepping outside the marked radius during the glow avoids the ring', () => {
    const glowing = stepUntil(arena('chinchou', vec(490, 300)), telegraphing('pulse')).state;
    const away = advance(glowing, CHINCHOU.telegraphMs + CHINCHOU.pulseMs + 50, input({ move: vec(-1, 0) }));
    expect(distance(away.state.player.pos, first(away.state).pos)).toBeGreaterThan(CHINCHOU.radius);
    expect(hurtBy(away.events)).toEqual([]);
  });

  it('Chinchou: a roll timed with the ring passes through it', () => {
    const glowing = stepUntil(arena('chinchou', vec(490, 300)), telegraphing('pulse')).state;
    // Roll when the ring front is about to reach the player.
    const near = stepUntil(glowing, (s) => {
      const e = first(s);
      if (e.ai.mode !== 'attack') return false;
      const r = e.radius + (CHINCHOU.radius - e.radius) * (e.ai.modeMs / e.ai.modeDurationMs);
      return distance(s.player.pos, e.pos) - r < 25;
    }).state;
    const rolled = advance(near, 500, input({ roll: true, move: vec(1, 0) }));
    expect(hurtBy(rolled.events)).toEqual([]);
  });

  it('Houndour: backing out of reach during the wind-up avoids the flamethrower', () => {
    const winding = stepUntil(arena('houndour', vec(470, 300)), telegraphing('breath')).state;
    const away = advance(winding, HOUNDOUR.telegraphMs + HOUNDOUR.breathMs, input({ move: vec(-1, 0) }));
    expect(hurtBy(away.events)).toEqual([]);
  });

  it('Slugma: the landing point is fixed when the throw leaves; walking out of the circle is safe and leaves a lava pool there', () => {
    const thrown = stepUntil(arena('slugma', vec(560, 300)), (s) => first(s).ai.mode === 'attack' && first(s).ai.attack === 'lob').state;
    const aim = first(thrown).ai.aimPoint!;
    expect(distance(aim, thrown.player.pos)).toBeLessThan(5);
    const away = advance(thrown, SLUGMA.flightMs + 50, input({ move: vec(-1, 0) }));
    expect(hurtBy(away.events)).toEqual([]);
    const pool = away.state.projectiles.find((p) => p.owner === 'enemy' && p.vel.x === 0 && p.vel.y === 0);
    expect(pool).toMatchObject({ type: 'fire', radius: SLUGMA.pool.radius });
    expect(distance(pool!.pos, aim)).toBeLessThan(1);
  });

  it('Croagunk: rolling away right after a blocked hit escapes the counter', () => {
    const stance = stepUntil(arena('croagunk', vec(440, 300)), telegraphing('stance')).state;
    const struck = swing(stance, first(stance).pos);
    expect(first(struck.state).ai.attack).toBe('counter');
    const rolled = advance(struck.state, 700, input({ roll: true, move: vec(-1, 0) }));
    expect(hurtBy(rolled.events)).toEqual([]);
  });
});

describe('special rules', () => {
  it('Croagunk: a hit during the stance is blocked and answered with a fast Fighting counter', () => {
    const stance = stepUntil(arena('croagunk', vec(440, 300)), telegraphing('stance')).state;
    const hp = first(stance).hp;
    const struck = swing(stance, first(stance).pos);
    expect(struck.events.some((e) => e.type === 'hitBlocked')).toBe(true);
    expect(first(struck.state).hp).toBe(hp);
    expect(telegraphs(struck.events).at(-1)).toMatchObject({ attack: 'counter', durationMs: CROAGUNK.counter.telegraphMs });
    const punished = advance(struck.state, CROAGUNK.counter.telegraphMs + CROAGUNK.counter.lungeMs + 50);
    const plain = advance(stepUntil(arena('croagunk', vec(440, 300)), telegraphing('stance')).state, CROAGUNK.stanceMs + CROAGUNK.jab.telegraphMs + CROAGUNK.jab.lungeMs + 50);
    const counterHit = hurtBy(punished.events)[0]!;
    const jabHit = hurtBy(plain.events)[0]!;
    expect(counterHit.damage).toBeGreaterThan(jabHit.damage);
  });

  it('Croagunk: left alone, the stance ends in a slower Poison Jab', () => {
    const { events } = advance(arena('croagunk', vec(440, 300)), CROAGUNK.stanceMs + 200);
    expect(telegraphs(events).map((e) => e.attack)).toEqual(['stance', 'jab']);
    expect(telegraphs(events)[1]!.durationMs).toBe(CROAGUNK.jab.telegraphMs);
  });

  it('Koffing: at low HP it lights a fuse that a stagger cannot stop, then explodes in a big ring and faints', () => {
    const start = arena('koffing', vec(460, 300));
    const low = { ...start, enemies: [{ ...first(start), hp: Math.floor(first(start).maxHp * KOFFING.explode.belowHp) }] };
    const lit = stepUntil(low, telegraphing('explode'), 30);
    expect(telegraphs(lit.events)[0]).toMatchObject({ attack: 'explode', durationMs: KOFFING.explode.telegraphMs });
    const staggered = { ...lit.state, enemies: [{ ...first(lit.state), hitstunMs: 400 }] };
    const boom = advance(staggered, KOFFING.explode.telegraphMs + KOFFING.explode.blastMs + 50);
    expect(hurtBy(boom.events).length).toBe(1);
    expect(first(boom.state).alive).toBe(false);
    expect(boom.events.some((e) => e.type === 'enemyDefeated')).toBe(true);
  });

  it('Koffing: leaving the marked ring during the fuse is safe; killing it first cancels the blast', () => {
    const start = arena('koffing', vec(460, 300));
    const low = { ...start, enemies: [{ ...first(start), hp: 10 }] };
    const lit = stepUntil(low, telegraphing('explode'), 30).state;
    const fled = advance(lit, KOFFING.explode.telegraphMs + KOFFING.explode.blastMs + 50, input({ move: vec(-1, 0) }));
    expect(hurtBy(fled.events)).toEqual([]);
    const killed = swing({ ...lit, player: { ...lit.player, pos: vec(440, 300) } }, first(lit).pos);
    expect(first(killed.state).alive).toBe(false);
    const after = advance(killed.state, KOFFING.explode.telegraphMs + 200);
    expect(hurtBy(after.events)).toEqual([]);
  });

  it('Corphish: its shell blocks hits from the front, not from behind, and opens while it recovers', () => {
    const base = arena('corphish', vec(440, 300));
    const facingPlayer = { ...base, enemies: [{ ...first(base), facing: vec(-1, 0), ai: { ...first(base).ai, mode: 'dormant' as const } }] };
    const front = swing(facingPlayer, first(facingPlayer).pos);
    expect(front.events.some((e) => e.type === 'hitBlocked')).toBe(true);
    expect(first(front.state).hp).toBeGreaterThan(first(facingPlayer).hp * 0.8);
    const fromBehind = { ...facingPlayer, player: { ...facingPlayer.player, pos: vec(480, 300) } };
    const back = swing(fromBehind, first(fromBehind).pos);
    expect(back.events.some((e) => e.type === 'hitBlocked')).toBe(false);
    expect(back.events.some((e) => e.type === 'enemyHit')).toBe(true);
    const recovering = { ...facingPlayer, enemies: [{ ...first(facingPlayer), ai: { ...first(facingPlayer).ai, mode: 'recover' as const, modeDurationMs: 99999 } }] };
    const open = swing(recovering, first(recovering).pos);
    expect(open.events.some((e) => e.type === 'hitBlocked')).toBe(false);
  });

  it('Grimer leaves a sludge trail behind it as it walks', () => {
    const { state } = advance(arena('grimer', vec(700, 300)), 2000);
    const sludge = state.projectiles.filter((p) => p.owner === 'enemy' && p.vel.x === 0 && p.vel.y === 0);
    expect(sludge.length).toBeGreaterThanOrEqual(3);
    expect(sludge.every((p) => p.type === 'poison' && p.radius === GRIMER.trail!.puddle.radius)).toBe(true);
  });

  it('Tentacool leaves a poison puddle where it lashes; Wooper a mud puddle', () => {
    for (const [species, def, pos] of [
      ['tentacool', TENTACOOL, vec(450, 300)],
      ['wooper', WOOPER, vec(460, 300)],
    ] as const) {
      const { state } = stepUntil(arena(species, pos), (s) => first(s).ai.mode === 'attack', 600);
      const puddle = state.projectiles.find((p) => p.owner === 'enemy' && p.vel.x === 0);
      expect(puddle).toMatchObject({ type: def.puddle!.type, radius: def.puddle!.radius });
    }
  });

  it('Zubat weaves sideways while it closes in', () => {
    let state = arena('zubat', vec(700, 300));
    let widest = 0;
    for (let i = 0; i < ticksFor(800); i++) {
      state = step(state, IDLE, FIXED_DT_MS);
      widest = Math.max(widest, Math.abs(first(state).pos.y - 300));
    }
    expect(widest).toBeGreaterThan(8);
  });
});

describe('Fire enemies feed Flash Fire', () => {
  for (const [species, pos] of [
    ['houndour', vec(470, 300)],
    ['slugma', vec(560, 300)],
    ['litleo', vec(560, 300)],
  ] as const) {
    it(`${species}: Litwick absorbs the hit instead of being hurt`, () => {
      const { state, events } = advance(arena(species, pos, 'litwick'), 4000);
      expect(events.some((e) => e.type === 'passiveTriggered' && e.passive === 'flash-fire' && !e.kindled)).toBe(true);
      expect(hurtBy(events)).toEqual([]);
      expect(state.player.flashFire).toBe(true);
    });
  }
});

describe('co-op: the new states travel in host snapshots', () => {
  it('encodes the attack name and the landing point, and a guest checks a jet against its own player', () => {
    const host = stepUntil(arena('slugma', vec(560, 300)), (s) => first(s).ai.mode === 'attack').state;
    const snapshot = hostSnapshot(host);
    expect(snapshot.enemies[0]!.ai).toMatchObject({ attack: 'lob', aimPoint: first(host).ai.aimPoint });
    const wire = decodeMessage(encodeMessage({ t: 'snap', at: 1, floor: 1, s: snapshot }));
    expect(wire?.t === 'snap' && wire.s.enemies[0]!.ai.attack).toBe('lob');
    expect(wire?.t === 'snap' && distance(wire.s.enemies[0]!.ai.aimPoint!, first(host).ai.aimPoint!)).toBeLessThan(0.2);

    const jetting = stepUntil(arena('corphish', vec(530, 300)), (s) => first(s).ai.mode === 'attack').state;
    const guest = { ...createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, species: 'cubone', role: 'guest', localId: 'p2' }) };
    const synced = applyHostSnapshot(guest, hostSnapshot(jetting));
    const events: GameEvent[] = [];
    guestEnemyContacts(synced, events);
    expect(hurtBy(events).length).toBe(1);
  });

  it('a snapshot without the new fields clears a stale attack name on the guest', () => {
    const host = stepUntil(arena('croagunk', vec(440, 300)), telegraphing('stance')).state;
    const guest = applyHostSnapshot(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, role: 'guest', localId: 'p2' }), hostSnapshot(host));
    expect(first(guest).ai.attack).toBe('stance');
    const later = hostSnapshot(host);
    const plain = { ...later, enemies: later.enemies.map((e) => ({ ...e, ai: { mode: 'approach' as const, modeMs: 0, modeDurationMs: 0, attackDir: e.ai.attackDir } })) };
    expect(first(applyHostSnapshot(guest, plain)).ai.attack).toBeUndefined();
  });
});
