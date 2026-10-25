/**
 * Net stats for the F3 overlay (docs/gdd.md §12): bytes per second out and
 * in, snapshots received per second and their average age over a sliding
 * window, and a smoothed round trip per peer. Pure: the caller passes the
 * time of every sample.
 */
export interface StatsSummary {
  bytesOutPerSec: number;
  bytesInPerSec: number;
  snapshotsPerSec: number;
  /** Average age of the snapshots received in the window (ms); null when none arrived. */
  avgSnapshotAgeMs: number | null;
  /** Smoothed round trip per transport peer id (ms). */
  rttMs: Record<string, number>;
}

export interface StatsTracker {
  sent(bytes: number, now: number): void;
  received(bytes: number, now: number): void;
  snapshot(ageMs: number, now: number): void;
  rtt(peer: string, ms: number): void;
  forget(peer: string): void;
  /** The smoothed round trip to `peer`, if measured. */
  rttOf(peer: string): number | undefined;
  summary(now: number): StatsSummary;
}

/** Weight of a new round-trip sample in the smoothed value. */
const RTT_SMOOTHING = 0.25;

export function createStatsTracker(windowMs = 1000): StatsTracker {
  type Entry = { at: number; value: number };
  let out: Entry[] = [];
  let incoming: Entry[] = [];
  let snapshots: Entry[] = [];
  const rtt = new Map<string, number>();
  const prune = (entries: Entry[], now: number) => entries.filter((e) => e.at > now - windowMs);
  const sum = (entries: Entry[]) => entries.reduce((total, e) => total + e.value, 0);
  const perSec = (value: number) => (value * 1000) / windowMs;
  return {
    sent: (bytes, now) => void (out = [...prune(out, now), { at: now, value: bytes }]),
    received: (bytes, now) => void (incoming = [...prune(incoming, now), { at: now, value: bytes }]),
    snapshot: (ageMs, now) => void (snapshots = [...prune(snapshots, now), { at: now, value: ageMs }]),
    rtt(peer, ms) {
      const previous = rtt.get(peer);
      rtt.set(peer, previous === undefined ? ms : previous + RTT_SMOOTHING * (ms - previous));
    },
    forget: (peer) => void rtt.delete(peer),
    rttOf: (peer) => rtt.get(peer),
    summary(now) {
      out = prune(out, now);
      incoming = prune(incoming, now);
      snapshots = prune(snapshots, now);
      return {
        bytesOutPerSec: perSec(sum(out)),
        bytesInPerSec: perSec(sum(incoming)),
        snapshotsPerSec: perSec(snapshots.length),
        avgSnapshotAgeMs: snapshots.length > 0 ? sum(snapshots) / snapshots.length : null,
        rttMs: Object.fromEntries(rtt),
      };
    },
  };
}
