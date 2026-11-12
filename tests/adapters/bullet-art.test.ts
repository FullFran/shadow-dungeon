import { describe, expect, it } from 'vitest';
import { POKEMON_TYPES } from '../../src/data/types';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { SPECIES, type SpeciesId } from '../../src/data/species';
import { STORY_FIGHTS } from '../../src/data/story/bosses';
import { behaviourFor } from '../../src/core/tricks';
import { heraldDef } from '../../src/core/herald/generate';
import { playViewport } from '../../src/adapters/viewport';
import {
  BULLET_LOOKS,
  BULLET_SIZES,
  bulletArt,
  bulletFrameCount,
  bulletSprite,
  GLOW_REACH,
  hangRingStep,
  HANG_STEPS,
  hangProgress,
  MIN_CORE_SCREEN_PX,
  OUTLINE,
  paintBullet,
  paintHangRing,
  ROLE,
  SIZE_CLASS_RADII,
  sizeClass,
} from '../../src/adapters/bullet-art';

/** Half the core's width along the cell's middle row, in cell pixels. */
function coreRadiusOf(cell: { size: number; roles: Uint8Array }): number {
  const row = cell.size / 2;
  let count = 0;
  for (let x = 0; x < cell.size; x++) if (cell.roles[row * cell.size + x] === ROLE.core) count++;
  return count / 2;
}

/** Farthest painted pixel centre from the cell centre. */
function reachOf(cell: { size: number; roles: Uint8Array }): number {
  const c = cell.size / 2;
  let far = 0;
  for (let y = 0; y < cell.size; y++) for (let x = 0; x < cell.size; x++) if (cell.roles[y * cell.size + x] !== ROLE.empty) far = Math.max(far, Math.hypot(x + 0.5 - c, y + 0.5 - c));
  return far;
}

const EVERY_RADIUS = Object.values(SIZE_CLASS_RADII).flat();

describe('bullet art: one look per type', () => {
  it('every type has a shape of its own', () => {
    for (const type of POKEMON_TYPES) expect(BULLET_LOOKS[type], type).toBeDefined();
    const shapes = POKEMON_TYPES.map((t) => BULLET_LOOKS[t].shape);
    expect(new Set(shapes).size).toBe(POKEMON_TYPES.length);
  });

  it('three size classes by the hitbox radius', () => {
    expect(BULLET_SIZES).toEqual(['S', 'M', 'L']);
    for (const size of BULLET_SIZES) for (const r of SIZE_CLASS_RADII[size]) expect(sizeClass(r), `r=${r}`).toBe(size);
    expect(sizeClass(4)).toBe('S');
    expect(sizeClass(5)).toBe('S');
    expect(sizeClass(6)).toBe('M');
    expect(sizeClass(7)).toBe('M');
    expect(sizeClass(8)).toBe('L');
    expect(sizeClass(14)).toBe('L');
  });
});

describe('bullet art: the bright core is exactly the hitbox', () => {
  it('every type, size class and frame paints a core of the hitbox radius', () => {
    for (const type of POKEMON_TYPES) {
      for (const r of EVERY_RADIUS) {
        for (let frame = 0; frame < bulletFrameCount(type); frame++) {
          const cell = paintBullet(type, r, frame);
          expect(coreRadiusOf(cell), `${type} r=${r} frame ${frame}`).toBe(r);
        }
      }
    }
  });

  it('the core is a disc: every pixel inside the radius is core, none outside', () => {
    for (const type of POKEMON_TYPES) {
      for (const r of EVERY_RADIUS) {
        const cell = paintBullet(type, r, 0);
        const c = cell.size / 2;
        for (let y = 0; y < cell.size; y++) {
          for (let x = 0; x < cell.size; x++) {
            const inside = Math.hypot(x + 0.5 - c, y + 0.5 - c) <= r;
            expect(cell.roles[y * cell.size + x] === ROLE.core, `${type} r=${r} (${x},${y})`).toBe(inside);
          }
        }
      }
    }
  });

  it('colour and glow never reach past 1.6 times the hitbox', () => {
    expect(GLOW_REACH).toBe(1.6);
    for (const type of POKEMON_TYPES) {
      for (const r of EVERY_RADIUS) {
        for (let frame = 0; frame < bulletFrameCount(type); frame++) expect(reachOf(paintBullet(type, r, frame)), `${type} r=${r}`).toBeLessThanOrEqual(GLOW_REACH * r + 0.75);
        for (let step = 0; step < HANG_STEPS; step++) expect(reachOf(paintHangRing(type, r, step)), `${type} ring r=${r}`).toBeLessThanOrEqual(GLOW_REACH * r + 0.75);
      }
    }
  });

  it('every bullet has a dark outline (it reads on bright and dark floors)', () => {
    for (const type of POKEMON_TYPES) {
      for (const r of EVERY_RADIUS) {
        const cell = paintBullet(type, r, 0);
        const outline = cell.roles.filter((role) => role === ROLE.outline).length;
        expect(outline, `${type} r=${r}`).toBeGreaterThan(0);
        // Its colour is the palette's outline key.
        const i = cell.roles.indexOf(ROLE.outline) * 4;
        expect(`#${[...cell.rgba.slice(i, i + 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`).toBe(OUTLINE);
      }
    }
  });

  it('the drawn core radius equals the hitbox radius, for every type and size class (fractional radii too)', () => {
    for (const type of POKEMON_TYPES) {
      for (const size of BULLET_SIZES) {
        for (const r of [...SIZE_CLASS_RADII[size], SIZE_CLASS_RADII[size][0]! + 0.5]) {
          const sprite = bulletSprite(type, r, { x: 3, y: 4 }, 1234, { state: 'flying' });
          const cell = paintBullet(type, sprite.bakedRadius, sprite.frame);
          const drawn = coreRadiusOf(cell) * (sprite.dw / cell.size);
          expect(drawn, `${type} ${size} r=${r}`).toBeCloseTo(r, 9);
          // Centred on the shot.
          expect(sprite.dx + sprite.dw / 2).toBeCloseTo(3, 9);
        }
      }
    }
  });

  it('a hanging shot keeps the same core, with a ring that closes as it nears relaunch', () => {
    for (const type of POKEMON_TYPES) {
      const sprite = bulletSprite(type, 6, { x: 0, y: 0 }, 0, { state: 'hanging', hang: 0.5 });
      expect(sprite.ring, type).toBeDefined();
      const cell = paintBullet(type, sprite.bakedRadius, sprite.frame);
      expect(coreRadiusOf(cell) * (sprite.dw / cell.size)).toBe(6);
    }
    expect(hangRingStep(0)).toBe(0);
    expect(hangRingStep(1)).toBe(HANG_STEPS - 1);
    // The ring closes: its reach shrinks step by step.
    const reaches = Array.from({ length: HANG_STEPS }, (_, s) => reachOf(paintHangRing('water', 8, s)));
    for (let s = 1; s < HANG_STEPS; s++) expect(reaches[s]!).toBeLessThan(reaches[s - 1]!);
  });
});

describe('bullet art: which shots use it', () => {
  const moving = { owner: 'enemy' as const, type: 'water' as const, radius: 6, vel: { x: 80, y: 0 } };
  const still = { ...moving, vel: { x: 0, y: 0 } };

  it('a moving enemy shot is a bullet of its type, of every type', () => {
    for (const type of POKEMON_TYPES) expect(bulletArt({ ...moving, type }, false)).toEqual({ kind: 'bullet', state: 'flying' });
  });

  it('a still enemy shot that was flying is hanging; one born still keeps its cloud, puddle or roots', () => {
    expect(bulletArt(still, true)).toEqual({ kind: 'bullet', state: 'hanging' });
    expect(bulletArt(still, false)).toEqual({ kind: 'still' });
  });

  it('a hanging shot reads its wait from the core when the core gives one (a `hold` with `leftMs` of `forMs`), else none', () => {
    expect(hangProgress({})).toBeUndefined();
    expect(hangProgress({ hold: { leftMs: 300, forMs: 1200 } })).toBe(0.75);
    expect(hangProgress({ hold: { leftMs: 0, forMs: 1200 } })).toBe(1);
    expect(hangProgress({ hold: { leftMs: 5000, forMs: 1200 } })).toBe(0);
    expect(hangProgress({ hold: { leftMs: 10, forMs: 0 } })).toBeUndefined();
  });

  it('player shots never use the enemy bullets (they keep their own looks)', () => {
    for (const type of POKEMON_TYPES) {
      expect(bulletArt({ ...moving, type, owner: 'player' }, false)).toEqual({ kind: 'player' });
      expect(bulletArt({ ...still, type, owner: 'player' }, true)).toEqual({ kind: 'player' });
    }
  });
});

/** Every enemy shot definition (an object with a speed above 0 and a radius) reachable from `root`. */
function shotRadii(root: unknown, out: Set<number>, seen = new Set<unknown>()): Set<number> {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  const o = root as Record<string, unknown>;
  if (typeof o.speed === 'number' && o.speed > 0 && typeof o.radius === 'number') out.add(o.radius);
  for (const v of Object.values(o)) shotRadii(v, out);
  return out;
}

describe('bullet art: a core of at least 4 px on the smallest phone', () => {
  it('every enemy shot of every enemy, card boss, Senda boss and herald', () => {
    const radii = new Set<number>();
    for (const species of Object.keys(SPECIES) as SpeciesId[]) for (const tier of DIFFICULTIES) shotRadii(behaviourFor(species, tier), radii);
    shotRadii(STORY_FIGHTS, radii);
    for (let seed = 1; seed <= 6; seed++) for (const tier of DIFFICULTIES) shotRadii(heraldDef(seed, 22 + seed * 12, tier), radii);
    expect(radii.size).toBeGreaterThan(3);
    const zooms = [playViewport(568, 320, 1, true).zoom, playViewport(320, 568, 1, true).zoom];
    for (const zoom of zooms) for (const r of radii) expect(2 * r * zoom, `r=${r} zoom ${zoom}`).toBeGreaterThanOrEqual(MIN_CORE_SCREEN_PX);
    expect(MIN_CORE_SCREEN_PX).toBe(4);
  }, 60_000);
});
