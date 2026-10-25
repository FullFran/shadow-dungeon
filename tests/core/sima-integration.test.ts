import { describe, expect, it } from 'vitest';
import { spawnShot, telegraph } from '../../src/core/brain';
import { eliteTimeScale, tierEliteRule } from '../../src/core/difficulty';
import type { Floor } from '../../src/core/dungeon';
import { coronaPockets, eclipseCardCount, nooseRadius } from '../../src/core/eclipse-echo';
import { endlessSpawns } from '../../src/core/endless';
import { isInvulnerable } from '../../src/core/player';
import { startRun } from '../../src/core/run';
import { eliteChance, eliteRuleAt } from '../../src/core/sima';
import { chooseSimaEvent, placeSimaEvent, simaEventChance, simaWaves, simaWaveSize, updateSimaEvent } from '../../src/core/sima-events';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { pierceZone } from '../../src/core/victim';
import { add, normalize, scale, vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { ALL_ELITE_TRAITS, ELITE_TRAIT_DEFS, ELITE_TRAITS, TIERS, type Difficulty } from '../../src/data/difficulty';
import { ECLIPSE_ECHO, ENEMY_SHOT_CAP, GASTLY, type EclipseEchoDef } from '../../src/data/enemies';
import { ENDLESS, ENDLESS_POOL } from '../../src/data/endless';
import { SIMA_ELITES, SIMA_EVENTS } from '../../src/data/sima';
import { SPECIES } from '../../src/data/species';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE, input, run, ticksFor } from './helpers';

/**
 * Integration of the Sima del Eclipse remaster with the difficulty tiers and
 * the caves and swamp: one elite system (one trait table, one seeded draw,
 * one wire field; the Sima's chance is the larger of the tier's and its depth
 * ramp's), the Sima's events read the tier's set-piece multipliers, the
 * Eclipse Echo's positional cards and deep elites use the one `pierceRoll`
 * rule solo and on guests, its hard card comes through `behaviourFor`, and
 * the caves' and swamp's enemies and guardians join the Sima.
 */

const ECL = 'eclipse-chasm' as const;
const SEEDS = [4242, 7, 99, 2024, 31337, 5, 11, 64];
const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt');

function stepEvents(w: WorldState, ms: number): { world: WorldState; events: GameEvent[] } {
  let current = w;
  const seen: GameEvent[] = [];
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step(current, IDLE, FIXED_DT_MS);
    seen.push(...current.events);
  }
  return { world: current, events: seen };
}

/** A player mid-roll, inside its i-frames (taken from a plain world). */
function rollingPlayer(): WorldState['player'] {
  const w = createWorld({ seed: 1, arena: { width: 800, height: 640 }, playerPos: vec(400, 320) });
  const rolled = run({ ...w, player: { ...w.player, disguiseBroken: true } }, input({ move: vec(0, -1), roll: true }), ticksFor(60));
  expect(isInvulnerable(rolled.player)).toBe(true);
  return rolled.player;
}

/** Runs `body` with `attack.pierceRoll` off (the negative control), restoring it after. */
function withoutPierce<T>(attack: { pierceRoll?: boolean }, body: () => T): T {
  const was = attack.pierceRoll;
  attack.pierceRoll = false;
  try {
    return body();
  } finally {
    attack.pierceRoll = was;
  }
}

describe('one elite system', () => {
  it('one trait table holds the tiers\' and the Sima\'s traits; the tiers draw tough/frenzied, the Sima all six', () => {
    expect([...ALL_ELITE_TRAITS].sort()).toEqual(['armored', 'enrage', 'frenzied', 'swift', 'tough', 'volley']);
    expect(ELITE_TRAITS).toEqual(['tough', 'frenzied']);
    expect([...SIMA_ELITES.traits].sort()).toEqual([...ALL_ELITE_TRAITS].sort());
    expect(ENDLESS.elites).toBe(SIMA_ELITES);
    // Swift and enrage read their pace from the table.
    expect(eliteTimeScale({ elite: 'swift', hp: 10, maxHp: 10 })).toBe(ELITE_TRAIT_DEFS.swift.pace);
    expect(eliteTimeScale({ elite: 'tough', hp: 1, maxHp: 10 })).toBe(1);
  });

  it('the Sima\'s chance is the larger of the tier\'s and the depth ramp\'s', () => {
    for (const d of ['easy', 'normal', 'hard', 'nightmare'] as Difficulty[]) {
      for (const floor of [1, 3, 6, 10, 20, 30, 60]) {
        expect(eliteRuleAt(SIMA_ELITES, floor, d).chance).toBe(Math.max(TIERS[d].eliteChance, eliteChance(SIMA_ELITES, floor)));
      }
    }
    expect(eliteRuleAt(SIMA_ELITES, 3, 'nightmare').chance).toBe(0.3);
    expect(eliteRuleAt(SIMA_ELITES, 60, 'normal').chance).toBe(SIMA_ELITES.max);
    expect(eliteRuleAt(SIMA_ELITES, 20, 'easy').pierceRollChance).toBe(0);
    expect(eliteRuleAt(SIMA_ELITES, 21, 'easy').pierceRollChance).toBe(SIMA_ELITES.pierceRoll.chance);
    // A regular dungeon keeps the tier's rule.
    expect(tierEliteRule('hard')).toEqual({ chance: TIERS.hard.eliteChance, traits: ELITE_TRAITS, hpScale: 1, pierceRollChance: 0 });
  });

  it('on the Sima\'s shallow floors (no ramp yet) the tier still makes elites; easy makes none', () => {
    const elitesAt = (d: Difficulty) => SEEDS.flatMap((seed) => [2, 3, 4].flatMap((f) => startRun(seed, { difficulty: d }, f, ECL).world.enemies.filter((e) => e.elite)));
    expect(elitesAt('easy')).toEqual([]);
    const nightmare = elitesAt('nightmare');
    expect(nightmare.length).toBeGreaterThan(0);
    for (const e of nightmare) expect(SIMA_ELITES.traits).toContain(e.elite);
    // HP: species x depth x tier x trait x the Sima's elite bonus.
    const world = startRun(4242, { difficulty: 'nightmare' }, 27, ECL).world;
    const elite = world.enemies.find((e) => e.elite)!;
    expect(elite).toBeDefined();
    expect(elite.maxHp).toBeCloseTo(SPECIES[elite.species].maxHp * world.enemyScale!.hp * TIERS.nightmare.hp * ELITE_TRAIT_DEFS[elite.elite!].hp * SIMA_ELITES.hpScale);
  });

  it('regular dungeons draw only the tier\'s traits; the Caves\' elites are tough or frenzied', () => {
    const elites = SEEDS.flatMap((seed) => [1, 2, 3, 4].flatMap((f) => startRun(seed, { difficulty: 'nightmare' }, f, 'flooded-caves').world.enemies.filter((e) => e.elite)));
    expect(elites.length).toBeGreaterThan(0);
    for (const e of elites) expect(ELITE_TRAITS).toContain(e.elite);
    for (const e of elites) expect(e.pierceRoll).toBeUndefined();
  });

  it('every peer makes the same elites, and the one elite field (tier traits too) rides the snapshot and the wire', () => {
    const a = startRun(99, { difficulty: 'hard' }, 23, ECL).world.enemies.map((e) => [e.species, e.elite ?? null, e.armor ?? null, e.pierceRoll ?? null]);
    const b = startRun(99, { difficulty: 'hard' }, 23, ECL).world.enemies.map((e) => [e.species, e.elite ?? null, e.armor ?? null, e.pierceRoll ?? null]);
    expect(a).toEqual(b);
    const host = spawnEnemy(spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) }), 'golett', vec(430, 300), { elite: 'tough' }), 'gastly', vec(200, 300), { elite: 'frenzied', pierceRoll: true });
    const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 23, s: hostSnapshot(host) }));
    if (!wire || wire.t !== 'snap') throw new Error('snapshot did not decode');
    expect(wire.s.enemies.map((e) => [e.elite, e.pierceRoll ?? null])).toEqual([
      ['tough', null],
      ['frenzied', true],
    ]);
    const guest = applyHostSnapshot({ ...host, role: 'guest', localId: 'p2', enemies: [] }, wire.s);
    expect(guest.enemies.map((e) => e.elite)).toEqual(['tough', 'frenzied']);
    // An armored elite spawns with its armor, from the table.
    expect(spawnEnemy(host, 'golett', vec(500, 300), { elite: 'armored' }).enemies[2]!.armor).toBe(true);
  });
});

describe('Sima events read the tier\'s set pieces', () => {
  it('event chance scales with the tier (capped at 1); waves +1 on nightmare, repeating the last size', () => {
    for (const floor of [2, 8, 20, 40]) {
      const easy = simaEventChance(SIMA_EVENTS, floor);
      expect(simaEventChance(SIMA_EVENTS, floor, 'hard')).toBeCloseTo(Math.min(1, easy * TIERS.hard.encounters.frequency));
      expect(simaEventChance(SIMA_EVENTS, floor, 'nightmare')).toBeCloseTo(Math.min(1, easy * TIERS.nightmare.encounters.frequency));
    }
    expect((['easy', 'normal', 'hard', 'nightmare'] as Difficulty[]).map((d) => simaWaves(SIMA_EVENTS, d))).toEqual([3, 3, 3, 4]);
    expect(simaWaveSize(SIMA_EVENTS, 4)).toBe(SIMA_EVENTS.waves.waves[2]);
  });

  it('nightmare floors hold more events than easy ones, still at most one each', () => {
    const count = (d: Difficulty) =>
      SEEDS.flatMap((seed) => Array.from({ length: 14 }, (_, i) => i + 2).filter((f) => f % 5 !== 0).map((f) => startRun(seed, { difficulty: d }, f, ECL).world.simaEvent)).filter(Boolean).length;
    expect(count('nightmare')).toBeGreaterThan(count('easy'));
    // The draw itself scales: one seed's floor that has none on easy may have one on nightmare, never the reverse.
    for (const seed of SEEDS) {
      const started = startRun(seed, {}, 12, ECL).world;
      const floor = started.arena.tiles as Floor;
      if (chooseSimaEvent(seed, 12, floor, 'normal', SIMA_EVENTS, 'easy')) expect(chooseSimaEvent(seed, 12, floor, 'normal', SIMA_EVENTS, 'nightmare')).not.toBeNull();
    }
  });

  it('a wave room on nightmare plays four waves before it clears', () => {
    const seed = 4242;
    const started = startRun(seed, { difficulty: 'nightmare' }, 12, ECL).world;
    const base = { ...started, simaEvent: undefined };
    const plan = base.arena.tiles as Floor;
    const room = plan.rooms.findIndex((_, i) => i !== plan.startRoom && i !== plan.stairsRoom);
    const pool = endlessSpawns(ENDLESS, 12).pool;
    let w = placeSimaEvent(base, { kind: 'waves', room }, plan, seed, 12, SIMA_EVENTS, pool, 'nightmare');
    const event = w.simaEvent!;
    w = { ...w, player: { ...w.player, pos: vec(event.rect.x + 40, event.rect.y + 40) } };
    const tick = (s: WorldState, ms: number) => {
      for (let t = 0; t < ms; t += FIXED_DT_MS) s = updateSimaEvent(s, FIXED_DT_MS, SIMA_EVENTS, pool);
      return s;
    };
    const killWave = (s: WorldState) => ({ ...s, enemies: s.enemies.map((e) => (s.simaEvent!.ids!.includes(e.id) ? { ...e, hp: 0, alive: false } : e)) });
    w = tick(w, 20);
    const waves: number[] = [];
    for (let i = 0; i < 6 && !w.simaEvent!.done; i++) {
      waves.push(w.simaEvent!.wave!);
      w = tick(tick(killWave(w), 20), SIMA_EVENTS.waves.pauseMs + 40);
    }
    expect(waves).toEqual([1, 2, 3, 4]);
    expect(w.simaEvent).toMatchObject({ done: true, outcome: 'cleared' });
  });
});

/** An Eclipse Echo floor with the boss about to play `card` (its next card), stepped into that card's attack window. */
function echoPlaying(card: 'corona' | 'noose'): WorldState {
  let host = startRun(7, {}, 60, ECL).world;
  const index = ECLIPSE_ECHO.cards.indexOf(card);
  host = { ...host, player: { ...host.player, pos: vec(40, host.arena.height - 40), hp: 1e9, maxHp: 1e9 } };
  host = { ...host, enemies: host.enemies.map((e) => ({ ...e, pos: vec(320, 144), ai: { ...e.ai, mode: 'approach' as const, cooldownMs: 0 }, boss: { ...e.boss!, combosDone: index } })) };
  for (let t = 0; t < 6000 && !(host.enemies[0]!.boss!.stance === card && host.enemies[0]!.ai.mode === 'attack'); t += FIXED_DT_MS) host = step(host, IDLE, FIXED_DT_MS);
  expect(host.enemies[0]!.boss!.stance).toBe(card);
  expect(host.enemies[0]!.ai.mode).toBe('attack');
  return { ...host, enemies: host.enemies.map((e) => ({ ...e, ai: { ...e.ai, contact: 'none' as const } })) };
}

const CENTRE = vec(320, 200);

/** Where a player on the noose's band stands (off its gap), `ahead` ms from now. */
function onNoose(host: WorldState, ahead = 16): Vec2 {
  const boss = host.enemies[0]!;
  const gap = normalize(boss.ai.attackDir);
  const side = vec(-gap.y, gap.x);
  return add(CENTRE, scale(Math.abs(side.x) > Math.abs(side.y) ? side : vec(-side.x, -side.y), nooseRadius(ECLIPSE_ECHO.noose, boss.ai.modeMs + ahead)));
}

describe('Eclipse Echo positional cards (pierceRoll)', () => {
  it('the corona burns a rolling player outside the pockets, solo; without the flag the roll saves it', () => {
    const solo = () => {
      const host = echoPlaying('corona');
      const roller = { ...rollingPlayer(), pos: vec(30, 370), hp: 500, maxHp: 500 };
      return hurt(stepEvents({ ...host, player: roller }, 50).events);
    };
    expect(ECLIPSE_ECHO.corona.attack.pierceRoll).toBe(true);
    expect(solo()).toBe(true);
    expect(withoutPierce(ECLIPSE_ECHO.corona.attack, solo)).toBe(false);
  });

  it('the corona burns a rolling guest after the host snapshot crosses the wire', () => {
    const asGuest = () => {
      const host = echoPlaying('corona');
      const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 60, s: hostSnapshot(host) }));
      if (!wire || wire.t !== 'snap') throw new Error('snapshot did not decode');
      const guest: WorldState = { ...host, role: 'guest', localId: 'p2', player: { ...rollingPlayer(), pos: vec(30, 370), hp: 500, maxHp: 500 } };
      return hurt(stepEvents(applyHostSnapshot(guest, wire.s), 50).events);
    };
    expect(asGuest()).toBe(true);
    expect(withoutPierce(ECLIPSE_ECHO.corona.attack, asGuest)).toBe(false);
  });

  it('the noose catches a rolling player on its band, solo and as a guest; without the flag the roll saves it', () => {
    const ready = () => {
      let host = echoPlaying('noose');
      // Wait until the ring is well inside the arena.
      for (let t = 0; t < 3000 && nooseRadius(ECLIPSE_ECHO.noose, host.enemies[0]!.ai.modeMs) > 170; t += FIXED_DT_MS) host = step(host, IDLE, FIXED_DT_MS);
      return { ...host, enemies: host.enemies.map((e) => ({ ...e, ai: { ...e.ai, contact: 'none' as const } })) };
    };
    const solo = () => {
      const host = ready();
      return hurt(stepEvents({ ...host, player: { ...rollingPlayer(), pos: onNoose(host), hp: 500, maxHp: 500 } }, 17).events);
    };
    const asGuest = () => {
      const host = ready();
      const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 60, s: hostSnapshot(host) }));
      if (!wire || wire.t !== 'snap') throw new Error('snapshot did not decode');
      const guest: WorldState = { ...host, role: 'guest', localId: 'p2', player: { ...rollingPlayer(), pos: onNoose(host), hp: 500, maxHp: 500 } };
      return hurt(stepEvents(applyHostSnapshot(guest, wire.s), 17).events);
    };
    expect(solo()).toBe(true);
    expect(asGuest()).toBe(true);
    expect(withoutPierce(ECLIPSE_ECHO.noose.attack, solo)).toBe(false);
    expect(withoutPierce(ECLIPSE_ECHO.noose.attack, asGuest)).toBe(false);
  });

  it('both wind up with the zone warning and a pierce zone (pockets, ring); its bullet cards do not', () => {
    let host = startRun(7, {}, 60, ECL).world;
    host = { ...host, enemies: host.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'approach' as const, cooldownMs: 0 }, boss: { ...e.boss!, combosDone: ECLIPSE_ECHO.cards.indexOf('corona') } })) };
    const next = step(host, IDLE, FIXED_DT_MS);
    const tele = next.events.find((e) => e.type === 'enemyTelegraph');
    expect(tele && tele.type === 'enemyTelegraph' && tele.attack === 'corona' && tele.pierceRoll).toBe(true);
    const boss = next.enemies[0]!;
    const zone = pierceZone(boss, 'easy', next.arena);
    expect(zone).toEqual({ kind: 'pockets', centers: coronaPockets(ECLIPSE_ECHO.corona, CENTRE, boss.ai.aimPoint!), radius: ECLIPSE_ECHO.corona.pocketRadius });
    expect(pierceZone({ ...boss, boss: { ...boss.boss!, stance: 'noose' } }, 'easy', next.arena)).toEqual({ kind: 'ring', center: CENTRE, radius: ECLIPSE_ECHO.noose.fromRadius, width: ECLIPSE_ECHO.noose.width });
    expect(pierceZone({ ...boss, boss: { ...boss.boss!, stance: 'ring' } }, 'easy', next.arena)).toBeNull();
    const ring = step({ ...host, enemies: host.enemies.map((e) => ({ ...e, boss: { ...e.boss!, combosDone: 0 } })) }, IDLE, FIXED_DT_MS);
    const plain = ring.events.find((e) => e.type === 'enemyTelegraph');
    expect(plain && plain.type === 'enemyTelegraph' && plain.attack === 'ring' && plain.pierceRoll).toBeFalsy();
  });
});

describe('deep Sima elites strike positionally (pierceRoll)', () => {
  const ARENA = { width: 800, height: 640 };
  const shotWorld = (role: 'host' | 'guest', pierce: boolean): WorldState => {
    const w = createWorld({ seed: 1, arena: ARENA, playerPos: vec(400, 320), role, localId: role === 'host' ? 'p1' : 'p2' });
    const spawned = spawnEnemy(w, 'gastly', vec(200, 320), { elite: 'swift', ...(pierce ? { pierceRoll: true as const } : {}) });
    return { ...spawned, player: { ...rollingPlayer(), hp: 500, maxHp: 500 } };
  };
  const shoot = (w: WorldState): WorldState => spawnShot(w, w.enemies[0]!, { ...GASTLY.projectile, speed: 1 }, vec(1, 0), w.player.pos);

  it('a deep elite\'s shot hits a rolling player solo; the same elite without the mark is dodged', () => {
    expect(hurt(stepEvents(shoot(shotWorld('host', true)), 34).events)).toBe(true);
    expect(hurt(stepEvents(shoot(shotWorld('host', false)), 34).events)).toBe(false);
  });

  it('the flag rides its shots over the wire: a rolling guest is hit too, and not without it', () => {
    const asGuest = (pierce: boolean) => {
      const host = shoot(shotWorld('host', pierce));
      const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 23, s: hostSnapshot(host) }));
      if (!wire || wire.t !== 'snap') throw new Error('snapshot did not decode');
      return hurt(stepEvents(applyHostSnapshot(shotWorld('guest', pierce), wire.s), 34).events);
    };
    expect(asGuest(true)).toBe(true);
    expect(asGuest(false)).toBe(false);
  });

  it('its wind-ups carry the zone warning and the "!" around its body', () => {
    const w = shotWorld('host', true);
    const enemy: EnemyState = w.enemies[0]!;
    const events: GameEvent[] = [];
    const winding = telegraph(enemy, 'cast', 600, vec(1, 0), events);
    expect(events[0]).toMatchObject({ type: 'enemyTelegraph', pierceRoll: true });
    expect(pierceZone(winding, 'easy')).toEqual({ kind: 'shape' });
    const plain = shotWorld('host', false).enemies[0]!;
    const quiet: GameEvent[] = [];
    expect(pierceZone(telegraph(plain, 'cast', 600, vec(1, 0), quiet), 'easy')).toBeNull();
    expect(quiet[0]).not.toHaveProperty('pierceRoll');
  });
});

describe('Eclipse Echo tricks and caps', () => {
  it('its hard card comes from behaviourFor (data/sima-tricks.ts); easy plays the data as written', () => {
    expect(behaviourFor('eclipse-echo', 'easy')).toBe(ECLIPSE_ECHO);
    expect(behaviourFor('eclipse-echo', 'normal')).toBe(ECLIPSE_ECHO);
    const hard = behaviourFor('eclipse-echo', 'hard') as EclipseEchoDef;
    expect(hard.extraCards).toBe(ECLIPSE_ECHO.extraCards + 1);
    expect(eclipseCardCount(hard, 10)).toBe(eclipseCardCount(ECLIPSE_ECHO, 10) + 1);
  });

  it('its own cap is 110 shots, under the global cap', () => {
    expect(ECLIPSE_ECHO.maxShots).toBe(110);
    expect(ECLIPSE_ECHO.maxShots).toBeLessThan(ENEMY_SHOT_CAP);
  });
});

describe('the caves and the swamp in the Sima', () => {
  it('their regulars join the pool from sensible depths; the mid-bosses stay out', () => {
    const entries = new Map(ENDLESS_POOL.map((e) => [e.species, e]));
    for (const species of ['krabby', 'remoraid', 'shellos', 'venipede', 'salandit', 'skrelp'] as const) {
      expect(entries.get(species), species).toBeDefined();
      expect(entries.get(species)!.minDepth).toBeGreaterThanOrEqual(6);
    }
    for (const species of ['lanturn', 'salazzle'] as const) expect(entries.has(species)).toBe(false);
    expect(endlessSpawns(ENDLESS, 5).pool.map((e) => e.species)).not.toContain('krabby');
    expect(endlessSpawns(ENDLESS, 12).pool.map((e) => e.species)).toEqual(expect.arrayContaining(['krabby', 'remoraid', 'shellos', 'venipede', 'salandit', 'skrelp']));
    // Deep floors do meet them (and still never more than 3 to a room, checked in sima-ramp).
    const met = new Set(SEEDS.flatMap((seed) => [16, 18, 22, 26].flatMap((f) => startRun(seed, {}, f, ECL).world.enemies.map((e) => e.species))));
    expect([...met].filter((s) => ['krabby', 'remoraid', 'shellos', 'venipede', 'salandit', 'skrelp'].includes(s)).length).toBeGreaterThanOrEqual(4);
  });

  it('Dhelmise and Nihilego join the guardian echoes, and as echoes never reach phase 2', () => {
    expect(ENDLESS.echoes.map((e) => e.room)).toEqual(['boss', 'hollow', 'roost', 'wreck', 'rift']);
    for (const [floor, species] of [
      [35, 'dhelmise'],
      [45, 'nihilego'],
    ] as const) {
      let w = startRun(4242, {}, floor, ECL).world;
      expect(w.enemyScale?.echo).toBe(true);
      const boss = w.enemies.find((e) => e.species === species)!;
      expect(boss).toBeDefined();
      // Below half HP, and its cards keep coming: it never awakens.
      w = { ...w, player: { ...w.player, hp: 1e9, maxHp: 1e9 }, enemies: w.enemies.map((e) => (e.id === boss.id ? { ...e, hp: e.maxHp * 0.2 } : e)) };
      for (let t = 0; t < 20_000; t += FIXED_DT_MS) {
        w = step(w, IDLE, FIXED_DT_MS);
        w = { ...w, player: { ...w.player, hp: 1e9 } };
      }
      expect(w.enemies.find((e) => e.id === boss.id)!.boss?.phase ?? 1).toBe(1);
      // The same boss outside an echo does awaken (control).
      let own: WorldState = { ...w, enemyScale: undefined, enemies: w.enemies.map((e) => (e.id === boss.id ? { ...e, boss: { ...e.boss!, phase: undefined } } : e)) };
      for (let t = 0; t < 20_000 && (own.enemies.find((e) => e.id === boss.id)!.boss?.phase ?? 1) !== 2; t += FIXED_DT_MS) {
        own = step(own, IDLE, FIXED_DT_MS);
        own = { ...own, player: { ...own.player, hp: 1e9 } };
      }
      expect(own.enemies.find((e) => e.id === boss.id)!.boss?.phase).toBe(2);
    }
  });
});
