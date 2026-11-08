import { newsImageUrl } from '../adapters/bundled-art';
import type { KeyValueStore } from '../adapters/storage';
import { CHANGELOG, CHANGELOG_SECTIONS, compareVersions, type ChangelogItem, type ChangelogSection, type Release } from '../data/changelog';
import { getLanguage, t } from '../i18n';
import '../styles/achievements-news.css';
import { isCompactTouch } from '../ui/compact-touch';
import { ACH_NEWS_ICONS, NEWS_SECTION_ICONS } from '../ui/icons/achievements-news-icons';
import { attachPager } from '../ui/pager';
import { pixelSvgOf } from '../ui/pixel-icons';
import { packSentences } from '../ui/text-chunks';
import { h, mdWindow } from '../ui/window';
import { formatDay } from './achievements';

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

/** The longest piece of a note on one phone page; a note longer than this turns over to the next page at a sentence end. */
const PIECE_MAX = 120;

/** A note of a release as the phone shows it: where it belongs and its text in pieces that each fit a page. */
export interface PhoneNote {
  section: ChangelogSection;
  item: ChangelogItem;
  text: string;
  pieces: string[];
}

/** Every note of a release, section by section in the fixed order, cut into page-sized pieces. */
export function phoneNotes(release: Release, language: 'es' | 'en'): PhoneNote[] {
  return releaseSections(release).flatMap(([section, items]) => items.map((item) => ({ section, item, text: item[language], pieces: packSentences(item[language], PIECE_MAX) })));
}

/** The longest headline: a first sentence longer than this is cut at its last comma (or word) before it. */
const HEADLINE_MAX = 110;

/**
 * Splits a note into its bold headline and the dimmer rest, without touching
 * a character (`head + rest === text`): the headline runs to the first
 * ": " or, without one, to the end of the first sentence; a headline longer
 * than `HEADLINE_MAX` is cut at its last comma, else its last space.
 */
export function splitHeadline(text: string): { head: string; rest: string } {
  const colon = text.indexOf(': ');
  const sentence = /[.!?](?=\s)/.exec(text);
  const candidates = [colon >= 0 ? colon + 1 : -1, sentence ? sentence.index + 1 : -1].filter((end) => end > 0);
  const natural = candidates.length > 0 ? Math.min(...candidates) : text.length;
  const end = natural <= HEADLINE_MAX ? natural : cutPoint(text);
  return { head: text.slice(0, end), rest: text.slice(end) };
}

/** Where to cut a headline that runs too long: after the last comma that fits, else before the last space that fits. */
function cutPoint(text: string): number {
  const window = text.slice(0, HEADLINE_MAX);
  const comma = window.lastIndexOf(', ');
  if (comma > 20) return comma + 1;
  const space = window.lastIndexOf(' ');
  return space > 0 ? space : HEADLINE_MAX;
}

const icon = (key: string, className: string): SVGSVGElement => pixelSvgOf(ACH_NEWS_ICONS[key]!, className);

/** A note as a row: its icon, the bold headline with the rest dimmer, and a thumbnail when it has a screenshot. */
function newsRow(item: ChangelogItem, section: ChangelogSection, language: 'es' | 'en'): HTMLElement {
  const { head, rest } = splitHeadline(item[language]);
  const row = h('li', { className: 'news-row' }, [icon(item.icon ?? NEWS_SECTION_ICONS[section], 'news-row-icon'), h('p', { className: 'news-row-text' }, [h('strong', { textContent: head }), rest])]);
  if (item.image) {
    const picture = h('img', { src: newsImageUrl(item.image), alt: head, loading: 'lazy', decoding: 'async' });
    const thumb = h('button', { type: 'button', className: 'news-thumb' }, [picture]);
    thumb.setAttribute('aria-pressed', 'false');
    thumb.setAttribute('aria-label', `${t('news.image.zoom')}: ${head}`);
    thumb.addEventListener('click', () => {
      const zoomed = row.classList.toggle('is-zoomed');
      thumb.setAttribute('aria-pressed', String(zoomed));
      thumb.setAttribute('aria-label', `${t(zoomed ? 'news.image.shrink' : 'news.image.zoom')}: ${head}`);
    });
    row.append(thumb);
  }
  return row;
}

/** One release as a card: a header button (version, date, count, the sections it touches) that folds the notes. */
function releaseCard(release: Release, index: number, language: 'es' | 'en'): { card: HTMLElement; head: HTMLButtonElement } {
  const sections = releaseSections(release);
  const count = sections.reduce((sum, [, items]) => sum + items.length, 0);
  const open = index === 0;
  const bodyId = `news-body-${release.version.replace(/\./g, '-')}`;
  const body = h('div', { className: 'news-body', id: bodyId }, [
    ...sections.map(([section, items]) =>
      h('div', { className: `news-group sec-${section}` }, [
        h('h4', { className: 'news-badge' }, [icon(NEWS_SECTION_ICONS[section], 'px-icon'), t(sectionTitleKey(section))]),
        h('ul', { className: 'news-rows' }, items.map((item) => newsRow(item, section, language))),
      ]),
    ),
  ]);
  const strip = h('span', { className: 'news-strip' }, sections.map(([section]) => icon(NEWS_SECTION_ICONS[section], 'px-icon')));
  strip.setAttribute('aria-hidden', 'true');
  const head = h('button', { type: 'button', className: 'news-head' }, [
    h('span', { className: 'news-chevron' }),
    h('span', { className: 'news-version', textContent: `v${release.version}` }),
    h('span', { className: 'news-chip', textContent: formatDay(release.date, language) }),
    index === 0 ? h('span', { className: 'news-chip is-latest', textContent: t('news.latest') }) : null,
    h('span', { className: 'news-chip', textContent: t(count === 1 ? 'news.items.one' : 'news.items').replace('{n}', String(count)) }),
    strip,
  ]);
  head.setAttribute('aria-controls', bodyId);
  const card = h('section', { className: open ? 'news-card is-open' : 'news-card' }, [h('h3', { className: 'news-card-title' }, [head]), body]);
  const setOpen = (value: boolean): void => {
    card.classList.toggle('is-open', value);
    head.setAttribute('aria-expanded', String(value));
    body.hidden = !value;
    head.title = t(value ? 'news.collapse' : 'news.expand');
  };
  setOpen(open);
  head.addEventListener('click', () => setOpen(!card.classList.contains('is-open')));
  return { card, head };
}

/**
 * The notes window: one card per release (the newest open, older ones folded
 * behind a header button), sections as icon badges and each note as a row.
 * `footer` holds the way back (a one-row list, so keys and touch work as
 * everywhere). Up/down move between the headers and the way back, Enter or
 * Space fold and unfold, Esc leaves.
 */
export function patchNotesWindow(footer: HTMLElement): HTMLElement {
  const language = getLanguage();
  if (isCompactTouch()) return phonePatchNotes(footer, language);
  const cards = CHANGELOG.map((release, index) => releaseCard(release, index, language));
  const scroll = h('div', { className: 'news-scroll' }, cards.map((c) => c.card));
  const element = mdWindow({ title: t('news.title'), className: 'news-window' }, [scroll, footer]);

  let attached = false;
  const onKey = (e: KeyboardEvent): void => {
    if (!element.isConnected) {
      if (attached) window.removeEventListener('keydown', onKey, true);
      return;
    }
    attached = true;
    if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    const stops = [...cards.map((c) => c.head), ...footer.querySelectorAll<HTMLElement>('button')];
    const at = target ? stops.indexOf(target) : -1;
    const isHead = at >= 0 && at < cards.length;
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW') {
      const next = at < 0 ? 0 : Math.max(0, Math.min(stops.length - 1, at + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1)));
      e.preventDefault();
      stops[next]?.focus({ preventScroll: true });
      stops[next]?.scrollIntoView?.({ block: 'nearest' });
    } else if (isHead && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) {
      // The way back's list also confirms on Enter: toggle here and keep the key from reaching it.
      e.preventDefault();
      if (!e.repeat) target!.click();
    }
  };
  window.addEventListener('keydown', onKey, true);
  // Focus the newest card's header once the window is on the page.
  setTimeout(() => {
    if (element.isConnected) cards[0]?.head.focus({ preventScroll: true });
  }, 0);
  return element;
}

/** A note's first piece with its headline bold; a continuation is plain text. */
function pieceText(note: PhoneNote, index: number): HTMLElement {
  if (index > 0) return h('p', { className: 'news-row-text', textContent: note.pieces[index] });
  const first = note.pieces[0] ?? '';
  const { head } = splitHeadline(note.text);
  const cut = head.length < first.length ? head.length : first.length;
  return h('p', { className: 'news-row-text' }, [h('strong', { textContent: first.slice(0, cut) }), first.slice(cut)]);
}

/** The rows of one note on a phone: the first carries the icon and the section's name, each piece after it is a row of its own. */
function phoneRows(note: PhoneNote): HTMLElement[] {
  return note.pieces.map((_, index) => {
    const row = h('li', { className: `news-row sec-${note.section}${index > 0 ? ' is-cont' : ''}` }, [
      index === 0 ? icon(note.item.icon ?? NEWS_SECTION_ICONS[note.section], 'news-row-icon') : h('span', { className: 'news-row-icon' }),
      h('div', { className: 'news-note' }, [index === 0 ? h('span', { className: 'news-tag', textContent: t(sectionTitleKey(note.section)) }) : null, pieceText(note, index)]),
    ]);
    row.setAttribute('role', 'listitem');
    if (index === 0 && note.item.image) {
      const { head } = splitHeadline(note.text);
      row.append(h('img', { className: 'news-shot', src: newsImageUrl(note.item.image), alt: head, loading: 'lazy', decoding: 'async' }));
    }
    return row;
  });
}

/**
 * The notes on a short touch screen (no scrolling): the release's title above, its notes paged (long notes sentence by sentence)
 * and, at the foot, the page buttons between two buttons that step to the older and the newer release.
 * The way back is the screen's own "Atrás" button. Left and Right turn the page, PageUp and PageDown change release.
 */
function phonePatchNotes(footer: HTMLElement, language: 'es' | 'en'): HTMLElement {
  let index = 0;
  const heading = h('div', { className: 'news-cur' });
  const host = h('div', { className: 'news-page' });
  host.setAttribute('role', 'list');
  const pages = h('div', { className: 'news-pages' });
  const pager = attachPager(host, { nav: pages, enabled: isCompactTouch });
  const stepper = (side: 'older' | 'newer'): { button: HTMLButtonElement; caption: HTMLElement } => {
    const caption = h('span', { className: 'news-step-ver' });
    const arrow = h('span', { className: `pg-arrow news-step-arrow is-${side}` });
    const button = h('button', { type: 'button', className: `news-step is-${side}` }, side === 'older' ? [arrow, caption] : [caption, arrow]);
    button.setAttribute('aria-label', t(`news.${side}`));
    return { button, caption };
  };
  const older = stepper('older');
  const newer = stepper('newer');
  const nav = h('div', { className: 'news-nav' }, [older.button, pages, newer.button]);

  function paint(): void {
    const release = CHANGELOG[index]!;
    heading.replaceChildren(
      h('span', { className: 'news-version', textContent: `v${release.version}` }),
      h('span', { className: 'news-chip', textContent: formatDay(release.date, language) }),
      ...(index === 0 ? [h('span', { className: 'news-chip is-latest', textContent: t('news.latest') })] : []),
    );
    host.replaceChildren(...phoneNotes(release, language).flatMap(phoneRows));
    const past = CHANGELOG[index + 1];
    const next = CHANGELOG[index - 1];
    older.button.disabled = !past;
    older.caption.textContent = past ? `v${past.version}` : '';
    newer.button.disabled = !next;
    newer.caption.textContent = next ? `v${next.version}` : '';
    pager.reset();
  }
  const step = (delta: number): void => {
    const to = Math.min(CHANGELOG.length - 1, Math.max(0, index + delta));
    if (to === index) return;
    index = to;
    paint();
  };
  older.button.addEventListener('click', () => step(1));
  newer.button.addEventListener('click', () => step(-1));

  const element = mdWindow({ title: t('news.title'), className: 'news-window is-compact' }, [heading, host, nav, footer]);
  let attached = false;
  const onKey = (e: KeyboardEvent): void => {
    if (!element.isConnected) {
      if (attached) window.removeEventListener('keydown', onKey, true);
      return;
    }
    attached = true;
    if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault();
      pager.go(pager.page() + (e.code === 'ArrowRight' ? 1 : -1));
    } else if (e.code === 'PageUp' || e.code === 'PageDown') {
      e.preventDefault();
      step(e.code === 'PageDown' ? 1 : -1);
    }
  };
  window.addEventListener('keydown', onKey, true);
  paint();
  return element;
}
