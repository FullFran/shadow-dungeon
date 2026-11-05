import { describe, expect, it } from 'vitest';
import { drawSimaBackdrop } from '../../src/adapters/sima-backdrop';
import { CHALLENGES, DUNGEONS, SENDA_ROADS, TUTORIAL } from '../../src/data/dungeons';
import { WORLD } from '../../src/data/world';
import * as townRender from '../../src/town/render';

/**
 * The play view is top-down: no horizon. The town used to paint a sky band (an eclipse with a corona, a ruined
 * skyline, birds) along the top edge of the map, and the Sima an eclipse disc with spires behind its void.
 * A recording context stands in for the canvas (the suite runs in node).
 */
function recorder() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ((calls.push(name), gradient));
        if (name === 'measureText') return () => ({ width: 40 });
        return (..._args: unknown[]) => void calls.push(name);
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const VIEWS = [
  { x: 0, y: 0, width: 512, height: 320 },
  { x: 0, y: 0, width: 1440, height: 900 },
  { x: -300, y: -200, width: 720, height: 450 },
];

describe('the town has no sky band', () => {
  it('exports no sky band size', () => {
    expect('SKY_BAND' in townRender).toBe(false);
  });

  for (const map of Object.values(WORLD)) {
    for (const view of VIEWS) {
      it(`${map.id} at ${view.width}x${view.height}: no eclipse disc is drawn`, () => {
        const { ctx, calls } = recorder();
        townRender.drawTownWorld(ctx, new Map(), new Map(), { map, look: map.look, view, timeMs: 1234, characters: [] });
        // The sky's eclipse and its corona were the only arcs the town world drew.
        expect(calls).not.toContain('arc');
      });
    }

    it(`${map.id}: the look carries no sky size and no birds`, () => {
      expect(Object.keys(map.look)).not.toContain('eclipse');
      expect(Object.keys(map.look)).not.toContain('birds');
    });
  }
});

describe('the Sima backdrop has no eclipse disc', () => {
  for (const floor of [1, 10, 30, 60, 200]) {
    for (const abyss of [false, true]) {
      it(`floor ${floor}${abyss ? ' (abyss)' : ''}: only a dark void with drifting rock`, () => {
        const { ctx, calls } = recorder();
        drawSimaBackdrop(ctx, { x: 0, y: 0, width: 720, height: 450 }, 2, { floor, abyss }, 5000);
        expect(calls).not.toContain('arc');
      });
    }
  }
});

describe('outside the map every dungeon shows its own darkest colour', () => {
  const luminance = (hex: string): number => {
    const channel = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  };
  for (const dungeon of [...DUNGEONS, ...CHALLENGES, ...SENDA_ROADS, TUTORIAL]) {
    it(`${dungeon.id}: the wall colour that fills the void is near black`, () => {
      expect(dungeon.palette.wall).toMatch(/^#[0-9a-f]{6}$/i);
      expect(luminance(dungeon.palette.wall)).toBeLessThan(0.06);
    });
  }
});
