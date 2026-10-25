import { t } from '../i18n';
import type { RosterEntry } from '../net/protocol';
import type { NetSession } from '../net/session';
import type { StatsSummary } from '../net/stats';

/**
 * F3 net stats overlay in a shared run (docs/gdd.md §12): role, players
 * connected, round trip per peer, snapshot rate and age, bytes per second
 * out and in. `netStatsLines` is the pure text; the overlay refreshes it a
 * few times a second.
 */
export interface NetStatsInfo {
  role: 'host' | 'guest';
  localId: string;
  selfPeer: string;
  roster: readonly RosterEntry[];
}

const kb = (bytesPerSec: number) => `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
const ms = (value: number) => `${Math.round(value)} ms`;

export function netStatsLines(summary: StatsSummary, info: NetStatsInfo): string[] {
  const others = info.roster.filter((r) => r.peer !== info.selfPeer);
  const role = t(info.role === 'host' ? 'stats.roleHost' : 'stats.roleGuest');
  const lines = [t('stats.title'), `${t('stats.role')}: ${role} · ${info.localId.toUpperCase()}`, `${t('stats.peers')}: ${others.length}`];
  for (const other of others) {
    const rtt = summary.rttMs[other.peer];
    lines.push(`RTT ${other.id.toUpperCase()}: ${rtt === undefined ? '…' : ms(rtt)}`);
  }
  if (info.role === 'guest') {
    const age = summary.avgSnapshotAgeMs === null ? '…' : ms(summary.avgSnapshotAgeMs);
    lines.push(`${t('stats.snapshots')}: ${Math.round(summary.snapshotsPerSec)}/s · ${t('stats.age')} ${age}`);
  }
  lines.push(`${t('stats.out')}: ${kb(summary.bytesOutPerSec)} · ${t('stats.in')}: ${kb(summary.bytesInPerSec)}`);
  return lines;
}

const REFRESH_MS = 250;

export interface NetOverlay {
  toggle(): void;
  update(nowMs: number): void;
  dispose(): void;
}

export function createNetOverlay(parent: HTMLElement, session: NetSession, role: 'host' | 'guest', localId: string): NetOverlay {
  const node = document.createElement('pre');
  node.className = 'net-stats';
  node.hidden = true;
  parent.append(node);
  let lastAt = Number.NEGATIVE_INFINITY;
  return {
    toggle() {
      node.hidden = !node.hidden;
      lastAt = Number.NEGATIVE_INFINITY;
    },
    update(nowMs) {
      if (node.hidden || nowMs - lastAt < REFRESH_MS) return;
      lastAt = nowMs;
      node.textContent = netStatsLines(session.liveStats(), { role, localId, selfPeer: session.peerId(), roster: session.roster() }).join('\n');
    },
    dispose: () => node.remove(),
  };
}
