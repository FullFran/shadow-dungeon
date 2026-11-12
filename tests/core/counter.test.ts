import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { AEGISLASH, DECIDUEYE, ECLIPSE_ECHO, SABLEYE, type ShotDef } from '../../src/data/enemies';
import { midnightAttack } from '../../src/core/boss';
import { DIFFICULTIES, type Difficulty } from '../../src/data/difficulty';
import { contactPlayer, spawnShot } from '../../src/core/brain';
import { counterWindowMs, countersHit, shotShooter, strikeInReach } from '../../src/core/counter';
import { computeDamage } from '../../src/core/damage';
import { landHitOnPlayer } from '../../src/core/hits';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { input } from './helpers';

/**
 * The counterstep (odd/tasks/perilous-counter.md S2): rolling INTO a perilous
 * (`pierceRoll`) shot or strike, landing within the window from the roll's
 * start, counters it; anything else is the full hit, as before.
 */
const PLAYER = vec(400, 300);
const base = (difficulty: Difficulty = 'normal'): WorldState => {
  const w = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, difficulty });
  return { ...w, player: { ...w.player, disguiseBroken: true } };
};
/** The player `elapsedMs` into a roll heading `dir`. */
const rollingAt = (w: WorldState, elapsedMs: number, dir: Vec2 = vec(-1, 0)): WorldState => ({ ...w, player: { ...w.player, roll: { elapsedMs, dir } } });
/** A perilous hit coming from the left (where the roll heads by default). */
const perilous = (from: Vec2 = vec(300, 300), attackerId?: string) => ({ damage: 20, from, pierceRoll: true, counter: attackerId ? { attackerId } : {} });

describe('counterstep: the rule', () => {
  it('every tier has a window, within the 120-180 ms the design asks for, never longer on a harder tier', () => {
    for (const d of DIFFICULTIES) {
      expect(counterWindowMs(d)).toBeGreaterThanOrEqual(120);
      expect(counterWindowMs(d)).toBeLessThanOrEqual(180);
    }
    const windows = DIFFICULTIES.map(counterWindowMs);
    expect([...windows].sort((a, b) => b - a)).toEqual(windows);
    expect(counterWindowMs('nightmare')).toBeLessThan(counterWindowMs('normal'));
  });

  it('window edges: a hit landing at the window counters, one ms later does not (every tier)', () => {
    for (const d of DIFFICULTIES) {
      const w = base(d);
      expect(countersHit(rollingAt(w, counterWindowMs(d)).player, perilous(), d)).toBe(true);
      expect(countersHit(rollingAt(w, counterWindowMs(d) + 1).player, perilous(), d)).toBe(false);
      expect(countersHit(rollingAt(w, 0).player, perilous(), d)).toBe(true);
    }
  });

  it('direction: head on or within the angle counters; sideways, away, or standing still does not', () => {
    const w = base();
    const at = (dir: Vec2) => countersHit(rollingAt(w, 50, dir).player, perilous(), 'normal');
    expect(at(vec(-1, 0))).toBe(true);
    expect(at(vec(-1, 0.9))).toBe(true);
    expect(at(vec(0, 1))).toBe(false);
    expect(at(vec(1, 0))).toBe(false);
    expect(countersHit(w.player, perilous(), 'normal')).toBe(false);
  });

  it('only a counterable perilous hit: a plain hit is the roll as before, a perilous one without `counter` (ground) cannot be', () => {
    const p = rollingAt(base(), 50).player;
    expect(countersHit(p, { damage: 20, from: vec(300, 300), counter: {} }, 'normal')).toBe(false);
    expect(countersHit(p, { damage: 20, from: vec(300, 300), pierceRoll: true }, 'normal')).toBe(false);
    expect(countersHit(p, { damage: 20, pierceRoll: true, counter: {} }, 'normal')).toBe(false);
  });

  it('a strike is counterable only within reach of its attacker', () => {
    const enemy = { pos: vec(300, 300), radius: 14 };
    expect(strikeInReach(vec(300 + 14 + TUNING.player.radius + TUNING.counter.meleeReachPx, 300), enemy)).toBe(true);
    expect(strikeInReach(vec(300 + 14 + TUNING.player.radius + TUNING.counter.meleeReachPx + 1, 300), enemy)).toBe(false);
  });

  it("a shot's shooter is the enemy behind it, a boss first; none for a still shot or with nobody behind", () => {
    let w = spawnEnemy(base(), 'gastly', vec(100, 300), { dormant: true });
    w = spawnEnemy(w, 'gastly', vec(100, 200), { dormant: true });
    w = spawnEnemy(w, 'gastly', vec(700, 300), { dormant: true });
    const shot = { pos: vec(300, 300), vel: vec(300, 0) };
    expect(shotShooter(shot, w.enemies)?.id).toBe(w.enemies[0]!.id);
    const boss = w.enemies.map((e, i) => (i === 1 ? { ...e, boss: { stance: 'blade' as const, comboIndex: 0 } } : e)) as WorldState['enemies'];
    expect(shotShooter(shot, boss)?.id).toBe(w.enemies[1]!.id);
    expect(shotShooter({ pos: shot.pos, vel: vec(0, 0) }, w.enemies)).toBeNull();
    expect(shotShooter({ pos: vec(50, 300), vel: vec(300, 0) }, w.enemies)).toBeNull();
  });
});

describe('counterstep: landing a hit', () => {
  it('countered: no damage, its event, the attacker owed the hit; a mistimed roll takes the full hit', () => {
    const w = rollingAt(base(), 40);
    const events: GameEvent[] = [];
    const landed = landHitOnPlayer(w, perilous(vec(300, 300), 'e9'), events);
    expect(landed.outcome).toBe('countered');
    expect(landed.state.player.hp).toBe(w.player.hp);
    expect(events.map((e) => e.type)).toEqual(['perilousCounter']);
    expect(landed.state.counterDue).toEqual(['e9']);
    const late = landHitOnPlayer(rollingAt(base(), counterWindowMs('normal') + 20), perilous(vec(300, 300), 'e9'), []);
    expect(late.outcome).toBe('hurt');
    expect(late.state.player.hp).toBeLessThan(w.player.hp);
    expect(late.state.counterDue).toBeUndefined();
  });
});

/** An enemy shot at the player from the left, `gap` px between the shot's edge and the player's. */
function shotAtPlayer(w: WorldState, gap: number, pierceRoll = true): WorldState {
  const shooter = spawnEnemy(w, 'gastly', vec(100, 300), { dormant: true });
  const at = vec(PLAYER.x - TUNING.player.radius - 10 - gap, PLAYER.y);
  return spawnShot(shooter, shooter.enemies[0]!, { power: 30, type: 'ghost', speed: 300, radius: 10, lifetimeMs: 3000, ...(pierceRoll ? { pierceRoll } : {}) }, vec(1, 0), at);
}

function play(w: WorldState, ms: number, rollDir: Vec2 | null): { state: WorldState; events: GameEvent[] } {
  let current = w;
  const seen: GameEvent[] = [];
  for (let i = 0; i < Math.round(ms / FIXED_DT_MS); i++) {
    current = step(current, input({ move: rollDir ?? vec(0, 0), roll: rollDir !== null && i === 0 }), FIXED_DT_MS);
    seen.push(...current.events);
  }
  return { state: current, events: seen };
}

const types = (events: GameEvent[]) => events.map((e) => e.type);

describe('counterstep: shots', () => {
  it('rolling into a perilous shot in time counters it: no hurt, the shot is gone, its shooter staggered and struck', () => {
    const out = play(shotAtPlayer(base(), 20), 400, vec(-1, 0));
    expect(types(out.events)).toContain('perilousCounter');
    expect(types(out.events)).not.toContain('playerHurt');
    expect(out.state.projectiles).toHaveLength(0);
    const struck = out.events.find((e) => e.type === 'enemyHit');
    expect(struck && struck.type === 'enemyHit' && struck.enemyId).toBe(out.state.enemies[0]!.id);
    expect(out.state.enemies[0]!.hp).toBeLessThan(out.state.enemies[0]!.maxHp);
    expect(out.state.counterDue).toBeUndefined();
  });

  it("its hit is the counter's power times the perfect dodge's damage multiplier", () => {
    const w = shotAtPlayer(base(), 20);
    const out = play(w, 400, vec(-1, 0));
    const hit = out.events.find((e) => e.type === 'enemyHit');
    const shooter = w.enemies[0]!;
    const { damage } = computeDamage({
      power: TUNING.counter.power,
      moveType: w.player.types[0]!,
      attackerTypes: w.player.types,
      defenderTypes: shooter.types,
      multiplier: TUNING.perfectDodge.damageMultiplier,
      onEnemy: true,
    });
    expect(hit && hit.type === 'enemyHit' && hit.damage).toBe(damage);
  });

  it('a mistimed roll (the shot arrives after the window) takes the full hit, as today', () => {
    // 150 px apart, closing at roll + shot speed: it lands about 230 ms into the roll.
    const out = play(shotAtPlayer(base(), 150), 600, vec(-1, 0));
    expect(types(out.events)).toContain('playerHurt');
    expect(types(out.events)).not.toContain('perilousCounter');
  });

  it('rolling away from it, or a plain shot rolled into, is no counter', () => {
    expect(types(play(shotAtPlayer(base(), 20), 400, vec(1, 0)).events)).not.toContain('perilousCounter');
    const plain = play(shotAtPlayer(base(), 20, false), 400, vec(-1, 0)).events;
    expect(types(plain)).not.toContain('perilousCounter');
    expect(types(plain)).not.toContain('playerHurt');
  });

  it('a deep Sima elite: every shot of its own is perilous, and counterable', () => {
    let w = spawnEnemy(base(), 'gastly', vec(100, 300), { dormant: true });
    w = { ...w, enemies: w.enemies.map((e) => ({ ...e, pierceRoll: true as const })) };
    w = spawnShot(w, w.enemies[0]!, { power: 30, type: 'ghost', speed: 300, radius: 10, lifetimeMs: 3000 }, vec(1, 0), vec(PLAYER.x - 40, PLAYER.y));
    expect(w.projectiles[0]!.pierceRoll).toBe(true);
    expect(types(play(w, 400, vec(-1, 0)).events)).toContain('perilousCounter');
  });

  it('deterministic: the same world and inputs give the same result', () => {
    const a = play(shotAtPlayer(base(), 20), 400, vec(-1, 0));
    const b = play(shotAtPlayer(base(), 20), 400, vec(-1, 0));
    expect(b.state).toEqual(a.state);
    expect(b.events).toEqual(a.events);
  });
});

describe('counterstep: every perilous source', () => {
  const SHOTS: readonly [string, ShotDef][] = [
    ["Aegislash's shadow sword", AEGISLASH.phase2.shadow.sword],
    ["Decidueye's rain arrow", DECIDUEYE.phase2.rain.arrow],
  ];
  for (const [name, shot] of SHOTS) {
    it(`${name}: rolled into in time, countered`, () => {
      expect(shot.pierceRoll).toBe(true);
      const w = spawnEnemy(base(), 'gastly', vec(100, 300), { dormant: true });
      const fired = spawnShot(w, w.enemies[0]!, shot, vec(1, 0), vec(PLAYER.x - TUNING.player.radius - shot.radius - 8, PLAYER.y));
      expect(types(play(fired, 300, vec(-1, 0)).events)).toContain('perilousCounter');
    });
  }
  const STRIKES = [
    ["Aegislash's Midnight (Hard)", midnightAttack(AEGISLASH, 'hard')],
    ["Sableye's gem burst", SABLEYE.gems.burst.attack],
  ] as const;
  for (const [name, attack] of STRIKES) {
    it(`${name}: within reach and rolled into, countered`, () => {
      expect(attack.pierceRoll).toBe(true);
      const w = rollingAt(spawnEnemy(base(), 'poochyena', vec(360, 300), { dormant: true }), 40);
      const events: GameEvent[] = [];
      contactPlayer(w, w.enemies[0]!, attack, true, events);
      expect(types(events)).toEqual(['perilousCounter']);
    });
  }
  it("the Eclipse Echo's corona, landing far from it, is ground: no counter", () => {
    const w = rollingAt(spawnEnemy(base(), 'poochyena', vec(150, 300), { dormant: true }), 40);
    const events: GameEvent[] = [];
    contactPlayer(w, w.enemies[0]!, ECLIPSE_ECHO.corona.attack, true, events);
    expect(types(events)).toEqual(['playerHurt']);
  });
});

describe('counterstep: strikes', () => {
  const attack = { power: 30, type: 'dark' as const, pierceRoll: true };
  const near = (w: WorldState, at: Vec2) => spawnEnemy(w, 'poochyena', at, { dormant: true });

  it('a perilous strike within reach, rolled into: countered, the striker struck at the next step', () => {
    const w = rollingAt(near(base(), vec(360, 300)), 40);
    const events: GameEvent[] = [];
    const hit = contactPlayer(w, w.enemies[0]!, attack, true, events);
    expect(types(events)).toEqual(['perilousCounter']);
    expect(hit.contact).toBe('dodged');
    expect(hit.state.player.hp).toBe(w.player.hp);
    const next = step({ ...hit.state, player: { ...hit.state.player, roll: null } }, input(), FIXED_DT_MS);
    expect(types(next.events)).toContain('enemyHit');
    expect(next.enemies[0]!.hitstunMs).toBeGreaterThan(0);
    expect(next.counterDue).toBeUndefined();
  });

  it("a deep Sima elite's strike (the enemy's own flag) is perilous and counterable too", () => {
    const w0 = near(base(), vec(360, 300));
    const w = rollingAt({ ...w0, enemies: w0.enemies.map((e) => ({ ...e, pierceRoll: true as const })) }, 40);
    const events: GameEvent[] = [];
    contactPlayer(w, w.enemies[0]!, { power: 30, type: 'dark' }, true, events);
    expect(types(events)).toEqual(['perilousCounter']);
  });

  it('a perilous zone landing away from its attacker is ground: it hurts, rolling or not', () => {
    const w = rollingAt(near(base(), vec(200, 300)), 40);
    const events: GameEvent[] = [];
    const hit = contactPlayer(w, w.enemies[0]!, attack, true, events);
    expect(types(events)).toEqual(['playerHurt']);
    expect(hit.state.counterDue).toBeUndefined();
  });
});

describe('counterstep: co-op victim side', () => {
  it("a guest counters a host shot on its own screen: the shot is spent there and its hit on the shooter is a claim", () => {
    const g = { ...shotAtPlayer(base(), 20), role: 'guest' as const };
    const out = play(g, 400, vec(-1, 0));
    expect(types(out.events)).toContain('perilousCounter');
    expect(types(out.events)).not.toContain('playerHurt');
    expect(out.state.spentShots).toEqual([g.projectiles[0]!.id]);
    const claim = out.events.find((e) => e.type === 'hitClaim');
    expect(claim && claim.type === 'hitClaim' && claim.claim.enemyId).toBe(g.enemies[0]!.id);
    expect(claim && claim.type === 'hitClaim' && claim.claim.hitstunMs).toBeGreaterThan(0);
  });

  it("a guest counters a host enemy's strike: the striker's hit is its claim, the host's world stays the host's", () => {
    const w0 = { ...spawnEnemy(base(), 'poochyena', vec(360, 300), { dormant: true }), role: 'guest' as const };
    const w = rollingAt(w0, 40);
    const events: GameEvent[] = [];
    const hit = contactPlayer(w, w.enemies[0]!, { power: 30, type: 'dark', pierceRoll: true }, true, events);
    expect(types(events)).toEqual(['perilousCounter']);
    const next = step({ ...hit.state, player: { ...hit.state.player, roll: null } }, input(), FIXED_DT_MS);
    const claim = next.events.find((e) => e.type === 'hitClaim');
    expect(claim && claim.type === 'hitClaim' && claim.claim.enemyId).toBe(w.enemies[0]!.id);
    expect(claim && claim.type === 'hitClaim' && claim.claim.id).toContain('counter');
  });
});
