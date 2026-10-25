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

export class TrysteroTransport implements Transport<string> {
  private readonly action: ActionLike;
  private readonly messageHandlers: Array<(from: string, message: string) => void> = [];
  private readonly joinHandlers: Array<(peer: string) => void> = [];
  private readonly leaveHandlers: Array<(peer: string) => void> = [];
  private closed = false;

  constructor(
    private readonly room: RoomLike,
    readonly selfId: string,
  ) {
    this.action = room.makeAction('m');
    this.action.onMessage = (data, { peerId }) => {
      if (typeof data !== 'string') return;
      for (const handler of this.messageHandlers) handler(peerId, data);
    };
    room.onPeerJoin = (peer) => this.joinHandlers.forEach((h) => h(peer));
    room.onPeerLeave = (peer) => this.leaveHandlers.forEach((h) => h(peer));
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
