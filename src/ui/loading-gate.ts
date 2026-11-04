/**
 * When the spin loader may appear (Doherty: feedback inside 400 ms, but no
 * flash for work that ends sooner). Pure, with an injected clock: the loader
 * shows only if the work is still running after `delayMs`, and once shown it
 * stays at least `minVisibleMs` so it never blinks.
 */
export interface GateOptions {
  delayMs: number;
  minVisibleMs: number;
  now(): number;
  schedule(fn: () => void, ms: number): number;
  cancel(handle: number): void;
  show(): void;
  hide(): void;
}

export function createLoadingGate(o: GateOptions): { start(): void; stop(): void } {
  let waiting: number | null = null;
  let leaving: number | null = null;
  let shownAt: number | null = null;
  let active = false;

  const hideNow = (): void => {
    leaving = null;
    shownAt = null;
    o.hide();
  };

  return {
    start() {
      if (leaving !== null) {
        o.cancel(leaving);
        leaving = null;
      }
      active = true;
      if (shownAt !== null || waiting !== null) return;
      waiting = o.schedule(() => {
        waiting = null;
        if (!active) return;
        shownAt = o.now();
        o.show();
      }, o.delayMs);
    },
    stop() {
      active = false;
      if (waiting !== null) {
        o.cancel(waiting);
        waiting = null;
        return;
      }
      if (shownAt === null) return;
      const left = o.minVisibleMs - (o.now() - shownAt);
      if (left <= 0) hideNow();
      else leaving = o.schedule(hideNow, left);
    },
  };
}

/** Whole percent done, clamped to 0..100. */
export function loadingProgress(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** Which tip is on after `elapsedMs`, starting at `first` and moving on every `periodMs`. */
export function tipIndex(elapsedMs: number, count: number, first: number, periodMs = 4000): number {
  if (count <= 0) return 0;
  return (first + Math.floor(Math.max(0, elapsedMs) / periodMs)) % count;
}
