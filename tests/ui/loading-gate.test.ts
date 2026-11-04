import { describe, expect, it } from 'vitest';
import { createLoadingGate, loadingProgress, tipIndex } from '../../src/ui/loading-gate';

/** A fake clock: timers fire when `advance` passes them. */
function clock() {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    schedule: (fn: () => void, ms: number) => {
      id += 1;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    cancel: (handle: number) => void timers.delete(handle),
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
}

function gate(delayMs = 150, minVisibleMs = 400) {
  const c = clock();
  const log: string[] = [];
  const g = createLoadingGate({ delayMs, minVisibleMs, ...c, show: () => log.push(`show@${c.now()}`), hide: () => log.push(`hide@${c.now()}`) });
  return { c, g, log };
}

describe('loading gate (no flash under the delay)', () => {
  it('does not show anything when the work ends before the delay', () => {
    const { c, g, log } = gate();
    g.start();
    c.advance(100);
    g.stop();
    c.advance(1000);
    expect(log).toEqual([]);
  });

  it('shows after the delay when the work is still going', () => {
    const { c, g, log } = gate();
    g.start();
    c.advance(149);
    expect(log).toEqual([]);
    c.advance(1);
    expect(log).toEqual(['show@150']);
  });

  it('once shown it stays for the minimum so it never blinks, then hides', () => {
    const { c, g, log } = gate();
    g.start();
    c.advance(200);
    g.stop();
    expect(log).toEqual(['show@150']);
    c.advance(349);
    expect(log).toEqual(['show@150']);
    c.advance(1);
    expect(log).toEqual(['show@150', 'hide@550']);
  });

  it('hides at once when the minimum already passed', () => {
    const { c, g, log } = gate();
    g.start();
    c.advance(2000);
    g.stop();
    expect(log).toEqual(['show@150', 'hide@2000']);
  });

  it('can run again after it finished', () => {
    const { c, g, log } = gate();
    g.start();
    c.advance(1000);
    g.stop();
    g.start();
    c.advance(150);
    expect(log.filter((l) => l.startsWith('show'))).toHaveLength(2);
  });
});

describe('progress and tips', () => {
  it('progress is a clamped whole percent and never goes backwards', () => {
    expect(loadingProgress(0, 0)).toBe(0);
    expect(loadingProgress(1, 4)).toBe(25);
    expect(loadingProgress(9, 4)).toBe(100);
    expect(loadingProgress(2, 3)).toBe(67);
  });

  it('the tip rotates through the list and wraps', () => {
    expect(tipIndex(0, 8, 0)).toBe(0);
    expect(tipIndex(4000, 8, 0, 4000)).toBe(1);
    expect(tipIndex(8 * 4000, 8, 0, 4000)).toBe(0);
    expect(tipIndex(0, 8, 5)).toBe(5);
  });
});
