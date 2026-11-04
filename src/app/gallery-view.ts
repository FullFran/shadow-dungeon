import { SPECIES, type SpeciesId } from '../data/species';
import { storyKeys } from '../data/story-quests';
import { t } from '../i18n';
import { GALLERY_ICONS } from '../ui/icons/gallery-icons';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import { PALETTE, RELIC, TYPE_COLORS } from '../ui/tokens';
import { h, mdWindow } from '../ui/window';
import { galleryUnlocked, groupSeen, type GalleryEntry, type GalleryGroup, type GallerySeen } from './lore-gallery';
import { hubStep, type HubDirection } from './title-hub';
import '../styles/lore-gallery.css';

/**
 * The lore gallery in the picker pattern (owner, 2026-11-04: "rediseña ... la galería"): a grid of group
 * cards (a framed vignette in the group's colour, title, seen counter; a sealed slab with a padlock and a
 * hint, never a scene's name, where nothing was seen) beside a sheet listing the chapters of the card in focus
 * with a play button on each seen scene, and one honest bar of overall progress. Arrows move across the grid,
 * Enter opens the sheet, Esc closes. Fixed geometry. The models below are pure; `galleryView` draws them.
 */
type Tr = (key: string) => string;

export interface GalleryCard {
  id: string;
  title: string;
  seen: number;
  total: number;
  /** The title for a card: a Senda drops its shared "La Senda del" so the distinguishing word survives the ellipsis. */
  short: string;
  /** Nothing of the group was seen: it shows as a sealed slab. */
  locked: boolean;
  /** Where the unlock comes from, in general words (null once something is seen). */
  hint: string | null;
}

export interface GallerySceneRow {
  entry: GalleryEntry;
  label: string;
  unlocked: boolean;
}

export interface GalleryRow {
  id: string;
  /** "???" while none of its scenes was seen. */
  title: string;
  scenes: GallerySceneRow[];
}

const SENDA_PREFIX = /^(?:La Senda (?:del|de la|de los|de)|The Path of(?: the)?)\s+/i;

const hintKey = (id: string): string => (id.startsWith('senda-') ? 'gallery.hint.senda' : `gallery.hint.${id}`);

export function galleryCards(groups: readonly GalleryGroup[], seen: GallerySeen, tr: Tr): GalleryCard[] {
  return groups.map((group) => {
    const count = groupSeen(group, seen);
    const title = group.title(tr);
    return { id: group.id, title, short: group.id.startsWith('senda-') ? title.replace(SENDA_PREFIX, '') : title, seen: count, total: group.entries.length, locked: count === 0, hint: count === 0 ? tr(hintKey(group.id)) : null };
  });
}

export function galleryProgress(groups: readonly GalleryGroup[], seen: GallerySeen): { seen: number; total: number; fraction: number } {
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const count = groups.reduce((n, g) => n + groupSeen(g, seen), 0);
  return { seen: count, total, fraction: total === 0 ? 0 : count / total };
}

const rowKey = (entry: GalleryEntry): string => {
  const s = entry.scene;
  return s.kind === 'story' ? `${s.line}-${s.chapter}` : s.kind === 'guardian' ? s.species : entry.id;
};

function rowTitle(entry: GalleryEntry, tr: Tr): string {
  const s = entry.scene;
  if (s.kind === 'story') return tr(storyKeys.chapterTitle(s.line, s.chapter));
  if (s.kind === 'guardian') return tr(`species.${s.species}`);
  return entry.label(tr);
}

function sceneLabel(entry: GalleryEntry, tr: Tr): string {
  const s = entry.scene;
  if (s.kind === 'story') return tr(`gallery.story.${s.phase}`);
  if (s.kind === 'guardian') return tr(`gallery.guardian.${s.phase}`);
  return tr('gallery.play');
}

/** A group's scenes as rows: a Senda chapter or a guardian folds its opening and closing into one row. */
export function galleryRows(group: GalleryGroup, seen: GallerySeen, tr: Tr): GalleryRow[] {
  const rows = new Map<string, GalleryRow>();
  for (const entry of group.entries) {
    const key = rowKey(entry);
    let row = rows.get(key);
    if (!row) {
      row = { id: key, title: rowTitle(entry, tr), scenes: [] };
      rows.set(key, row);
    }
    row.scenes.push({ entry, label: sceneLabel(entry, tr), unlocked: galleryUnlocked(entry.scene, seen) });
  }
  return [...rows.values()].map((row) => (row.scenes.some((s) => s.unlocked) ? row : { ...row, title: tr('gallery.locked') }));
}

/** The group's colour: its Senda's species type, the eclipse for the Sima, ember for the prologue, gold for the guardians. */
export function groupTint(id: string): string {
  if (id.startsWith('senda-')) {
    const species = SPECIES[id.slice('senda-'.length) as SpeciesId];
    return TYPE_COLORS[species?.types[0] ?? 'normal'].core;
  }
  return id === 'sima' ? PALETTE.eclipse : id === 'guardians' ? RELIC.gold : RELIC.ember;
}

/** The card to land on moving across a grid of `count` cards in `columns` columns (stays put at an edge; a short last row takes the last card). */
export function gridMove(index: number, count: number, columns: number, dir: HubDirection): number {
  const last = count - 1;
  switch (dir) {
    case 'left':
      return index % columns === 0 ? index : index - 1;
    case 'right':
      return index % columns === columns - 1 || index >= last ? index : index + 1;
    case 'up':
      return index - columns >= 0 ? index - columns : index;
    case 'down':
      if (index + columns <= last) return index + columns;
      return Math.floor(index / columns) < Math.floor(last / columns) ? last : index;
  }
}

export interface GalleryViewOptions {
  groups: readonly GalleryGroup[];
  seen: GallerySeen;
  /** Whether a seen scene may play right now (the pleas only replay on the crater's rim, alone). */
  canPlay(entry: GalleryEntry): boolean;
  /** Plays a scene over the view; `done` runs when it ends and gives the keys back. */
  onPlay(entry: GalleryEntry, done: () => void): void;
  onBack(): void;
}

const KEYS: Record<string, HubDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

const bar = (fraction: number, className: string) => {
  const fill = h('i');
  fill.style.width = `${Math.round(fraction * 100)}%`;
  return h('span', { className }, [fill]);
};

const fill = (text: string, values: Record<string, string>) => Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text);

export function galleryView(options: GalleryViewOptions): { element: HTMLElement; dispose(): void } {
  const { groups, seen } = options;
  const cardsModel = galleryCards(groups, seen, t);
  const progress = galleryProgress(groups, seen);
  let focused = Math.max(0, cardsModel.findIndex((c) => !c.locked));
  let busy = false;

  const tint = (el: HTMLElement, id: string) => el.style.setProperty('--gv-tint', groupTint(id));
  const emblem = (id: string, locked: boolean) => {
    const v = h('span', { className: 'gv-vignette' }, [locked ? pixelIconSvg('lock', 'px-icon gv-lock') : pixelSvgOf(GALLERY_ICONS[id]!, 'px-icon gv-emblem')]);
    tint(v, id);
    return v;
  };

  const cards = cardsModel.map((card, i) => {
    const body = card.locked
      ? [h('span', { className: 'gv-card-hint', textContent: card.hint ?? '' })]
      : [h('span', { className: 'gv-card-count', textContent: fill(t('gallery.count'), { seen: String(card.seen), total: String(card.total) }) }), bar(card.seen / card.total, 'gv-mini')];
    const el = h('button', { className: `gv-card${card.locked ? ' is-locked' : ''}`, type: 'button' }, [emblem(card.id, card.locked), h('span', { className: 'gv-card-title', textContent: card.short }), ...body]);
    tint(el, card.id);
    el.dataset.group = card.id;
    el.setAttribute('aria-label', card.locked ? `${card.title}, ${t('gallery.sealed')}. ${card.hint}` : `${card.title}, ${fill(t('gallery.count'), { seen: String(card.seen), total: String(card.total) })}`);
    el.addEventListener('mouseenter', () => show(i));
    el.addEventListener('focus', () => show(i));
    el.addEventListener('click', () => {
      show(i);
      firstPlay()?.focus();
    });
    return el;
  });

  const sheet = h('section', { className: 'gv-sheet' });
  const grid = h('div', { className: 'gv-grid' }, cards);
  grid.setAttribute('aria-label', t('gallery.pick'));
  const back = h('button', { className: 'gv-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());

  const plays = (): HTMLButtonElement[] => [...sheet.querySelectorAll<HTMLButtonElement>('.gv-play:not([aria-disabled="true"])')];
  const firstPlay = () => plays()[0];

  const play = (entry: GalleryEntry, button: HTMLElement) => {
    if (busy) return;
    busy = true;
    options.onPlay(entry, () => {
      busy = false;
      if (button.isConnected) button.focus({ preventScroll: true });
    });
  };

  function show(index: number): void {
    focused = index;
    const group = groups[index]!;
    const card = cardsModel[index]!;
    cards.forEach((el, i) => el.classList.toggle('is-focused', i === index));
    const rows = galleryRows(group, seen, t);
    const head = h('header', { className: 'gv-sheet-head' }, [
      emblem(card.id, card.locked),
      h('div', { className: 'gv-sheet-titles' }, [
        h('h2', { className: 'gv-sheet-title', textContent: card.title }),
        h('p', { className: 'gv-sheet-count', textContent: card.locked ? t('gallery.sealed') : fill(t('gallery.count'), { seen: String(card.seen), total: String(card.total) }) }),
      ]),
    ]);
    const list = h(
      'ul',
      { className: 'gv-rows' },
      rows.map((row) => {
        const open = row.scenes.some((s) => s.unlocked);
        const buttons = row.scenes.map((s) => {
          if (!s.unlocked) return h('span', { className: 'gv-play is-locked', textContent: s.label }, [pixelIconSvg('lock', 'px-icon')]);
          const allowed = options.canPlay(s.entry);
          const b = h('button', { className: 'gv-play', type: 'button' }, [pixelIconSvg('play', 'px-icon'), h('span', { textContent: s.label })]);
          b.setAttribute('aria-label', `${row.title}, ${s.label}`);
          if (!allowed) {
            b.setAttribute('aria-disabled', 'true');
            b.title = t('gallery.plea.room');
          } else b.addEventListener('click', () => play(s.entry, b));
          return b;
        });
        return h('li', { className: `gv-row${open ? '' : ' is-locked'}` }, [h('span', { className: 'gv-row-title', textContent: row.title }), h('span', { className: 'gv-row-plays' }, buttons)]);
      }),
    );
    const note = card.locked ? h('p', { className: 'gv-sheet-hint' }, [pixelIconSvg('lock', 'px-icon'), h('span', { textContent: card.hint ?? '' })]) : null;
    sheet.replaceChildren(head, ...(note ? [note] : []), list);
    tint(sheet, card.id);
  }

  const win = mdWindow({ title: t('gallery.title'), className: 'gv-window' }, [
    h('div', { className: 'gv-progress' }, [
      h('span', { className: 'gv-progress-label', textContent: fill(t('gallery.progress'), { seen: String(progress.seen), total: String(progress.total) }) }),
      bar(progress.fraction, 'gv-bar'),
    ]),
    h('div', { className: 'gv-body' }, [grid, sheet]),
    h('div', { className: 'gv-foot' }, [back, h('p', { className: 'gv-hint', textContent: t('gallery.hint.keys') })]),
  ]);

  const columns = (): number => {
    const top = cards[0]?.offsetTop ?? 0;
    return Math.max(1, cards.filter((c) => c.offsetTop === top).length);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (!win.isConnected) {
      window.removeEventListener('keydown', onKey, true);
      return;
    }
    if (busy || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      options.onBack();
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    if (e.key === 'Enter' || e.key === ' ') {
      // Buttons activate themselves; the keys just must not reach the menus below.
      if (active && win.contains(active)) e.stopPropagation();
      return;
    }
    const dir = KEYS[e.code];
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    const at = active ? cards.indexOf(active as HTMLButtonElement) : -1;
    if (at >= 0) {
      const next = gridMove(at, cards.length, columns(), dir);
      if (next !== at) cards[next]!.focus();
      else if (dir === 'right') (firstPlay() ?? cards[at])!.focus();
      else if (dir === 'down') back.focus();
      return;
    }
    if (active === back) {
      if (dir === 'up') cards[focused]!.focus();
      return;
    }
    const list = plays();
    const here = active ? list.indexOf(active as HTMLButtonElement) : -1;
    if (here < 0) {
      cards[focused]!.focus();
      return;
    }
    const points = list.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const next = hubStep(points, String(here), dir);
    if (next === String(here) && dir === 'left') cards[focused]!.focus();
    else list[Number(next)]?.focus();
  };
  window.addEventListener('keydown', onKey, true);

  show(focused);
  queueMicrotask(() => cards[focused]?.focus({ preventScroll: true }));
  return {
    element: win,
    dispose() {
      window.removeEventListener('keydown', onKey, true);
    },
  };
}
