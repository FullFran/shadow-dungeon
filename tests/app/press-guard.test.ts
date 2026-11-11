import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESS_GRACE_MS, pressGuard } from '../../src/app/press-guard';

const source = (file: string) => readFileSync(join(__dirname, '../../src', file), 'utf8');

describe('press guard (issue #53: an attack click in progress must not dismiss a dialog)', () => {
  it('ignores attack clicks that keep coming when the boss last line appears, then takes one deliberate press', () => {
    const guard = pressGuard();
    guard.arm(1000);
    const accepted: number[] = [];
    // The player keeps clicking to attack every 150 ms for 3 seconds.
    for (let at = 1020; at < 4000; at += 150) if (guard.accept(at)) accepted.push(at);
    expect(accepted).toEqual([]);
    // They stop, read, and press once.
    expect(guard.accept(5000)).toBe(true);
  });

  it('ignores any press inside the grace window, even a lone one', () => {
    const guard = pressGuard();
    guard.arm(0);
    expect(guard.accept(PRESS_GRACE_MS - 1)).toBe(false);
    expect(guard.accept(PRESS_GRACE_MS + 400)).toBe(true);
  });

  it('a later line armed with a short grace takes a deliberate press soon, not a double click', () => {
    const guard = pressGuard();
    guard.arm(0);
    expect(guard.accept(2000)).toBe(true);
    guard.arm(2000, 250);
    expect(guard.accept(2100)).toBe(false);
    expect(guard.accept(2700)).toBe(true);
  });
});

describe('the guard is wired into every dialog that can open mid-fight', () => {
  const game = source('app/game.ts');
  it('the story box answers pointer and key only through the guard, and the pad leaves combat mode for it', () => {
    expect(game).toMatch(/storyBox\.addEventListener\('pointerdown'[\s\S]{0,300}storyGuard\.accept\(/);
    expect(game).toMatch(/if \(storyBox\) \{[\s\S]{0,250}storyGuard\.accept\(/);
    expect(game).toMatch(/setCombat\([^\n]*storyBox/);
  });
  it('the solo item pick after a boss confirms a click through the guard', () => {
    expect(game).toMatch(/pickGuard\.accept\(/);
  });
});
