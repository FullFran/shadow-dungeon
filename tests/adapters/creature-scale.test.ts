import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREATURE_SCALE, creatureRect, drawCreatureFrame, withCreatureScale } from '../../src/adapters/creature-scale';
import { SHRINE_BOSSES } from '../../src/core/shrine';
import { TILE } from '../../src/core/tiles';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { lookKey, SPRITE_KEYS, SPRITES } from '../../src/data/sprites';

/** Owner, 2026-11-04: "Haz los pokemon tambien mas grandes". A visual scale only: hitboxes, AI ranges and network state never read it. */
const ROOT = new URL('../../', import.meta.url).pathname;
const pos = { x: 200, y: 300 };

type Meta = (typeof SPRITES.sprites)[string]['anims'][string];

/** Every sheet a playable species, a shrine boss or any other species can be drawn from: base, shiny and female looks. */
function metas(): { who: string; meta: Meta }[] {
  const ids = new Set<string>([...PLAYABLE_SPECIES, ...SHRINE_BOSSES.map((b) => b.boss), ...Object.keys(SPECIES)]);
  const out: { who: string; meta: Meta }[] = [];
  for (const id of ids) {
    const def = SPECIES[id as keyof typeof SPECIES];
    if (!def) continue;
    for (const shiny of [false, true])
      for (const female of [false, true]) {
        const sheet = SPRITES.sprites[lookKey(SPRITE_KEYS[def.sprite], shiny, female)];
        for (const [anim, meta] of Object.entries(sheet?.anims ?? {})) out.push({ who: `${id}${shiny ? ' shiny' : ''}${female ? ' female' : ''} ${anim}`, meta });
      }
  }
  return out;
}

describe('creature scale', () => {
  it('is one constant, large enough to read and small enough for a one-tile doorway', () => {
    expect(CREATURE_SCALE).toBe(1.5);
    // Playable species and shrine bosses: the idle frame stays under four and a half tiles tall (the biggest sheets are scenery-sized foes).
    const named = new Set<string>([...PLAYABLE_SPECIES, ...SHRINE_BOSSES.map((b) => b.boss)]);
    const idle = metas().filter((m) => m.who.endsWith(' Idle') && named.has(m.who.split(' ')[0]!));
    expect(idle.length).toBeGreaterThan(20);
    for (const { who, meta } of idle) expect(meta.frameHeight * CREATURE_SCALE, who).toBeLessThanOrEqual(TILE * 4.5);
  });

  it('covers every playable species and every shrine boss', () => {
    const who = new Set(metas().map((m) => m.who.split(' ')[0]));
    for (const id of PLAYABLE_SPECIES) expect(who.has(id), id).toBe(true);
    for (const stop of SHRINE_BOSSES) expect(who.has(stop.boss), stop.boss).toBe(true);
  });

  it('every species and boss frame is drawn at CREATURE_SCALE, feet-anchored', () => {
    expect(metas().length).toBeGreaterThan(100);
    for (const { who, meta } of metas()) {
      const rect = creatureRect(meta, pos);
      const anchor = meta.anchor ?? { x: meta.frameWidth / 2, y: meta.frameHeight * 0.75 };
      expect(rect.width, who).toBe(meta.frameWidth * CREATURE_SCALE);
      expect(rect.height, who).toBe(meta.frameHeight * CREATURE_SCALE);
      // The anchor (feet) stays on the position, to the pixel the rounding allows.
      expect(Math.abs(rect.x + anchor.x * CREATURE_SCALE - pos.x), who).toBeLessThanOrEqual(0.5);
      expect(Math.abs(rect.y + anchor.y * CREATURE_SCALE - pos.y), who).toBeLessThanOrEqual(0.5);
      expect(rect.y, who).toBeLessThan(pos.y);
      expect(rect.y + rect.height, who).toBeGreaterThanOrEqual(pos.y - 0.5);
    }
  });

  it('a boss keeps its relative size: a herald or wound factor multiplies the same scale', () => {
    const meta = { frameWidth: 40, frameHeight: 56 };
    const normal = creatureRect(meta, pos);
    const big = creatureRect(meta, pos, 1.7);
    expect(big.width / normal.width).toBeCloseTo(1.7, 5);
    expect(big.height / normal.height).toBeCloseTo(1.7, 5);
  });
});

/** A canvas context that only records what the creature code calls, with a translate/scale matrix. */
function recorder() {
  let m = { a: 1, d: 1, e: 0, f: 0 };
  const stack: (typeof m)[] = [];
  const calls: { image: unknown; args: number[] }[] = [];
  const ctx = {
    save: () => stack.push({ ...m }),
    restore: () => void (m = stack.pop() ?? m),
    translate: (x: number, y: number) => void (m = { ...m, e: m.e + m.a * x, f: m.f + m.d * y }),
    scale: (x: number, y: number) => void (m = { ...m, a: m.a * x, d: m.d * y }),
    drawImage: (image: unknown, ...args: number[]) => calls.push({ image, args }),
    imageSmoothingEnabled: true,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, raw: ctx, calls, map: (x: number, y: number) => ({ x: m.a * x + m.e, y: m.d * y + m.f }) };
}

describe('creature drawing', () => {
  it('drawCreatureFrame draws the frame into the creature rect, nearest-neighbour', () => {
    const meta = { frameWidth: 32, frameHeight: 48, anchor: { x: 16, y: 40 } };
    const r = recorder();
    drawCreatureFrame(r.ctx, {} as CanvasImageSource, meta, 2, 1, pos, 1);
    expect(r.calls).toHaveLength(1);
    const rect = creatureRect(meta, pos);
    expect(r.calls[0]!.args).toEqual([2 * 32, 1 * 48, 32, 48, rect.x, rect.y, rect.width, rect.height]);
    expect(r.raw.imageSmoothingEnabled).toBe(false);
  });

  it('withCreatureScale grows what is drawn around the feet and restores afterwards', () => {
    const r = recorder();
    let inside = { x: 0, y: 0 };
    let feet = { x: 0, y: 0 };
    withCreatureScale(r.ctx, pos, () => {
      inside = r.map(pos.x + 10, pos.y - 20);
      feet = r.map(pos.x, pos.y);
    });
    expect(feet).toEqual(pos);
    expect(inside.x).toBeCloseTo(pos.x + 10 * CREATURE_SCALE, 5);
    expect(inside.y).toBeCloseTo(pos.y - 20 * CREATURE_SCALE, 5);
    expect(r.map(pos.x + 10, pos.y - 20)).toEqual({ x: pos.x + 10, y: pos.y - 20 });
  });
});

describe('every draw path uses the constant', () => {
  it('the dungeon renderer and the town renderer draw creatures through creature-scale only', () => {
    for (const file of ['src/adapters/renderer.ts', 'src/town/render.ts']) {
      const source = readFileSync(`${ROOT}${file}`, 'utf8');
      expect(source, file).toContain('/creature-scale');
      expect(source, file).not.toMatch(/meta\.frameWidth \* scaleBy|anchor\.x \* scaleBy/);
      expect(source, file).not.toMatch(/Math\.round\(c\.pos\.x - anchor\.x\)/);
    }
  });
});
