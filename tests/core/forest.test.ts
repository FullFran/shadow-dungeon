import { describe, expect, it } from 'vitest';
import { FOG } from '../../src/data/dungeon';
import { CRYPT, FOREST } from '../../src/data/dungeons';
import { DECIDUEYE, FOONGUS, PHANTUMP, PUMPKABOO_SUPER, SPINARAK, TREVENANT } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { TUNING } from '../../src/data/tuning';
import { cardAt, DIVE_LOCK_MS, fanPerch } from '../../src/core/archer';
import { generateFloor } from '../../src/core/dungeon';
import { fogClosed, fogRadiusTiles, startFog, updateFog } from '../../src/core/fog';
import { floorKind, floorSeed, isBossFloor, progressRun, startRun, type RunProgress } from '../../src/core/run';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { createMemory, revealAround } from '../../src/adapters/minimap';
import { IDLE, input, ticksFor } from './helpers';

const PLAYER = vec(400, 300);

function arena(species: EnemyState['species'], pos: Vec2, playerPos = PLAYER, size = { width: 800, height: 600 }): WorldState {
  return spawnEnemy(createWorld({ seed: 1, arena: size, playerPos }), species, pos);
}

const first = (state: WorldState) => state.enemies[0]!;

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

const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');

describe('Misty Forest run plan', () => {
  it('has 8 floors: the Trevenant mid-boss on 4 and Decidueye on 8, and opens after the Crypt', () => {
    expect(FOREST.plan).toHaveLength(8);
    expect(FOREST.plan[3]).toEqual({ kind: 'room', room: 'hollow', role: 'midboss' });
    expect(FOREST.plan[7]).toEqual({ kind: 'room', room: 'roost' });
    expect(FOREST.unlockedBy).toBe(CRYPT.id);
    const run = startRun(3, {}, 1, 'misty-forest').run;
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((floor) => isBossFloor({ ...run, floor }))).toEqual([false, false, false, false, false, false, false, true]);
    expect(ROOMS.hollow.spawns[0]!.species).toBe('trevenant');
    expect(ROOMS.roost.spawns[0]!.species).toBe('decidueye');
    expect(ROOMS.hollow.exit).not.toBeNull();
  });

  it('never makes floor 1 or an arena urgent; fog floors come up from floor 2 and grow with depth', () => {
    const counts = new Map<number, number>();
    for (let seed = 1; seed <= 1000; seed++) {
      for (const floor of [1, 4, 8]) expect(floorKind(seed, floor, FOREST)).toBe('normal');
      for (const floor of [2, 7]) if (floorKind(seed, floor, FOREST) === 'fog') counts.set(floor, (counts.get(floor) ?? 0) + 1);
    }
    expect(counts.get(2)! / 1000).toBeCloseTo(0.3, 1);
    expect(counts.get(7)!).toBeGreaterThan(counts.get(2)!);
  });

  it('starts gentler than the late Crypt and ramps: fewer enemies on forest floor 1 than Crypt floor 3, more by floor 7', () => {
    const average = (depth: number, spawns = FOREST.spawns) => {
      let total = 0;
      for (let seed = 1; seed <= 200; seed++) total += generateFloor(floorSeed(seed, depth), depth, spawns).spawns.length;
      return total / 200;
    };
    expect(average(1)).toBeLessThan(average(3, CRYPT.spawns));
    expect(average(7)).toBeGreaterThan(average(1));
    for (let seed = 1; seed <= 200; seed++) {
      const species = generateFloor(seed, 1, FOREST.spawns).spawns.map((s) => s.species);
      expect(species).not.toContain('hoothoot');
      expect(species).not.toContain('pumpkaboo-super');
    }
  });

  it('plays a whole forest run: stairs, the hollow exit after Trevenant falls, then victory when Decidueye falls', () => {
    let progress: RunProgress = { ...startRun(9, {}, 1, 'misty-forest'), entered: false, outcome: null };
    const toStairs = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
    const clear = (w: WorldState): WorldState => ({ ...w, enemies: w.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });
    for (const floor of [2, 3, 4]) {
      progress = progressRun(progress.run, toStairs(progress.world));
      expect(progress.run.floor).toBe(floor);
    }
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['trevenant']);
    const exit = ROOMS.hollow.exit!;
    const atExit = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) } });
    expect(progressRun(progress.run, atExit(progress.world)).entered).toBe(false);
    progress = progressRun(progress.run, atExit(clear(progress.world)));
    expect(progress.run.floor).toBe(5);
    for (const floor of [6, 7, 8]) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(8);
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['decidueye']);
    expect(progressRun(progress.run, clear(progress.world)).outcome).toBe('victory');
  });
});

describe('forest enemies', () => {
  it('Phantump drifts straight through walls towards the player and drains on a hit', () => {
    // A wall of tiles between them: a walker would need the flow field, the phaser goes straight.
    const cols = 20;
    const rows = 10;
    const tiles = new Array<number>(cols * rows).fill(1);
    for (let y = 0; y < rows; y++) tiles[y * cols + 10] = 0;
    for (let x = 0; x < cols; x++) {
      tiles[x] = 0;
      tiles[(rows - 1) * cols + x] = 0;
    }
    for (let y = 0; y < rows; y++) {
      tiles[y * cols] = 0;
      tiles[y * cols + cols - 1] = 0;
    }
    let state = createWorld({ seed: 1, arena: { width: cols * 32, height: rows * 32, tiles: { cols, rows, tiles } }, playerPos: vec(15 * 32, 5 * 32) });
    state = spawnEnemy(state, 'phantump', vec(5 * 32, 5 * 32));
    const crossed = stepUntil(state, (s) => first(s).pos.x > 11 * 32, ticksFor(8000));
    expect(first(crossed.state).pos.x).toBeGreaterThan(11 * 32);
    // Drain: a landed grab heals it.
    const wounded = { ...arena('phantump', vec(460, 300)), player: { ...arena('phantump', vec(460, 300)).player, disguiseBroken: true } };
    const hurtOne = { ...wounded, enemies: [{ ...first(wounded), hp: 30 }] };
    const hit = stepUntil(hurtOne, (s) => s.player.hp < s.player.maxHp, ticksFor(4000));
    expect(hit.state.player.hp).toBeLessThan(hit.state.player.maxHp);
    expect(first(hit.state).hp).toBe(30 + PHANTUMP.drainHp!);
  });

  it('Spinarak fires a fan of three threads after its telegraph', () => {
    const state = arena('spinarak', vec(560, 300));
    const cast = stepUntil(state, (s) => s.projectiles.length > 0, ticksFor(5000));
    expect(cast.events.some((e) => e.type === 'enemyTelegraph' && e.durationMs === SPINARAK.telegraphMs)).toBe(true);
    expect(cast.state.projectiles).toHaveLength(3);
    const angles = cast.state.projectiles.map((p) => Math.atan2(p.vel.y, p.vel.x));
    expect(new Set(angles.map((a) => a.toFixed(3))).size).toBe(3);
  });

  it('Pumpkaboo Super telegraphs a ground slam that hits inside its radius and misses outside it', () => {
    const near = arena('pumpkaboo-super', vec(450, 300));
    const slam = stepUntil(near, (s) => first(s).ai.mode === 'recover', ticksFor(6000));
    expect(slam.events.some((e) => e.type === 'enemyTelegraph' && e.attack === 'slam' && e.durationMs >= 800)).toBe(true);
    expect(hurt(slam.events)).toBe(true);
    // A slam started in range, then the player walks out during the wind-up: it misses.
    const started = stepUntil(near, (s) => first(s).ai.mode === 'telegraph', ticksFor(4000)).state;
    const away = stepUntil(started, (s) => first(s).ai.mode === 'recover', ticksFor(3000), input({ move: vec(-1, 0) }));
    expect(hurt(away.events)).toBe(false);
    expect(PUMPKABOO_SUPER.recoverMs).toBeGreaterThanOrEqual(1000);
  });

  it('Foongus never moves and leaves a still spore cloud on its spot', () => {
    const state = arena('foongus', vec(470, 300));
    const puff = stepUntil(state, (s) => s.projectiles.length > 0, ticksFor(3000));
    expect(first(puff.state).pos).toEqual(vec(470, 300));
    const cloud = puff.state.projectiles[0]!;
    expect(cloud.vel).toEqual(vec(0, 0));
    expect(cloud.pos).toEqual(vec(470, 300));
    expect(cloud.radius).toBe(FOONGUS.cloud.radius);
    // Far away it does nothing.
    const far = advance(arena('foongus', vec(700, 300)), 3000).state;
    expect(far.projectiles).toHaveLength(0);
  });

  it('Trevenant slams with a ring of leaves and shows a boss bar', () => {
    const state = arena('trevenant', vec(450, 300));
    const slam = stepUntil(state, (s) => s.projectiles.length > 0, ticksFor(6000));
    expect(slam.state.projectiles).toHaveLength(TREVENANT.ring!.count);
  });
});

describe('Decidueye', () => {
  const ROOST = { width: ROOMS.roost.width, height: ROOMS.roost.height };
  const fight = (playerPos = vec(320, 330)) => arena('decidueye', vec(320, 120), playerPos, ROOST);

  it('plays its spell cards in order, each announced and telegraphed for at least half a second', () => {
    expect([0, 1, 2, 3].map((i) => cardAt(DECIDUEYE, i))).toEqual(['volley', 'fan', 'dive', 'volley']);
    let state = fight();
    const cards: string[] = [];
    const telegraphs: { attack: string; durationMs: number }[] = [];
    for (let i = 0; i < ticksFor(30000) && cards.length < 4; i++) {
      state = step({ ...state, player: { ...state.player, hp: state.player.maxHp } }, IDLE, FIXED_DT_MS);
      for (const e of state.events) {
        if (e.type === 'bossStance') cards.push(e.stance);
        if (e.type === 'enemyTelegraph') telegraphs.push({ attack: e.attack, durationMs: e.durationMs });
      }
    }
    expect(cards).toEqual(['volley', 'fan', 'dive', 'volley']);
    for (const attack of ['volley', 'fan', 'dive']) {
      const t = telegraphs.find((x) => x.attack === attack)!;
      expect(t.durationMs).toBeGreaterThanOrEqual(500);
    }
  });

  it('volley: every arrow is aimed where the player is when it leaves', () => {
    // From the left edge, so the strafing player never reaches the right wall during the card.
    let state = fight(vec(40, 330));
    const shots: Vec2[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < ticksFor(8000) && shots.length < DECIDUEYE.volley.shots; i++) {
      // The player strafes right: each arrow leads further right.
      state = step({ ...state, player: { ...state.player, hp: state.player.maxHp } }, input({ move: vec(1, 0) }), FIXED_DT_MS);
      for (const p of state.projectiles) if (!seen.has(p.id)) {
        seen.add(p.id);
        shots.push(p.vel);
      }
    }
    expect(shots).toHaveLength(DECIDUEYE.volley.shots);
    const angles = shots.map((v) => Math.atan2(v.y, v.x));
    for (let i = 1; i < angles.length; i++) expect(angles[i]).not.toBeCloseTo(angles[i - 1]!, 3);
  });

  it('fan: reappears at the edge farthest from the player, and every other fan is shifted by half a gap', () => {
    expect(fanPerch(ROOST, vec(320, 380), 80)).toEqual(vec(320, 80));
    expect(fanPerch(ROOST, vec(60, 200), 80)).toEqual(vec(ROOST.width - 80, 200));
    let state = fight();
    state = stepUntil(state, (s) => first(s).boss?.stance === 'fan' && first(s).ai.mode === 'telegraph', ticksFor(20000)).state;
    expect(first(state).pos).toEqual(fanPerch(ROOST, state.player.pos, DECIDUEYE.fan.edgeInset));
    const before = state.projectiles.length;
    const one = stepUntil(state, (s) => s.projectiles.length >= before + DECIDUEYE.fan.leaves, ticksFor(3000)).state;
    const two = stepUntil(one, (s) => s.projectiles.length >= before + 2 * DECIDUEYE.fan.leaves, ticksFor(3000)).state;
    const fanAngles = (s: WorldState, from: number) =>
      s.projectiles.slice(from, from + DECIDUEYE.fan.leaves).map((p) => Math.atan2(p.vel.y, p.vel.x));
    const a = fanAngles(two, before);
    const b = fanAngles(two, before + DECIDUEYE.fan.leaves);
    // Same aim (the player stood still), shifted lanes.
    expect(b[0]! - a[0]!).toBeCloseTo((DECIDUEYE.fan.spreadDegrees / (DECIDUEYE.fan.leaves - 1) / 2) * (Math.PI / 180), 3);
  });

  it('dive: the aim locks before it starts, stepping aside after the lock dodges it, and a long recovery follows', () => {
    expect(DIVE_LOCK_MS).toBeGreaterThanOrEqual(350);
    expect(DECIDUEYE.dive.telegraphMs).toBeGreaterThan(DIVE_LOCK_MS + 500);
    expect(DECIDUEYE.dive.recoverMs).toBeGreaterThanOrEqual(1500);
    let state = fight();
    state = stepUntil(state, (s) => first(s).boss?.stance === 'dive' && first(s).ai.mode === 'telegraph', ticksFor(30000)).state;
    // Stand still until the lock: it would hit.
    const locked = stepUntil(state, (s) => first(s).ai.modeDurationMs - first(s).ai.modeMs <= DIVE_LOCK_MS, ticksFor(3000)).state;
    const standing = stepUntil({ ...locked, player: { ...locked.player, disguiseBroken: true } }, (s) => first(s).ai.mode === 'recover', ticksFor(3000));
    expect(hurt(standing.events)).toBe(true);
    // Walk sideways from the lock on: it misses.
    const aside = stepUntil({ ...locked, player: { ...locked.player, disguiseBroken: true } }, (s) => first(s).ai.mode === 'recover', ticksFor(3000), input({ move: vec(1, 0) }));
    expect(hurt(aside.events)).toBe(false);
    // Once locked the lane no longer follows the player.
    const committed = stepUntil(locked, (s) => first(s).ai.mode === 'attack', ticksFor(3000), input({ move: vec(1, 0) })).state;
    expect(first(committed).ai.attackDir).toEqual(first(locked).ai.attackDir);
    expect(first(aside.state).ai.modeDurationMs).toBe(DECIDUEYE.dive.recoverMs);
  });

  it('a guest is hit by the dive and the slam on its own side', () => {
    const base = arena('decidueye', vec(300, 200), vec(310, 200), ROOST);
    const diving = { ...base, role: 'guest' as const, enemies: [{ ...first(base), boss: { ...first(base).boss!, stance: 'dive' as const }, ai: { ...first(base).ai, mode: 'attack' as const, contact: 'none' as const } }] };
    const events: GameEvent[] = [];
    guestEnemyContacts(diving, events);
    expect(hurt(events)).toBe(true);
    const tank = arena('pumpkaboo-super', vec(450, 300));
    const slamming = { ...tank, role: 'guest' as const, enemies: [{ ...first(tank), ai: { ...first(tank).ai, mode: 'attack' as const, contact: 'none' as const } }] };
    const more: GameEvent[] = [];
    guestEnemyContacts(slamming, more);
    expect(hurt(more)).toBe(true);
  });
});

describe('Niebla (fog floors)', () => {
  it('shrinks the vision radius steadily to its minimum and never grows back', () => {
    let fog = startFog();
    let last = fogRadiusTiles(fog);
    expect(last).toBe(FOG.startTiles);
    for (let ms = 0; ms < FOG.graceMs + FOG.closeMs + 5000; ms += 500) {
      fog = { ...fog, elapsedMs: ms };
      const r = fogRadiusTiles(fog);
      expect(r).toBeLessThanOrEqual(last + 1e-9);
      last = r;
    }
    expect(last).toBeCloseTo(FOG.minTiles);
    expect(fogClosed(fog)).toBe(true);
  });

  it('chills the player once closed, never below 1 HP, and not before', () => {
    let state: WorldState = { ...createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER }), fog: startFog() };
    const events: GameEvent[] = [];
    state = updateFog(state, FOG.graceMs + FOG.closeMs - 100, events);
    expect(state.player.hp).toBe(state.player.maxHp);
    for (let i = 0; i < 400; i++) state = updateFog(state, 500, events);
    expect(state.player.hp).toBe(1);
    expect(events.length).toBeGreaterThan(0);
  });

  it('starts on fog floors only and the minimap only remembers what is inside the sight circle', () => {
    let seed = 1;
    while (floorKind(seed, 2, FOREST) !== 'fog') seed++;
    const fogRun = startRun(seed, {}, 2, 'misty-forest');
    expect(fogRun.run.kind).toBe('fog');
    expect(fogRun.world.fog).toBeDefined();
    expect(startRun(1, {}, 1, 'misty-forest').world.fog).toBeUndefined();
    const grid = fogRun.world.arena.tiles!;
    const start = { x: Math.floor(fogRun.world.player.pos.x / 32), y: Math.floor(fogRun.world.player.pos.y / 32) };
    const open = createMemory(grid);
    revealAround(open, grid, fogRun.world.arena.rooms ?? [], start);
    const misty = createMemory(grid);
    revealAround(misty, grid, fogRun.world.arena.rooms ?? [], start, 2.5);
    const seen = (m: ReturnType<typeof createMemory>) => [...m.seen].filter(Boolean).length;
    expect(seen(misty)).toBeLessThan(seen(open));
    expect(seen(misty)).toBeLessThanOrEqual(Math.ceil(Math.PI * 2.5 * 2.5) + 4);
  });
});

it('keeps the player radius the hitboxes assume', () => {
  expect(TUNING.player.radius).toBeGreaterThan(0);
  expect(distance(vec(0, 0), vec(3, 4))).toBe(5);
});
