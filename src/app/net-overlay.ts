import { t } from '../i18n';
import { linkKind, type LinkInfo } from '../net/diagnostics';
import type { RosterEntry } from '../net/protocol';
import type { NetSession } from '../net/session';
import type { StatsSummary } from '../net/stats';

/**
 * F3 net stats overlay in a shared run (docs/gdd.md §12): role, players
 * connected, round trip per peer, snapshot rate and age, bytes per second
 * out and in; whether this guest is admitted and, per peer, whether the
 * link is direct or through a relay (issue #6). `netStatsLines` is the pure
 * text; the overlay refreshes it a few times a second.
 */
export interface NetStatsInfo {
  role: 'host' | 'guest';
  localId: string;
  selfPeer: string;
  roster: readonly RosterEntry[];
  /** In the host's roster (absent: not shown). */
  admitted?: boolean;
  /** The selected ICE pair per transport peer id (absent or null: not known yet). */
  links?: Record<string, LinkInfo | null>;
}

const kb = (bytesPerSec: number) => `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
const ms = (value: number) => `${Math.round(value)} ms`;

export function netStatsLines(summary: StatsSummary, info: NetStatsInfo): string[] {
  const others = info.roster.filter((r) => r.peer !== info.selfPeer);
  const role = t(info.role === 'host' ? 'stats.roleHost' : 'stats.roleGuest');
  const admitted = info.admitted === undefined ? '' : ` · ${t(info.admitted ? 'stats.admitted' : 'stats.pending')}`;
  const lines = [t('stats.title'), `${t('stats.role')}: ${role} · ${info.localId.toUpperCase()}${admitted}`, `${t('stats.peers')}: ${others.length}`];
  for (const other of others) {
    const rtt = summary.rttMs[other.peer];
    const link = info.links?.[other.peer];
    lines.push(`RTT ${other.id.toUpperCase()}: ${rtt === undefined ? '…' : ms(rtt)}${link ? ` · ${t(linkKind(link) === 'relay' ? 'stats.relay' : 'stats.direct')}` : ''}`);
  }
  if (info.role === 'guest') {
    const age = summary.avgSnapshotAgeMs === null ? '…' : ms(summary.avgSnapshotAgeMs);
    lines.push(`${t('stats.snapshots')}: ${Math.round(summary.snapshotsPerSec)}/s · ${t('stats.age')} ${age}`);
  }
  lines.push(`${t('stats.out')}: ${kb(summary.bytesOutPerSec)} · ${t('stats.in')}: ${kb(summary.bytesInPerSec)}`);
  return lines;
}

const REFRESH_MS = 250;
/** The ICE pair is read from the peer connections' stats less often. */
const LINKS_MS = 2000;

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
  let linksAt = Number.NEGATIVE_INFINITY;
  let links: Record<string, LinkInfo | null> = {};
  return {
    toggle() {
      node.hidden = !node.hidden;
      lastAt = Number.NEGATIVE_INFINITY;
      linksAt = Number.NEGATIVE_INFINITY;
    },
    update(nowMs) {
      if (node.hidden || nowMs - lastAt < REFRESH_MS) return;
      lastAt = nowMs;
      if (nowMs - linksAt >= LINKS_MS) {
        linksAt = nowMs;
        session.links().then(
          (next) => void (links = next),
          () => undefined,
        );
      }
      node.textContent = netStatsLines(session.liveStats(), { role, localId, selfPeer: session.peerId(), roster: session.roster(), admitted: session.diagnostics().admitted, links }).join('\n');
    },
    dispose: () => node.remove(),
  };
}
