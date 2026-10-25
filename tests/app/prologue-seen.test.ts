import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { hasSeenPrologue, markPrologueSeen } from '../../src/app/prologue-seen';

describe('prologue seen flag', () => {
  it('is false on a fresh store and true once marked', () => {
    const store = memoryStore();
    expect(hasSeenPrologue(store)).toBe(false);
    markPrologueSeen(store);
    expect(hasSeenPrologue(store)).toBe(true);
  });

  it('ignores a stored value it does not understand', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.prologueSeen', 'maybe');
    expect(hasSeenPrologue(store)).toBe(false);
  });

  it('does not touch the settings key', () => {
    const store = memoryStore();
    markPrologueSeen(store);
    expect(store.get('mazmorra-sombria.settings')).toBeNull();
  });
});
