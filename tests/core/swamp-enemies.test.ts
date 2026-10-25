import { behaviourFor } from '../../src/core/tricks';
import type { SpeciesId } from '../../src/data/species';
import type { DasherDef, RollerDef, SniperDef } from '../../src/data/swamp-enemies';
import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../../src/data/difficulty';
import { SALANDIT, SKRELP, VENIPEDE } from '../../src/data/swamp-enemies';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { dashesBack, rollerBounces, sniperShots } from '../../src/core/swamp-brains';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE } from './helpers';

/** A swamp behaviour at a tier, through the shared `behaviourFor` (data/swamp-tricks.ts patches). */
const tiered = <D,>(species: SpeciesId, d: Difficulty): D => behaviourFor(species, d) as D;


function arena(species: EnemyState['species'], pos: Vec2, playerPos: Vec2, difficulty?: Difficulty): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos });
  return spawnEnemy(difficulty ? { ...base, difficulty } : base, species, pos);
}

const first = (state: WorldState) => state.enemies[0]!;

/** Steps until `until` holds (or `maxTicks`), collecting the events; the player can be moved each tick. */
function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 900, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const angle = (v: Vec2) => Math.atan2(v.y, v.x);
const inMode = (mode: string) => (s: WorldState) => first(s).ai.mode === mode;
const shots = (s: WorldState) => s.projectiles.filter((p) => p.owner === 'enemy');

describe('Venipede (roller)', () => {
  it('curls with the aim tracking, locks it for the last part, then rolls down the lane', () => {
    const start = arena('venipede', vec(300, 300), vec(420, 300));
    const winding = stepUntil(start, inMode('telegraph')).state;
    const walkUp: PlayerInput = { ...IDLE, move: vec(0, -1) };
    // Inside the lock window the lane no longer follows the walking player.
    const locked = stepUntil(winding, (s) => first(s).ai.modeDurationMs - first(s).ai.modeMs <= VENIPEDE.lockMs - FIXED_DT_MS, 900, walkUp).state;
    const aim = angle(first(locked).ai.attackDir);
    const rolling = stepUntil(locked, inMode('attack'), 900, walkUp).state;
    expect(angle(first(rolling).ai.attackDir)).toBeCloseTo(aim, 5);
  });

  it('bounces off the first wall once on easy and then stops; lies dizzy after (the punish window)', () => {
    // Against the right wall: the roll heads right, bounces back left.
    const start = arena('venipede', vec(640, 300), vec(760, 300));
    const rolling = stepUntil(start, inMode('attack')).state;
    expect(first(rolling).ai.chain).toBe(1);
    expect(first(rolling).ai.attackDir.x).toBeGreaterThan(0);
    const bounced = stepUntil(rolling, (s) => first(s).ai.attackDir.x < 0, 200).state;
    expect(first(bounced).ai.mode).toBe('attack');
    expect(first(bounced).ai.chain).toBe(0);
    const resting = stepUntil(bounced, inMode('recover'), 200).state;
    expect(first(resting).ai.modeDurationMs).toBe(VENIPEDE.recoverMs);
  });

  it('bounces once more on hard and above (its extra trick)', () => {
    expect(rollerBounces(VENIPEDE)).toBe(1);
    expect(rollerBounces(tiered<RollerDef>('venipede', 'normal'))).toBe(1);
    expect(rollerBounces(tiered<RollerDef>('venipede', 'hard'))).toBe(2);
    expect(rollerBounces(tiered<RollerDef>('venipede', 'nightmare'))).toBe(2);
    const rolling = stepUntil(arena('venipede', vec(640, 300), vec(760, 300), 'hard'), inMode('attack')).state;
    expect(first(rolling).ai.chain).toBe(2);
  });

  it('hurts a player it rolls into, once per roll', () => {
    const start = arena('venipede', vec(300, 300), vec(420, 300));
    const { events } = stepUntil({ ...start, player: { ...start.player, disguiseBroken: true } }, inMode('recover'), 900);
    expect(events.filter((e) => e.type === 'playerHurt')).toHaveLength(1);
  });
});

describe('Salandit (dasher)', () => {
  it('dashes past the player down a locked lane and leaves a line of smoke puffs behind', () => {
    const start = arena('salandit', vec(300, 300), vec(420, 300));
    const dashing = stepUntil(start, inMode('attack')).state;
    const from = first(dashing).pos;
    const done = stepUntil(dashing, (s) => first(s).ai.mode !== 'attack', 200).state;
    const puffs = shots(done).filter((p) => p.vel.x === 0 && p.vel.y === 0);
    expect(puffs.length).toBeGreaterThanOrEqual(Math.floor(SALANDIT.dashDistance / SALANDIT.smoke.everyPx) - 1);
    for (const puff of puffs) expect(puff.radius).toBe(SALANDIT.smoke.puff.radius);
    // It went past the player's side.
    expect(distance(first(done).pos, from)).toBeGreaterThan(SALANDIT.dashDistance * 0.8);
    // Easy: one dash, then the recovery.
    expect(first(done).ai.mode).toBe('recover');
  });

  it('turns and dashes back once on hard and above', () => {
    expect(dashesBack(SALANDIT)).toBe(false);
    expect(dashesBack(tiered<DasherDef>('salandit', 'hard'))).toBe(true);
    const start = arena('salandit', vec(300, 300), vec(420, 300), 'nightmare');
    const dashing = stepUntil(start, inMode('attack')).state;
    const { state, events } = stepUntil(dashing, (s) => first(s).ai.mode !== 'attack', 200);
    expect(first(state).ai.mode).toBe('telegraph');
    expect(first(state).ai.chain).toBe(1);
    expect(events.some((e) => e.type === 'enemyTelegraph' && e.attack === 'dash2' && e.durationMs === tiered<DasherDef>('salandit', 'nightmare').returnDash!.telegraphMs)).toBe(true);
    const back = stepUntil(state, inMode('recover'), 400).events;
    expect(back.some((e) => e.type === 'enemyAttack' && e.attack === 'dash2')).toBe(true);
  });
});

describe('Skrelp (sniper)', () => {
  it('locks its ink line before it spits one fast bolt, then hops back', () => {
    const start = arena('skrelp', vec(150, 300), vec(400, 300));
    const winding = stepUntil(start, inMode('telegraph')).state;
    const walkDown: PlayerInput = { ...IDLE, move: vec(0, 1) };
    const locked = stepUntil(winding, (s) => first(s).ai.modeDurationMs - first(s).ai.modeMs <= SKRELP.lockMs - FIXED_DT_MS, 900, walkDown).state;
    const aim = angle(first(locked).ai.attackDir);
    const fired = stepUntil(locked, inMode('attack'), 900, walkDown).state;
    const bolts = shots(fired);
    expect(bolts).toHaveLength(1);
    expect(angle(bolts[0]!.vel)).toBeCloseTo(aim, 5);
    expect(Math.hypot(bolts[0]!.vel.x, bolts[0]!.vel.y)).toBeCloseTo(SKRELP.bolt.speed, 5);
    const before = first(fired).pos;
    const hopped = stepUntil(fired, inMode('recover'), 100).state;
    expect(distance(first(hopped).pos, fired.player.pos)).toBeGreaterThan(distance(before, fired.player.pos));
  });

  it('spits a narrow fan of three on hard and above', () => {
    expect(sniperShots(tiered<SniperDef>('skrelp', 'normal'))).toBe(1);
    expect(sniperShots(tiered<SniperDef>('skrelp', 'hard'))).toBe(3);
    const fired = stepUntil(arena('skrelp', vec(150, 300), vec(400, 300), 'hard'), inMode('attack')).state;
    expect(shots(fired)).toHaveLength(3);
  });
});

describe('swamp enemies on a guest', () => {
  it("lands a roll or a dash on the guest's own player, and leaves Skrelp to its bolts", () => {
    for (const species of ['venipede', 'salandit'] as const) {
      const base = arena(species, vec(400, 300), vec(405, 300));
      const enemy = first(base);
      const guest: WorldState = {
        ...base,
        role: 'guest',
        player: { ...base.player, disguiseBroken: true },
        enemies: [{ ...enemy, ai: { ...enemy.ai, mode: 'attack', modeMs: 10, modeDurationMs: 300, contact: 'none' } }],
      };
      const events: GameEvent[] = [];
      const hit = guestEnemyContacts(guest, events);
      expect(hit.player.hp, species).toBeLessThan(guest.player.hp);
      expect(first(hit).ai.contact).toBe('hit');
    }
    const base = arena('skrelp', vec(400, 300), vec(405, 300));
    const enemy = first(base);
    const guest: WorldState = { ...base, role: 'guest', enemies: [{ ...enemy, ai: { ...enemy.ai, mode: 'attack', modeMs: 10, modeDurationMs: 300, contact: 'none' } }] };
    expect(guestEnemyContacts(guest, []).player.hp).toBe(guest.player.hp);
  });
});
