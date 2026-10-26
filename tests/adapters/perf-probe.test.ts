import { describe, expect, it } from 'vitest';
import { createPerfProbe, summarize } from '../../src/adapters/perf-probe';

describe('perf probe', () => {
  it('summarizes samples as nearest-rank percentiles', () => {
    const s = summarize([5, 1, 4, 2, 3, 10, 6, 7, 8, 9]);
    expect(s).toEqual({ count: 10, mean: 5.5, p50: 5, p95: 10, max: 10 });
  });

  it('summarizes nothing as zeros', () => {
    expect(summarize([])).toEqual({ count: 0, mean: 0, p50: 0, p95: 0, max: 0 });
  });

  it('records named channels and resets them', () => {
    const probe = createPerfProbe(4);
    probe.record('render', 2);
    probe.record('render', 4);
    probe.record('sim', 1);
    expect(probe.report().render).toMatchObject({ count: 2, mean: 3, max: 4 });
    expect(probe.report().sim).toMatchObject({ count: 1 });
    probe.reset();
    expect(probe.report()).toEqual({});
  });

  it('keeps only the newest samples of a channel (bounded memory)', () => {
    const probe = createPerfProbe(3);
    for (const v of [100, 1, 2, 3]) probe.record('frame', v);
    expect(probe.report().frame).toMatchObject({ count: 3, max: 3 });
  });
});
