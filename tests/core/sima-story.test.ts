import { describe, expect, it } from 'vitest';
import { bagDraw, isStrayFloor, runPlanAt, strayAt, woundAt } from '../../src/core/sima-story';
import { crossFogWall } from '../../src/core/fog-wall';
import { atLeavingPoint, fogWallFloor, progressRun, startRun, strayHere, withFogWall } from '../../src/core/run';
import { depthScale } from '../../src/core/endless';
import { vec } from '../../src/core/vec';
import { loadRoom } from '../../src/core/rooms';
import type { WorldState } from '../../src/core/state';
import { ECLIPSE } from '../../src/data/dungeons';
import { ENDLESS, isEchoFloor, isWoundFloor } from '../../src/data/endless';
import { ROOMS } from '../../src/data/rooms';
import { SIMA_SHADOWS, SIMA_STORY, SIMA_WOUNDS } from '../../src/data/sima-story';
import { SPECIES } from '../../src/data/species';
import { STORY_BOSSES } from '../../src/data/story/bosses';

/**
 * The Sendas' bosses in the Sima (docs/sima-redesign.md §4): wounds on the
 * wound floors, lost shadows on seeded stray floors behind a fog with a way
 * past, every boss of every Senda in the pools, the draw a function of the
 * seed and the floor only.
 */
const ECL = ECLIPSE.id;

/** The first stray floor of `seed` (searching floors 12..200). */
function firstStray(seed: number): number {
  for (let f = SIMA_STORY.strays.fromFloor; f < 200; f++) if (isStrayFloor(ENDLESS, seed, f)) return f;
  throw new Error('no stray floor');
}

describe('the Sendas in the Sima: pools', () => {
  it('every Senda boss (Mimikyu\'s wound too) is in a pool once, in its own arena', () => {
    const pooled = [...SIMA_SHADOWS, ...SIMA_WOUNDS].map((b) => b.species).sort();
    expect(pooled).toEqual(STORY_BOSSES.map((b) => b.id).sort());
    expect(new Set(pooled).size).toBe(pooled.length);
    expect(SIMA_WOUNDS.map((b) => b.species)).toContain('mimikyu-wound');
    for (const b of [...SIMA_SHADOWS, ...SIMA_WOUNDS]) {
      expect(ROOMS[b.room].spawns.map((s) => s.species)).toEqual([b.species]);
      expect(b.wound).toBe(b.species.endsWith('-wound'));
      expect(b.species.startsWith(`${b.line}-`)).toBe(true);
    }
  });

  it('the bag: one boss per sheet in each turn, every sheet in every turn', () => {
    const sheets = new Set(SIMA_SHADOWS.map((b) => b.sprite)).size;
    for (const seed of [1, 7, 4242]) {
      for (let turn = 0; turn < 3; turn++) {
        const drawn = Array.from({ length: sheets }, (_, i) => bagDraw(SIMA_SHADOWS, seed, 9, turn * sheets + i));
        expect(new Set(drawn.map((b) => b.sprite)).size).toBe(sheets);
      }
    }
    // Over enough turns, every shadow comes out (two on one sheet alternate).
    const all = new Set(Array.from({ length: sheets * 4 }, (_, i) => bagDraw(SIMA_SHADOWS, 3, 9, i).species));
    expect(all.size).toBe(SIMA_SHADOWS.length);
  });
});

describe('the Sendas in the Sima: wounds', () => {
  it('stand on 35, 55, 75... in the guardian echo\'s place, as an echo with the way on at the top', () => {
    for (const floor of [35, 55, 75, 95]) {
      expect(isWoundFloor(ENDLESS, floor)).toBe(true);
      const wound = woundAt(ENDLESS, 4242, floor)!;
      expect(runPlanAt(ECLIPSE, floor, 4242)).toEqual({ kind: 'room', room: wound.room, role: 'echo' });
    }
    expect(woundAt(ENDLESS, 4242, 45)).toBeNull();
    // The first turn of the bag shows every wound once.
    const firsts = [35, 55, 75, 95].map((f) => woundAt(ENDLESS, 4242, f)!.species);
    expect(new Set(firsts).size).toBe(Math.min(4, SIMA_WOUNDS.length));
  });

  it('a wound plays its whole tier\'s fight at a fixed share of its HP; only its damage grows with depth', () => {
    const { world } = startRun(4242, {}, 35, ECL);
    const wound = woundAt(ENDLESS, 4242, 35)!;
    expect(world.enemies.map((e) => e.species)).toEqual([wound.species]);
    expect(world.enemyScale?.echo).toBeUndefined();
    expect(world.enemyScale?.hp).toBe(SIMA_STORY.hp);
    expect(world.enemyScale?.damage).toBe(depthScale(ENDLESS.scaling, 35).damage);
    // Its Senda fight's HP on this tier (the same arena loaded unscaled), times the Sima's share.
    const own = loadRoom({ ...world, enemyScale: undefined }, wound.room).enemies[0]!;
    expect(world.enemies[0]!.maxHp / own.maxHp).toBeCloseTo(SIMA_STORY.hp, 2);
    expect(own.maxHp).toBeLessThan(SPECIES[wound.species].maxHp * 2);
    // No fog in front of a wound (it is an echo floor).
    expect(withFogWall(startRun(4242, {}, 35, ECL).run, world).fogWall).toBeUndefined();
  });
});

describe('the Sendas in the Sima: lost shadows («Sombra extraviada»)', () => {
  it('never before floor 12, never on an echo or herald floor; seeded; about `chance` of the floors', () => {
    let hits = 0;
    let floors = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (let f = 1; f <= 60; f++) {
        const stray = isStrayFloor(ENDLESS, seed, f);
        expect(stray && (f < SIMA_STORY.strays.fromFloor || isEchoFloor(ENDLESS, f))).toBe(false);
        expect(isStrayFloor(ENDLESS, seed, f)).toBe(stray);
        if (f >= SIMA_STORY.strays.fromFloor && !isEchoFloor(ENDLESS, f)) {
          floors++;
          if (stray) hits++;
        }
      }
    }
    expect(Math.abs(hits / floors - SIMA_STORY.strays.chance)).toBeLessThan(0.015);
  });

  it('a stray floor is the shadow\'s arena behind its fog, with a way down in the antechamber', () => {
    const seed = 4242;
    const floor = firstStray(seed);
    const shadow = strayAt(ENDLESS, seed, floor)!;
    const started = startRun(seed, {}, floor, ECL);
    expect(strayHere(started.run)).toBe(true);
    expect(fogWallFloor(started.run)).toBe(true);
    expect(started.run.kind).toBe('normal');
    const world = withFogWall(started.run, started.world);
    expect(world.fogWall).toBeDefined();
    expect(world.fogWall!.enemies.map((e) => e.species)).toEqual([shadow.species]);
    const stairs = world.arena.stairs!;
    expect(stairs.y).toBeGreaterThan(world.fogWall!.line);
    // Walking past: the stairs are a leaving point, and the party goes down without the fight.
    const onStairs: WorldState = { ...world, player: { ...world.player, pos: vec(stairs.x + stairs.width / 2, stairs.y + stairs.height / 2) } };
    expect(atLeavingPoint(started.run, onStairs, onStairs.player.pos)).toBe(true);
    const past = progressRun(started.run, onStairs, true);
    expect(past.entered).toBe(true);
    expect(past.run.floor).toBe(floor + 1);
    // Crossing the fog leaves the way past behind.
    expect(crossFogWall(world).arena.stairs).toBeUndefined();
  });

  it('felling the shadow pays its time once (less than an echo), and its way on opens at the top', () => {
    const seed = 4242;
    const floor = firstStray(seed);
    const started = startRun(seed, {}, floor, ECL);
    const crossed = crossFogWall(withFogWall(started.run, started.world));
    const felled = { ...crossed, enemies: crossed.enemies.map((e) => ({ ...e, hp: 0, alive: false })) };
    const paid = progressRun(started.run, felled);
    expect(paid.bonusMs).toBe(SIMA_STORY.strays.bonusMs);
    expect(progressRun(paid.run, felled).bonusMs ?? 0).toBe(0);
    const out = progressRun(paid.run, { ...felled, player: { ...felled.player, pos: vec(felled.arena.width / 2, 10) } });
    expect(out.entered).toBe(true);
  });

  it('depends on the seed only: the same seed gives the same floors and shadows, another seed others', () => {
    const plans = (seed: number) => Array.from({ length: 60 }, (_, i) => JSON.stringify(runPlanAt(ECLIPSE, i + 1, seed)));
    expect(plans(4242)).toEqual(plans(4242));
    expect(plans(4242)).not.toEqual(plans(4243));
    expect(depthScale(ENDLESS.scaling, 1).hp).toBe(1);
  });
});
