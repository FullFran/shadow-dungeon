import { describe, expect, it } from 'vitest';
import { CRYPT } from '../../src/data/dungeons';
import { setLanguage, t } from '../../src/i18n';
import { TUTORIAL_HINTS, hintKey, hintsFor, markTutorialSeen, tutorialApplies, tutorialSeen, type TutorialDevice } from '../../src/app/tutorial';

// odd/tasks/menu-redesign.md T7, S10: neutral signs in the Crypt the first time each thing happens; controls, not strategy.
describe('where the tutorial runs', () => {
  it('only in the Crypt, never in a shrine trial, a Senda or a dev run', () => {
    const base = { dungeon: CRYPT.id, trial: false, story: false, dev: false };
    expect(tutorialApplies(base)).toBe(true);
    expect(tutorialApplies({ ...base, dungeon: 'sima-del-eclipse' })).toBe(false);
    expect(tutorialApplies({ ...base, trial: true })).toBe(false);
    expect(tutorialApplies({ ...base, story: true })).toBe(false);
    expect(tutorialApplies({ ...base, dev: true })).toBe(false);
  });
});

describe('which sign a moment brings', () => {
  const none = new Set<string>();

  it('floor 1 opens with moving and rolling, then attacking', () => {
    expect(hintsFor({ floorStart: 1, events: [] }, none)).toEqual(['move', 'attack']);
    expect(hintsFor({ floorStart: 2, events: [] }, none)).toEqual([]);
  });

  it('the first hit teaches the roll, a refused roll the stamina, a heavy move its charge, a quick move the lock, a lit bonfire the bonfire', () => {
    expect(hintsFor({ events: [{ type: 'playerHurt' }] }, none)).toEqual(['roll']);
    expect(hintsFor({ events: [{ type: 'disguiseBroken' }] }, none)).toEqual(['roll']);
    expect(hintsFor({ events: [{ type: 'rollDenied' }] }, none)).toEqual(['stamina']);
    expect(hintsFor({ events: [{ type: 'moveStarted', slotIndex: 1 }] }, none)).toEqual(['charge']);
    expect(hintsFor({ events: [{ type: 'moveStarted', slotIndex: 0 }] }, none)).toEqual(['lock']);
    expect(hintsFor({ events: [], bonfire: true }, none)).toEqual(['bonfire']);
  });

  it('never repeats a sign already seen, nor one twice in the same step', () => {
    expect(hintsFor({ events: [{ type: 'playerHurt' }] }, new Set(['roll']))).toEqual([]);
    expect(hintsFor({ events: [{ type: 'playerHurt' }, { type: 'playerHurt' }] }, none)).toEqual(['roll']);
    expect(hintsFor({ floorStart: 1, events: [] }, new Set(['move']))).toEqual(['attack']);
  });
});

describe('sign wording', () => {
  it('every sign has keyboard, touch and gamepad wording in both languages, without em dashes', () => {
    for (const language of ['es', 'en'] as const) {
      setLanguage(language);
      for (const hint of TUTORIAL_HINTS) {
        for (const device of ['keys', 'touch', 'pad'] as TutorialDevice[]) {
          const text = t(hintKey(hint, device));
          expect(text, `${language} ${hint} ${device}`).not.toBe(hintKey(hint, device));
          expect(text).not.toContain('—');
        }
      }
    }
    setLanguage('es');
  });
});

describe('signs seen on this device', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { get: (k: string) => data.get(k) ?? null, set: (k: string, v: string) => void data.set(k, v), data };
  };

  it('remembers each sign once and survives a broken value', () => {
    const store = memory();
    expect(tutorialSeen(store).size).toBe(0);
    markTutorialSeen(store, 'roll');
    markTutorialSeen(store, 'roll');
    markTutorialSeen(store, 'move');
    expect([...tutorialSeen(store)]).toEqual(['roll', 'move']);
    store.set('mazmorra-sombria.tutorialSeen', '{not json');
    expect(tutorialSeen(store).size).toBe(0);
  });
});
