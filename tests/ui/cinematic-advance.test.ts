import { describe, expect, it } from 'vitest';
import { holdAtMs, revealEndMs } from '../../src/ui/cinematic';
import type { CinematicPanel } from '../../src/data/prologue';

// odd/tasks/menu-redesign.md S13: "los textos de las cinematicas, haz que puedas pasarlos dandole al boton o ponerlos en auto".
const panel = (over: Partial<CinematicPanel> = {}): CinematicPanel => ({
  id: 'p',
  scene: 'light',
  durationMs: 9000,
  fadeInMs: 600,
  fadeOutMs: 800,
  lines: ['a', 'b'],
  textStartMs: 1000,
  charsPerSecond: 20,
  lineGapMs: 500,
  camera: { from: { x: 0, y: 0, zoom: 1 }, to: { x: 0, y: 0, zoom: 1 } },
  ...over,
});

describe('press to advance', () => {
  it('the text ends after its start, every character at its pace and the gaps between lines', () => {
    // 1000 + 40 chars at 20/s (2000) + one 500 gap.
    expect(revealEndMs(panel(), [20, 20])).toBe(3500);
    expect(revealEndMs(panel({ lines: ['a'] }), [10])).toBe(1500);
  });

  it('manual play waits once the text is out, before the fade, and never past it', () => {
    expect(holdAtMs(panel(), [20, 20])).toBe(3500);
    // Text that would still be running at the fade: the wait sits at the fade's start.
    expect(holdAtMs(panel({ durationMs: 3000 }), [20, 20])).toBe(2200);
  });

  it('a panel without words never waits', () => {
    expect(holdAtMs(panel({ lines: [] }), [])).toBeNull();
  });
});
