import { describe, expect, it } from 'vitest';
import { CRYPT_SPAWNS } from '../../src/data/dungeon';
import { CRYPT } from '../../src/data/dungeons';
import { DUSKULL, GOLETT, PAWNIARD, SABLEYE, spellCardKey } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { generateFloor } from '../../src/core/dungeon';
import { progressRun, startRun, type RunProgress } from '../../src/core/run';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { returnStolen, settleStolen, stealItem } from '../../src/core/stolen';
import { blinkSpot, ringOffset, thiefCardAt } from '../../src/core/thief';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, normalize, sub, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld, enterRoom, spawnEnemy } from '../../src/core/world';
import { IDLE, ticksFor, openGate } from './helpers';

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

const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');
/** Disguise spent so every hit shows as damage. */
const exposed = (state: WorldState): WorldState => ({ ...state, player: { ...state.player, disguiseBroken: true } });
const angle = (v: Vec2) => Math.atan2(v.y, v.x);

describe('the remastered Crypt run', () => {
  it('plays through: stairs, the vault exit once Sableye falls (a mid-boss), stairs, then victory on Aegislash', () => {
    let progress: RunProgress = { ...startRun(11, {}), entered: false, outcome: null };
    const toStairs = (w: WorldState): WorldState => ({ ...openGate(w), player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
    const clear = (w: WorldState): WorldState => ({ ...w, enemies: w.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });
    for (const floor of [2, 3]) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(3);
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['sableye']);
    expect(CRYPT.plan[2]).toEqual({ kind: 'room', room: 'vault', role: 'midboss' });
    const exit = ROOMS.vault.exit!;
    const atExit = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) } });
    expect(progressRun(progress.run, atExit(progress.world)).entered).toBe(false);
    progress = progressRun(progress.run, atExit(clear(progress.world)));
    expect(progress.run.floor).toBe(4);
    for (const floor of [5, 6]) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(6);
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['aegislash']);
    expect(progressRun(progress.run, clear(progress.world)).outcome).toBe('victory');
  });

  it('places Pawniard in pairs', () => {
    expect(CRYPT_SPAWNS.pool.find((e) => e.species === 'pawniard')?.pack).toBe(2);
    let paired = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const floor = generateFloor(seed, 4);
      const rooms = new Map<number, number>();
      for (const s of floor.spawns) if (s.species === 'pawniard') rooms.set(s.room, (rooms.get(s.room) ?? 0) + 1);
      if ([...rooms.values()].some((n) => n >= 2)) paired += 1;
    }
    expect(paired).toBeGreaterThan(10);
  });
});

describe('crypt enemies', () => {
  it('Duskull drifts straight through walls towards the player', () => {
    const cols = 20;
    const rows = 10;
    const tiles = new Array<number>(cols * rows).fill(1);
    for (let y = 0; y < rows; y++) {
      tiles[y * cols + 10] = 0;
      tiles[y * cols] = 0;
      tiles[y * cols + cols - 1] = 0;
    }
    for (let x = 0; x < cols; x++) {
      tiles[x] = 0;
      tiles[(rows - 1) * cols + x] = 0;
    }
    let state = createWorld({ seed: 1, arena: { width: cols * 32, height: rows * 32, tiles: { cols, rows, tiles } }, playerPos: vec(17 * 32, 5 * 32) });
    state = spawnEnemy(state, 'duskull', vec(4 * 32, 5 * 32));
    const crossed = stepUntil(state, (s) => first(s).pos.x > 11 * 32, ticksFor(15000));
    expect(first(crossed.state).pos.x).toBeGreaterThan(11 * 32);
  });

  it('Duskull telegraphs, then its will-o-wisp bends towards the player for a while and then flies straight', () => {
    const cast = stepUntil(arena('duskull', vec(560, 300)), (s) => s.projectiles.length > 0, ticksFor(6000));
    expect(cast.events.some((e) => e.type === 'enemyTelegraph' && e.durationMs === DUSKULL.telegraphMs)).toBe(true);
    const wisp = cast.state.projectiles[0]!;
    expect(wisp.type).toBe('fire');
    expect(wisp.steer).toEqual(DUSKULL.projectile.steer);
    // The player steps far to the side: the wisp turns after it.
    const moved = { ...cast.state, player: { ...cast.state.player, pos: vec(cast.state.player.pos.x, 520) } };
    const later = stepUntil(moved, () => false, ticksFor(600)).state.projectiles.find((p) => p.id === wisp.id)!;
    const toPlayer = normalize(sub(moved.player.pos, later.pos));
    const before = Math.abs(angle(wisp.vel) - angle(normalize(sub(moved.player.pos, wisp.pos))));
    const after = Math.abs(angle(later.vel) - angle(toPlayer));
    expect(after).toBeLessThan(before);
    // Steering wears off: no steer left, the velocity no longer changes.
    const done = stepUntil(moved, () => false, ticksFor(DUSKULL.projectile.steer!.ms + 100)).state.projectiles.find((p) => p.id === wisp.id)!;
    expect(done.steer).toBeUndefined();
    const straight = stepUntil({ ...moved, projectiles: [done] }, () => false, ticksFor(300)).state.projectiles[0]!;
    expect(straight.vel).toEqual(done.vel);
  });

  it('Golett slams in front with the aim fixed at the start of its wind-up: in front hurts, behind it is safe', () => {
    const golett = vec(480, 300);
    const front = exposed(arena('golett', golett));
    const slam = stepUntil(front, (s) => first(s).ai.mode === 'recover', ticksFor(6000));
    expect(slam.events.some((e) => e.type === 'enemyTelegraph' && e.attack === 'slam' && e.durationMs === GOLETT.telegraphMs)).toBe(true);
    expect(hurt(slam.events)).toBe(true);
    // The wind-up starts facing the player; the player then slips round behind it: the aim stays, the slam misses.
    const started = stepUntil(front, (s) => first(s).ai.mode === 'telegraph', ticksFor(4000)).state;
    const aim = first(started).ai.attackDir;
    const behind = { ...started, player: { ...started.player, pos: vec(golett.x + 60, golett.y) } };
    const out = stepUntil(behind, (s) => first(s).ai.mode === 'recover', ticksFor(3000));
    expect(first(out.state).ai.attackDir).toEqual(aim);
    expect(hurt(out.events)).toBe(false);
    expect(GOLETT.poise.knockbackScale).toBeLessThanOrEqual(0.1);
  });

  it('Pawniard cuts twice: a second, re-aimed lunge follows the first', () => {
    const state = exposed(arena('pawniard', vec(480, 300)));
    const firstCut = stepUntil(state, (s) => first(s).ai.mode === 'attack', ticksFor(4000)).state;
    expect(first(firstCut).ai.chain).toBeUndefined();
    // The player rolls aside during the first cut; the second wind-up tracks it.
    const aside = { ...firstCut, player: { ...firstCut.player, pos: vec(400, 380) } };
    const second = stepUntil(aside, (s) => first(s).ai.chain === 1 && first(s).ai.mode === 'attack', ticksFor(2000));
    expect(second.events.some((e) => e.type === 'enemyTelegraph' && e.attack === 'lunge2' && e.durationMs === PAWNIARD.followUp!.telegraphMs)).toBe(true);
    const dir = first(second.state).ai.attackDir;
    expect(dir.y).toBeGreaterThan(0.3);
    const done = stepUntil(second.state, (s) => first(s).ai.mode === 'recover', ticksFor(2000)).state;
    expect(first(done).ai.chain).toBeUndefined();
  });
});

describe('Sableye, el ladrón de gemas', () => {
  const VAULT = { width: ROOMS.vault.width, height: ROOMS.vault.height };
  const fight = (items: WorldState['player']['items'] = ['leftovers', 'scope-lens']) => {
    const state = exposed(arena('sableye', vec(360, 200), vec(360, 420), VAULT));
    return { ...state, player: { ...state.player, items } };
  };

  it('plays Glint then Gems, each named and telegraphed for at least half a second, with a boss bar', () => {
    expect([0, 1, 2].map((i) => thiefCardAt(SABLEYE, i))).toEqual(['glint', 'gems', 'glint']);
    expect(spellCardKey('sableye', 'glint')).toBe('spell.sableye.glint');
    expect(spellCardKey('sableye', 'gems')).toBe('spell.sableye.gems');
    let state = fight([]);
    const cards: string[] = [];
    const telegraphs: { attack: string; durationMs: number }[] = [];
    for (let i = 0; i < ticksFor(30000) && cards.length < 3; i++) {
      state = step({ ...state, player: { ...state.player, hp: state.player.maxHp } }, IDLE, FIXED_DT_MS);
      for (const e of state.events) {
        if (e.type === 'bossStance') cards.push(e.stance);
        if (e.type === 'enemyTelegraph') telegraphs.push({ attack: e.attack, durationMs: e.durationMs });
      }
    }
    expect(cards).toEqual(['glint', 'gems', 'glint']);
    for (const attack of ['glint', 'gems']) expect(telegraphs.find((t) => t.attack === attack)!.durationMs).toBeGreaterThanOrEqual(500);
  });

  it('Glint: blinks to a spot beside the player, a third of a turn around each time', () => {
    const state = fight();
    const spot0 = blinkSpot(state, first(state), state.player.pos, SABLEYE, 0);
    const spot1 = blinkSpot(state, first(state), state.player.pos, SABLEYE, 1);
    expect(distance(spot0, state.player.pos)).toBeCloseTo(SABLEYE.blink.distance, 0);
    expect(distance(spot1, state.player.pos)).toBeCloseTo(SABLEYE.blink.distance, 0);
    expect(distance(spot0, spot1)).toBeGreaterThan(SABLEYE.blink.distance);
    const glint = stepUntil(state, (s) => first(s).ai.mode === 'telegraph', ticksFor(5000)).state;
    expect(distance(first(glint).pos, glint.player.pos)).toBeCloseTo(SABLEYE.blink.distance, -1);
  });

  it('a Glint slash that hurts steals the last held item; hitting Sableye gives it back', () => {
    const robbed = stepUntil(fight(), (s) => s.player.stolen !== undefined, ticksFor(8000));
    expect(robbed.events.some((e) => e.type === 'itemStolen' && e.item === 'scope-lens')).toBe(true);
    expect(robbed.state.player.items).toEqual(['leftovers']);
    expect(robbed.state.player.stolen).toMatchObject({ item: 'scope-lens', enemyId: first(robbed.state).id });
    // One item at a time.
    expect(stealItem(robbed.state.player, 'e9', 1000, []).items).toEqual(['leftovers']);
    // The player's own hit on the thief (an enemyHit event of this step) returns it.
    const events: GameEvent[] = [{ type: 'enemyHit', enemyId: first(robbed.state).id, damage: 5, effectiveness: 1, pos: first(robbed.state).pos }];
    const back = settleStolen(robbed.state, FIXED_DT_MS, events);
    expect(back.player.items).toEqual(['leftovers', 'scope-lens']);
    expect(back.player.stolen).toBeUndefined();
    expect(events.some((e) => e.type === 'itemReturned' && e.item === 'scope-lens')).toBe(true);
  });

  it('the item also comes back by itself, when the thief falls, and on leaving the room; nothing held, nothing taken', () => {
    const base = fight();
    const thief = first(base).id;
    const robbed = { ...base, player: stealItem(base.player, thief, SABLEYE.stealMs, []) };
    expect(robbed.player.items).toEqual(['leftovers']);
    const ticking = settleStolen(robbed, 1000, []);
    expect(ticking.player.stolen?.remainingMs).toBe(SABLEYE.stealMs - 1000);
    expect(settleStolen(robbed, SABLEYE.stealMs, []).player.items).toEqual(['leftovers', 'scope-lens']);
    const fallen = { ...robbed, enemies: robbed.enemies.map((e) => ({ ...e, alive: false })) };
    expect(settleStolen(fallen, FIXED_DT_MS, []).player.items).toEqual(['leftovers', 'scope-lens']);
    expect(enterRoom(robbed).player.items).toEqual(['leftovers', 'scope-lens']);
    expect(enterRoom(robbed).player.stolen).toBeUndefined();
    expect(returnStolen(base.player)).toBe(base.player);
    expect(stealItem({ ...base.player, items: [] }, thief, 1000, [])).toEqual({ ...base.player, items: [] });
  });

  it('a guest is robbed on its own side by the slash in the host snapshot', () => {
    const state = fight();
    const host = stepUntil(state, (s) => first(s).ai.mode === 'attack' && first(s).boss?.stance === 'glint', ticksFor(8000)).state;
    const enemy = first(host);
    const guest: WorldState = { ...host, role: 'guest', player: { ...host.player, pos: enemy.pos, stolen: undefined, items: ['leftovers', 'scope-lens'] }, enemies: [{ ...enemy, ai: { ...enemy.ai, contact: 'none' } }] };
    const events: GameEvent[] = [];
    const after = guestEnemyContacts(guest, events);
    expect(after.player.stolen?.item).toBe('scope-lens');
    expect(events.some((e) => e.type === 'itemStolen')).toBe(true);
  });

  it('Gems: rings of gems from the middle of the vault, every other ring turned by half a gap', () => {
    expect(ringOffset(SABLEYE, 0)).toBe(0);
    expect(ringOffset(SABLEYE, 1)).toBeCloseTo(180 / SABLEYE.gems.perRing);
    // Skip the first card.
    let state = fight([]);
    state = { ...state, enemies: [{ ...first(state), boss: { ...first(state).boss!, combosDone: 1 } }] };
    const thrown = stepUntil({ ...state, player: { ...state.player, hp: 9999, maxHp: 9999 } }, (s) => s.projectiles.length >= SABLEYE.gems.perRing, ticksFor(5000)).state;
    expect(first(thrown).pos).toEqual(vec(VAULT.width / 2, VAULT.height / 2));
    expect(thrown.projectiles).toHaveLength(SABLEYE.gems.perRing);
  });
});
