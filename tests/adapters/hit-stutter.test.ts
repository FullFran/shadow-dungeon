import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyEvents, initialJuice, JUICE } from '../../src/adapters/juice';
import { MOVES, type MoveDef } from '../../src/data/moves';
import { measure } from '../../tools/hit-stutter';

const damaging = (Object.values(MOVES) as MoveDef[]).filter((m) => m.power > 0);
/** Remote players are drawn this far in the past (src/net/session.ts): a longer silence makes them jump. */
const RENDER_DELAY_MS = 100;

describe('mashing a move never stutters the game', () => {
  it.each(damaging.map((m) => [m.id, m] as const))('%s: co-op keeps sending within the render delay', (_id, move) => {
    expect(measure(move, { shared: true, seconds: 6 }).sendGap).toBeLessThan(RENDER_DELAY_MS);
  });

  it.each(damaging.filter((m) => (m.multiHit ?? 1) > 1).map((m) => [m.id, m] as const))('%s: solo, a multi-hit move freezes less than a single blow', (_id, move) => {
    expect(measure(move, { seconds: 6 }).frozen).toBeLessThan(0.15);
  });

  it('a co-op run does not stop its world for a hitstop', () => {
    expect(readFileSync('src/app/game.ts', 'utf8')).toContain('const frozen = !net && juice.hitstopMs > 0;');
  });

  it('only the last part of a multi-hit move stops the action; every part still shows its number', () => {
    const hit = (finisher?: boolean) => ({ type: 'enemyHit' as const, enemyId: 'e', damage: 4, effectiveness: 1, pos: { x: 0, y: 0 }, moveId: 'fury-swipes' as const, ...(finisher ? { finisher } : {}) });
    const part = applyEvents(initialJuice(), [hit()], { x: 0, y: 0 });
    expect(part.hitstopMs).toBe(0);
    expect(part.numbers).toHaveLength(1);
    expect(applyEvents(initialJuice(), [hit(true)], { x: 0, y: 0 }).hitstopMs).toBe(JUICE.heavyHitstopMs);
  });

  it('a single blow keeps its hitstop', () => {
    const one = { type: 'enemyHit' as const, enemyId: 'e', damage: 4, effectiveness: 1, pos: { x: 0, y: 0 }, moveId: 'slash' as const };
    expect(applyEvents(initialJuice(), [one], { x: 0, y: 0 }).hitstopMs).toBe(JUICE.hitstopMs);
  });
});
