import { describe, expect, it } from 'vitest';
import { FIGURATIONS, figurationMode, figurationsAt, type FigurationInput, type FigurationMode } from '../../src/adapters/figurations';
import { startRun, tickRunClock } from '../../src/core/run';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { ECLIPSE } from '../../src/data/dungeons';
import { IDLE } from '../core/helpers';

/**
 * Figuraciones (docs/sima-redesign.md §3): shapes at the edge of the view
 * under low lucidity, presentation only. They never touch the simulation:
 * the same seed played with them on and off gives the same world; they need
 * low lucidity, come apart near the player, and keep still when reduced.
 */
const VIEW = { x: 0, y: 0, width: 480, height: 270 };
const base = (over: Partial<FigurationInput> = {}): FigurationInput => ({ mode: 'on', clockMs: 10_000, timeMs: 0, view: VIEW, player: { x: 240, y: 135 }, sprites: ['gengar', 'haunter'], salt: 12, ...over });
const over = (input: Partial<FigurationInput>, ms = 120_000) => Array.from({ length: ms / 100 }, (_, i) => figurationsAt(base({ ...input, timeMs: i * 100 })));

describe('figuraciones', () => {
  it('only under low lucidity, never when off, never at 0 (the run is over)', () => {
    expect(over({ clockMs: FIGURATIONS.belowMs + 1 }).flat()).toEqual([]);
    expect(over({ mode: 'off' }).flat()).toEqual([]);
    expect(over({ clockMs: 0 }).flat()).toEqual([]);
    expect(over({}).flat().length).toBeGreaterThan(0);
  });

  it('more often the lower the lucidity; one at a time, at the edge, faint', () => {
    const low = over({ clockMs: 2000 }).filter((f) => f.length > 0).length;
    const mid = over({ clockMs: 50_000 }).filter((f) => f.length > 0).length;
    expect(low).toBeGreaterThan(mid);
    for (const frame of over({})) {
      expect(frame.length).toBeLessThanOrEqual(1);
      for (const f of frame) {
        expect(f.alpha).toBeLessThanOrEqual(FIGURATIONS.alpha);
        const edge = Math.min(f.pos.x - VIEW.x, VIEW.x + VIEW.width - f.pos.x, f.pos.y - VIEW.y, VIEW.y + VIEW.height - f.pos.y);
        expect(edge).toBeLessThan(70);
      }
    }
  });

  it('comes apart as the player nears it', () => {
    const shown = over({}).flat()[0]!;
    expect(figurationsAt(base({ player: shown.pos, timeMs: over({}).findIndex((f) => f.length > 0) * 100 }))).toEqual([]);
  });

  it('reduced: rarer, fainter, and still; reduced motion turns «on» down to reduced', () => {
    const on = over({}).filter((f) => f.length > 0).length;
    const reduced = over({ mode: 'reduced' });
    expect(reduced.filter((f) => f.length > 0).length).toBeLessThan(on);
    for (const f of reduced.flat()) {
      expect(f.walking).toBe(false);
      expect(f.alpha).toBeLessThanOrEqual(FIGURATIONS.alpha / 2);
    }
    expect(figurationMode('on', true)).toBe('reduced');
    expect(figurationMode('off', true)).toBe('off');
    expect(figurationMode('on', false)).toBe('on');
  });

  it('never touch the simulation: the same seed with them on and off gives the same world', () => {
    const play = (mode: FigurationMode) => {
      let { run, world } = startRun(4242, {}, 3, ECLIPSE.id);
      run = { ...run, clockMs: 20_000 };
      const seen: unknown[] = [];
      for (let i = 0; i < 400; i++) {
        world = step(world, IDLE, FIXED_DT_MS);
        run = tickRunClock(run, FIXED_DT_MS);
        // The game works them out every frame from what it draws; they go to the renderer only.
        seen.push(...figurationsAt({ mode, clockMs: run.clockMs!, timeMs: i * FIXED_DT_MS, view: VIEW, player: world.player.pos, sprites: ['gengar'], salt: run.floor }));
      }
      return { world: JSON.stringify(world), run: JSON.stringify(run), seen: seen.length };
    };
    const on = play('on');
    const off = play('off');
    expect(on.world).toBe(off.world);
    expect(on.run).toBe(off.run);
    expect(on.seen).toBeGreaterThan(0);
    expect(off.seen).toBe(0);
  });
});
