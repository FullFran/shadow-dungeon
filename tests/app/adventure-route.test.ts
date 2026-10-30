import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasProgress, nextAdventureScreen, nextOnlineScreen } from '../../src/app/adventure-route';
import { EMPTY_SAVE } from '../../src/app/save';
import { EMPTY_RECORDS } from '../../src/town/records';
import { defaultSettings, lastPlayedForm, withReturningPlayer, withStarter } from '../../src/app/settings';
import { rosterOf } from '../../src/core/collection';
import { lineRoot } from '../../src/data/player-evolutions';
import { isPlayable, PLAYABLE_SPECIES } from '../../src/data/species';
import { STARTERS } from '../../src/data/quiz';

describe('new adventure routing', () => {
  it('opens with the prologue the first time, whatever the starter', () => {
    expect(nextAdventureScreen({ prologueSeen: false, starterChosen: false })).toBe('prologue');
    expect(nextAdventureScreen({ prologueSeen: false, starterChosen: true })).toBe('prologue');
  });

  it('runs the quiz after the prologue while no starter is chosen', () => {
    expect(nextAdventureScreen({ prologueSeen: true, starterChosen: false })).toBe('quiz');
  });

  it('goes straight to the loadout once both are done', () => {
    expect(nextAdventureScreen({ prologueSeen: true, starterChosen: true })).toBe('loadout');
  });

  it('walks prologue, quiz, loadout as each step is marked done', () => {
    const state = { prologueSeen: false, starterChosen: false };
    const path: string[] = [];
    for (let step = nextAdventureScreen(state); ; step = nextAdventureScreen(state)) {
      path.push(step);
      if (step === 'loadout') break;
      if (step === 'prologue') state.prologueSeen = true;
      else state.starterChosen = true;
    }
    expect(path).toEqual(['prologue', 'quiz', 'loadout']);
  });

  it('every quiz starter is playable, so its result is the run species with no Mimikyu fallback', () => {
    for (const starter of STARTERS) {
      expect(isPlayable(starter), starter).toBe(true);
      expect(withStarter(defaultSettings('es'), starter).species).toBe(starter);
    }
  });

  it('a fresh profile shows no progress; any run, coin, species, chapter, upgrade or achievement does', () => {
    expect(hasProgress(EMPTY_SAVE, EMPTY_RECORDS)).toBe(false);
    expect(hasProgress({ ...EMPTY_SAVE, owned: [] , story: {}, achievements: {}, earned: 0 }, EMPTY_RECORDS)).toBe(false);
    expect(hasProgress(EMPTY_SAVE, { ...EMPTY_RECORDS, runs: 1 })).toBe(true);
    expect(hasProgress({ ...EMPTY_SAVE, coins: 40 }, EMPTY_RECORDS)).toBe(true);
    expect(hasProgress({ ...EMPTY_SAVE, earned: 40 }, EMPTY_RECORDS)).toBe(true);
    expect(hasProgress({ ...EMPTY_SAVE, owned: ['shinx'] }, EMPTY_RECORDS)).toBe(true);
    expect(hasProgress({ ...EMPTY_SAVE, story: { cubone: 1 } }, EMPTY_RECORDS)).toBe(true);
    expect(hasProgress({ ...EMPTY_SAVE, upgrades: { vitality: 1 } }, EMPTY_RECORDS)).toBe(true);
    expect(hasProgress({ ...EMPTY_SAVE, achievements: { 'first-run': '2026-10-01' } }, EMPTY_RECORDS)).toBe(true);
  });

  it('a returning player on a new device skips the prologue and the quiz, keeping the species it last played', () => {
    const fresh = defaultSettings('es');
    const back = withReturningPlayer(fresh, 'cubone', ['mimikyu', 'cubone', 'shinx']);
    expect(back.starterChosen).toBe(true);
    expect(back.species).toBe('cubone');
    expect(nextAdventureScreen({ prologueSeen: true, starterChosen: back.starterChosen })).toBe('loadout');
    // A last species outside the roster (or none recorded) keeps the current one.
    expect(withReturningPlayer(fresh, 'not-a-species', ['mimikyu']).species).toBe(fresh.species);
    expect(withReturningPlayer(fresh, null, ['mimikyu'])).toEqual({ ...fresh, starterChosen: true });
    // A chosen starter is never touched.
    const chosen = withStarter(fresh, 'cubone');
    expect(withReturningPlayer(chosen, 'mimikyu', ['mimikyu', 'cubone'])).toBe(chosen);
  });

  it('both ways into the first steps (Play and a new adventure) adopt a returning player first', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    for (const fn of ['function playScreen(', 'function newAdventure(']) {
      const body = main.slice(main.indexOf(fn), main.indexOf('const next', main.indexOf(fn)));
      expect(body, fn).toContain('adoptReturningPlayer();');
    }
  });

  it('the last species played resolves through its line to the form the player has now, for every playable line', () => {
    for (const last of PLAYABLE_SPECIES) {
      for (const now of PLAYABLE_SPECIES.filter((id) => lineRoot(id) === lineRoot(last))) {
        // The roster holds one form per line: the one the player has now (an evolved starter replaces its first form).
        const roster = rosterOf({ owned: [now] });
        expect(lastPlayedForm(last, roster), `${last} -> ${now}`).toBe(now);
        expect(withReturningPlayer(defaultSettings('es'), last, roster).species, `${last} -> ${now}`).toBe(now);
      }
    }
    // Mimikyu awakens without a new id: it stays itself.
    expect(lastPlayedForm('mimikyu', rosterOf({ owned: [] }))).toBe('mimikyu');
    // A line the player no longer has, or junk, resolves to nothing.
    expect(lastPlayedForm('kadabra', rosterOf({ owned: [] }))).toBeNull();
    expect(lastPlayedForm('not-a-species', rosterOf({ owned: [] }))).toBeNull();
    expect(lastPlayedForm(null, rosterOf({ owned: [] }))).toBeNull();
  });
});

describe('the first time through Play online', () => {
  it('goes through the same first steps as Play, then to the online menu', () => {
    expect(nextOnlineScreen({ prologueSeen: false, starterChosen: false })).toBe('prologue');
    expect(nextOnlineScreen({ prologueSeen: true, starterChosen: false })).toBe('quiz');
    expect(nextOnlineScreen({ prologueSeen: true, starterChosen: true })).toBe('online');
  });
  it('the title sends Play online through it, adopting a returning player first', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main).toContain('online: () => onlineEntry(root),');
    const entry = main.slice(main.indexOf('function onlineEntry('), main.indexOf('function onlineEntry(') + 400);
    expect(entry).toContain('adoptReturningPlayer();');
    expect(entry).toContain('nextOnlineScreen(');
  });
});

