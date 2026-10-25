import { describe, expect, it } from 'vitest';
import { bonusPopup } from '../../src/adapters/clock-hud';
import { progressRun, startRun, tickRunClock } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { simaEventLines, SUMMARY_LINES } from '../../src/app/sima-summary';
import { ENDLESS } from '../../src/data/endless';
import { catalog } from '../../src/i18n';

const ECL = 'eclipse-chasm' as const;
const toStairs = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });

describe('Sima pacing', () => {
  it('every floor starts with a few seconds of breathing room: the clock waits, then runs', () => {
    const grace = ENDLESS.clock.graceMs!;
    expect(grace).toBeGreaterThanOrEqual(2000);
    const { run } = startRun(4242, {}, 1, ECL);
    expect(run.graceMs).toBe(grace);
    const waited = tickRunClock(run, grace - 100);
    expect(waited.clockMs).toBe(run.clockMs);
    const ran = tickRunClock(waited, 600);
    expect(ran.clockMs).toBe(run.clockMs! - 500);
    expect(ran.graceMs).toBe(0);
    // A new floor brings it back.
    const started = startRun(4242, {}, 1, ECL);
    const down = progressRun(tickRunClock(started.run, 10_000), toStairs(started.world));
    expect(down.entered).toBe(true);
    expect(down.run.graceMs).toBe(grace);
    // Other dungeons have no clock and no grace.
    expect(startRun(4242, {}, 1).run.graceMs).toBeUndefined();
  });

  it('the time popup is big, rounded to whole seconds, and says why the time came', () => {
    const popup = bonusPopup({ ms: 39_600, shownAtMs: 0, reason: 'descend' }, 200, (k) => `[${k}]`);
    expect(popup).toMatchObject({ text: '+40 s', reason: '[sima.bonus.descend]' });
    expect(popup!.size).toBeGreaterThanOrEqual(14);
    expect(bonusPopup({ ms: 20_000, shownAtMs: 0 }, 200, (k) => k)!.reason).toBeNull();
    expect(bonusPopup({ ms: 20_000, shownAtMs: 0 }, 99_999, (k) => k)).toBeNull();
    const es = catalog('es');
    for (const reason of ['descend', 'echo', 'crystal', 'waves', 'shrine']) expect(es[`sima.bonus.${reason}`]).toBeTruthy();
  });

  it('the end screen lists the events taken, floor by floor, in plain words', () => {
    const t = (key: string) => catalog('es')[key] ?? key;
    const lines = simaEventLines(
      [
        { floor: 4, kind: 'shrine', outcome: 'accepted' },
        { floor: 7, kind: 'waves', outcome: 'cleared' },
        { floor: 9, kind: 'crystal', outcome: 'faded' },
      ],
      t,
    );
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('4');
    expect(lines[0]).toContain(t('sima.event.shrine'));
    expect(lines[0]).toContain(t('sima.outcome.accepted'));
    expect(lines.every((l) => !l.includes('sima.'))).toBe(true);
    expect(simaEventLines([], t)).toEqual([]);
    // A long run keeps the list short: the last ones, with a count of the rest.
    const many = Array.from({ length: 12 }, (_, i) => ({ floor: i + 2, kind: 'crystal' as const, outcome: 'taken' as const }));
    const shown = simaEventLines(many, t);
    expect(shown).toHaveLength(SUMMARY_LINES + 1);
    expect(SUMMARY_LINES).toBeLessThanOrEqual(6);
    expect(shown.at(-1)).toContain(String(12 - SUMMARY_LINES));
  });
});
