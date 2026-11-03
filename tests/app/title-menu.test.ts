import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextPlayScreen, townOpen } from '../../src/app/adventure-route';
import { CRYPT, TUTORIAL } from '../../src/data/dungeons';
import { OPTIONS_ENTRIES, optionsAboutKey, optionsEntries, TITLE_ENTRIES, TITLE_LABEL } from '../../src/app/title-menu';
import { catalog, LANGUAGES } from '../../src/i18n';

/** The town-first title (owner, 2026-10-26; odd/tasks/fast-travel.md T2). */
describe('title menu', () => {
  it('has exactly Play, Play online and Options', () => {
    expect([...TITLE_ENTRIES]).toEqual(['play', 'online', 'options']);
  });

  // Superseded by the title hub (owner, 2026-11-03; odd/tasks/title-hub.md): the title draws every button from `hubButtons`.
  it('the title screen builds its buttons from the hub model only', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const title = main.slice(main.indexOf('function titleScreen('), main.indexOf('async function toggleFullscreen('));
    expect(title).toContain('buttons: hubButtons(state)');
    expect(title).not.toContain('cursorList(');
  });

  it('keeps everything else under Options, the install offer only when installable', () => {
    expect(optionsEntries(true)).toEqual([...OPTIONS_ENTRIES]);
    expect(optionsEntries(false)).not.toContain('install');
    expect(optionsEntries(false)).toEqual(OPTIONS_ENTRIES.filter((e) => e !== 'install'));
  });

  for (const language of LANGUAGES) {
    it(`"${language}" names every entry and describes every option, no em dash`, () => {
      const tr = (key: string) => catalog(language)[key];
      for (const entry of [...TITLE_ENTRIES, ...OPTIONS_ENTRIES]) expect(tr(TITLE_LABEL[entry]), entry).toBeTruthy();
      for (const entry of [...OPTIONS_ENTRIES, 'back' as const]) {
        const text = tr(entry === 'back' ? 'options.about.back' : optionsAboutKey(entry));
        expect(text, entry).toBeTruthy();
        expect(text!.includes('—')).toBe(false);
      }
    });
  }
});

describe('Play goes to the town', () => {
  it('runs the prologue and the quiz the first time, then the town', () => {
    expect(nextPlayScreen({ prologueSeen: false, starterChosen: false, townOpen: true })).toBe('prologue');
    expect(nextPlayScreen({ prologueSeen: true, starterChosen: false, townOpen: true })).toBe('quiz');
    expect(nextPlayScreen({ prologueSeen: true, starterChosen: true, townOpen: true })).toBe('town');
  });

  // odd/tasks/tutorial-dungeon.md S1: the first run walks the tutorial dungeon to the town, not the Crypt.
  it('goes straight into the tutorial dungeon while the town is still closed', () => {
    expect(nextPlayScreen({ prologueSeen: true, starterChosen: true, townOpen: false })).toBe('tutorial');
    expect(nextPlayScreen({ prologueSeen: false, starterChosen: false, townOpen: false })).toBe('prologue');
    expect(nextPlayScreen({ prologueSeen: true, starterChosen: false, townOpen: false })).toBe('quiz');
  });
});

describe('the town opens after the tutorial dungeon', () => {
  const none = { owned: [], upgrades: {}, learned: {}, story: {} };
  it('stays closed for a new player until the shadow falls at the end of the way to the town', () => {
    expect(townOpen(new Set(), none)).toBe(false);
    expect(townOpen(new Set([TUTORIAL.id]), none)).toBe(true);
  });

  it('stays open for a player who already cleared the Crypt (the old first dungeon)', () => {
    expect(townOpen(new Set([CRYPT.id]), none)).toBe(true);
  });

  it('stays open for a player who already used the town (anything bought, learned or owned there)', () => {
    expect(townOpen(new Set(), { ...none, owned: ['zorua'] })).toBe(true);
    expect(townOpen(new Set(), { ...none, upgrades: { vitality: 1 } })).toBe(true);
    expect(townOpen(new Set(), { ...none, learned: { mimikyu: ['shadow-sneak'] } })).toBe(true);
    expect(townOpen(new Set(), { ...none, story: { mimikyu: 1 } })).toBe(true);
  });
});
