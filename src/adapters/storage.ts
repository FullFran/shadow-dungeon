/**
 * Storage port: a tiny string key-value store. The browser adapter wraps
 * localStorage in try/catch because it can be missing or throw (private
 * mode, disabled storage, quota); settings then just are not remembered.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
    },
  };
}

export function browserStore(): KeyValueStore {
  return {
    get(key) {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // Not persisted; the game keeps working with in-memory settings.
      }
    },
  };
}
