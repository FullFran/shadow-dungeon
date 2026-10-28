import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { markSimaSceneSeen, simaPleaDue } from '../../src/app/sima-cinematic';
import { pleaOnArrival, pleaReady } from '../../src/town/plea';
import { CRYPT } from '../../src/data/dungeons';
import { clearedDungeons, parseRecords } from '../../src/town/records';

/**
 * The villagers' pleas reach every player who has not seen them (owner,
 * 2026-10-27: "que si no se las pierden"): a profile from before the pleas
 * (its save, records and prologue flag, but no `simaScenes` key) is due, and
 * the solo town plays them the moment it opens, not only on the way to the Sima.
 * They wait until the player has cleared the Crypt (owner, 2026-10-28: right
 * after the quiz the player has not met the Sima Walkers nor its shadow yet).
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

  it('the town plays them on arrival alone, once the Crypt is cleared, never in a room nor under a development window', () => {
    expect(pleaOnArrival({ inRoom: false, startWindow: false, due: true, ready: true })).toBe(true);
    expect(pleaOnArrival({ inRoom: true, startWindow: false, due: true, ready: true })).toBe(false);
    expect(pleaOnArrival({ inRoom: false, startWindow: true, due: true, ready: true })).toBe(false);
    expect(pleaOnArrival({ inRoom: false, startWindow: false, due: false, ready: true })).toBe(false);
    // Right after the prologue and the quiz: nothing cleared yet, no pleas.
    expect(pleaOnArrival({ inRoom: false, startWindow: false, due: true, ready: false })).toBe(false);
  });

  it('ready once the Crypt is cleared: a fresh profile is not, a first clear is, an old victory without the flag is too', () => {
    expect(pleaReady(clearedDungeons(parseRecords(null)))).toBe(false);
    expect(pleaReady(new Set(['misty-forest']))).toBe(false);
    expect(pleaReady(new Set([CRYPT.id]))).toBe(true);
    // Records from before the `cleared` flag: a victory in the first dungeon counts as clearing it.
    expect(pleaReady(clearedDungeons(parseRecords(JSON.stringify({ runs: 3, victories: 1, bestLevel: 9, lastSpecies: 'cubone', dungeons: { [CRYPT.id]: { bestFloor: 5 } } }))))).toBe(true);
    // A crypt run that ended in defeat is not a clear.
    expect(pleaReady(clearedDungeons(parseRecords(JSON.stringify({ runs: 1, victories: 0, bestLevel: 3, lastSpecies: 'cubone', dungeons: { [CRYPT.id]: { bestFloor: 2 } } }))))).toBe(false);
  });

  it('the scene checks it when it opens and starts the pleas there; the solo town hands its due over', () => {
    const scene = readFileSync(join(__dirname, '../../src/town/scene.ts'), 'utf8');
    const opening = scene.slice(scene.indexOf('window.addEventListener(\'keydown\', onKeyDown);'));
    expect(opening).toMatch(/pleaOnArrival\(\{[^}]*due: [^}]*ready: [^}]*\}\)\) beginPlea\(/);
    // Afterwards the player is back where the town opened (the hub's spawn after a run), not left on the crater's rim.
    expect(opening).toMatch(/beginPlea\(\(\) => enterMap\(opened\.map, opened\.walker\)\)/);
    expect(scene).toMatch(/const opened = \{ map, walker \};/);
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main).toContain('due: () => simaPleaDue(store)');
    expect(main).toContain('ready: () => pleaReady(cleared())');
  });
});
