/**
 * The shared image loader (odd/tasks/loading-errors.md), DOM-free so it can be
 * tested: one cache for every sprite sheet, tile and portrait, keyed by URL.
 * A URL loads at most once (requests share the promise), a loaded image is
 * served at once, requests are prioritised (`high` before `low`, a `low` one
 * promoted when something asks for it with `high`), `low` work never takes
 * more than `lowActive` slots so it cannot starve the screen being opened, a
 * failure retries once, and what still fails resolves to a placeholder (so
 * callers never wait on, or branch around, a broken image) and is reported.
 */
export type Priority = 'high' | 'low';
export type AssetState = 'pending' | 'loaded' | 'failed';

export interface LoaderDeps<I> {
  /** URL prefix of sheet keys (`<base>sprites/`). */
  base: string;
  /** Loads running at the same time. */
  maxActive: number;
  /** Of those, how many background (`low`) loads may run. */
  lowActive: number;
  loadImage(url: string, priority: Priority): Promise<I>;
  /** What stands in for an image that could not load. */
  placeholder(url: string): I;
  sleep(ms: number): Promise<void>;
  /** An image gave up (after its retry). */
  onFailure?(url: string): void;
}

export interface AssetLoader<I> {
  /** A sprite sheet by key `<dex>/<form>/<file>`; resolves to its image, or the placeholder after a failure. */
  sheet(key: string, options?: { priority?: Priority }): Promise<I>;
  /** Any image URL through the same cache. */
  image(url: string, options?: { priority?: Priority }): Promise<I>;
  /** The sheet if it is already here. Otherwise undefined, and a background load starts so a later frame has it. */
  get(key: string): I | undefined;
  state(key: string): AssetState;
  /** The state of any image by its full URL. */
  stateOfUrl(url: string): AssetState;
  /** Loads the sheets; `onProgress` gets (settled, total) after each one. Resolves when all settled, failures included. */
  preload(keys: Iterable<string>, options?: { priority?: Priority; onProgress?(done: number, total: number): void }): Promise<void>;
}

interface Entry<I> {
  url: string;
  state: AssetState;
  value: I | undefined;
  priority: Priority;
  started: boolean;
  promise: Promise<I>;
  settle(value: I): void;
}

const RETRY_DELAY_MS = 250;

export function createAssetLoader<I>(deps: LoaderDeps<I>): AssetLoader<I> {
  const entries = new Map<string, Entry<I>>();
  const queue: Entry<I>[] = [];
  let active = 0;
  let activeLow = 0;

  function take(): Entry<I> | undefined {
    const high = queue.findIndex((e) => e.priority === 'high');
    if (high >= 0) return queue.splice(high, 1)[0];
    if (activeLow >= deps.lowActive) return undefined;
    return queue.shift();
  }

  async function load(entry: Entry<I>): Promise<void> {
    let value: I;
    try {
      value = await deps.loadImage(entry.url, entry.priority);
      entry.state = 'loaded';
    } catch {
      try {
        await deps.sleep(RETRY_DELAY_MS);
        value = await deps.loadImage(entry.url, entry.priority);
        entry.state = 'loaded';
      } catch {
        value = deps.placeholder(entry.url);
        entry.state = 'failed';
        deps.onFailure?.(entry.url);
      }
    }
    entry.value = value;
    entry.settle(value);
  }

  function pump(): void {
    while (active < deps.maxActive) {
      const entry = take();
      if (!entry) return;
      entry.started = true;
      const low = entry.priority === 'low';
      active += 1;
      if (low) activeLow += 1;
      void load(entry).finally(() => {
        active -= 1;
        if (low) activeLow -= 1;
        pump();
      });
    }
  }

  function request(url: string, priority: Priority): Entry<I> {
    const known = entries.get(url);
    if (known) {
      if (priority === 'high' && known.priority === 'low' && !known.started) known.priority = 'high';
      return known;
    }
    let settle!: (value: I) => void;
    const promise = new Promise<I>((resolve) => (settle = resolve));
    const entry: Entry<I> = { url, state: 'pending', value: undefined, priority, started: false, promise, settle };
    entries.set(url, entry);
    queue.push(entry);
    pump();
    return entry;
  }

  const urlOf = (key: string): string => deps.base + key;

  function fetchEntry(url: string, priority: Priority): Promise<I> {
    const entry = request(url, priority);
    // A promotion changes the queue order: run it again.
    if (!entry.started) pump();
    return entry.promise;
  }

  return {
    sheet: (key, options) => fetchEntry(urlOf(key), options?.priority ?? 'high'),
    image: (url, options) => fetchEntry(url, options?.priority ?? 'high'),
    get(key) {
      const entry = request(urlOf(key), 'low');
      return entry.state === 'pending' ? undefined : entry.value;
    },
    state: (key) => entries.get(urlOf(key))?.state ?? 'pending',
  stateOfUrl: (url) => entries.get(url)?.state ?? 'pending',
    async preload(keys, options) {
      const list = [...new Set(keys)];
      let done = 0;
      await Promise.all(
        list.map(async (key) => {
          await fetchEntry(urlOf(key), options?.priority ?? 'high');
          done += 1;
          options?.onProgress?.(done, list.length);
        }),
      );
    },
  };
}
