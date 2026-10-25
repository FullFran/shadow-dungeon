import { describe, expect, it } from 'vitest';
import { DHELMISE, LANTURN, spellCardKey, type DanmakuCard, type DanmakuDef } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { TUNING } from '../../src/data/tuning';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { danmakuCardAt, danmakuMelee, laneGap, laneShots, ringDirections, spiralDirections, sweepAngle } from '../../src/core/danmaku';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { withTricks } from '../../src/core/tricks';
import { angleOf, distance, fromAngle, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { loadRoom } from '../../src/core/rooms';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE, ticksFor } from './helpers';

const DEG = Math.PI / 180;
const PLAYER = vec(400, 450);

function arena(species: 'lanturn' | 'dhelmise', pos: Vec2 = vec(400, 220), difficulty?: WorldState['difficulty']): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 640 }, playerPos: PLAYER });
  const world = spawnEnemy(difficulty ? { ...base, difficulty } : base, species, pos);
  // Disguise spent so every hit shows as damage; HP high enough to take a whole fight.
  return { ...world, player: { ...world.player, disguiseBroken: true, hp: 1e6, maxHp: 1e6 } };
}

const boss = (state: WorldState): EnemyState => state.enemies[0]!;
const withEnemy = (state: WorldState, patch: (e: EnemyState) => EnemyState): WorldState => ({ ...state, enemies: [patch(boss(state))] });
const ready = (state: WorldState, combosDone = 0): WorldState => withEnemy(state, (e) => ({ ...e, ai: { ...e.ai, mode: 'approach', cooldownMs: 0 }, boss: { ...e.boss!, combosDone } }));

function run(state: WorldState, ticks: number, onTick?: (s: WorldState) => void) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    current = step(current, IDLE, FIXED_DT_MS);
    events.push(...current.events);
    onTick?.(current);
  }
  return { state: current, events };
}

const angleGap = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const allCards = (def: DanmakuDef): DanmakuCard[] => Object.keys(def.patterns) as DanmakuCard[];

describe('caves bosses: data', () => {
  it('names every card in both bosses and gives every card a telegraph of at least 500 ms on every tier', () => {
    for (const def of [LANTURN, DHELMISE]) {
      for (const tier of DIFFICULTIES) {
        const d = withTricks(def, tier);
        for (const card of allCards(d)) {
          expect(d.patterns[card]!.telegraphMs, card).toBeGreaterThanOrEqual(500);
          expect(d.cardNames[card], card).toBeTruthy();
        }
      }
    }
    expect(spellCardKey('lanturn', 'bubbles')).toBe('spell.lanturn.bubbles');
    expect(spellCardKey('dhelmise', 'riptide')).toBe('spell.dhelmise.riptide');
  });

  it('marks positional attacks that a roll does not escape: one on Lanturn, two on Dhelmise', () => {
    const piercing = (def: DanmakuDef) =>
      allCards(def).filter((c) => {
        const p = def.patterns[c]!.pattern;
        return (p.kind === 'zone' || p.kind === 'sweep') && p.attack.pierceRoll === true;
      });
    expect(piercing(LANTURN)).toEqual(['surge']);
    expect(piercing(DHELMISE).sort()).toEqual(['riptide', 'undertow']);
    // Long enough to walk out of: at least a second of warning.
    for (const [def, card] of [[LANTURN, 'surge'], [DHELMISE, 'riptide'], [DHELMISE, 'undertow']] as const) expect(def.patterns[card]!.telegraphMs).toBeGreaterThanOrEqual(1000);
  });

  it('gives both arenas cover, and the grotto a way on', () => {
    expect(ROOMS.grotto.obstacles.every((o) => o.cover)).toBe(true);
    expect(ROOMS.wreck.obstacles.every((o) => o.cover)).toBe(true);
    expect(ROOMS.wreck.obstacles.some((o) => o.width > o.height * 1.8)).toBe(true);
    expect(ROOMS.wreck.exit).toBeNull();
  });

  it('adds a trick from hard on and a card on nightmare, leaving easy as written', () => {
    expect(withTricks(LANTURN, 'easy')).toBe(LANTURN);
    expect(withTricks(LANTURN, 'normal')).toBe(LANTURN);
    const lure = (d: DanmakuDef) => d.patterns.lure!.pattern;
    expect(lure(LANTURN)).toMatchObject({ arms: 2 });
    expect(lure(withTricks(LANTURN, 'hard'))).toMatchObject({ arms: 3 });
    expect(withTricks(LANTURN, 'hard').cards).toEqual(LANTURN.cards);
    expect(withTricks(LANTURN, 'nightmare').cards).toContain('deep');
    expect(withTricks(DHELMISE, 'hard').patterns.whirlpool!.pattern).toMatchObject({ arms: 3 });
    expect(withTricks(DHELMISE, 'nightmare').phase2!.cards).toContain('maelstrom');
    expect(DHELMISE.phase2!.cards).not.toContain('maelstrom');
  });
});

describe('caves bosses: safe paths', () => {
  it('leaves a gap in every ring wide enough for the player, facing the player on the first ring', () => {
    const aim = vec(0, 1);
    for (const def of [LANTURN, DHELMISE, withTricks(LANTURN, 'nightmare')]) {
      for (const card of allCards(def)) {
        const p = def.patterns[card]!.pattern;
        if (p.kind !== 'rings') continue;
        for (let i = 0; i < p.rings; i++) {
          const centre = angleOf(aim) + i * p.gapTurnDeg * DEG;
          const nearest = Math.min(...ringDirections(aim, p.perRing, p.gap, p.gapTurnDeg, i).map((d) => angleGap(angleOf(d), centre)));
          const halfGap = nearest - (p.shot.radius / 60);
          // At 60 px out the gap still fits a player with room to spare.
          expect(2 * halfGap * 60, `${card} ring ${i}`).toBeGreaterThan(2 * (TUNING.player.radius + p.shot.radius));
        }
      }
    }
  });

  it('spaces spiral arms evenly', () => {
    const dirs = spiralDirections(vec(1, 0), 3, 13, 4);
    expect(angleGap(angleOf(dirs[0]!), angleOf(dirs[1]!))).toBeCloseTo(120 * DEG);
    expect(angleGap(angleOf(dirs[0]!), 4 * 13 * DEG)).toBeCloseTo(0);
  });

  it('keeps the kelp lane clear, wide enough, inside the arena and shifting every other wave', () => {
    const p = DHELMISE.patterns.kelp!.pattern;
    if (p.kind !== 'lanes') throw new Error('kelp is a lane card');
    expect(p.gapWidth).toBeGreaterThan(2 * (TUNING.player.radius + p.shot.radius) + 30);
    for (const markX of [0, 100, 440, 800, 880]) {
      for (let wave = 0; wave < p.waves; wave++) {
        const gap = laneGap(880, markX, p.gapWidth, p.shiftPx, wave);
        expect(gap - p.gapWidth / 2).toBeGreaterThanOrEqual(0);
        expect(gap + p.gapWidth / 2).toBeLessThanOrEqual(880);
        for (const x of laneShots(880, gap, p.gapWidth, p.spacing)) expect(Math.abs(x - gap)).toBeGreaterThan(p.gapWidth / 2);
      }
    }
    expect(laneGap(880, 200, p.gapWidth, p.shiftPx, 1)).not.toBe(laneGap(880, 200, p.gapWidth, p.shiftPx, 0));
  });

  it('stops firing at the cap when the room is already full of shots', () => {
    const start = ready(arena('lanturn'));
    const filler = Array.from({ length: LANTURN.maxShots - 5 }, (_, i) => ({
      id: `x${i}`, owner: 'enemy' as const, type: 'water' as const, attackerTypes: [], power: 1, damageMultiplier: 1,
      pos: vec(20 + i, 20), vel: vec(0, 0), radius: 2, remainingMs: 60000, hitstunMs: 0, knockback: 0, hitIds: [],
    }));
    const full = { ...start, projectiles: filler };
    const { state } = run(full, ticksFor(LANTURN.patterns.bubbles!.telegraphMs + 40));
    expect(state.projectiles.filter((p) => p.owner === 'enemy').length).toBe(LANTURN.maxShots);
  });

  it('never holds more enemy shots than the cap through a whole fight', () => {
    for (const [species, def] of [['lanturn', LANTURN], ['dhelmise', DHELMISE]] as const) {
      let most = 0;
      run(ready(arena(species)), ticksFor(30000), (s) => {
        most = Math.max(most, s.projectiles.filter((p) => p.owner === 'enemy').length);
      });
      expect(most, species).toBeGreaterThan(20);
      expect(most, species).toBeLessThanOrEqual(def.maxShots);
    }
  });
});

describe('caves bosses: cards', () => {
  it('Lanturn plays its cards in order, each with its name on the boss state, resting in between', () => {
    const { events } = run(ready(arena('lanturn')), ticksFor(20000));
    const stances = events.filter((e) => e.type === 'bossStance').map((e) => (e as { stance: string }).stance);
    expect(stances.slice(0, 4)).toEqual(['bubbles', 'lure', 'surge', 'bubbles']);
  });

  it('the first bubble ring opens towards the player', () => {
    const { state } = run(ready(arena('lanturn')), ticksFor(LANTURN.patterns.bubbles!.telegraphMs + 40));
    const toPlayer = angleOf(vec(PLAYER.x - 400, PLAYER.y - 220));
    const shots = state.projectiles.filter((p) => p.owner === 'enemy');
    expect(shots.length).toBe(20 - 3);
    for (const p of shots) expect(angleGap(angleOf(p.vel), toPlayer)).toBeGreaterThan(20 * DEG);
  });

  it('Lanturn\'s surge hits inside its circle and not outside it', () => {
    const surge = (playerPos: Vec2) => {
      const start = ready(arena('lanturn'), 2);
      const placed = { ...start, player: { ...start.player, pos: playerPos } };
      return run(placed, ticksFor(LANTURN.patterns.surge!.telegraphMs + 400)).events.some((e) => e.type === 'playerHurt');
    };
    expect(surge(vec(400, 300))).toBe(true);
    expect(surge(vec(400, 560))).toBe(false);
  });

  it('Dhelmise\'s anchor sweeps the front and never the open quarter behind it', () => {
    const p = DHELMISE.patterns.undertow!.pattern;
    if (p.kind !== 'sweep') throw new Error('undertow is a sweep');
    const at = vec(400, 220);
    const enemy = (modeMs: number): EnemyState => ({ ...boss(arena('dhelmise')), pos: at, ai: { ...boss(arena('dhelmise')).ai, mode: 'attack', modeMs, modeDurationMs: p.sweepMs, attackDir: vec(0, 1) }, boss: { ...boss(arena('dhelmise')).boss!, stance: 'undertow' } });
    const hitsAt = (player: Vec2) => Array.from({ length: 46 }, (_, i) => danmakuMelee(enemy((i * p.sweepMs) / 45), DHELMISE, player)!.touches).some(Boolean);
    expect(hitsAt(vec(400, 320))).toBe(true);
    expect(hitsAt(vec(400, 120))).toBe(false);
    expect(hitsAt(vec(400, 400))).toBe(false);
    expect(sweepAngle(vec(0, 1), 270, 900, 0)).toBeCloseTo(angleOf(vec(0, 1)) - 135 * DEG);
  });

  it('Riptide\'s mark follows the player, then locks; Dhelmise surfaces on it and bursts there', () => {
    const p = DHELMISE.patterns.riptide!;
    const zone = p.pattern;
    if (zone.kind !== 'zone') throw new Error('riptide is a zone');
    const start = withEnemy(ready(arena('dhelmise')), (e) => ({ ...e, boss: { ...e.boss!, phase: 2 } }));
    let state = run(start, 2).state;
    expect(boss(state).boss!.stance).toBe('riptide');
    const dodge = vec(PLAYER.x + 160, PLAYER.y);
    state = run(state, ticksFor(p.telegraphMs - zone.lockMs - 100)).state;
    expect(distance(boss(state).ai.aimPoint!, PLAYER)).toBeLessThan(1);
    state = run(state, ticksFor(200)).state;
    // Locked: walking away no longer drags the mark.
    state = { ...state, player: { ...state.player, pos: dodge } };
    const mark = boss(state).ai.aimPoint!;
    const after = run(state, ticksFor(zone.lockMs));
    expect(distance(boss(after.state).ai.aimPoint!, mark)).toBeLessThan(1e-6);
    expect(distance(boss(after.state).pos, mark)).toBeLessThan(1);
    expect(after.events.some((e) => e.type === 'playerHurt')).toBe(false);
  });

  it('awakens once at half HP, between cards, then plays its phase-2 order', () => {
    const start = withEnemy(ready(arena('dhelmise')), (e) => ({ ...e, hp: e.maxHp * 0.49 }));
    const { state, events } = run(start, ticksFor(9000));
    const stances = events.filter((e) => e.type === 'bossStance').map((e) => (e as { stance: string }).stance);
    expect(stances[0]).toBe('awaken');
    expect(stances.filter((s) => s === 'awaken')).toHaveLength(1);
    expect(stances[1]).toBe(DHELMISE.phase2!.cards[0]);
    expect(boss(state).boss!.phase).toBe(2);
    expect(danmakuCardAt(DHELMISE, { phase: 2, combosDone: 1 })).toBe('kelp');
    expect(danmakuCardAt(DHELMISE, { combosDone: 1 })).toBe('whirlpool');
  });

  it('a guest feels the anchor on its own player from the snapshot fields alone', () => {
    const p = DHELMISE.patterns.undertow!.pattern;
    if (p.kind !== 'sweep') throw new Error('undertow is a sweep');
    const base = arena('dhelmise');
    const guest: WorldState = {
      ...base,
      role: 'guest',
      player: { ...base.player, pos: vec(400, 330) },
      enemies: [{ ...boss(base), ai: { ...boss(base).ai, mode: 'attack', modeMs: p.sweepMs / 2, modeDurationMs: p.sweepMs, attackDir: vec(0, 1), contact: 'none' }, boss: { ...boss(base).boss!, stance: 'undertow' } }],
    };
    const events: GameEvent[] = [];
    guestEnemyContacts(guest, events);
    expect(events.some((e) => e.type === 'playerHurt')).toBe(true);
  });

  it('plays the fight in its arena: Lanturn in the grotto, Dhelmise on the wreck', () => {
    const grotto = loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), 'grotto');
    expect(boss(grotto).species).toBe('lanturn');
    expect(boss(grotto).boss?.stance).toBe('bubbles');
    const wreck = loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), 'wreck');
    expect(boss(wreck).boss?.stance).toBe('undertow');
    expect(fromAngle(0).x).toBe(1);
  });
});
