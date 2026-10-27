import { describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { readGallerySeen } from '../../src/app/gallery-seen';
import { galleryGroups, galleryUnlocked } from '../../src/app/lore-gallery';
import { markSimaSceneSeen } from '../../src/app/sima-cinematic';

/**
 * The gallery's unlocks for a real store (odd/tasks/lore-gallery.md): an old
 * profile unlocks what its progress proves it saw, and reading never writes.
 */
const OLD_PROFILE: Record<string, string> = {
  'mazmorra-sombria.save': JSON.stringify({ version: 1, coins: 1200, story: { cubone: 3, zorua: 1 } }),
  'mazmorra-sombria.records': JSON.stringify({ runs: 40, victories: 12, bestLevel: 20, lastSpecies: 'cubone', dungeons: { 'crypt-of-the-sword-king': { bestFloor: 10, cleared: true } } }),
};

function storeOf(entries: Record<string, string>): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(entries));
  return { get: (k: string) => data.get(k) ?? null, set: (k: string, v: string) => void data.set(k, v), dump: () => Object.fromEntries(data) };
}

describe('the gallery\'s unlocks', () => {
  it('a fresh device: nothing but what the starter proves', () => {
    const seen = readGallerySeen(memoryStore(), false);
    for (const g of galleryGroups()) for (const e of g.entries) expect(galleryUnlocked(e.scene, seen), e.id).toBe(false);
    expect(galleryUnlocked({ kind: 'prologue' }, readGallerySeen(memoryStore(), true))).toBe(true);
  });

  it('an old profile: the prologue, the closed chapters and the fallen guardian; the Sima once seen here', () => {
    const store = storeOf(OLD_PROFILE);
    const seen = readGallerySeen(store, true);
    expect(galleryUnlocked({ kind: 'prologue' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'story', line: 'cubone', chapter: 3, phase: 'after' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'story', line: 'zorua', chapter: 1, phase: 'before' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'story', line: 'zorua', chapter: 2, phase: 'before' }, seen)).toBe(false);
    expect(galleryUnlocked({ kind: 'guardian', species: 'aegislash', phase: 'post' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'guardian', species: 'nihilego', phase: 'pre' }, seen)).toBe(false);
    expect(galleryUnlocked({ kind: 'plea' }, seen)).toBe(false);
    markSimaSceneSeen(store, 'plea');
    expect(galleryUnlocked({ kind: 'plea' }, readGallerySeen(store, true))).toBe(true);
  });

  it('reading the unlocks writes nothing', () => {
    const store = storeOf(OLD_PROFILE);
    const before = store.dump();
    readGallerySeen(store, true);
    expect(store.dump()).toEqual(before);
  });
});
