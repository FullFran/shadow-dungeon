import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { markSimaSceneSeen, simaPleaDue } from '../../src/app/sima-cinematic';
import { pleaOnArrival } from '../../src/town/plea';

/**
 * The villagers' pleas reach every player who has not seen them (owner,
 * 2026-10-27: "que si no se las pierden"): a profile from before the pleas
 * (its save, records and prologue flag, but no `simaScenes` key) is due, and
 * the solo town plays them the moment it opens, not only on the way to the Sima.
 */
const OLD_PROFILE: Record<string, string> = {
  'mazmorra-sombria.prologueSeen': '1',
  'mazmorra-sombria.save': JSON.stringify({ version: 1, coins: 1200, story: { cubone: 3, mimikyu: 1 } }),
  'mazmorra-sombria.records': JSON.stringify({ runs: 40, victories: 12, bestLevel: 20, lastSpecies: 'cubone', dungeons: { 'eclipse-chasm': { bestFloor: 33 } } }),
  'mazmorra-sombria.cinematicsSeen': JSON.stringify(['aegislash:pre', 'aegislash:post']),
};

const storeOf = (entries: Record<string, string>) => {
  const store = memoryStore();
  for (const [k, v] of Object.entries(entries)) store.set(k, v);
  return store;
};

describe('the pleas for every player who has not seen them', () => {
  it('an old profile without the scenes key is due, whatever it already cleared', () => {
    expect(simaPleaDue(storeOf(OLD_PROFILE))).toBe(true);
  });

  it('a broken scenes key reads as unseen; once seen, never due again', () => {
    const store = storeOf({ ...OLD_PROFILE, 'mazmorra-sombria.simaScenes': '{nope' });
    expect(simaPleaDue(store)).toBe(true);
    markSimaSceneSeen(store, 'mouth');
    expect(simaPleaDue(store)).toBe(true);
    markSimaSceneSeen(store, 'plea');
    expect(simaPleaDue(store)).toBe(false);
  });

  it('the town plays them on arrival alone, never in a room nor under a development window', () => {
    expect(pleaOnArrival({ inRoom: false, startWindow: false, due: true })).toBe(true);
    expect(pleaOnArrival({ inRoom: true, startWindow: false, due: true })).toBe(false);
    expect(pleaOnArrival({ inRoom: false, startWindow: true, due: true })).toBe(false);
    expect(pleaOnArrival({ inRoom: false, startWindow: false, due: false })).toBe(false);
  });

  it('the scene checks it when it opens and starts the pleas there; the solo town hands its due over', () => {
    const scene = readFileSync(join(__dirname, '../../src/town/scene.ts'), 'utf8');
    const opening = scene.slice(scene.indexOf('window.addEventListener(\'keydown\', onKeyDown);'));
    expect(opening).toMatch(/pleaOnArrival\(\{[^}]*due: [^}]*\}\)\) beginPlea\(/);
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main).toContain('due: () => simaPleaDue(store)');
  });
});
