import { challengeMisfits, challengeOpen } from '../core/challenge';
import { currentForm, type Collection } from '../core/collection';
import { CHALLENGES, type DungeonDef, type DungeonId } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import { SPECIES, type SpeciesId } from '../data/species';
import type { SheetStore } from '../adapters/assets';
import { isTouchUi } from '../adapters/touch-mode';
import { t } from '../i18n';
import { chaptersCleared, sendaTierOpen, type StoryProgress } from '../core/story';
import { storyKeys, storyOf } from '../data/story-quests';
import { EVOLVE_SHOP_ICONS } from '../ui/icons/evolve-shop-icons';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import { TYPE_COLORS } from '../ui/tokens';
import { h, mdWindow } from '../ui/window';
import { portrait } from './loadout';
import { gridNav } from './window-nav';
import '../styles/evolve-shop.css';
import '../styles/challenges.css';

/**
 * The challenges menu (odd/tasks/roster-parity.md): every line's trial in
 * one place, reached from the dungeon select, the town exit and Phantump's
 * window (one module, three entry points). Only a form of the line may enter
 * (core/challenge.ts).
 *
 * In the Pokémon picker's mould (owner, 2026-11-03: "esto queda demasiado
 * saturado"): a card per Senda (animated sprite, chapter gems, a padlock when
 * it cannot be entered) beside a sheet for the card in focus (sprite on a
 * rune circle, title, a two-line hook, the three chapters with the Essence
 * each pays, one primary action that says why when it cannot be used). The
 * secondary rules sit in one small info line.
 */
export interface ChallengeRow {
  dungeon: DungeonDef;
  /** The form of the line the player has (its first form when none). */
  form: SpeciesId;
  /** The player has the line (a starter's always). */
  open: boolean;
  /** The species picked now is a form of the line. */
  fits: boolean;
}

/** Every challenge in list order, for a player with `collection` who picked `species`. */
export function challengeRows(collection: Pick<Collection, 'owned'>, species: SpeciesId): ChallengeRow[] {
  return CHALLENGES.map((dungeon) => ({
    dungeon,
    form: currentForm(collection, dungeon.challenge!.line),
    open: challengeOpen(dungeon, collection.owned ?? []),
    fits: challengeMisfits(dungeon, [species]).length === 0,
  }));
}

/** Whether a row can be chosen: the line is the player's, and (when the species is already picked) it fits. */
export const rowEnabled = (row: ChallengeRow, requireFit: boolean): boolean => row.open && (!requireFit || row.fits);

/** A line's Senda on the challenges menu: its name and the chapters closed, or null without one. */
export function storyHint(line: NonNullable<DungeonDef['challenge']>['line'], story: StoryProgress | undefined): string | null {
  if (!storyOf(line)) return null;
  return t('story.progress').replace('{senda}', t(storyKeys.title(line))).replace('{n}', String(chaptersCleared(story, line)));
}

/** Which tier this Senda opens next and how: nothing once they are all open. */
export function nextTierHint(dungeon: DungeonDef, story: StoryProgress | undefined): string | null {
  const shut = (['hard', 'nightmare'] as const).find((d) => !sendaTierOpen(dungeon, d, story));
  if (!shut) return null;
  return t('story.tierLocked').replace('{tier}', t(`difficulty.${shut}`)).replace('{chapter}', shut === 'hard' ? 'I' : 'II');
}

/** The row's state line: the line is missing, the species must change, or ready. */
export function rowHint(row: ChallengeRow): string {
  if (!row.open) return t('challenges.locked');
  return row.fits ? t('challenges.ready') : t('challenges.playWith').replace('{species}', t(`species.${row.form}`));
}

/** What a Senda's card shows: the chapters closed (0 to 3), whether it can be entered, and why not. */
export interface ChallengeCard {
  closed: number;
  enabled: boolean;
  reason: string | null;
}

export function challengeCard(row: ChallengeRow, requireFit: boolean, story: StoryProgress | undefined): ChallengeCard {
  const closed = Math.min(3, chaptersCleared(story, row.dungeon.challenge!.line));
  if (!row.open) return { closed, enabled: false, reason: t('challenges.locked') };
  if (requireFit && !row.fits) return { closed, enabled: false, reason: t('challenges.fitOnly').replace('{species}', t(`species.${row.form}`)) };
  return { closed, enabled: true, reason: null };
}

export interface ChapterState {
  chapter: 1 | 2 | 3;
  difficulty: Difficulty;
  /** Closed: cleared. Open: the next one to play. Shut: needs the one before. */
  state: 'closed' | 'open' | 'shut';
}

/** The three chapters of a Senda (I Normal, II Difícil, III Pesadilla) given how many are closed. */
export function chapterStates(closed: number | undefined): ChapterState[] {
  const done = closed ?? 0;
  return ([[1, 'normal'], [2, 'hard'], [3, 'nightmare']] as const).map(([chapter, difficulty]) => ({ chapter, difficulty, state: chapter <= done ? 'closed' : chapter === done + 1 ? 'open' : 'shut' }));
}

const HOOK_MAX = 120;

/** The Senda's hook for the sheet: whole sentences of its lore up to 120 characters (two lines), or cut at a word with an ellipsis. */
export function hookText(dungeon: DungeonDef): string {
  const lore = t(dungeon.lore.loreKeys[0] ?? '').trim();
  if (lore.length <= HOOK_MAX) return lore;
  const sentences = lore.match(/[^.!?]+[.!?]+\s*/g) ?? [lore];
  let out = '';
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > HOOK_MAX) break;
    out += sentence;
  }
  if (out.trim().length >= 20) return out.trim();
  const cut = lore.slice(0, HOOK_MAX - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).replace(/[\s,;:.]+$/, '')}…`;
}

const ROMAN = ['', 'I', 'II', 'III'] as const;

export interface ChallengesOptions {
  collection: Pick<Collection, 'owned'> & { story?: StoryProgress };
  /** The species picked now. */
  species: SpeciesId;
  /** True after the loadout (the species is final): a challenge it cannot play is greyed out. Otherwise the run's loadout switches to the line. */
  requireFit: boolean;
  /** The line portraits (none without). */
  sheets?: Promise<SheetStore>;
  onChoose(dungeon: DungeonId): void;
  onBack(): void;
}

/** Chapter gems: filled for the chapters closed. */
function gems(closed: number): HTMLElement {
  const el = h('span', { className: 'es-gems ch-gems' }, [1, 2, 3].map((n) => h('i', { className: n <= closed ? 'is-on' : '' })));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', t('challenges.chapters').replace('{n}', String(closed)));
  return el;
}

export function challengesWindow(options: ChallengesOptions): { element: HTMLElement; dispose(): void } {
  const rows = challengeRows(options.collection, options.species);
  const sheets = options.sheets;
  const art = (row: ChallengeRow, scale: number): HTMLElement[] => (sheets ? [portrait(sheets, row.form, scale)] : []);
  const cardOf = (row: ChallengeRow) => challengeCard(row, options.requireFit, options.collection.story);
  let focused = rows[0]!;

  const stage = h('div', { className: 'es-stage ch-stage' });
  const title = h('h2', { className: 'ch-title' });
  const hook = h('p', { className: 'ch-hook' });
  const chapters = h('div', { className: 'ch-chapters' });
  const info = h('p', { className: 'ch-info' });
  const primary = h('button', { className: 'es-primary', type: 'button' });
  const grid = h('div', { className: 'es-grid ch-grid' });
  grid.setAttribute('aria-label', t('challenges.title'));

  const cards = rows.map((row) => {
    const state = cardOf(row);
    const card = h('button', { className: `es-card ch-card${state.enabled ? '' : ' is-locked'}${state.closed >= 3 ? ' is-done' : ''}`, type: 'button' }, [
      h('span', { className: `es-card-art${row.open ? '' : ' is-dim'}` }, art(row, 2)),
      h('span', { className: 'es-card-name', textContent: t(`species.${row.form}`) }),
      h('span', { className: 'ch-card-senda', textContent: t(row.dungeon.lore.nameKey) }),
      gems(state.closed),
      ...(state.enabled ? [] : [h('span', { className: 'ch-lock' }, [pixelIconSvg('lock', 'px-icon')])]),
    ]);
    card.dataset.dungeon = row.dungeon.id;
    card.setAttribute('aria-label', `${t(row.dungeon.lore.nameKey)}, ${t(`species.${row.form}`)}, ${t('challenges.chapters').replace('{n}', String(state.closed))}${state.reason ? `, ${state.reason}` : ''}`);
    card.addEventListener('mouseenter', () => {
      if (!isTouchUi()) show(row);
    });
    card.addEventListener('focus', () => show(row));
    card.addEventListener('click', () => {
      // Touch: the first tap shows the sheet, the second goes in. A shut Senda only shows its sheet.
      if ((isTouchUi() && focused !== row) || !state.enabled) show(row);
      else options.onChoose(row.dungeon.id);
    });
    return card;
  });
  grid.replaceChildren(...cards);

  function show(row: ChallengeRow): void {
    focused = row;
    const state = cardOf(row);
    const line = row.dungeon.challenge!.line;
    stage.style.setProperty('--sp-glow', TYPE_COLORS[SPECIES[row.form].types[0]!].core);
    for (const card of cards) card.classList.toggle('is-focused', card.dataset.dungeon === row.dungeon.id);
    stage.replaceChildren(h('div', { className: 'es-stage-glow' }), h('div', { className: `ch-stage-sprite${row.open ? '' : ' is-dim'}` }, art(row, 4)), h('div', { className: 'es-stage-sign ch-sign' }));
    title.textContent = t(row.dungeon.lore.nameKey);
    hook.textContent = hookText(row.dungeon);
    const pays = row.dungeon.challenge!.materials;
    chapters.replaceChildren(
      ...chapterStates(state.closed).map((c) => {
        const tier = t(`difficulty.${c.difficulty}`);
        const word = t(`challenges.chapter.${c.state}`);
        const el = h('div', { className: `ch-chapter is-${c.state}` }, [
          h('span', { className: 'ch-roman', textContent: ROMAN[c.chapter] }),
          h('span', { className: 'ch-diff', textContent: tier }),
          h('span', { className: 'ch-pay' }, [pixelSvgOf(EVOLVE_SHOP_ICONS[`essence-${c.difficulty}`]!, 'px-icon'), h('span', { textContent: `×${pays}` })]),
          h('span', { className: 'ch-state' }, [h('i', { className: 'ch-mark' }), h('span', { textContent: word })]),
        ]);
        el.setAttribute('role', 'text');
        el.setAttribute('aria-label', `${ROMAN[c.chapter]} ${tier}: ${word}, ${t('evolve.essence').replace('{tier}', tier)} ×${pays}`);
        if (c.state === 'shut') el.title = t('story.tierLocked').replace('{tier}', tier).replace('{chapter}', ROMAN[c.chapter - 1] ?? '');
        return el;
      }),
    );
    info.textContent = [storyOf(line) ? t('challenges.info') : '', state.enabled && !row.fits ? t('challenges.playWith').replace('{species}', t(`species.${row.form}`)) : ''].filter(Boolean).join(' ');
    primary.classList.toggle('is-blocked', !state.enabled);
    primary.setAttribute('aria-disabled', String(!state.enabled));
    primary.replaceChildren(...(state.enabled ? [pixelIconSvg('play', 'px-icon'), h('span', { textContent: t('challenges.enter') })] : [h('span', { textContent: state.reason ?? '' })]));
  }

  primary.addEventListener('click', () => {
    if (cardOf(focused).enabled) options.onChoose(focused.dungeon.id);
  });
  const back = h('button', { className: 'es-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());

  const sheet = h('section', { className: 'es-sheet ch-sheet' }, [stage, title, hook, chapters, info, primary]);
  const element = mdWindow({ title: t('challenges.title'), className: 'es-window ch-window' }, [
    h('p', { className: 'dim es-context', textContent: t('challenges.text') }),
    h('div', { className: 'es-body' }, [sheet, grid]),
    h('div', { className: 'es-foot' }, [back, h('p', { className: 'es-hint', textContent: t(isTouchUi() ? 'shop.hint.touch' : 'hub.hint') })]),
  ]);

  const stopKeys = gridNav({ win: element, controls: () => [...cards, primary, back], fallback: () => cards.find((c) => c.dataset.dungeon === focused.dungeon.id) ?? cards[0], onBack: options.onBack });
  show(focused);
  queueMicrotask(() => cards[0]?.focus({ preventScroll: true }));
  return { element, dispose: stopKeys };
}
