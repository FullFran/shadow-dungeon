import { describe, expect, it } from 'vitest';
import { MOVES, type MoveDef } from '../../src/data/moves';
import { bakeEffect } from '../../src/adapters/fx/bake';
import { allMoveCues, cueKey, cueRequest, impactCue, moveCue, projectileCue, typeRamp } from '../../src/adapters/fx/cues';
import { EFFECT_IDS, loadEffect } from '../../src/adapters/fx/effects';
import { TYPE_COLORS } from '../../src/ui/tokens';
import type { PokemonType } from '../../src/data/types';

const ALL_MOVES = Object.values(MOVES) as MoveDef[];
const ALL_TYPES = Object.keys(TYPE_COLORS) as PokemonType[];

describe('baking an effect', () => {
  it('samples the asked frames into one atlas with their offsets from the origin', async () => {
    const baked = bakeEffect(await loadEffect('impacts/hit-spark'), { effect: 'impacts/hit-spark', frames: 5 });
    expect(baked.frames).toHaveLength(5);
    expect(baked.pixels.length).toBe(baked.width * baked.height * 4);
    const drawn = baked.frames.filter((f) => f.w > 0);
    expect(drawn.length).toBeGreaterThan(1);
    for (const f of drawn) {
      expect(f.x + f.w).toBeLessThanOrEqual(baked.width);
      expect(f.y + f.h).toBeLessThanOrEqual(baked.height);
    }
    expect(baked.bounds.right).toBeGreaterThan(0);
  });

  it('is smaller than the raw frames: frames are trimmed to what they draw', async () => {
    const mod = await loadEffect('melee/sword-slash');
    const baked = bakeEffect(mod, { effect: 'melee/sword-slash', frames: 7 });
    const [w = 0, h = 0] = mod.meta?.size ?? [];
    expect(baked.width * baked.height).toBeLessThan(w * h * 7 * 0.6);
  });

  it('gives the same pixels for the same request', async () => {
    const mod = await loadEffect('spawn/poof');
    const a = bakeEffect(mod, { effect: 'spawn/poof', frames: 4 });
    const b = bakeEffect(mod, { effect: 'spawn/poof', frames: 4 });
    expect(Buffer.from(a.pixels).equals(Buffer.from(b.pixels))).toBe(true);
  });

  it('recolours with a type ramp', async () => {
    const mod = await loadEffect('impacts/hit-spark');
    const plain = bakeEffect(mod, { effect: 'impacts/hit-spark', frames: 3 });
    const tinted = bakeEffect(mod, { effect: 'impacts/hit-spark', frames: 3, options: { palette: typeRamp('poison') } });
    expect(Buffer.from(plain.pixels).equals(Buffer.from(tinted.pixels))).toBe(false);
  });
});

describe('every move has its look', () => {
  it.each(ALL_MOVES.map((m) => [m.id, m] as const))('%s', (_id, move) => {
    if (move.hitbox.kind === 'projectile') {
      expect(moveCue(move)).toBeNull();
      expect(EFFECT_IDS).toContain(projectileCue(move.type).effect);
    } else {
      expect(EFFECT_IDS).toContain(moveCue(move)?.effect);
    }
  });

  it.each(ALL_TYPES)('%s has shots and hits', (type) => {
    expect(EFFECT_IDS).toContain(projectileCue(type).effect);
    expect(EFFECT_IDS).toContain(impactCue(type, false).effect);
    expect(EFFECT_IDS).toContain(impactCue(type, true).effect);
  });

  it('every look bakes and draws something, and a tint is an option the effect has', async () => {
    const cues = new Map(allMoveCues(ALL_MOVES).map((c) => [cueKey(c), c]));
    for (const c of cues.values()) {
      const mod = await loadEffect(c.effect);
      if (c.tint) expect(mod.meta?.options, `${c.effect} takes a palette`).toHaveProperty('palette');
      const baked = bakeEffect(mod, cueRequest(c));
      expect(baked.frames.some((f) => f.w > 0), c.effect).toBe(true);
    }
  }, 120_000);

  it('a whole movepool of looks stays well under the memory cap', async () => {
    const cues = new Map(allMoveCues(ALL_MOVES).map((c) => [cueKey(c), c]));
    let bytes = 0;
    for (const c of cues.values()) {
      const baked = bakeEffect(await loadEffect(c.effect), cueRequest(c));
      bytes += baked.width * baked.height * 4;
    }
    // Every look of every move at once: far more than one run ever shows.
    expect(bytes).toBeLessThan(64 * 1024 * 1024);
  }, 120_000);
});
