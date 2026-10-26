import { describe, expect, it } from 'vitest';
import { hitPlayer } from '../../src/core/step';
import type { GameEvent, HitClaim, PlayerInput, WorldState } from '../../src/core/state';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { DOTS, MOVES, type MoveId } from '../../src/data/moves';
import type { SpeciesId } from '../../src/data/species';
import { IDLE } from '../core/helpers';
import { coopLoop, ticksOf, type CoopLoop } from './coop-loop';

/**
 * Rank effects (odd/tasks/move-progression.md, Follow-ups F2) when the GUEST
 * uses its ranked moves, over the lagged loopback: its hits reach the host as
 * claims; the burn, poison, mark and weakening they leave are the host's to
 * tick, once; the zones, split shots, chained jumps and rethrows are the
 * guest's own hits, claimed like any other; and its own super-armor and
 * i-frames protect it on its screen.
 */
const ARENA = { width: 800, height: 600 };
const GUEST_AT = vec(400, 300);

interface GuestBuild {
  species: SpeciesId;
  loadout: (MoveId | null)[];
  ranks: Partial<Record<MoveId, number>>;
}

/** The host far away in a corner, dormant very tough dummies at `dummies` (they never fall), the guest at GUEST_AT. */
function duel(build: GuestBuild, dummies: readonly Vec2[], dummy: SpeciesId = 'gastly'): CoopLoop {
  const loop = coopLoop((guestId) => {
    let host = createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p1', species: 'mimikyu' });
    for (const at of dummies) host = spawnEnemy(host, dummy, at, { dormant: true });
    host = { ...host, enemies: host.enemies.map((e) => ({ ...e, hp: 9999, maxHp: 9999 })) };
    const guest = createWorld({ seed: 1, arena: ARENA, playerPos: GUEST_AT, localId: guestId, role: 'guest', species: build.species, moveRanks: build.ranks });
    const player = { ...guest.player, loadout: build.loadout, slotsHeld: build.loadout.map(() => false), disguiseBroken: true, illusionBroken: true };
    return { host, guest: { ...guest, player } };
  });
  for (let i = 0; i < ticksOf(500); i++) loop.tick(IDLE, IDLE);
  expect(loop.guestWorld.enemies).toHaveLength(dummies.length);
  return loop;
}

const press = (slot: number, aim: Vec2): PlayerInput => ({ ...IDLE, aim, slots: [0, 1, 2, 3].map((i) => i === slot), slotMouse: [0, 1, 2, 3].map((i) => i === slot) });

/** The guest uses slot `slot` at `aim`, then everyone idles for `ms`. */
function guestUses(loop: CoopLoop, slot: number, aim: Vec2, ms: number): void {
  loop.tick(IDLE, press(slot, aim));
  for (let i = 0; i < ticksOf(ms); i++) loop.tick(IDLE, { ...IDLE, aim });
}

type Hit = Extract<GameEvent, { type: 'enemyHit' }>;
const hitsOn = (events: readonly GameEvent[], enemyId: string): Hit[] => events.filter((e): e is Hit => e.type === 'enemyHit' && e.enemyId === enemyId);
const claimsOf = (loop: CoopLoop): HitClaim[] => loop.guestEvents.flatMap((e) => (e.type === 'hitClaim' ? [e.claim] : []));
const lost = (loop: CoopLoop, index: number): number => 9999 - loop.hostWorld.enemies[index]!.hp;

describe('co-op rank effects (guest): damage-only effects ride on the hit claims', () => {
  it('crit: the host applies exactly what the guest claimed for its ranked Shadow Claw', () => {
    const loop = duel({ species: 'mimikyu', loadout: ['shadow-claw', null, null, null], ranks: { 'shadow-claw': 1 } }, [vec(424, 300)]);
    guestUses(loop, 0, vec(424, 300), 900);
    const claims = claimsOf(loop);
    expect(claims).toHaveLength(1);
    expect(lost(loop, 0)).toBe(claims[0]!.damage);
  });

  it('size: a ranked Dazzling Gleam reaches a dummy the plain one misses, and the host takes it', () => {
    const body = 14;
    const at = vec(400 + 58 * 1.1 + body, 300);
    const plain = duel({ species: 'mimikyu', loadout: [null, null, null, 'dazzling-gleam'], ranks: {} }, [at]);
    guestUses(plain, 3, at, 900);
    expect(lost(plain, 0)).toBe(0);
    const ranked = duel({ species: 'mimikyu', loadout: [null, null, null, 'dazzling-gleam'], ranks: { 'dazzling-gleam': 1 } }, [at]);
    guestUses(ranked, 3, at, 900);
    expect(lost(ranked, 0)).toBeGreaterThan(0);
    expect(lost(ranked, 0)).toBe(claimsOf(ranked).reduce((s, c) => s + c.damage, 0));
  });

  it('extra hit: every hit of a ranked Fury Swipes lands once on the host', () => {
    const count = (ranks: Partial<Record<MoveId, number>>) => {
      // A Normal move: a Cubone dummy (a Gastly is immune).
      const loop = duel({ species: 'zorua', loadout: ['fury-swipes', null, null, null], ranks }, [vec(424, 300)], 'cubone');
      guestUses(loop, 0, vec(424, 300), 1200);
      expect(lost(loop, 0)).toBe(claimsOf(loop).reduce((s, c) => s + c.damage, 0));
      return hitsOn(loop.hostEvents, 'e1').length;
    };
    // Rank +1 is a crit bonus, +2 the extra hit.
    expect(count({ 'fury-swipes': 2 })).toBe(count({}) + 1);
  });

  it('burn: a guest burn reaches the host and ticks there exactly once', () => {
    const loop = duel({ species: 'litwick', loadout: [null, 'inferno', null, null], ranks: { inferno: 1 } }, [vec(424, 300)]);
    guestUses(loop, 1, vec(424, 300), 1200);
    const claims = claimsOf(loop);
    expect(claims).toHaveLength(1);
    const hit = claims[0]!.damage;
    for (let i = 0; i < ticksOf(DOTS.burn.ticks * DOTS.burn.everyMs + 1000); i++) loop.tick(IDLE, IDLE);
    const ticks = hitsOn(loop.hostEvents, 'e1').filter((e) => e.dot === 'burn');
    const perTick = Math.max(1, Math.round((hit * DOTS.burn.share) / DOTS.burn.ticks));
    expect(ticks).toHaveLength(DOTS.burn.ticks);
    expect(ticks.every((e) => e.damage === perTick)).toBe(true);
    expect(lost(loop, 0)).toBe(hit + DOTS.burn.ticks * perTick);
    // The guest's screen ends where the host's does, with no burn left on it.
    expect(loop.guestWorld.enemies[0]!.hp).toBe(loop.hostWorld.enemies[0]!.hp);
    expect(loop.hostWorld.enemies[0]!.dot).toBeUndefined();
    expect(loop.guestWorld.enemies[0]!.dot).toBeUndefined();
  });

  it('burn chance: the host follows the guest roll (no burn claimed, no burn ticked)', () => {
    let burned = 0;
    let missed = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const loop = duel({ species: 'litwick', loadout: ['ember', null, null, null], ranks: { ember: 1 } }, [vec(424, 300)]);
      loop.guestWorld = { ...loop.guestWorld, rng: seed * 7919 };
      guestUses(loop, 0, vec(424, 300), 500);
      const took = claimsOf(loop).some((c) => c.dot !== undefined);
      for (let i = 0; i < ticksOf(DOTS.burn.ticks * DOTS.burn.everyMs + 500); i++) loop.tick(IDLE, IDLE);
      const ticked = hitsOn(loop.hostEvents, 'e1').some((e) => e.dot === 'burn');
      expect(ticked).toBe(took);
      if (took) burned++;
      else missed++;
    }
    expect(burned).toBeGreaterThan(0);
    expect(missed).toBeGreaterThan(0);
  });
});

describe('co-op rank effects (guest): host-resolved effects happen in the host world', () => {
  it('mark: the host marks the enemy, bursts it once, and the guest sees the mark', () => {
    const loop = duel({ species: 'mimikyu', loadout: ['shadow-claw', null, null, null], ranks: { 'shadow-claw': 2 } }, [vec(424, 300)]);
    guestUses(loop, 0, vec(424, 300), 300);
    const hit = claimsOf(loop)[0]!.damage;
    let seenMarked = false;
    for (let i = 0; i < ticksOf(1500); i++) {
      loop.tick(IDLE, IDLE);
      if (loop.guestWorld.enemies[0]!.mark) seenMarked = true;
    }
    const bursts = hitsOn(loop.hostEvents, 'e1').filter((e) => e.burst);
    expect(bursts).toHaveLength(1);
    expect(bursts[0]!.damage).toBe(Math.round(hit * 0.35));
    expect(seenMarked).toBe(true);
    expect(loop.guestWorld.enemies[0]!.mark).toBeUndefined();
    expect(loop.guestWorld.enemies[0]!.hp).toBe(loop.hostWorld.enemies[0]!.hp);
  });

  it('weaken: the host weakens the enemy, the guest sees it, and its shots hit the guest softer', () => {
    const loop = duel({ species: 'mimikyu', loadout: [null, 'play-rough', null, null], ranks: { 'play-rough': 2 } }, [vec(424, 300)]);
    guestUses(loop, 1, vec(424, 300), 500);
    expect(loop.hostWorld.enemies[0]!.weakened?.factor).toBe(0.7);
    for (let i = 0; i < ticksOf(300); i++) loop.tick(IDLE, IDLE);
    expect(loop.guestWorld.enemies[0]!.weakened?.factor).toBe(0.7);
    // A shot the weakened enemy fires on the host reaches the guest with the weakening on it.
    const enemy = loop.hostWorld.enemies[0]!;
    loop.hostWorld = {
      ...loop.hostWorld,
      nextId: loop.hostWorld.nextId + 1,
      projectiles: [
        ...loop.hostWorld.projectiles,
        { id: `p${loop.hostWorld.nextId}`, owner: 'enemy', type: 'ghost', attackerTypes: enemy.types, power: 40, damageMultiplier: enemy.weakened!.factor, pos: vec(700, 100), vel: vec(0, 0), radius: 5, remainingMs: 2000, hitstunMs: 0, knockback: 0, hitIds: [] },
      ],
    };
    for (let i = 0; i < ticksOf(300); i++) loop.tick(IDLE, IDLE);
    const shot = loop.guestWorld.projectiles.find((p) => p.owner === 'enemy');
    expect(shot?.damageMultiplier).toBe(0.7);
    // ...and it wears off on both.
    for (let i = 0; i < ticksOf(4200); i++) loop.tick(IDLE, IDLE);
    expect(loop.hostWorld.enemies[0]!.weakened).toBeUndefined();
    expect(loop.guestWorld.enemies[0]!.weakened).toBeUndefined();
  });

  it('split: a ranked Shadow Ball bursts past its target and a split shot hits the dummy behind, on the host', () => {
    const run = (ranks: Partial<Record<MoveId, number>>) => {
      const loop = duel({ species: 'mimikyu', loadout: [null, 'shadow-ball', null, null], ranks }, [vec(470, 300), vec(530, 300)]);
      guestUses(loop, 1, vec(470, 300), 1200);
      return loop;
    };
    expect(lost(run({}), 1)).toBe(0);
    const ranked = run({ 'shadow-ball': 2 });
    expect(lost(ranked, 1)).toBeGreaterThan(0);
    expect(lost(ranked, 1)).toBe(claimsOf(ranked).filter((c) => c.enemyId === 'e2').reduce((s, c) => s + c.damage, 0));
  });

  it('zone: a ranked Ember leaves embers whose every tick lands on the host', () => {
    const loop = duel({ species: 'litwick', loadout: ['ember', null, null, null], ranks: { ember: 2 } }, [vec(424, 300)]);
    guestUses(loop, 0, vec(424, 300), 2500);
    const host = hitsOn(loop.hostEvents, 'e1').filter((e) => !e.dot);
    const guest = hitsOn(loop.guestEvents, 'e1').filter((e) => e.minor && !e.dot);
    expect(guest.length).toBeGreaterThanOrEqual(2);
    // One host hit per guest hit: the first hit and every ember tick.
    expect(host).toHaveLength(hitsOn(loop.guestEvents, 'e1').filter((e) => !e.dot).length);
    expect(lost(loop, 0)).toBeGreaterThanOrEqual(claimsOf(loop).reduce((s, c) => s + c.damage, 0));
  });

  it('a lingering zone (Fire Spin, unranked): every tick is its own claim, so none is dropped as a resend', () => {
    const loop = duel({ species: 'litwick', loadout: [null, null, null, 'fire-spin'], ranks: {} }, [vec(440, 300)]);
    guestUses(loop, 3, vec(440, 300), 3000);
    const guest = hitsOn(loop.guestEvents, 'e1').filter((e) => !e.dot);
    expect(guest.length).toBeGreaterThanOrEqual(3);
    expect(new Set(claimsOf(loop).map((c) => c.id)).size).toBe(claimsOf(loop).length);
    expect(hitsOn(loop.hostEvents, 'e1').filter((e) => !e.dot)).toHaveLength(guest.length);
  });

  it('chain: a ranked Thunderbolt jumps to the nearest other dummy on the host, never the far one', () => {
    const loop = duel({ species: 'mimikyu', loadout: [null, 'thunderbolt', null, null], ranks: { thunderbolt: 2 } }, [vec(470, 300), vec(470, 360), vec(700, 500)]);
    guestUses(loop, 1, vec(470, 300), 900);
    expect(lost(loop, 0)).toBeGreaterThan(0);
    expect(lost(loop, 1)).toBeGreaterThan(0);
    expect(lost(loop, 1)).toBeLessThan(lost(loop, 0));
    expect(lost(loop, 2)).toBe(0);
  });

  it('return: a ranked Bonemerang thrown again by the guest lands every pass on the host', () => {
    const count = (ranks: Partial<Record<MoveId, number>>) => {
      const loop = duel({ species: 'cubone', loadout: [null, 'bonemerang', null, null], ranks }, [vec(470, 300)]);
      guestUses(loop, 1, vec(470, 300), 2600);
      return hitsOn(loop.hostEvents, 'e1').length;
    };
    expect(count({})).toBe(2);
    expect(count({ bonemerang: 2 })).toBe(4);
  });
});

describe('co-op rank effects (guest): its own moves protect it on its screen', () => {
  it('i-frames: an ordinary hit passes through the active phase of a ranked dash on a guest', () => {
    const loop = duel({ species: 'mimikyu', loadout: ['shadow-sneak', null, null, null], ranks: { 'shadow-sneak': 2 } }, [vec(700, 500)]);
    loop.tick(IDLE, press(0, vec(500, 300)));
    for (let i = 0; i < 40 && loop.guestWorld.player.action?.phase !== 'active'; i++) loop.tick(IDLE, IDLE);
    expect(loop.guestWorld.player.action?.phase).toBe('active');
    const guest: WorldState = loop.guestWorld;
    expect(hitPlayer(guest, { damage: 20 }).player.hp).toBe(guest.player.hp);
    expect(hitPlayer(guest, { damage: 20, pierceRoll: true }).player.hp).toBeLessThan(guest.player.hp);
  });

  it('super-armor: a ranked Swords Dance cast by the guest takes the edge off hits on it', () => {
    const loop = duel({ species: 'mimikyu', loadout: [null, null, 'swords-dance', null], ranks: { 'swords-dance': 2 } }, [vec(700, 500)]);
    guestUses(loop, 2, vec(500, 300), MOVES['swords-dance'].windupMs + MOVES['swords-dance'].activeMs + 50);
    expect(loop.guestWorld.player.ward?.damageTaken).toBe(0.6);
    const warded = hitPlayer(loop.guestWorld, { damage: 20 });
    expect(loop.guestWorld.player.hp - warded.player.hp).toBeCloseTo(20 * 0.6, 5);
  });
});
