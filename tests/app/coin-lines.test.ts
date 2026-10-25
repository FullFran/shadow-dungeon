import { describe, expect, it } from 'vitest';
import { coinLines } from '../../src/app/coin-lines';
import type { CoinBreakdown } from '../../src/core/coins';

const tr = (key: string) => (key === 'hud.coins' ? '{coins} P' : key === 'screen.coins.share' ? '{pct} %' : key);
const base: CoinBreakdown = { floors: 36, enemies: 41, escapes: 0, guardian: 0, time: 6, subtotal: 83, share: 1, multiplier: 1, total: 83 };

describe('end screen coin lines', () => {
  it('lists the earning lines with coins, skipping empty bonuses, then the total and the balance', () => {
    const lines = coinLines(base, 200, tr);
    expect(lines.map((l) => l.label)).toEqual(['screen.coins.floors', 'screen.coins.enemies', 'screen.coins.time', 'screen.coins.total', 'screen.coins.balance']);
    expect(lines.at(-2)?.value).toBe('+83 P');
    expect(lines.at(-1)?.value).toBe('200 P');
  });

  it('shows the share kept on defeat and the guardian on victory', () => {
    const lost = coinLines({ ...base, share: 0.75, total: 62 }, 62, tr).map((l) => l.label);
    expect(lost).toContain('75 %');
    const won = coinLines({ ...base, guardian: 50, escapes: 12, subtotal: 145, total: 145 }, 145, tr).map((l) => l.label);
    expect(won).toContain('screen.coins.guardian');
    expect(won).toContain('screen.coins.escapes');
    expect(won.some((l) => l.endsWith('%'))).toBe(false);
  });
});
