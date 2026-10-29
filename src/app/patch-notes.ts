import type { KeyValueStore } from '../adapters/storage';
import { CHANGELOG, CHANGELOG_SECTIONS, compareVersions, type ChangelogItem, type ChangelogSection, type Release } from '../data/changelog';
import { getLanguage, t } from '../i18n';
import { h, mdWindow } from '../ui/window';

/**
 * The "Novedades" screen (issue #10): the patch notes of src/data/changelog.ts,
 * newest release first. Reachable from the title's Options; it also opens by
 * itself once on the title after the game updates to a version this browser
 * has not seen (never on a brand-new install, never over the first-run flow).
 */
export const LAST_SEEN_VERSION_KEY = 'mazmorra-sombria.lastSeenVersion';

const SEMVER = /^\d+\.\d+\.\d+$/;

export function readLastSeenVersion(store: KeyValueStore): string | null {
  const value = store.get(LAST_SEEN_VERSION_KEY);
  return value && SEMVER.test(value) ? value : null;
}

export function markVersionSeen(store: KeyValueStore, version: string): void {
  store.set(LAST_SEEN_VERSION_KEY, version);
}

export interface PatchNotesState {
  /** The version whose notes this browser last saw (null: none recorded yet). */
  lastSeen: string | null;
  /** The running build's version ("dev" outside a Vite build). */
  current: string;
  /** The player already played (progress, a chosen starter or the prologue seen). */
  returningPlayer: boolean;
}

/**
 * What the title does on reaching it: `show` the notes (and record the
 * version), only `record` it (a brand-new install, an older build, a version
 * without notes), or `none`.
 */
export function patchNotesDue(state: PatchNotesState): 'show' | 'record' | 'none' {
  if (!SEMVER.test(state.current) || state.lastSeen === state.current) return 'none';
  if (!CHANGELOG.some((release) => release.version === state.current)) return 'record';
  if (state.lastSeen === null) return state.returningPlayer ? 'show' : 'record';
  return compareVersions(state.current, state.lastSeen) > 0 ? 'show' : 'record';
}

/** i18n key of a section heading. */
export const sectionTitleKey = (section: ChangelogSection): string => `news.section.${section}`;

/** The non-empty sections of a release, in the fixed order. */
export function releaseSections(release: Release): [ChangelogSection, readonly ChangelogItem[]][] {
  return CHANGELOG_SECTIONS.flatMap((section) => {
    const items = release.sections[section] ?? [];
    return items.length > 0 ? [[section, items] as [ChangelogSection, readonly ChangelogItem[]]] : [];
  });
}

/** The notes window; `footer` holds the way back (a one-row list, so keys and touch work as everywhere). */
export function patchNotesWindow(footer: HTMLElement): HTMLElement {
  const language = getLanguage();
  const releases = CHANGELOG.map((release) =>
    h('section', { className: 'news-release' }, [
      h('h3', { textContent: t('news.version').replace('{version}', release.version).replace('{date}', release.date) }),
      ...releaseSections(release).flatMap(([section, items]) => [
        h('h4', { className: 'news-section', textContent: t(sectionTitleKey(section)) }),
        h('ul', { className: 'news-list' }, items.map((item) => h('li', { textContent: item[language] }))),
      ]),
    ]),
  );
  return mdWindow({ title: t('news.title'), className: 'wide credits news' }, [h('div', { className: 'credit-scroll' }, releases), footer]);
}
