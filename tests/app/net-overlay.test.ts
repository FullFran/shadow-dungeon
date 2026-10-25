import { describe, expect, it } from 'vitest';
import { netStatsLines } from '../../src/app/net-overlay';
import { setLanguage } from '../../src/i18n';

describe('net stats overlay text', () => {
  it('shows role, players, round trip per other player, snapshot rate and age, and bytes per second', () => {
    setLanguage('en');
    const lines = netStatsLines(
      { bytesOutPerSec: 2048, bytesInPerSec: 15360, snapshotsPerSec: 20, avgSnapshotAgeMs: 84.6, rttMs: { h: 41.2 } },
      {
        role: 'guest',
        localId: 'p2',
        selfPeer: 'g',
        roster: [
          { peer: 'h', id: 'p1', species: 'mimikyu' },
          { peer: 'g', id: 'p2', species: 'mimikyu' },
          { peer: 'x', id: 'p3', species: 'mimikyu' },
        ],
      },
    );
    expect(lines).toEqual([
      'Network (F3)',
      'Role: guest · P2',
      'Connected: 2',
      'RTT P1: 41 ms',
      'RTT P3: …',
      'Snapshots: 20/s · age 85 ms',
      'Out: 2.0 KB/s · In: 15.0 KB/s',
    ]);
  });

  it('leaves the snapshot line out on the host, which sends them', () => {
    setLanguage('en');
    const lines = netStatsLines(
      { bytesOutPerSec: 0, bytesInPerSec: 0, snapshotsPerSec: 0, avgSnapshotAgeMs: null, rttMs: {} },
      { role: 'host', localId: 'p1', selfPeer: 'h', roster: [{ peer: 'h', id: 'p1', species: 'mimikyu' }] },
    );
    expect(lines.some((l) => l.startsWith('Snapshots'))).toBe(false);
    expect(lines[1]).toBe('Role: host · P1');
  });
});
