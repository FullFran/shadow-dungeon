/**
 * Transport port (docs/gdd.md §12): how peers exchange messages, whatever
 * carries them (BroadcastChannel between local tabs, WebRTC rooms later).
 * Messages go to every other peer; `reliable` ones must arrive, in order;
 * unreliable ones may be dropped or reordered (the protocol tolerates it).
 */
export interface Transport<M> {
  /** This peer's transport-level id (not the player id, which the host assigns). */
  readonly selfId: string;
  peers(): readonly string[];
  send(message: M, reliable: boolean): void;
  onMessage(handler: (from: string, message: M) => void): void;
  onPeerJoin(handler: (peer: string) => void): void;
  onPeerLeave(handler: (peer: string) => void): void;
  close(): void;
}

/** Time and timers, injectable so lag and sessions run on a fake clock in tests. */
export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): void;
}

export const realScheduler = (): Scheduler => ({
  now: () => performance.now(),
  setTimeout: (fn, ms) => {
    globalThis.setTimeout(fn, ms);
  },
});

export interface FakeScheduler extends Scheduler {
  /** Moves time forward, running every timer that falls due, in time order. */
  advance(ms: number): void;
}

export function createFakeScheduler(start = 0): FakeScheduler {
  let now = start;
  let seq = 0;
  let timers: Array<{ at: number; seq: number; fn: () => void }> = [];
  return {
    now: () => now,
    setTimeout(fn, ms) {
      timers.push({ at: now + Math.max(0, ms), seq: seq++, fn });
    },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= until).sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        now = Math.max(now, due.at);
        due.fn();
      }
      now = until;
    },
  };
}

/** In-memory transports sharing one hub: instant, lossless delivery (tests, loopback). */
export interface MemoryHub<M> {
  connect(id: string): Transport<M>;
  /**
   * The link of `id` drops without anyone leaving (a network blip: WebRTC's
   * ICE gives up and Trystero reports a peer leave on both ends). Messages to
   * and from it are lost until `restore`.
   */
  drop(id: string): void;
  /** The dropped link of `id` comes back (Trystero finds the same peer id again): both ends see a peer join. */
  restore(id: string): void;
}

export function createMemoryHub<M>(): MemoryHub<M> {
  interface Node {
    id: string;
    message: Array<(from: string, m: M) => void>;
    join: Array<(peer: string) => void>;
    leave: Array<(peer: string) => void>;
  }
  const nodes = new Map<string, Node>();
  const offline = new Set<string>();
  /** The other nodes `id` can reach now (none while its link is down). */
  const linked = (id: string): Node[] => (offline.has(id) ? [] : [...nodes.values()].filter((n) => n.id !== id && !offline.has(n.id)));
  return {
    connect(id) {
      const node: Node = { id, message: [], join: [], leave: [] };
      for (const other of linked(id)) other.join.forEach((h) => h(id));
      nodes.set(id, node);
      return {
        selfId: id,
        peers: () => linked(id).map((n) => n.id),
        send(message) {
          for (const other of linked(id)) other.message.forEach((h) => h(id, message));
        },
        onMessage: (h) => void node.message.push(h),
        onPeerJoin: (h) => void node.join.push(h),
        onPeerLeave: (h) => void node.leave.push(h),
        close() {
          const others = linked(id);
          nodes.delete(id);
          offline.delete(id);
          for (const other of others) other.leave.forEach((h) => h(id));
        },
      };
    },
    drop(id) {
      const node = nodes.get(id);
      if (!node || offline.has(id)) return;
      const others = linked(id);
      offline.add(id);
      for (const other of others) {
        other.leave.forEach((h) => h(id));
        node.leave.forEach((h) => h(other.id));
      }
    },
    restore(id) {
      const node = nodes.get(id);
      if (!node || !offline.has(id)) return;
      offline.delete(id);
      for (const other of linked(id)) {
        other.join.forEach((h) => h(id));
        node.join.forEach((h) => h(other.id));
      }
    },
  };
}
