import { describe, expect, it } from 'vitest';
import { CHALLENGES, DUNGEONS } from '../../src/data/dungeons';
import { lineRoot } from '../../src/data/player-evolutions';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { MAX_RANK, tutorOffer } from '../../src/data/tutor';
import { SHINY_LINES } from '../../src/core/shiny';
import { isUnlocked } from '../../src/core/dungeon-select';
import { unlockEverything, unlockedRecords, unlockedSave } from '../../src/app/dev-unlock';
import { memoryStore } from '../../src/adapters/storage';
import { WORLD } from '../../src/data/world';
import { readVisited } from '../../src/town/travel';
import { EMPTY_SAVE, sanitize } from '../../src/app/save';
import { clearedDungeons, EMPTY_RECORDS, parseRecords, readRecords } from '../../src/town/records';
import { readFileSync } from 'node:fs';

describe('dev unlock', () => {
  const save = sanitize(JSON.parse(JSON.stringify(unlockedSave(EMPTY_SAVE))));
  const records = parseRecords(JSON.stringify(unlockedRecords(EMPTY_RECORDS)));

  it.each(PLAYABLE_SPECIES.map((s) => [s] as const))('%s has its whole movepool at full rank, after the save is read back', (species) => {
    const offer = tutorOffer(species);
    expect(save.learned?.[species] ?? []).toEqual(expect.arrayContaining([...offer]));
    for (const id of offer) expect(save.ranks?.[species]?.[id]).toBe(MAX_RANK);
  });

  it('every line is owned, has materials and its shiny', () => {
    const lines = [...new Set(PLAYABLE_SPECIES.map(lineRoot))];
    for (const line of lines) expect(save.materials?.[line], line).toBeDefined();
    expect(save.shinies).toEqual(expect.arrayContaining([...SHINY_LINES]));
    expect(save.owned?.length).toBeGreaterThan(0);
    expect(save.coins).toBeGreaterThan(100_000);
  });

  it('every dungeon and challenge is open and cleared', () => {
    const cleared = clearedDungeons(records);
    for (const d of [...DUNGEONS, ...CHALLENGES]) {
      expect(isUnlocked(d, cleared), d.id).toBe(true);
      expect(cleared.has(d.id), d.id).toBe(true);
    }
  });

  it('every map is a travel destination', () => {
    const store = memoryStore();
    unlockEverything(store);
    expect(readVisited(store)).toEqual(Object.keys(WORLD));
    expect(clearedDungeons(readRecords(store)).size).toBe(DUNGEONS.length + CHALLENGES.length);
  });

  it('only the development server can reach it', () => {
    const main = readFileSync('src/app/main.ts', 'utf8');
    expect(main).toMatch(/import\.meta\.env\.DEV && new URLSearchParams\(window\.location\.search\)\.get\('unlock'\) === 'all'/);
  });
});
