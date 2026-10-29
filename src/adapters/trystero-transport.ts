import { pushRing, selectedPair, type LinkInfo, type LinkProbe, type Transition } from '../net/diagnostics';
import type { Transport } from '../net/transport';

/**
 * Transport port over a Trystero room (WebRTC data channels, peers found
 * through public Nostr relays; docs/gdd.md §12). Every message travels as a
 * string on one action. Trystero's data channel is reliable and ordered, so
 * in the spike the "unreliable" state and snapshot messages ride the same
 * channel as the reliable ones (a lost packet stalls the ones behind it:
 * that is part of what the spike measures). `LagTransport` still wraps it.
 *
 * Only the shape of the room this needs is typed here, so the transport is
 * tested with a fake room and the package itself loads only in `trystero.ts`.
 */
export interface ActionLike {
  send(data: string, options?: { target?: string | string[] | null }): Promise<void>;
  onMessage: ((data: string, context: { peerId: string }) => void) | null;
}

export interface RoomLike {
  makeAction(namespace: string): ActionLike;
  getPeers(): Record<string, unknown>;
  onPeerJoin: ((peerId: string) => void) | null;
  onPeerLeave: ((peerId: string) => void) | null;
  leave(): Promise<void>;
}

/** The part of an `RTCPeerConnection` the diagnostics read (Trystero 0.26 `room.getPeers()` hands them out). */
interface PeerConnectionLike {
  iceConnectionState?: string;
  getStats?(): Promise<{ forEach(fn: (report: Record<string, unknown>) => void): void }>;
  addEventListener?(type: string, listener: () => void): void;
}

/** ICE state changes kept for the technical report. */
const MAX_LINK_EVENTS = 30;

export class TrysteroTransport implements Transport<string>, LinkProbe {
  private readonly action: ActionLike;
  private readonly messageHandlers: Array<(from: string, message: string) => void> = [];
  private readonly joinHandlers: Array<(peer: string) => void> = [];
  private readonly leaveHandlers: Array<(peer: string) => void> = [];
  private closed = false;
  private readonly events: Transition[] = [];

  constructor(
    private readonly room: RoomLike,
    readonly selfId: string,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.action = room.makeAction('m');
    this.action.onMessage = (data, { peerId }) => {
      if (typeof data !== 'string') return;
      for (const handler of this.messageHandlers) handler(peerId, data);
    };
    room.onPeerJoin = (peer) => {
      this.watchIce(peer);
      this.joinHandlers.forEach((h) => h(peer));
    };
    room.onPeerLeave = (peer) => this.leaveHandlers.forEach((h) => h(peer));
  }

  /** Notes the peer's ICE connection state now and on every change (diagnostics, issue #6). */
  private watchIce(peer: string): void {
    const pc = this.room.getPeers()[peer] as PeerConnectionLike | undefined;
    if (!pc) return;
    const note = () => pushRing(this.events, { tMs: Math.round(this.now()), event: `ice:${pc.iceConnectionState ?? 'unknown'}` }, MAX_LINK_EVENTS);
    note();
    pc.addEventListener?.('iceconnectionstatechange', note);
  }

  /** The selected candidate pair per peer: kinds and protocol only, never addresses. */
  async links(): Promise<Record<string, LinkInfo | null>> {
    const entries = Object.entries(this.room.getPeers()).map(async ([peer, raw]): Promise<[string, LinkInfo | null]> => {
      const pc = raw as PeerConnectionLike;
      try {
        if (typeof pc?.getStats !== 'function') return [peer, null];
        const reports: Array<Record<string, unknown>> = [];
        (await pc.getStats()).forEach((report) => reports.push(report));
        return [peer, selectedPair(reports)];
      } catch {
        return [peer, null];
      }
    });
    return Object.fromEntries(await Promise.all(entries));
  }

  linkEvents(): readonly Transition[] {
    return [...this.events];
  }

  peers(): readonly string[] {
    return Object.keys(this.room.getPeers());
  }

  /** Reliable or not, the message takes the same (reliable, ordered) channel. */
  send(message: string, _reliable?: boolean): void {
    if (this.closed) return;
    // A peer that went away mid-send rejects; the leave event handles it.
    this.action.send(message).catch(() => {});
  }

  onMessage(handler: (from: string, message: string) => void): void {
    this.messageHandlers.push(handler);
  }

  onPeerJoin(handler: (peer: string) => void): void {
    this.joinHandlers.push(handler);
  }

  onPeerLeave(handler: (peer: string) => void): void {
    this.leaveHandlers.push(handler);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.room.leave().catch(() => {});
  }
}
