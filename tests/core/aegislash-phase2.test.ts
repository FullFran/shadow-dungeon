import { describe, expect, it } from 'vitest';
import { AEGISLASH, spellCardKey } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { blocksHit, shadowGapX } from '../../src/core/boss';
import { loadRoom } from '../../src/core/rooms';
import type { BossState, EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld } from '../../src/core/world';
import { IDLE, ticksFor } from './helpers';

const P2 = AEGISLASH.phase2;

/** The real arena (pillars included) with Aegislash, optionally hurt and with boss state overrides. */
function throne(playerPos: Vec2 = vec(400, 540), hpFraction = 1, boss: Partial<BossState> = {}): WorldState {
  let state = loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), 'boss');
  state = { ...state, player: { ...state.player, pos: playerPos, disguiseBroken: true, hp: 9999, maxHp: 9999 } };
  const e = state.enemies[0]!;
  return { ...state, enemies: [{ ...e, hp: Math.round(e.maxHp * hpFraction), boss: { ...e.boss!, ...boss } }] };
}

const boss = (state: WorldState): EnemyState => state.enemies[0]!;

function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 2400, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    // Keep the player alive and still: the patterns, not survival, are under test.
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt');

describe('the throne room', () => {
  it('has four pillars that stop every shot (cover) but not the player', () => {
    const pillars = ROOMS.boss.obstacles;
    expect(pillars).toHaveLength(4);
    expect(pillars.every((p) => p.cover === true)).toBe(true);
    const pillar = pillars[0]!;
    const state = throne(vec(pillar.x + pillar.width / 2, pillar.y + pillar.height + 60), 1, {});
    // An enemy shot flying straight into the pillar from above dies on it.
    const shot = {
      id: 'px',
      owner: 'enemy' as const,
      type: 'ghost' as const,
      attackerTypes: ['ghost' as const],
      power: 30,
      damageMultiplier: 1,
      pos: vec(pillar.x + pillar.width / 2, pillar.y - 30),
      vel: vec(0, 200),
      radius: 8,
      remainingMs: 3000,
      hitstunMs: 0,
      knockback: 0,
      hitIds: [],
    };
    const dormant = { ...state, enemies: state.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'dormant' as const } })), projectiles: [shot] };
    const after = stepUntil(dormant, () => false, ticksFor(800));
    expect(after.state.projectiles).toHaveLength(0);
    expect(hurt(after.events)).toBe(false);
  });
});

describe('Aegislash phase 2: "El Rey desenvaina"', () => {
  it('starts once HP falls to half: a long, harmless unsheathing with its own name, never again', () => {
    expect(spellCardKey('aegislash', 'unsheathe')).toBe('spell.aegislash.unsheathe');
    const above = stepUntil(throne(vec(400, 540), 0.51), () => false, ticksFor(1500));
    expect(above.events.some((e) => e.type === 'bossStance' && e.stance === 'unsheathe')).toBe(false);
    const half = stepUntil(throne(vec(400, 540), 0.5), (s) => boss(s).boss?.stance === 'unsheathe', ticksFor(1000));
    const unsheathe = half.events.find((e) => e.type === 'enemyTelegraph' && e.attack === 'unsheathe');
    expect(unsheathe && unsheathe.type === 'enemyTelegraph' && unsheathe.durationMs).toBeGreaterThanOrEqual(1000);
    expect(boss(half.state).boss?.phase).toBe(2);
    expect(boss(half.state).ai.mode).toBe('transform');
    const after = stepUntil(half.state, () => false, ticksFor(20000));
    expect(after.events.filter((e) => e.type === 'bossStance' && e.stance === 'unsheathe')).toHaveLength(0);
    expect(hurt(half.events)).toBe(false);
  });

  it('cycles shield, blade, then a named spell card (Midnight, Oaths, Shadow in turn), every warning at least half a second', () => {
    expect(P2.cards).toEqual(['midnight', 'oaths', 'shadow']);
    for (const card of P2.cards) expect(spellCardKey('aegislash', card)).toBe(`spell.aegislash.${card}`);
    const fight = throne(vec(400, 330), 0.4, { phase: 2 });
    const stances: string[] = [];
    const telegraphs: { attack: string; durationMs: number }[] = [];
    let state = fight;
    for (let i = 0; i < ticksFor(120000) && stances.filter((s) => (P2.cards as readonly string[]).includes(s)).length < 3; i++) {
      state = step({ ...state, player: { ...state.player, hp: state.player.maxHp } }, IDLE, FIXED_DT_MS);
      for (const e of state.events) {
        if (e.type === 'bossStance') stances.push(e.stance);
        if (e.type === 'enemyTelegraph') telegraphs.push({ attack: e.attack, durationMs: e.durationMs });
      }
    }
    expect(stances.filter((s) => (P2.cards as readonly string[]).includes(s))).toEqual(['midnight', 'oaths', 'shadow']);
    // Before each card: blade; after it: back to shield.
    const firstCard = stances.indexOf('midnight');
    expect(stances[firstCard - 1]).toBe('blade');
    expect(stances[firstCard + 1]).toBe('shield');
    // Every phase-2 warning (cards, stance swaps); the Blade combo keeps its phase-1 rhythm (a chain after a 480 ms opener).
    for (const t of telegraphs.filter((x) => !x.attack.startsWith('combo'))) expect(t.durationMs, t.attack).toBeGreaterThanOrEqual(500);
    for (const card of P2.cards) expect(telegraphs.some((t) => t.attack === card)).toBe(true);
  });

  it('swaps stances faster than phase 1', () => {
    expect(P2.shieldMaxMs).toBeLessThan(AEGISLASH.shield.maxMs);
    expect(P2.bladeMaxMs).toBeLessThan(AEGISLASH.blade.maxMs);
    expect(P2.transformMs).toBeLessThan(AEGISLASH.transformMs);
    expect(P2.transformMs).toBeGreaterThanOrEqual(500);
  });

  it('Midnight: the spin hits inside its ring and misses outside it, throws a ring of blades, then stays open', () => {
    const start = (pos: Vec2) => throne(pos, 0.4, { phase: 2, stance: 'blade', combosDone: 99, stanceMs: 99999 });
    const near = stepUntil(start(vec(400, 300)), (s) => boss(s).boss?.stance === 'midnight' && boss(s).ai.mode === 'recover', ticksFor(8000));
    expect(hurt(near.events)).toBe(true);
    const far = stepUntil(start(vec(400, 300 + P2.midnight.radius + 80)), (s) => boss(s).boss?.stance === 'midnight' && boss(s).ai.mode === 'attack', ticksFor(8000));
    expect(far.state.projectiles.length).toBe(P2.midnight.blades.count);
    const done = stepUntil(far.state, (s) => boss(s).ai.mode === 'recover', ticksFor(1000));
    expect(hurt([...far.events, ...done.events].filter((e) => e.type === 'playerHurt' && e.damage > 25))).toBe(false);
    expect(P2.midnight.recoverMs).toBeGreaterThanOrEqual(1000);
  });

  it('Oaths: guards from every side while it fires, and lowers the guard to recover', () => {
    const fight = throne(vec(400, 520), 0.4, { phase: 2, stance: 'blade', combosDone: 99, stanceMs: 99999, cardsPlayed: 1 });
    const firing = stepUntil(fight, (s) => boss(s).boss?.stance === 'oaths' && boss(s).ai.mode === 'attack', ticksFor(8000)).state;
    const at = boss(firing).pos;
    for (const from of [vec(at.x, at.y - 50), vec(at.x + 50, at.y), vec(at.x, at.y + 50)]) expect(blocksHit(boss(firing), from)).toBe(true);
    expect(firing.projectiles.length).toBe(P2.oaths.perVolley);
    const resting = stepUntil(firing, (s) => boss(s).ai.mode === 'recover', ticksFor(5000)).state;
    expect(blocksHit(boss(resting), vec(at.x, at.y - 50))).toBe(false);
  });

  it('Shadow: a wall of shadow swords sweeps the throne room with a gap away from the player; a pillar shields its column', () => {
    const fight = throne(vec(200, 540), 0.4, { phase: 2, stance: 'blade', combosDone: 99, stanceMs: 99999, cardsPlayed: 2 });
    const winding = stepUntil(fight, (s) => boss(s).boss?.stance === 'shadow' && boss(s).ai.mode === 'telegraph', ticksFor(8000)).state;
    const gap = shadowGapX(ROOMS.boss.width, boss(winding).boss!.comboIndex);
    expect(Math.abs(gap - 200)).toBeGreaterThan(200);
    const swept = stepUntil(winding, (s) => s.projectiles.length > 0, ticksFor(3000)).state;
    const xs = swept.projectiles.map((p) => p.pos.x);
    expect(xs.length).toBeGreaterThan(15);
    expect(xs.every((x) => Math.abs(x - gap) >= P2.shadow.gapWidth / 2)).toBe(true);
    expect(swept.projectiles.every((p) => p.vel.x === 0 && p.vel.y !== 0)).toBe(true);
    // Standing in the gap: untouched. Hiding below a pillar: the swords of that column die on it.
    const inGap = stepUntil({ ...swept, player: { ...swept.player, pos: vec(gap, 500) } }, (s) => s.projectiles.length === 0, ticksFor(8000));
    expect(hurt(inGap.events)).toBe(false);
    const pillar = ROOMS.boss.obstacles.find((p) => p.y > 300)!;
    const behind = vec(pillar.x + pillar.width / 2, pillar.y + pillar.height + 14);
    const hidden = stepUntil({ ...swept, player: { ...swept.player, pos: behind } }, (s) => s.projectiles.length === 0, ticksFor(8000));
    expect(hurt(hidden.events)).toBe(false);
    const exposedPos = vec(gap > 400 ? 60 : 740, 500);
    const caught = stepUntil({ ...swept, player: { ...swept.player, pos: exposedPos } }, (s) => s.projectiles.length === 0, ticksFor(8000));
    expect(hurt(caught.events)).toBe(true);
  });

  it('a guest is hit by the Midnight spin from the host snapshot, and never by a card that only throws', () => {
    const host = stepUntil(throne(vec(400, 300), 0.4, { phase: 2, stance: 'blade', combosDone: 99, stanceMs: 99999 }), (s) => boss(s).boss?.stance === 'midnight' && boss(s).ai.mode === 'attack', ticksFor(8000)).state;
    const e = boss(host);
    const guest: WorldState = { ...host, role: 'guest', player: { ...host.player, pos: vec(e.pos.x, e.pos.y + 40) }, enemies: [{ ...e, ai: { ...e.ai, contact: 'none' } }] };
    const events: GameEvent[] = [];
    guestEnemyContacts(guest, events);
    expect(hurt(events)).toBe(true);
    for (const stance of ['oaths', 'shadow', 'unsheathe'] as const) {
      const quiet: GameEvent[] = [];
      guestEnemyContacts({ ...guest, enemies: [{ ...e, boss: { ...e.boss!, stance }, ai: { ...e.ai, contact: 'none' } }] }, quiet);
      expect(hurt(quiet)).toBe(false);
    }
  });
});
