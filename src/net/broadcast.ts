import type { Transport } from './transport';

/**
 * Transport between tabs of the same browser (`?net=local`), no network
 * involved: a BroadcastChannel carries every message to every tab. Peers
 * find each other with a hello / here exchange and a heartbeat; a tab that
 * closes says bye, one that stops answering is dropped after a timeout.
 * Delivery is in order and lossless, so `reliable` changes nothing here.
 */
type Frame =
  | { kind: 'hello' | 'here' | 'beat' | 'bye'; from: string }
  | { kind: 'data'; from: string; data: string };

const HEARTBEAT_MS = 1000;
const TIMEOUT_MS = 3500;

export class BroadcastChannelTransport implements Transport<string> {
  readonly selfId: string;
  private readonly channel: BroadcastChannel;
  private readonly lastSeen = new Map<string, number>();
  private readonly messageHandlers: Array<(from: string, message: string) => void> = [];
  private readonly joinHandlers: Array<(peer: string) => void> = [];
  private readonly leaveHandlers: Array<(peer: string) => void> = [];
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly onPageHide = () => this.close();

  constructor(room = 'mazmorra-sombria') {
    this.selfId = `tab-${Math.random().toString(36).slice(2, 10)}`;
    this.channel = new BroadcastChannel(`${room}:net`);
    this.channel.onmessage = (event: MessageEvent<Frame>) => this.receive(event.data);
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    window.addEventListener('pagehide', this.onPageHide);
    this.post({ kind: 'hello', from: this.selfId });
  }

  peers(): readonly string[] {
    return [...this.lastSeen.keys()];
  }

  send(message: string): void {
    this.post({ kind: 'data', from: this.selfId, data: message });
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
    clearInterval(this.timer);
    window.removeEventListener('pagehide', this.onPageHide);
    this.post({ kind: 'bye', from: this.selfId });
    this.channel.close();
  }

  private post(frame: Frame): void {
    try {
      this.channel.postMessage(frame);
    } catch {
      // Closed channel: nothing to do.
    }
  }

  private see(peer: string): void {
    const known = this.lastSeen.has(peer);
    this.lastSeen.set(peer, performance.now());
    if (!known) for (const handler of this.joinHandlers) handler(peer);
  }

  private drop(peer: string): void {
    if (!this.lastSeen.delete(peer)) return;
    for (const handler of this.leaveHandlers) handler(peer);
  }

  private receive(frame: Frame): void {
    if (!frame || frame.from === this.selfId) return;
    if (frame.kind === 'bye') return this.drop(frame.from);
    this.see(frame.from);
    if (frame.kind === 'hello') this.post({ kind: 'here', from: this.selfId });
    else if (frame.kind === 'data') for (const handler of this.messageHandlers) handler(frame.from, frame.data);
  }

  private heartbeat(): void {
    this.post({ kind: 'beat', from: this.selfId });
    const now = performance.now();
    for (const [peer, seen] of [...this.lastSeen]) if (now - seen > TIMEOUT_MS) this.drop(peer);
  }
}
