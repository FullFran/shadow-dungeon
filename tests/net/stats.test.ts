import { describe, expect, it } from 'vitest';
import { createStatsTracker } from '../../src/net/stats';

describe('net stats aggregator', () => {
  it('reports bytes per second out and in over a sliding one-second window', () => {
    const stats = createStatsTracker();
    stats.sent(100, 0);
    stats.sent(100, 500);
    stats.received(300, 600);
    expect(stats.summary(999)).toMatchObject({ bytesOutPerSec: 200 });
    expect(stats.summary(1000)).toMatchObject({ bytesOutPerSec: 100, bytesInPerSec: 300 });
    expect(stats.summary(1600)).toMatchObject({ bytesOutPerSec: 0, bytesInPerSec: 0 });
  });

  it('counts snapshots received per second and averages their age', () => {
    const stats = createStatsTracker();
    for (let at = 0; at < 1000; at += 50) stats.snapshot(at < 500 ? 30 : 50, at);
    const summary = stats.summary(999);
    expect(summary.snapshotsPerSec).toBe(20);
    expect(summary.avgSnapshotAgeMs).toBeCloseTo(40);
  });

  it('has no snapshot age when nothing arrived', () => {
    const summary = createStatsTracker().summary(5000);
    expect(summary).toEqual({ bytesOutPerSec: 0, bytesInPerSec: 0, snapshotsPerSec: 0, avgSnapshotAgeMs: null, rttMs: {} });
  });

  it('smooths the round trip per peer and forgets a peer that left', () => {
    const stats = createStatsTracker();
    stats.rtt('a', 100);
    expect(stats.summary(0).rttMs).toEqual({ a: 100 });
    stats.rtt('a', 200);
    stats.rtt('b', 40);
    expect(stats.summary(0).rttMs).toEqual({ a: 125, b: 40 });
    stats.forget('a');
    expect(stats.summary(0).rttMs).toEqual({ b: 40 });
  });
});
