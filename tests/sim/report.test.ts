import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/sim/bands';
import { renderJson, renderMarkdown } from '../../src/sim/report';
import { runSweep, type SweepConfig } from '../../src/sim/sweep';

const SMALL: SweepConfig = { dungeons: ['crypt-of-the-sword-king'], tiers: ['easy'], bots: ['perfect'], parties: [1, 2], seeds: [1], maxFloors: 3, arenaBots: ['perfect'] };

describe('balance report', () => {
  it('renders tables per dungeon/tier/bot/party, the gate line, and the same text for the same sweep', () => {
    const sweep = runSweep(SMALL);
    const checks = evaluate(sweep);
    const md = renderMarkdown(sweep, checks);
    expect(md).toContain('# Balance report');
    expect(md).toMatch(/\*\*Gate: (PASS|FAIL \(\d+\))\*\*/);
    expect(md).toContain('## crypt-of-the-sword-king');
    expect(md).toContain('| easy | perfect | 1 |');
    expect(md).toContain('| easy | perfect | 2 |');
    expect(md).toContain('| F6 aegislash | easy | perfect | 1 |');
    expect(renderMarkdown(runSweep(SMALL), evaluate(runSweep(SMALL)))).toBe(md);
    const json = JSON.parse(renderJson(sweep, checks));
    expect(json.runs).toHaveLength(2);
    expect(json.arenas).toHaveLength(4);
  }, 60_000);
});
