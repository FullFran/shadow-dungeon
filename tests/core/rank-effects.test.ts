import { describe, expect, it } from 'vitest';
import { spawnShot } from '../../src/core/brain';
import { rankedMove } from '../../src/core/rank-effects';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { hitPlayer, step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { MOVES, type MoveId } from '../../src/data/moves';
import { RANK_EFFECTS } from '../../src/data/rank-effects';
import type { SpeciesId } from '../../src/data/species';
import { IDLE } from './helpers';

/**
 * The tutor's rank effects (odd/tasks/move-progression.md T2): one test per
 * generic kind, on the real step. A world whose player has `ranks` on its moves.
 */
const world = (loadout: (MoveId | null)[], ranks: Partial<Record<MoveId, number>> = {}, species: SpeciesId = 'mimikyu', seed = 1): WorldState => {
  const w = createWorld({ seed, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species, moveRanks: ranks });
  return { ...w, player: { ...w.player, loadout, slotsHeld: loadout.map(() => false), disguiseBroken: true, illusionBroken: true } };
};

function runFor(state: WorldState, ms: number, input: PlayerInput = IDLE): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.ceil(ms / FIXED_DT_MS); i++) {
    current = step(current, input, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const press = (slot: number, aim: Vec2): PlayerInput => ({ ...IDLE, aim, slots: [0, 1, 2, 3].map((i) => i === slot), slotMouse: [0, 1, 2, 3].map((i) => i === slot) });
const moveTime = (id: MoveId) => MOVES[id].windupMs + MOVES[id].activeMs + MOVES[id].recoveryMs;

function use(state: WorldState, slot: number, aim: Vec2, extraMs = 3 * FIXED_DT_MS): { state: WorldState; events: GameEvent[] } {
  const id = state.player.loadout[slot]!;
  const pressed = runFor(state, FIXED_DT_MS, press(slot, aim));
  const after = runFor(pressed.state, moveTime(id) + extraMs, { ...IDLE, aim });
  return { state: after.state, events: [...pressed.events, ...after.events] };
}

/** Dormant, very tough dummies (they never fall, so no XP changes the numbers). */
function withDummies(state: WorldState, at: readonly Vec2[] = [vec(424, 300)], species: SpeciesId = 'gastly'): WorldState {
  let current: WorldState = { ...state, enemies: [] };
  for (const pos of at) current = spawnEnemy(current, species, pos, { dormant: true });
  return { ...current, enemies: current.enemies.map((e) => ({ ...e, hp: 9999, maxHp: 9999 })) };
}

const hits = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { type: 'enemyHit' }> => e.type === 'enemyHit');

describe('rank effects: numbers folded into the move', () => {
  it('crit, size, stagger, drain and homing change the ranked definition only', () => {
    expect(rankedMove('shadow-claw', 1).critBonus).toBeCloseTo(0.15);
    const sneak = rankedMove('shadow-sneak', 1).hitbox;
    expect(sneak.kind === 'dash' && sneak.radius).toBeCloseTo(16 * 1.25);
    expect(rankedMove('play-rough', 1).hitstunMs).toBeCloseTo(MOVES['play-rough'].hitstunMs * 1.3);
    expect(rankedMove('foul-play', 2).drain).toBeCloseTo(0.25);
    const hex = rankedMove('hex', 1).hitbox;
    expect(hex.kind === 'projectile' && hex.homing).toBe(120);
    // The plain move is untouched.
    expect(MOVES['shadow-claw'].critBonus).toBeUndefined();
  });

  it('a bigger hitbox reaches a target the plain move misses', () => {
    // Just past Dazzling Gleam's ring (58 px + the body), inside the ranked one (×1.2).
    const body = withDummies(world([null, null, null, null])).enemies[0]!.radius;
    const at = [vec(400 + 58 * 1.1 + body, 300)];
    const plain = use(withDummies(world([null, null, null, 'dazzling-gleam']), at), 3, at[0]!);
    const ranked = use(withDummies(world([null, null, null, 'dazzling-gleam'], { 'dazzling-gleam': 1 }), at), 3, at[0]!);
    expect(hits(plain.events)).toHaveLength(0);
    expect(hits(ranked.events).length).toBeGreaterThan(0);
  });
});

describe('rank effects: on-hit effects', () => {
  it('hits: a multi-hit move lands one more hit', () => {
    const count = (ranks: Partial<Record<MoveId, number>>) => hits(use(withDummies(world(['fury-swipes', null, null, null], ranks, 'zorua'), [vec(424, 300)], 'cubone'), 0, vec(424, 300)).events).length;
    const plain = count({});
    expect(plain).toBeGreaterThan(0);
    expect(count({ 'fury-swipes': 2 })).toBe(plain + 1);
  });

  it('dot: a sure burn always takes hold; a chance only sometimes (seeded)', () => {
    const sure = use(withDummies(world([null, 'inferno', null, null], { inferno: 1 }, 'litwick')), 1, vec(424, 300), 1200);
    expect(sure.state.enemies[0]!.dot?.kind).toBe('burn');
    let burned = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const used = use(withDummies(world(['ember', null, null, null], { ember: 1 }, 'litwick', seed)), 0, vec(424, 300), 400);
      if (used.state.enemies[0]!.dot) burned++;
    }
    expect(burned).toBeGreaterThan(0);
    expect(burned).toBeLessThan(12);
  });

  it('mark: the hit leaves a mark that bursts later for its share of the hit', () => {
    const used = use(withDummies(world(['shadow-claw', null, null, null], { 'shadow-claw': 2 })), 0, vec(424, 300));
    const first = hits(used.events)[0]!;
    expect(used.state.enemies[0]!.mark?.damage).toBe(Math.round(first.damage * 0.35));
    const later = runFor(used.state, 1300);
    const burst = hits(later.events).find((e) => e.burst);
    expect(burst?.damage).toBe(Math.round(first.damage * 0.35));
    expect(later.state.enemies[0]!.mark).toBeUndefined();
  });

  it('split: a shot bursts into smaller ones past its target, which they do not hit again', () => {
    const used = use(withDummies(world([null, 'shadow-ball', null, null], { 'shadow-ball': 2 }), [vec(470, 300)]), 1, vec(470, 300), 0);
    const children = used.state.projectiles.filter((p) => p.owner === 'player' && p.hitIds.includes(used.state.enemies[0]!.id));
    expect(children).toHaveLength(3);
    expect(children[0]!.power).toBe(Math.round(MOVES['shadow-ball'].power * 0.35));
    expect(new Set(children.map((c) => `${c.vel.x.toFixed(1)},${c.vel.y.toFixed(1)}`)).size).toBe(3);
  });

  it('weaken: the target deals less with its shots and its contact hits, then it wears off', () => {
    const used = use(withDummies(world([null, 'play-rough', null, null], { 'play-rough': 2 })), 1, vec(424, 300));
    const enemy = used.state.enemies[0]!;
    expect(enemy.weakened?.factor).toBe(0.7);
    const shot = spawnShot(used.state, enemy, { name: 'test', power: 40, type: 'ghost', windupMs: 0, speed: 100, radius: 5, lifetimeMs: 500 } as never, vec(1, 0));
    expect(shot.projectiles.at(-1)!.damageMultiplier).toBe(0.7);
    const worn = runFor(used.state, 4200);
    expect(worn.state.enemies[0]!.weakened).toBeUndefined();
  });

  it('zone (impact): an ember zone lingers where the shot landed and ticks quietly', () => {
    const used = use(withDummies(world(['ember', null, null, null], { ember: 2 }, 'litwick')), 0, vec(424, 300), 1600);
    const ticks = hits(used.events).filter((e) => e.minor);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.every((e) => e.moveId === undefined)).toBe(true);
  });

  it('zone (self): an aftershock hits again a moment after the move', () => {
    // The quake's knockback throws the dummy out: it is put back beside the player before the aftershock.
    const after = (ranks: Partial<Record<MoveId, number>>) => {
      const used = use(withDummies(world([null, null, null, 'earthquake'], ranks, 'cubone'), [vec(440, 300)]), 3, vec(440, 300), 0);
      const back = { ...used.state, enemies: used.state.enemies.map((e) => ({ ...e, pos: vec(440, 300), knockback: vec(0, 0) })) };
      return hits(runFor(back, 600).events);
    };
    expect(after({})).toHaveLength(0);
    const shock = after({ earthquake: 2 });
    expect(shock).toHaveLength(1);
    expect(shock[0]!.minor).toBe(true);
  });

  it('zone (line): a ranked Flamethrower leaves a flame line along its path', () => {
    const used = use(withDummies(world([null, null, null, 'flamethrower'], { flamethrower: 2 }, 'litwick'), [vec(700, 100)]), 3, vec(500, 300), 0);
    const zones = used.state.projectiles.filter((p) => p.zone);
    expect(zones.length).toBeGreaterThanOrEqual(3);
    expect(new Set(zones.map((z) => Math.round(z.pos.y))).size).toBe(1);
  });

  it('return: a ranked Bonemerang is thrown out again once it comes back', () => {
    const count = (ranks: Partial<Record<MoveId, number>>) =>
      hits(use(withDummies(world([null, 'bonemerang', null, null], ranks, 'cubone'), [vec(470, 300)]), 1, vec(470, 300), 2400).events).length;
    expect(count({})).toBe(2);
    expect(count({ bonemerang: 2 })).toBe(4);
  });

  it('chain: a hit jumps to the nearest other enemy in range, weaker, once', () => {
    const used = use(withDummies(world([null, 'thunderbolt', null, null], { thunderbolt: 2 }), [vec(470, 300), vec(470, 360), vec(700, 500)]), 1, vec(470, 300), 600);
    const all = hits(used.events);
    const [first, jump] = [all.find((e) => !e.minor)!, all.find((e) => e.minor)!];
    expect(jump.enemyId).toBe(used.state.enemies[1]!.id);
    expect(jump.damage).toBeLessThan(first.damage);
    expect(all.filter((e) => e.enemyId === used.state.enemies[2]!.id)).toHaveLength(0);
  });
});

describe('rank effects: on the user', () => {
  it('ward: super-armor from the move takes the edge off hits for a while', () => {
    const cast = use(world([null, null, 'swords-dance', null], { 'swords-dance': 2 }), 2, vec(424, 300), 0);
    expect(cast.state.player.ward?.damageTaken).toBe(0.6);
    const plainHit = hitPlayer(world([null, null, null, null]), { damage: 20 });
    const wardHit = hitPlayer(cast.state, { damage: 20 });
    expect(cast.state.player.hp - wardHit.player.hp).toBeLessThan(plainHit.player.maxHp - plainHit.player.hp);
    expect(runFor(cast.state, 3100).state.player.ward).toBeUndefined();
  });

  it('i-frames: an ordinary hit passes through the active phase of a ranked dash; a positional one does not', () => {
    const s = world(['shadow-sneak', null, null, null], { 'shadow-sneak': 2 });
    let current = runFor(s, FIXED_DT_MS, press(0, vec(500, 300))).state;
    while (current.player.action?.phase !== 'active') current = step(current, IDLE, FIXED_DT_MS);
    expect(hitPlayer(current, { damage: 20 }).player.hp).toBe(current.player.hp);
    expect(hitPlayer(current, { damage: 20, pierceRoll: true }).player.hp).toBeLessThan(current.player.hp);
    // Unranked: no i-frames.
    let plain = runFor(world(['shadow-sneak', null, null, null]), FIXED_DT_MS, press(0, vec(500, 300))).state;
    while (plain.player.action?.phase !== 'active') plain = step(plain, IDLE, FIXED_DT_MS);
    expect(hitPlayer(plain, { damage: 20 }).player.hp).toBeLessThan(plain.player.hp);
  });

  it('heal: a ranked Bulk Up heals a share of max HP as it takes hold', () => {
    const s = world([null, null, 'bulk-up', null], { 'bulk-up': 2 }, 'cubone');
    const hurt = { ...s, player: { ...s.player, hp: 20 } };
    const cast = use(hurt, 2, vec(424, 300), 0);
    expect(cast.state.player.hp).toBeCloseTo(20 + s.player.maxHp * 0.1, 5);
  });

  it('buff: a ranked Swords Dance powers one more hit', () => {
    const cast = use(world([null, null, 'swords-dance', null], { 'swords-dance': 1 }), 2, vec(424, 300), 0);
    expect(cast.state.player.buff?.hitsLeft).toBe(4);
    expect(RANK_EFFECTS['swords-dance'][0]).toEqual({ kind: 'buff', hits: 1 });
  });
});
