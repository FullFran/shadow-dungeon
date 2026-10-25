import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../../src/data/difficulty';
import { spellCardKey } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { NIHILEGO, SALAZZLE, SWAMP_SHOT_CAP } from '../../src/data/swamp-enemies';
import { TUNING } from '../../src/data/tuning';
import { loadRoom } from '../../src/core/rooms';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import {
  danceDashes,
  downpourCircles,
  FLOOD_GRID,
  floodPockets,
  HAZE_GRID,
  hazePockets,
  inTendril,
  nearestSpot,
  pocketGrid,
  queenCards,
  shardRings,
  sheltered,
  spawnCapped,
  spiralDirs,
  tendrilLanes,
  tendrilWaves,
  ultraCards,
} from '../../src/core/swamp-bosses';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld } from '../../src/core/world';
import { IDLE } from './helpers';

const PLAYER_R = TUNING.player.radius;
const SPEED = TUNING.player.moveSpeed;
const DEG = Math.PI / 180;

function room(id: 'den' | 'rift', difficulty?: Difficulty): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  const loaded = loadRoom(difficulty ? { ...base, difficulty } : base, id);
  return { ...loaded, player: { ...loaded.player, disguiseBroken: true } };
}

const boss = (s: WorldState) => s.enemies[0]!;

function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 3000, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

/** Keeps the player alive and out of the way so a boss runs its whole rotation. */
const immortal = (s: WorldState): WorldState => ({ ...s, player: { ...s.player, hp: s.player.maxHp } });

function playCards(state: WorldState, cards: number, maxTicks = 20000): { stances: string[]; state: WorldState; maxShots: number } {
  let current = state;
  const stances: string[] = [];
  let maxShots = 0;
  for (let i = 0; i < maxTicks && stances.length < cards; i++) {
    current = immortal(step(current, IDLE, FIXED_DT_MS));
    for (const e of current.events) if (e.type === 'bossStance') stances.push(e.stance);
    maxShots = Math.max(maxShots, current.projectiles.filter((p) => p.owner === 'enemy').length);
  }
  return { stances, state: current, maxShots };
}

/** A spiral leaves a safe path when its gaps are wide and turn slower than a player walks near the boss. */
function spiralIsFair(arms: number, degPerSec: number, shotRadius: number): void {
  const r = 100;
  expect(360 / arms).toBeGreaterThanOrEqual(90);
  expect(degPerSec * DEG * r).toBeLessThanOrEqual(0.8 * SPEED);
  expect((2 * Math.PI * r) / arms - 2 * shotRadius).toBeGreaterThanOrEqual(3 * 2 * PLAYER_R);
}

/** Every point of the arena is close enough to a pocket to walk into it (whole body) within the telegraph. */
function pocketsReachable(arena: { width: number; height: number }, grid: { cols: number; rows: number }, pockets: (aim: Vec2) => Vec2[], radius: number, telegraphMs: number): void {
  const spots = pocketGrid(arena, grid.cols, grid.rows);
  for (let y = PLAYER_R; y <= arena.height - PLAYER_R; y += 20) {
    for (let x = PLAYER_R; x <= arena.width - PLAYER_R; x += 20) {
      const player = vec(x, y);
      const aim = nearestSpot(spots, player);
      const walk = Math.max(0, distance(aim, player) - (radius - PLAYER_R));
      expect(walk / SPEED).toBeLessThanOrEqual((0.75 * telegraphMs) / 1000);
      expect(sheltered(pockets(aim), radius, aim)).toBe(true);
    }
  }
}

describe('Salazzle, the den mid-boss', () => {
  it('plays Dance, Spiral and Haze in turn, with the Escort only on nightmare', () => {
    expect(queenCards(SALAZZLE, 'easy')).toEqual(['dance', 'spiral', 'haze']);
    expect(queenCards(SALAZZLE, 'hard')).toEqual(['dance', 'spiral', 'haze']);
    expect(queenCards(SALAZZLE, 'nightmare')).toEqual(['dance', 'spiral', 'haze', 'escort']);
    expect(playCards(room('den'), 4).stances).toEqual(['dance', 'spiral', 'haze', 'dance']);
    for (const card of ['dance', 'spiral', 'haze', 'escort']) expect(spellCardKey('salazzle', card)).toBe(`spell.salazzle.${card}`);
  });

  it('dances three dashes (four on hard and above), leaving smoke puffs', () => {
    expect(danceDashes(SALAZZLE, 'normal')).toBe(3);
    expect(danceDashes(SALAZZLE, 'hard')).toBe(4);
    const start = room('den');
    const { state, events } = stepUntil(immortal(start), (s) => boss(s).ai.mode === 'recover', 4000);
    expect(events.filter((e) => e.type === 'enemyAttack' && e.attack === 'dance')).toHaveLength(3);
    expect(state.projectiles.filter((p) => p.vel.x === 0 && p.vel.y === 0).length).toBeGreaterThanOrEqual(3);
    const hard = stepUntil(immortal(room('den', 'hard')), (s) => boss(s).ai.mode === 'recover', 4000).events;
    expect(hard.filter((e) => e.type === 'enemyAttack' && e.attack === 'dance')).toHaveLength(4);
  });

  it('turns its spiral slowly enough to ride a gap', () => {
    spiralIsFair(SALAZZLE.spiral.arms, SALAZZLE.spiral.degPerSec, SALAZZLE.spiral.flame.radius);
    const dirs = spiralDirs(vec(1, 0), SALAZZLE.spiral.arms, SALAZZLE.spiral.degPerSec, 500);
    expect(Math.abs(Math.atan2(dirs[1]!.y, dirs[1]!.x) - Math.atan2(dirs[0]!.y, dirs[0]!.x)) % (2 * Math.PI)).toBeCloseTo((2 * Math.PI) / SALAZZLE.spiral.arms, 5);
  });

  it('fills the den with haze except two pockets a player can always reach in time; rolling does not help', () => {
    expect(SALAZZLE.haze.attack.pierceRoll).toBe(true);
    const den = ROOMS.den;
    pocketsReachable(den, HAZE_GRID, (aim) => hazePockets(den, aim), SALAZZLE.haze.pocketRadius, SALAZZLE.haze.telegraphMs);
    const aim = vec(den.width / 6, den.height / 4);
    expect(sheltered(hazePockets(den, aim), SALAZZLE.haze.pocketRadius, vec(den.width - aim.x, den.height - aim.y))).toBe(true);
    expect(sheltered(hazePockets(den, aim), SALAZZLE.haze.pocketRadius, vec(den.width / 2, den.height / 2))).toBe(false);
  });

  it('calls two Salandit on nightmare, never more than two at once', () => {
    let current = immortal(room('den', 'nightmare'));
    let seen = 0;
    for (let i = 0; i < 20000 && seen < 2; i++) {
      current = immortal(step(current, IDLE, FIXED_DT_MS));
      for (const e of current.events) if (e.type === 'bossStance' && e.stance === 'escort') seen++;
      expect(current.enemies.filter((e) => e.alive && e.species === 'salandit').length).toBeLessThanOrEqual(SALAZZLE.escort.count);
    }
    expect(seen).toBe(2);
    expect(current.enemies.filter((e) => e.species === 'salandit')).toHaveLength(2);
  });
});

describe('Nihilego, the rift guardian', () => {
  it('plays Tendrils, Spores and Shards in phase 1; the downpour joins on nightmare', () => {
    expect(ultraCards(NIHILEGO, 1, 'easy')).toEqual(['tendrils', 'spores', 'shards']);
    expect(ultraCards(NIHILEGO, 2, 'hard')).toEqual(['wormhole', 'tendrils', 'spores', 'flood', 'shards']);
    expect(ultraCards(NIHILEGO, 1, 'nightmare')).toEqual(['tendrils', 'spores', 'shards', 'downpour']);
    expect(playCards(room('rift'), 4).stances).toEqual(['tendrils', 'spores', 'shards', 'tendrils']);
    for (const card of ['tendrils', 'spores', 'shards', 'wormhole', 'flood', 'downpour', 'ultra']) expect(spellCardKey('nihilego', card)).toBe(`spell.nihilego.${card}`);
  });

  it('awakens once at half HP, between cards, then plays the phase-2 rotation starting with the wormhole', () => {
    const start = room('rift');
    const half: WorldState = { ...start, enemies: [{ ...boss(start), hp: boss(start).maxHp * NIHILEGO.phase2.threshold }] };
    const { stances, state } = playCards(half, 3);
    expect(stances).toEqual(['ultra', 'wormhole', 'tendrils']);
    expect(boss(state).boss?.phase).toBe(2);
    // Lower still: never awakens again.
    const lower: WorldState = { ...state, enemies: [{ ...boss(state), hp: boss(state).maxHp * 0.2 }] };
    expect(playCards(lower, 4).stances).not.toContain('ultra');
    // Not mid-pattern: dropping below half during a card lets the card finish first.
    const winding = stepUntil(immortal(start), (s) => boss(s).ai.mode === 'telegraph').state;
    const hurt: WorldState = { ...winding, enemies: [{ ...boss(winding), hp: boss(winding).maxHp * 0.4 }] };
    const { events } = stepUntil(hurt, (s) => boss(s).boss?.stance === 'ultra', 4000);
    expect(events.some((e) => e.type === 'enemyAttack' && e.attack === 'tendrils')).toBe(true);
  });

  it('awakens with a harmless transform long enough to read', () => {
    expect(NIHILEGO.phase2.awakenMs).toBeGreaterThanOrEqual(1500);
  });

  it('lashes every other tendril lane, the other set next wave, always leaving a lane wider than a player', () => {
    const arena = ROOMS.rift;
    for (const rows of [true, false]) {
      for (const wave of [0, 1]) {
        const lashed = tendrilLanes(arena, rows, NIHILEGO.tendrils.lanes, wave);
        const other = tendrilLanes(arena, rows, NIHILEGO.tendrils.lanes, wave + 1);
        expect(lashed.length + other.length).toBe(NIHILEGO.tendrils.lanes);
        const safe = other[0]!;
        expect(safe[1] - safe[0]).toBeGreaterThanOrEqual(2 * PLAYER_R + 40);
        const mid = (safe[0] + safe[1]) / 2;
        expect(inTendril(arena, rows, NIHILEGO.tendrils.lanes, wave, rows ? vec(300, mid) : vec(mid, 300))).toBe(false);
        const hitMid = (lashed[0]![0] + lashed[0]![1]) / 2;
        expect(inTendril(arena, rows, NIHILEGO.tendrils.lanes, wave, rows ? vec(300, hitMid) : vec(hitMid, 300))).toBe(true);
      }
    }
    expect(tendrilWaves(NIHILEGO, 'easy')).toBe(2);
    expect(tendrilWaves(NIHILEGO, 'hard')).toBe(3);
  });

  it('turns its spore spiral slowly enough to ride a gap, in both phases', () => {
    spiralIsFair(NIHILEGO.spores.arms, NIHILEGO.spores.degPerSec, NIHILEGO.spores.spore.radius);
    spiralIsFair(NIHILEGO.spores.arms2, NIHILEGO.spores.degPerSec, NIHILEGO.spores.spore.radius);
    // Phase 2 spins back halfway: the arms return to where they started.
    const back = spiralDirs(vec(1, 0), 4, NIHILEGO.spores.degPerSec, NIHILEGO.spores.durationMs, NIHILEGO.spores.durationMs / 2)[0]!;
    const begin = spiralDirs(vec(1, 0), 4, NIHILEGO.spores.degPerSec, 0)[0]!;
    expect(back.x).toBeCloseTo(begin.x, 5);
    expect(back.y).toBeCloseTo(begin.y, 5);
  });

  it('throws evenly spaced shard rings whose gaps fit a player (one more ring on hard)', () => {
    const r = 120;
    expect((2 * Math.PI * r) / NIHILEGO.shards.perRing - 2 * NIHILEGO.shards.shard.radius).toBeGreaterThanOrEqual(2 * PLAYER_R + 10);
    expect(shardRings(NIHILEGO, 'normal')).toBe(3);
    expect(shardRings(NIHILEGO, 'hard')).toBe(4);
    const { state } = stepUntil(immortal(room('rift')), (s) => s.projectiles.filter((p) => p.type === 'rock').length >= 2 * NIHILEGO.shards.perRing, 8000);
    const shards = state.projectiles.filter((p) => p.type === 'rock');
    const angles = shards.map((p) => Math.atan2(p.vel.y, p.vel.x));
    const first = angles.slice(0, NIHILEGO.shards.perRing);
    const second = angles.slice(NIHILEGO.shards.perRing, 2 * NIHILEGO.shards.perRing);
    expect(second).toHaveLength(NIHILEGO.shards.perRing);
    // Evenly spaced rings: every gap the same.
    const gap = (2 * Math.PI) / NIHILEGO.shards.perRing;
    for (const ring of [first, second]) {
      for (let i = 1; i < ring.length; i++) expect(((ring[i]! - ring[i - 1]! + 4 * Math.PI) % (2 * Math.PI))).toBeCloseTo(gap, 4);
    }
  });

  it('opens the wormhole on the player but walking straight out beats its pull before it bites (rolling does not help)', () => {
    expect(NIHILEGO.wormhole.attack.pierceRoll).toBe(true);
    expect(NIHILEGO.wormhole.pullSpeed).toBeLessThan(SPEED / 2);
    const start = room('rift');
    const at = vec(380, 420);
    const placed: WorldState = { ...start, player: { ...start.player, pos: at } };
    const b = boss(placed);
    const opening: EnemyState = {
      ...b,
      boss: { ...b.boss!, stance: 'wormhole', comboIndex: 0, phase: 2 },
      ai: { ...b.ai, mode: 'telegraph', modeMs: 0, modeDurationMs: NIHILEGO.wormhole.telegraphMs, aimPoint: at, attackDir: vec(0, 1) },
    };
    const away: PlayerInput = { ...IDLE, move: vec(1, 0) };
    const { state, events } = stepUntil({ ...placed, enemies: [opening] }, (s) => boss(s).ai.mode === 'attack', 400, away);
    expect(distance(state.player.pos, at)).toBeGreaterThan(NIHILEGO.wormhole.radius + PLAYER_R);
    expect(distance(boss(state).pos, at)).toBeLessThan(1);
    const bitten = stepUntil(state, (s) => boss(s).ai.mode !== 'attack', 100, away).events;
    expect([...events, ...bitten].some((e) => e.type === 'playerHurt' && e.damage > 25)).toBe(false);
    // Standing still inside, it pulls and then bites.
    const still = stepUntil({ ...placed, player: { ...placed.player, pos: vec(at.x + 60, at.y) }, enemies: [opening] }, (s) => boss(s).ai.mode === 'attack', 400);
    expect(distance(still.state.player.pos, at)).toBeLessThan(60);
  });

  it('floods the rift except three pockets a player can always reach in time; rolling does not help', () => {
    expect(NIHILEGO.flood.attack.pierceRoll).toBe(true);
    const rift = ROOMS.rift;
    pocketsReachable(rift, FLOOD_GRID, (aim) => floodPockets(rift, aim), NIHILEGO.flood.pocketRadius, NIHILEGO.flood.telegraphMs);
  });

  it('rains a checkerboard of circles that always leaves the other half dry (nightmare)', () => {
    const rift = ROOMS.rift;
    const { cols, rows, radius } = NIHILEGO.downpour;
    for (const wave of [0, 1]) {
      const wet = downpourCircles(rift, cols, rows, wave);
      const dry = downpourCircles(rift, cols, rows, wave + 1);
      expect(wet.length + dry.length).toBe(cols * rows);
      for (const spot of dry) for (const c of wet) expect(distance(spot, c)).toBeGreaterThan(radius + PLAYER_R);
    }
  });

  it('keeps every telegraph of both bosses at 500 ms or more', () => {
    const telegraphs = [
      SALAZZLE.dance.telegraphMs,
      SALAZZLE.spiral.telegraphMs,
      SALAZZLE.haze.telegraphMs,
      SALAZZLE.escort.telegraphMs,
      NIHILEGO.tendrils.telegraphMs,
      NIHILEGO.spores.telegraphMs,
      NIHILEGO.shards.telegraphMs,
      NIHILEGO.wormhole.telegraphMs,
      NIHILEGO.flood.telegraphMs,
      NIHILEGO.downpour.telegraphMs,
    ];
    for (const ms of telegraphs) expect(ms).toBeGreaterThanOrEqual(500);
  });

  it('never lets more than the cap of enemy shots into the air, even on nightmare in phase 2', () => {
    const start = room('rift', 'nightmare');
    const awake: WorldState = { ...start, enemies: [{ ...boss(start), hp: boss(start).maxHp * 0.3 }] };
    const { maxShots } = playCards(awake, 12, 30000);
    expect(maxShots).toBeLessThanOrEqual(SWAMP_SHOT_CAP);
    const full: WorldState = { ...start, projectiles: Array.from({ length: SWAMP_SHOT_CAP }, (_, i) => ({ ...spawnCapped(start, boss(start), NIHILEGO.shards.shard, vec(1, 0)).projectiles[0]!, id: `x${i}` })) };
    expect(spawnCapped(full, boss(full), NIHILEGO.shards.shard, vec(1, 0)).projectiles).toHaveLength(SWAMP_SHOT_CAP);
  });

  it('hides behind crystal spires: they stop shards', () => {
    expect(ROOMS.rift.obstacles.filter((o) => o.cover)).toHaveLength(4);
    const start = room('rift');
    const spire = ROOMS.rift.obstacles[0]!;
    const shooter = { ...boss(start), pos: vec(spire.x + spire.width / 2, spire.y + spire.height + 60) };
    const fired = spawnCapped({ ...start, enemies: [{ ...shooter, alive: false }] }, shooter, NIHILEGO.shards.shard, vec(0, -1));
    const later = stepUntil(fired, () => false, 60).state;
    expect(later.projectiles).toHaveLength(0);
  });

  it("lands the flood on a guest outside the pockets, and spares one inside", () => {
    const start = room('rift');
    const aim = nearestSpot(pocketGrid(start.arena, FLOOD_GRID.cols, FLOOD_GRID.rows), vec(100, 100));
    const flooding: EnemyState = {
      ...boss(start),
      boss: { ...boss(start).boss!, stance: 'flood', comboIndex: 0, phase: 2 },
      ai: { ...boss(start).ai, mode: 'attack', modeMs: 10, modeDurationMs: NIHILEGO.flood.activeMs, contact: 'none', aimPoint: aim },
    };
    const guest = (pos: Vec2): WorldState => ({ ...start, role: 'guest', player: { ...start.player, pos }, enemies: [flooding] });
    expect(guestEnemyContacts(guest(vec(380, 300)), []).player.hp).toBeLessThan(start.player.hp);
    expect(guestEnemyContacts(guest(aim), []).player.hp).toBe(start.player.hp);
  });
});
