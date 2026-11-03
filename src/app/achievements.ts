import type { KeyValueStore } from '../adapters/storage';
import { familyProgress } from '../core/achievements';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENTS, type AchievementDef, type AchievementFamily } from '../data/achievements';
import { dungeonById, guardianOf } from '../data/dungeons';
import { awakeningsOf } from '../data/player-evolutions';
import type { Difficulty } from '../data/difficulty';
import { getLanguage, t } from '../i18n';
import '../styles/achievements-news.css';
import { cursorList } from '../ui/cursor-list';
import { ACHIEVEMENT_FAMILY_ICONS, ACH_NEWS_ICONS } from '../ui/icons/achievements-news-icons';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import { h, mdWindow } from '../ui/window';
import { coinText } from './coin-lines';
import { loadSave } from './save';

/**
 * The achievements on screen (odd/tasks/achievements-missions.md): names
 * and descriptions filled from i18n templates with the content's own names
 * (a new dungeon or species needs no new text), the unlock toast and the
 * achievements window (families with their progress, and the list of the
 * family under the cursor). `tr` is the i18n lookup.
 */
type Tr = (key: string) => string;

const fill = (text: string, values: Record<string, string>): string => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(v), text);

/** The placeholders of an achievement's texts. */
function values(def: AchievementDef, tr: Tr): Record<string, string> {
  const r = def.rule;
  switch (r.kind) {
    case 'clear':
      return { dungeon: tr(dungeonById(r.dungeon).lore.nameKey), difficulty: tr(`difficulty.${r.tier}`) };
    case 'flawless': {
      const guardian = guardianOf(dungeonById(r.dungeon));
      return { dungeon: tr(dungeonById(r.dungeon).lore.nameKey), guardian: guardian ? tr(`species.${guardian}`) : '' };
    }
    case 'depth':
      return { dungeon: tr(dungeonById(r.dungeon).lore.nameKey), floor: String(r.floor) };
    case 'species':
    case 'evolve':
      return { species: tr(`species.${r.species}`) };
    case 'awaken':
      return { species: tr(`species.${r.species}`), n: String(r.step), steps: String(awakeningsOf(r.species).length) };
    case 'shiny':
      return { species: tr(`species.${r.line}`) };
    case 'earned':
      return { n: String(r.coins) };
    default:
      return {};
  }
}

/** The i18n key stem of an achievement's texts: its rule kind. */
const stem = (def: AchievementDef): string => `achievement.${def.rule.kind}`;

export const achievementTitle = (def: AchievementDef, tr: Tr): string => fill(tr(`${stem(def)}.title`), values(def, tr));

export const achievementText = (def: AchievementDef, tr: Tr): string => fill(tr(`${stem(def)}.text`), values(def, tr));

/** A row of the window: the title (or "???" while a hidden one is locked), its text and its reward. */
export function achievementLine(def: AchievementDef, unlocked: string | undefined, tr: Tr): { title: string; text: string; done: boolean } {
  const done = unlocked !== undefined;
  if (def.hidden && !done) return { title: tr('achievement.hidden'), text: tr('achievement.hidden.text'), done };
  const reward = def.reward > 0 ? ` ${tr('achievement.reward').replace('{coins}', coinText(def.reward, tr))}` : '';
  return { title: achievementTitle(def, tr), text: achievementText(def, tr) + reward, done };
}

const TOAST_MS = 4500;
/** Toast lines shown at once; the rest are summed up in one more line. */
const TOAST_LINES = 3;

/** Puts one toast on screen; `closed` is called when it goes by itself; returns how to take it down early. */
export type ShowToast = (closed: () => void) => () => void;

export interface ToastGate {
  /** Shows the toast now, or queues it while held. */
  show(toast: ShowToast): void;
  /** A cinematic starts: toasts wait, and any on screen is taken down to come back after. */
  hold(): void;
  /** The cinematic is over: once no hold is left, the waiting toasts show in order. */
  release(): void;
}

/**
 * Keeps the toasts off the cinematics (pure; the DOM is in `ShowToast`):
 * the prologue and the cinematics after a run hold it, and the toasts come
 * out with the results.
 */
export function toastGate(): ToastGate {
  let holds = 0;
  const waiting: ShowToast[] = [];
  const shown = new Map<ShowToast, () => void>();
  const display = (toast: ShowToast) => {
    let gone = false;
    const close = toast(() => {
      gone = true;
      shown.delete(toast);
    });
    if (!gone) shown.set(toast, close);
  };
  return {
    show(toast) {
      if (holds > 0) waiting.push(toast);
      else display(toast);
    },
    hold() {
      holds += 1;
      if (holds > 1) return;
      const up = [...shown.entries()];
      shown.clear();
      for (const [toast, close] of up) {
        close();
        waiting.push(toast);
      }
    },
    release() {
      if (holds === 0) return;
      holds -= 1;
      if (holds === 0) for (const toast of waiting.splice(0)) display(toast);
    },
  };
}

const toasts = toastGate();

/** A cinematic is starting: achievement toasts wait (see `toastGate`). */
export const holdToasts = (): void => toasts.hold();

/** The cinematic is over: the waiting toasts show. */
export const releaseToasts = (): void => toasts.release();

/**
 * The unlock toast: a small window at the top of the page (over any screen,
 * like the install banner) naming the new achievements, gone after a few
 * seconds or a tap. Nothing when the list is empty. While a cinematic
 * holds the toasts it waits and shows after.
 */
export function achievementToast(defs: readonly AchievementDef[], tr: Tr = (key) => t(key), past = false): void {
  if (defs.length === 0 || typeof document === 'undefined') return;
  const shown = defs.slice(0, TOAST_LINES).map((d) => h('p', { textContent: `★ ${achievementTitle(d, tr)}` }));
  const more = defs.length > TOAST_LINES ? [h('p', { className: 'dim', textContent: tr('achievement.toast.more').replace('{n}', String(defs.length - TOAST_LINES)) })] : [];
  const coins = defs.reduce((sum, d) => sum + d.reward, 0);
  const paid = coins > 0 ? [h('p', { className: 'dim', textContent: tr('achievement.reward').replace('{coins}', coinText(coins, tr)) })] : [];
  // Unlocked for progress made before achievements existed: one summary line instead of a list.
  const lines = past ? [h('p', { textContent: pastAchievementsText(defs.length, tr) })] : [...shown, ...more];
  // Held during a cinematic (`toastGate`): it may be shown later, or again, each time for the full time.
  toasts.show((closed) => {
    const toast = h('div', { className: 'achievement-toast' }, [mdWindow({ title: tr(past ? 'achievement.past.title' : 'achievement.toast.title') }, [...lines, ...paid])]);
    let gone = false;
    const close = () => {
      if (gone) return;
      gone = true;
      toast.remove();
      closed();
    };
    toast.addEventListener('click', close);
    document.body.append(toast);
    setTimeout(close, TOAST_MS);
    return close;
  });
}

/** The retroactive toast's line: how many achievements earlier progress unlocked. */
export const pastAchievementsText = (n: number, tr: Tr): string => tr(n === 1 ? 'achievement.past.one' : 'achievement.past.many').replace('{n}', String(n));

/** The accent colour of each family (its icon's key hue): the rail bar, the tile frame accent and the panel title. */
export const FAMILY_COLORS: Record<AchievementFamily, string> = {
  clear: '#c9a45a',
  flawless: '#8fb3d9',
  depth: '#a98bf5',
  species: '#ff8a3d',
  evolve: '#7fe08a',
  gacha: '#e8d8b8',
  shiny: '#5fd0e8',
  coop: '#ff7a6b',
  coins: '#ffcf4a',
  secret: '#c9b0ff',
};

/** The accent of a clear's difficulty chip and the stripe of its tile (the CSS chips use the same hues). */
const TIER_COLORS: Record<Difficulty, string> = { easy: '#7fe08a', normal: '#8fd3ff', hard: '#ffbf5e', nightmare: '#ff8a7a' };

/** One achievement as its tile shows it. */
export interface AchievementTile {
  id: string;
  family: AchievementFamily;
  /** The title ("???" while a hidden one is locked); a clear names the dungeon only, its chip carries the difficulty. */
  name: string;
  text: string;
  done: boolean;
  hidden: boolean;
  /** The UTC day it was unlocked (YYYY-MM-DD). */
  date: string | null;
  /** "20 P", null when it pays nothing. */
  reward: string | null;
  /** Difficulty (a clear) or depth (the Sima) chip; `tier` colours the difficulty ones. */
  chip: { label: string; tier?: Difficulty } | null;
}

/** A tile's name: a clear names its dungeon and a flawless its guardian (the chip and the icon carry the rest), the rest their title. */
function tileName(def: AchievementDef, tr: Tr): string {
  const rule = def.rule;
  if (rule.kind === 'clear') return tr(dungeonById(rule.dungeon).lore.nameKey);
  if (rule.kind === 'flawless') {
    const guardian = guardianOf(dungeonById(rule.dungeon));
    if (guardian) return tr(`species.${guardian}`);
  }
  return achievementTitle(def, tr);
}

/** The tile of `def`: names, state and chips from the same texts as `achievementLine`. */
export function achievementTile(def: AchievementDef, unlocked: string | undefined, tr: Tr): AchievementTile {
  const done = unlocked !== undefined;
  const hidden = def.hidden === true && !done;
  const rule = def.rule;
  const chip: AchievementTile['chip'] = hidden
    ? null
    : rule.kind === 'clear'
      ? { label: tr(`difficulty.${rule.tier}`), tier: rule.tier }
      : rule.kind === 'depth'
        ? { label: tr('ach.chip.floor').replace('{floor}', String(rule.floor)) }
        : null;
  return {
    id: def.id,
    family: def.family,
    name: hidden ? tr('achievement.hidden') : tileName(def, tr),
    text: hidden ? tr('achievement.hidden.text') : achievementText(def, tr),
    done,
    hidden,
    date: unlocked ?? null,
    reward: def.reward > 0 ? coinText(def.reward, tr) : null,
    chip,
  };
}

/** Whole percent done, rounded down so 100 only ever means complete. */
export const overallPercent = (done: number, total: number): number => (total === 0 ? 0 : Math.floor((done * 100) / total));

export type GridDirection = 'up' | 'down' | 'left' | 'right';

/**
 * The tile a step lands on in a grid of `count` tiles in rows of `cols`
 * (null: a left from the first column, which leaves the grid for the rail).
 * A down from a row above a shorter last row lands on the last tile.
 */
export function stepGrid(index: number, count: number, cols: number, direction: GridDirection): number | null {
  const last = count - 1;
  switch (direction) {
    case 'left':
      return index % cols === 0 ? null : index - 1;
    case 'right':
      return Math.min(index + 1, last);
    case 'up':
      return index - cols >= 0 ? index - cols : index;
    case 'down':
      if (index + cols <= last) return index + cols;
      return Math.floor(index / cols) < Math.floor(last / cols) ? last : index;
  }
}

/** "26 oct 2026" in the player's language from a UTC day; the raw day when it does not parse. */
export function formatDay(day: string, language: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const DIRECTION_OF_KEY: Readonly<Record<string, GridDirection>> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };

/** A bar of `done` over `total`, as an element (decorative: the text next to it says the numbers). */
function bar(done: number, total: number, className = 'ach-bar'): HTMLElement {
  const fill = h('i');
  fill.style.width = `${total === 0 ? 0 : Math.round((done * 100) / total)}%`;
  return h('span', { className }, [fill]);
}

const icon = (key: string, className: string): SVGSVGElement => pixelSvgOf(ACH_NEWS_ICONS[key]!, className);

export interface AchievementsOptions {
  store: KeyValueStore;
  onBack(): void;
}

/**
 * The achievements window: an overall progress header, a rail of the families
 * (each with its colour icon, count and bar) and, for the family under the
 * cursor, a grid of tiles (icon, name, difficulty and reward chips, a dim
 * silhouette with a lock while locked, a gold frame and the date once won) with
 * the focused tile described below. Keys: up/down pick a family, right or Enter
 * enters the grid, the arrows move between tiles, left from the first column
 * returns to the rail, Esc closes. Rows and tiles are real buttons, so mouse
 * and touch work the same.
 */
export function achievementsWindow(options: AchievementsOptions): { element: HTMLElement; dispose(): void } {
  const tr: Tr = (key) => t(key);
  const unlocked = loadSave(options.store).achievements ?? {};
  const progress = familyProgress(unlocked);
  const done = progress.reduce((sum, p) => sum + p.done, 0);
  const total = ACHIEVEMENTS.length;
  const percent = overallPercent(done, total);
  const language = getLanguage();

  // Header: the overall progress.
  const meter = bar(done, total, 'ach-bar ach-bar-big');
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-label', tr('ach.overall'));
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', String(total));
  meter.setAttribute('aria-valuenow', String(done));
  const head = h('div', { className: 'ach-head' }, [
    icon('trophy', 'ach-head-icon'),
    h('div', { className: 'ach-head-text' }, [
      h('span', { className: 'ach-head-label', textContent: tr('ach.overall') }),
      h('span', { className: 'ach-head-count' }, [h('b', { textContent: `${done}/${total}` }), ` ${percent}%`]),
    ]),
    meter,
  ]);

  const panelTitle = h('div', { className: 'ach-panel-title' });
  const grid = h('div', { className: 'ach-grid', role: 'group' });
  grid.setAttribute('aria-label', tr('ach.tiles'));
  const detail = h('div', { className: 'ach-detail' });
  detail.setAttribute('role', 'status');
  detail.setAttribute('aria-live', 'polite');

  let tiles: AchievementTile[] = [];
  let buttons: HTMLButtonElement[] = [];
  let selected = 0;
  let zone: 'rail' | 'grid' = 'rail';

  const describeTile = (index: number): void => {
    const tile = tiles[index];
    if (!tile) return detail.replaceChildren(h('p', { className: 'dim', textContent: tr('achievement.pick') }));
    const state = tile.done ? tr('ach.done').replace('{date}', formatDay(tile.date ?? '', language)) : tr('ach.locked');
    const meta = h('p', { className: 'ach-detail-meta' }, [
      h('span', { className: tile.done ? 'ach-state is-done' : 'ach-state', textContent: state }),
      tile.chip ? h('span', { className: `ach-chip${tile.chip.tier ? ` tier-${tile.chip.tier}` : ''}`, textContent: tile.chip.label }) : null,
      tile.reward ? h('span', { className: 'ach-chip ach-reward', textContent: tile.reward }) : null,
    ]);
    const mark = tile.hidden ? 'secret' : ACHIEVEMENT_FAMILY_ICONS[tile.family];
    detail.style.setProperty('--fam', FAMILY_COLORS[tile.family]);
    detail.className = tile.done ? 'ach-detail is-done' : 'ach-detail';
    detail.replaceChildren(icon(mark, 'ach-detail-icon'), h('div', { className: 'ach-detail-text' }, [h('p', { className: 'ach-detail-name', textContent: tile.name }), h('p', { className: 'ach-detail-desc', textContent: tile.text }), meta]));
  };

  const select = (index: number): void => {
    if (index < 0 || index >= buttons.length) return;
    selected = index;
    buttons.forEach((button, i) => {
      button.tabIndex = i === index ? 0 : -1;
      button.classList.toggle('is-selected', i === index);
      if (i === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    describeTile(index);
  };

  const focusTile = (index: number): void => {
    select(index);
    const button = buttons[selected];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView?.({ block: 'nearest' });
  };

  const tileButton = (tile: AchievementTile, index: number): HTMLButtonElement => {
    const locked = !tile.done;
    const mark = tile.hidden ? 'secret' : ACHIEVEMENT_FAMILY_ICONS[tile.family];
    const art = h('span', { className: 'ach-tile-art' }, [icon(mark, 'ach-tile-icon')]);
    if (locked) art.append(pixelIconSvg('lock', 'ach-tile-lock'));
    const chips = h('span', { className: 'ach-tile-chips' }, [
      tile.chip ? h('span', { className: `ach-chip${tile.chip.tier ? ` tier-${tile.chip.tier}` : ''}`, textContent: tile.chip.label }) : null,
      tile.reward ? h('span', { className: 'ach-chip ach-reward', textContent: tile.reward }) : null,
    ]);
    const button = h('button', { type: 'button', className: `ach-tile ${tile.done ? 'is-done' : 'is-locked'}` }, [
      art,
      h('span', { className: 'ach-tile-name', textContent: tile.name }),
      chips,
      tile.done ? h('span', { className: 'ach-tile-date', textContent: formatDay(tile.date ?? '', language) }) : null,
    ]);
    button.style.setProperty('--fam', tile.chip?.tier ? TIER_COLORS[tile.chip.tier] : FAMILY_COLORS[tile.family]);
    button.setAttribute('aria-label', `${tile.name}. ${tile.text} ${tile.done ? tr('ach.done').replace('{date}', formatDay(tile.date ?? '', language)) : tr('ach.locked')}`);
    button.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') select(index);
    });
    button.addEventListener('click', () => select(index));
    return button;
  };

  const showFamily = (index: number): void => {
    const family = ACHIEVEMENT_FAMILIES[index];
    if (!family) return;
    const p = progress[index]!;
    tiles = ACHIEVEMENTS.filter((d) => d.family === family).map((d) => achievementTile(d, unlocked[d.id], tr));
    buttons = tiles.map(tileButton);
    grid.replaceChildren(...buttons);
    grid.scrollTop = 0;
    panelTitle.style.setProperty('--fam', FAMILY_COLORS[family]);
    panelTitle.replaceChildren(
      icon(ACHIEVEMENT_FAMILY_ICONS[family], 'ach-panel-icon'),
      h('span', { className: 'ach-panel-name', textContent: tr(`achievement.family.${family}`) }),
      h('span', { className: 'ach-panel-count', textContent: `${p.done}/${p.total}` }),
    );
    select(0);
  };

  const enterGrid = (): void => {
    if (buttons.length === 0) return;
    zone = 'grid';
    focusTile(selected);
  };

  const rail = ACHIEVEMENT_FAMILIES.map((family, i) => {
    const p = progress[i]!;
    const label = h('span', { className: p.done === p.total ? 'ach-cat is-complete' : 'ach-cat' }, [
      icon(ACHIEVEMENT_FAMILY_ICONS[family], 'ach-cat-icon'),
      h('span', { className: 'ach-cat-text' }, [h('span', { className: 'ach-cat-name', textContent: tr(`achievement.family.${family}`) }), bar(p.done, p.total, 'ach-bar ach-cat-bar')]),
    ]);
    label.style.setProperty('--fam', FAMILY_COLORS[family]);
    const count = h('span', { className: 'ach-cat-count', textContent: `${p.done}/${p.total}` });
    count.setAttribute('aria-label', tr('ach.count').replace('{done}', String(p.done)).replace('{total}', String(p.total)));
    return { label, value: count, tapToSelect: true, onConfirm: enterGrid };
  });
  const list = cursorList({ items: rail, onBack: options.onBack, onCursor: showFamily, label: tr('achievement.title'), className: 'ach-rail' });
  showFamily(list.index());

  // The grid takes the arrows while a tile has focus; the capture phase runs before the rail's own key handler.
  const columns = (): number => {
    const first = buttons[0];
    if (!first) return 1;
    return Math.max(1, buttons.filter((b) => b.offsetTop === first.offsetTop).length);
  };
  let attached = false;
  const onKey = (e: KeyboardEvent): void => {
    if (!element.isConnected) {
      if (attached) dispose();
      return;
    }
    attached = true;
    if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    const direction = DIRECTION_OF_KEY[e.code];
    if (zone === 'rail') {
      if (direction === 'right' && !e.repeat) {
        e.preventDefault();
        enterGrid();
      }
      return;
    }
    if (direction) {
      const next = stepGrid(selected, buttons.length, columns(), direction);
      if (next === null) {
        zone = 'rail';
        (document.activeElement as HTMLElement | null)?.blur();
      } else focusTile(next);
      e.preventDefault();
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      e.preventDefault();
      describeTile(selected);
    }
  };
  window.addEventListener('keydown', onKey, true);
  grid.addEventListener('focusin', () => {
    zone = 'grid';
  });
  grid.addEventListener('focusout', (e) => {
    if (!(e.relatedTarget instanceof Node) || !grid.contains(e.relatedTarget)) zone = 'rail';
  });

  const back = h('button', { type: 'button', className: 'ach-back', textContent: tr('ach.back') });
  back.addEventListener('click', () => options.onBack());
  const hint = h('p', { className: 'ach-hint', textContent: tr(document.documentElement.classList.contains('touch') ? 'ach.hint.touch' : 'ach.hint') });

  const element = mdWindow({ title: tr('achievement.title'), className: 'achievements ach-window' }, [
    head,
    h('div', { className: 'ach-body' }, [list.element, h('div', { className: 'ach-panel' }, [panelTitle, grid])]),
    detail,
    h('div', { className: 'ach-foot' }, [back, hint]),
  ]);

  function dispose(): void {
    window.removeEventListener('keydown', onKey, true);
    list.dispose();
  }
  return { element, dispose };
}
