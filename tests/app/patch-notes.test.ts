import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { LAST_SEEN_VERSION_KEY, markVersionSeen, patchNotesDue, readLastSeenVersion, releaseSections, sectionTitleKey } from '../../src/app/patch-notes';
import { OPTIONS_ENTRIES } from '../../src/app/title-menu';
import { CHANGELOG, CHANGELOG_SECTIONS } from '../../src/data/changelog';
import { catalog, LANGUAGES } from '../../src/i18n';
import { releaseNotesMarkdown } from '../../tools/release-notes.mjs';

describe('when the patch notes open by themselves (issue #10)', () => {
  it('never on a brand-new install: it only records the version', () => {
    expect(patchNotesDue({ lastSeen: null, current: '0.9.0', returningPlayer: false })).toBe('record');
  });

  it('once for a player who already played before versions were recorded', () => {
    expect(patchNotesDue({ lastSeen: null, current: '0.9.0', returningPlayer: true })).toBe('show');
  });

  it('once after the game updates to a version the player has not seen', () => {
    expect(patchNotesDue({ lastSeen: '0.8.2', current: '0.9.0', returningPlayer: true })).toBe('show');
    expect(patchNotesDue({ lastSeen: '0.8.2', current: '0.9.0', returningPlayer: false })).toBe('show');
  });

  it('not again for the version already seen, nor after going back to an older build', () => {
    expect(patchNotesDue({ lastSeen: '0.9.0', current: '0.9.0', returningPlayer: true })).toBe('none');
    expect(patchNotesDue({ lastSeen: '0.10.0', current: '0.9.0', returningPlayer: true })).toBe('record');
  });

  it('never in a development build or for a version without notes', () => {
    expect(patchNotesDue({ lastSeen: null, current: 'dev', returningPlayer: true })).toBe('none');
    expect(patchNotesDue({ lastSeen: '0.9.0', current: '99.0.0', returningPlayer: true })).toBe('record');
  });

  it('remembers the last seen version under its own key, ignoring garbage', () => {
    const store = memoryStore();
    expect(readLastSeenVersion(store)).toBeNull();
    markVersionSeen(store, '0.9.0');
    expect(store.get(LAST_SEEN_VERSION_KEY)).toBe('0.9.0');
    expect(LAST_SEEN_VERSION_KEY).toBe('mazmorra-sombria.lastSeenVersion');
    expect(readLastSeenVersion(store)).toBe('0.9.0');
    store.set(LAST_SEEN_VERSION_KEY, 'banana');
    expect(readLastSeenVersion(store)).toBeNull();
  });
});

describe('the Novedades screen', () => {
  it('shows the sections of a release in a fixed order, skipping empty ones', () => {
    const release = { version: '1.0.0', date: '2026-11-01', sections: { known: [{ es: 'a', en: 'a' }], new: [{ es: 'b', en: 'b' }], fixed: [] } };
    expect(releaseSections(release).map(([section]) => section)).toEqual(['new', 'known']);
  });

  for (const language of LANGUAGES) {
    it(`"${language}" names the screen, its entry and every section heading`, () => {
      const tr = catalog(language);
      for (const section of CHANGELOG_SECTIONS) expect(tr[sectionTitleKey(section)], section).toBeTruthy();
      for (const key of ['news.title', 'news.version', 'title.news', 'options.about.news']) expect(tr[key], key).toBeTruthy();
    });
  }

  it('is an Options entry, and the title checks for unseen notes before drawing itself', () => {
    expect(OPTIONS_ENTRIES).toContain('news');
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const title = main.slice(main.indexOf('function titleScreen('), main.indexOf('function optionsScreen('));
    expect(title).toMatch(/if \(patchNotesOnBoot\(root\)\) return;/);
    expect(main).toMatch(/news: \(\) => newsScreen\(root, \(\) => optionsScreen\(root, 'news'\)\)/);
  });
});

describe('GitHub Release notes from the same changelog', () => {
  it('prints Spanish first, then English, with every item of the version', () => {
    const release = CHANGELOG[0]!;
    const markdown: string = releaseNotesMarkdown(release);
    const es = markdown.indexOf('Español');
    const en = markdown.indexOf('English');
    expect(es).toBeGreaterThanOrEqual(0);
    expect(en).toBeGreaterThan(es);
    for (const section of CHANGELOG_SECTIONS)
      for (const item of release.sections[section] ?? []) {
        expect(markdown.indexOf(`- ${item.es}`)).toBeGreaterThan(es);
        expect(markdown.indexOf(`- ${item.en}`, en)).toBeGreaterThan(en);
      }
    expect(markdown).toContain(catalog('es')[sectionTitleKey('multiplayer')]!);
    expect(markdown).toContain(catalog('en')[sectionTitleKey('multiplayer')]!);
  });
});
