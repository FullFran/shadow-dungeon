import { describe, expect, it } from 'vitest';
import { stepDifficulty, type Difficulty } from '../../src/data/difficulty';
import { restartsLeft } from '../../src/core/difficulty';
import { restartLabel } from '../../src/app/menu';
import { tierRow } from '../../src/town/lobby';

const tr = (key: string) => key;

describe('difficulty selector', () => {
  it('steps through the tiers: clamped with ◀ ▶, wrapping on confirm', () => {
    expect(stepDifficulty('easy', -1)).toBe('easy');
    expect(stepDifficulty('easy', 1)).toBe('normal');
    expect(stepDifficulty('nightmare', 1)).toBe('nightmare');
    expect(stepDifficulty('nightmare', 1, true)).toBe('easy');
  });

  it('gives the host (and only the host) a tier row in the town windows', () => {
    let tier: Difficulty = 'normal';
    let redraws = 0;
    const host = { isHost: true, difficulty: () => tier, setDifficulty: (d: Difficulty) => (tier = d) };
    const row = tierRow(host, 'Dificultad', (d) => `tier:${d}`, () => redraws++)!;
    expect(row.value).toBe('tier:normal');
    row.onAdjust(1);
    expect(tier).toBe('hard');
    expect(redraws).toBe(1);
    expect(tierRow({ ...host, isHost: false }, 'Dificultad', String, () => undefined)).toBeNull();
    expect(tierRow(null, 'Dificultad', String, () => undefined)).toBeNull();
  });
});

describe('solo floor restarts per tier', () => {
  it('are unlimited on easy and normal, one per floor on hard, none on nightmare', () => {
    expect(restartsLeft('easy', 50)).toBeNull();
    expect(restartsLeft('normal', 3)).toBeNull();
    expect(restartsLeft('hard', 0)).toBe(1);
    expect(restartsLeft('hard', 1)).toBe(0);
    expect(restartsLeft('nightmare', 0)).toBe(0);
  });

  it('label the Esc menu row: plain when unlimited, the count otherwise', () => {
    expect(restartLabel(null, tr)).toBe('pause.restart');
    expect(restartLabel(undefined, tr)).toBe('pause.restart');
    expect(restartLabel(1, tr)).toBe('pause.restart (1)');
    expect(restartLabel(0, tr)).toBe('pause.restartNone');
  });
});
