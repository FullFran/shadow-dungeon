import type { KeyValueStore } from '../adapters/storage';

/**
 * Whether this browser has seen the prologue (it plays by itself only on the
 * first Play). Kept under its own storage key, next to the settings, so it
 * survives settings migrations and never resets them.
 */
const KEY = 'mazmorra-sombria.prologueSeen';

export const hasSeenPrologue = (store: KeyValueStore): boolean => store.get(KEY) === '1';

export function markPrologueSeen(store: KeyValueStore): void {
  store.set(KEY, '1');
}
