import type { Scheduler, Transport } from './transport';

/**
 * Lag simulator around any transport (`?lag=ms&jitter=ms&loss=0..1`):
 * every outgoing message is delayed by `lagMs` ± `jitterMs` (uniform);
 * unreliable ones may also be lost (and may overtake each other), reliable
 * ones are only delayed and never overtake an earlier reliable one. Incoming
 * messages pass straight through: each peer delays what it sends, so with
 * the same settings on both ends the round trip is twice the lag.
 */
export interface LagSettings {
  lagMs: number;
  jitterMs: number;
  loss: number;
}

export interface LagOptions extends LagSettings {
  scheduler: Scheduler;
  /** Uniform in [0, 1); injectable for tests. */
  random: () => number;
}

export class LagTransport<M> implements Transport<M> {
  private lastReliableAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly inner: Transport<M>,
    private readonly options: LagOptions,
  ) {}

  get selfId(): string {
    return this.inner.selfId;
  }

  peers(): readonly string[] {
    return this.inner.peers();
  }

  send(message: M, reliable: boolean): void {
    const { lagMs, jitterMs, loss, scheduler, random } = this.options;
    if (!reliable && loss > 0 && random() < loss) return;
    const now = scheduler.now();
    let at = now + Math.max(0, lagMs + jitterMs * (random() * 2 - 1));
    if (reliable) {
      at = Math.max(at, this.lastReliableAt);
      this.lastReliableAt = at;
    }
    scheduler.setTimeout(() => this.inner.send(message, reliable), at - now);
  }

  onMessage(handler: (from: string, message: M) => void): void {
    this.inner.onMessage(handler);
  }

  onPeerJoin(handler: (peer: string) => void): void {
    this.inner.onPeerJoin(handler);
  }

  onPeerLeave(handler: (peer: string) => void): void {
    this.inner.onPeerLeave(handler);
  }

  close(): void {
    this.inner.close();
  }
}

/** Lag settings from a page query string; null when it asks for none. */
export function parseLagParams(search: string): LagSettings | null {
  const params = new URLSearchParams(search);
  if (!params.has('lag') && !params.has('jitter') && !params.has('loss')) return null;
  const num = (key: string) => {
    const value = Number.parseFloat(params.get(key) ?? '');
    return Number.isFinite(value) ? value : 0;
  };
  return {
    lagMs: Math.max(0, num('lag')),
    jitterMs: Math.max(0, num('jitter')),
    loss: Math.min(1, Math.max(0, num('loss'))),
  };
}
