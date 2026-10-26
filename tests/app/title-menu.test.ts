import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextPlayScreen } from '../../src/app/adventure-route';
import { OPTIONS_ENTRIES, optionsAboutKey, optionsEntries, TITLE_ENTRIES, TITLE_LABEL } from '../../src/app/title-menu';
import { catalog, LANGUAGES } from '../../src/i18n';

/** The town-first title (owner, 2026-10-26; odd/tasks/fast-travel.md T2). */
describe('title menu', () => {
  it('has exactly Play, Play online and Options', () => {
    expect([...TITLE_ENTRIES]).toEqual(['play', 'online', 'options']);
  });

  it('the title screen builds its rows from those three entries only', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const title = main.slice(main.indexOf('function titleScreen('), main.indexOf('function optionsScreen('));
    expect(title).toContain('TITLE_ENTRIES.map(');
    // No hand-written rows left beside them (the old shop, shrine, town, account... entries).
    expect(title.match(/\{ label: /g) ?? []).toHaveLength(1);
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
    expect(nextPlayScreen({ prologueSeen: false, starterChosen: false })).toBe('prologue');
    expect(nextPlayScreen({ prologueSeen: true, starterChosen: false })).toBe('quiz');
    expect(nextPlayScreen({ prologueSeen: true, starterChosen: true })).toBe('town');
  });
});
