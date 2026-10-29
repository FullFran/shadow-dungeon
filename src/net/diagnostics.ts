/**
 * Co-op diagnostics (issue #6, docs/gdd.md §12): what the session and the
 * transport know about the connection, for the technical report a player
 * attaches to a bug report or copies from the room menu. Only kinds and
 * counts: never addresses, nicknames or anything the player typed.
 */

/** A connection transition, at its time on the page clock (ms). */
export interface Transition {
  tMs: number;
  event: string;
}

/** Keeps the last `max` entries: `list` plus `entry`, oldest dropped first. */
export function pushRing<T>(list: T[], entry: T, max: number): void {
  list.push(entry);
  if (list.length > max) list.splice(0, list.length - max);
}

/**
 * The ICE candidate pair a peer connection selected: the kind of each end
 * (host, srflx, prflx, relay) and the protocol, never the addresses.
 * `relayProtocol` is how this end reaches its relay (udp, tcp, tls).
 */
export interface LinkInfo {
  local: string;
  remote: string;
  protocol: string;
  relayProtocol?: string;
}

/** Direct (both ends found each other) or through a relay (TURN). */
export const linkKind = (link: LinkInfo): 'direct' | 'relay' => (link.local === 'relay' || link.remote === 'relay' ? 'relay' : 'direct');

const CANDIDATE_TYPES = new Set(['host', 'srflx', 'prflx', 'relay']);
const PROTOCOLS = new Set(['udp', 'tcp', 'tls']);
const kind = (value: unknown): string => (typeof value === 'string' && CANDIDATE_TYPES.has(value) ? value : 'unknown');
const proto = (value: unknown): string | undefined => (typeof value === 'string' && PROTOCOLS.has(value.toLowerCase()) ? value.toLowerCase() : undefined);

/**
 * The selected pair from `RTCPeerConnection.getStats()` reports: the
 * transport's `selectedCandidatePairId` (Chromium, Safari), else the
 * nominated or selected pair that succeeded (Firefox). Null before ICE
 * has chosen one.
 */
export function selectedPair(reports: Iterable<Record<string, unknown>>): LinkInfo | null {
  const byId = new Map<string, Record<string, unknown>>();
  for (const report of reports) if (typeof report.id === 'string') byId.set(report.id, report);
  const all = [...byId.values()];
  const viaTransport = all.find((r) => r.type === 'transport' && typeof r.selectedCandidatePairId === 'string');
  const pair =
    (viaTransport ? byId.get(viaTransport.selectedCandidatePairId as string) : undefined) ??
    all.find((r) => r.type === 'candidate-pair' && r.state === 'succeeded' && (r.selected === true || r.nominated === true));
  if (!pair) return null;
  const local = byId.get(pair.localCandidateId as string);
  const remote = byId.get(pair.remoteCandidateId as string);
  if (!local || !remote) return null;
  const relayProtocol = local.candidateType === 'relay' ? proto(local.relayProtocol) : undefined;
  return { local: kind(local.candidateType), remote: kind(remote.candidateType), protocol: proto(local.protocol) ?? 'unknown', ...(relayProtocol ? { relayProtocol } : {}) };
}

/** A transport that can tell how each peer is linked (the WebRTC one; the local and test ones cannot). */
export interface LinkProbe {
  /** The selected candidate pair per transport peer id (null: not chosen yet, or unreadable). */
  links(): Promise<Record<string, LinkInfo | null>>;
  /** Recent link transitions (ICE connection state changes). */
  linkEvents(): readonly Transition[];
}

export const isLinkProbe = (value: unknown): value is LinkProbe =>
  typeof value === 'object' && value !== null && typeof (value as LinkProbe).links === 'function' && typeof (value as LinkProbe).linkEvents === 'function';

/** What the session knows about the room right now (`NetSession.diagnostics`). */
export interface SessionDiagnostics {
  role: 'host' | 'guest' | null;
  localId: string | null;
  /** The host; or a guest the host has listed. */
  admitted: boolean;
  started: boolean;
  /** Why this guest was turned away, if it was. */
  refused: 'full' | 'version' | null;
  hostLeft: boolean;
  rosterSize: number;
  /** Peers connected at the transport level (the roster can lag behind or run ahead). */
  peersConnected: number;
  /** Every connected peer: its player id once listed, round trip, and time since it was last heard. */
  peers: Array<{ peer: string; id?: string; rttMs?: number; msSinceLastMessage?: number }>;
  transitions: readonly Transition[];
}
