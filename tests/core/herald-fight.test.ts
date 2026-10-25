import { describe, expect, it } from 'vitest';
import { cardHpFloor } from '../../src/core/cards';
import { dailySeed } from '../../src/core/endless';
import { heraldCard, heraldContact, heraldOf } from '../../src/core/herald/brain';
import { devHeraldFloor, heraldSeed, withHerald } from '../../src/core/herald/floor';
import { generateBoss, heraldDef } from '../../src/core/herald/generate';
import { followToFloor, startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { guestEnemyContacts, pierceZone } from '../../src/core/victim';
import { musicFor, planAt, ECLIPSE } from '../../src/data/dungeons';
import { echoAt, ENDLESS, isEchoFloor, isHeraldFloor } from '../../src/data/endless';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE } from './helpers';

const ECL = 'eclipse-chasm';

const herald = (w: WorldState) => w.enemies.find((e) => e.species === 'sima-herald')!;
const invulnerable = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, hp: 1e9, maxHp: 1e9 } });

/** Steps `ms`, keeping the player alive, collecting events and the peak of enemy shots. */
function play(world: WorldState, ms: number, each?: (w: WorldState) => WorldState): { world: WorldState; events: GameEvent[]; peak: number } {
  let w = invulnerable(world);
  const events: GameEvent[] = [];
  let peak = 0;
  for (let t = 0; t < ms; t += FIXED_DT_MS) {
    w = invulnerable(step(w, IDLE, FIXED_DT_MS));
    if (each) w = each(w);
    events.push(...w.events);
    peak = Math.max(peak, w.projectiles.filter((p) => p.owner === 'enemy').length);
  }
  return { world: w, events, peak };
}

describe('herald floors in the Sima', () => {
  it('start after the first strata: 22, 32, 42... (strata I-II keep the hand-made echoes); the other echoes keep their floors', () => {
    expect([2, 12, 20, 21, 22, 25, 30, 32, 42, 52].map((f) => isHeraldFloor(ENDLESS, f))).toEqual([false, false, false, false, true, false, false, true, true, true]);
    for (const f of [22, 32, 42]) {
      expect(isEchoFloor(ENDLESS, f)).toBe(true);
      expect(echoAt(ENDLESS, f).room).toBe('abyss');
      expect(planAt(ECLIPSE, f)).toEqual({ kind: 'room', room: 'abyss', role: 'echo' });
      expect(musicFor(ECLIPSE, planAt(ECLIPSE, f)!, 'normal', f)).toBe('guardian');
    }
    // The guardian echoes and the Eclipse Echo are where they were.
    expect([5, 10, 15, 20, 25, 30, 35, 40].map((f) => echoAt(ENDLESS, f).room)).toEqual(['boss', 'eclipse', 'hollow', 'eclipse', 'roost', 'eclipse', 'wreck', 'eclipse']);
  });

  it('spawns the run\'s herald in the abyss arena; the daily seed gives everyone the same herald, other runs others', () => {
    const day = dailySeed('2026-10-25');
    const a = startRun(day, {}, 22, ECL).world;
    const b = startRun(day, {}, 22, ECL).world;
    expect(herald(a).herald).toEqual({ seed: heraldSeed(day, 22), depth: 22 });
    expect(herald(a)).toEqual(herald(b));
    expect(heraldOf(a, herald(a))).toEqual(heraldOf(b, herald(b)));
    expect(a.arena.obstacles?.some((o) => o.cover)).toBe(true);
    const seeds = new Set(Array.from({ length: 12 }, (_, i) => herald(startRun(i + 1, {}, 32, ECL).world).herald!.seed));
    expect(seeds.size).toBe(12);
    // Types and HP from the generated herald.
    const def = heraldOf(a, herald(a))!;
    expect(herald(a).types).toEqual(def.types);
    expect(herald(a).maxHp).toBeGreaterThan(1000);
  });
});

describe('a herald fight', () => {
  it('plays its first card announced by name, fires within its cap, and moves to the next card when the segment empties (shots cleared)', { timeout: 60_000 }, () => {
    const start = startRun(4, {}, 32, ECL).world;
    const def = heraldOf(start, herald(start))!;
    const first = play(start, 9000);
    const stances = first.events.filter((e) => e.type === 'bossStance').map((e) => (e.type === 'bossStance' ? e.stance : ''));
    expect(stances[0]).toBe('herald0');
    expect(first.peak).toBeGreaterThan(0);
    expect(first.peak).toBeLessThanOrEqual(def.maxShots);
    // Empty the first segment.
    const boss = herald(first.world);
    const hurt = { ...first.world, enemies: first.world.enemies.map((e) => (e.id === boss.id ? { ...e, hp: cardHpFloor(e.maxHp, 0, def.cards.length) - 1 } : e)) };
    const next = step(invulnerable(hurt), IDLE, FIXED_DT_MS);
    expect(herald(next).boss!.combosDone).toBe(1);
    expect(next.projectiles.filter((p) => p.owner === 'enemy')).toEqual([]);
  });

  it('a card that runs out its timer ends with no capture: the HP drops to its segment floor', { timeout: 60_000 }, () => {
    const start = startRun(9, {}, 22, ECL).world;
    const def = heraldOf(start, herald(start))!;
    const out = play(start, def.cards[0]!.timerMs + 3000);
    expect(herald(out.world).boss!.combosDone).toBeGreaterThanOrEqual(1);
    expect(herald(out.world).hp).toBeLessThanOrEqual(cardHpFloor(herald(out.world).maxHp, 0, def.cards.length));
  });

  it('awakens at the middle card and plays its phase-2 versions', { timeout: 60_000 }, () => {
    const start = startRun(11, {}, 42, ECL).world;
    const def = heraldOf(start, herald(start))!;
    let w = play(start, 2000).world;
    // Straight to the card before phase 2, then empty it.
    const id = herald(w).id;
    const before = def.phase2.fromCard - 1;
    w = { ...w, enemies: w.enemies.map((e) => (e.id === id ? { ...e, hp: cardHpFloor(e.maxHp, before, def.cards.length) - 1, boss: { ...e.boss!, combosDone: before, stance: `herald${before}` } } : e)) };
    const out = play(w, def.phase2.transformMs + 500);
    const stances = out.events.filter((e) => e.type === 'bossStance').map((e) => (e.type === 'bossStance' ? e.stance : ''));
    expect(stances).toContain('awaken');
    expect(stances[stances.length - 1]).toBe(`herald${def.phase2.fromCard}x`);
    expect(herald(out.world).boss!.phase).toBe(2);
  });
});

/** A herald whose first card burns pockets (searching seeds). */
function pocketsRun(): { seed: number; world: WorldState } {
  for (let seed = 1; seed < 400; seed++) {
    const def = generateBoss(heraldSeed(seed, 22), 22, 'easy');
    if (def.cards[0]!.layers.some((l) => l.kind === 'pockets')) return { seed, world: startRun(seed, {}, 22, ECL).world };
  }
  throw new Error('no pockets herald found');
}

describe('herald co-op', () => {
  it('a guest regenerates the same herald from the run seed and follows its card through the wire; its pockets land on the guest\'s own player', { timeout: 60_000 }, () => {
    const { seed, world } = pocketsRun();
    // Host: play into the first card's attack window, at the moment the pockets burn.
    let host = invulnerable(world);
    const def = heraldOf(host, herald(host))!;
    const pockets = def.cards[0]!.layers.find((l) => l.kind === 'pockets')!;
    if (pockets.kind !== 'pockets') throw new Error('no pockets');
    for (let t = 0; t < 30_000; t += FIXED_DT_MS) {
      host = invulnerable(step(host, IDLE, FIXED_DT_MS));
      const b = herald(host);
      if (b.ai.mode === 'attack' && heraldContact(def, b, vec(5, 5))) break;
    }
    expect(herald(host).ai.mode).toBe('attack');
    expect(pierceZone(herald(host), 'easy', host.arena)).toMatchObject({ kind: 'pockets', radius: pockets.radius });
    const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 22, s: hostSnapshot(host) }));
    if (!wire || wire.t !== 'snap') throw new Error('snapshot did not decode');
    // The guest made the same floor from the seed (followToFloor/startRun), then takes the snapshot.
    const guestStart = startRun(seed, {}, 22, ECL).world;
    const guest = applyHostSnapshot({ ...guestStart, role: 'guest', localId: 'p2' }, wire.s);
    const b = herald(guest);
    expect(b.herald).toEqual(herald(host).herald);
    expect(b.boss!.stance).toBe('herald0');
    expect(heraldCard(heraldOf(guest, b)!, b.boss!.stance)).toEqual(def.cards[0]);
    // Outside every pocket the burn lands on the guest's own player, through a roll (positional).
    const exposed = { ...guest, player: { ...guest.player, pos: vec(4, 4), hp: 100, maxHp: 100 } };
    const landed = (e: GameEvent) => e.type === 'playerHurt' || e.type === 'disguiseBroken';
    const events: GameEvent[] = [];
    guestEnemyContacts(exposed, events);
    expect(events.some(landed)).toBe(true);
    // Inside a pocket it does not.
    const safe = { ...guest, player: { ...guest.player, pos: vec(pockets.pockets[0]!.x, pockets.pockets[0]!.y), hp: 100, maxHp: 100 } };
    const quiet: GameEvent[] = [];
    guestEnemyContacts(safe, quiet);
    expect(quiet.some(landed)).toBe(false);
  });

  it('a guest following the host down to a herald floor gets the same herald', () => {
    const host = startRun(77, {}, 21, ECL);
    const guest = followToFloor(host.run, { ...host.world, role: 'guest', localId: 'p2' }, 22);
    expect(herald(guest.world).herald).toEqual({ seed: heraldSeed(77, 22), depth: 22 });
    expect(heraldDef(heraldSeed(77, 22), 22, 'easy').name).toBe(heraldOf(guest.world, herald(guest.world))!.name);
  });
});

describe('herald dev route helpers', () => {
  it('rounds any depth to a herald floor (22 at least) and swaps a floor\'s herald without compounding its HP', () => {
    expect([Number.NaN, 1, 22, 23, 32, 39, 41].map(devHeraldFloor)).toEqual([22, 22, 22, 32, 32, 42, 42]);
    const w = startRun(3, {}, 22, ECL).world;
    const swapped = withHerald(withHerald(w, 999, 22), 999, 22);
    expect(herald(swapped).herald).toEqual({ seed: 999, depth: 22 });
    expect(herald(swapped).maxHp).toBe(herald(withHerald(w, 999, 22)).maxHp);
  });
});
