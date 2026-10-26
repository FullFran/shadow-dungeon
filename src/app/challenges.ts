import { challengeMisfits, challengeOpen } from '../core/challenge';
import { currentForm, type Collection } from '../core/collection';
import { CHALLENGES, type DungeonDef, type DungeonId } from '../data/dungeons';
import type { SpeciesId } from '../data/species';
import type { SheetStore } from '../adapters/assets';
import { t } from '../i18n';
import { chaptersCleared, type StoryProgress } from '../core/story';
import { storyKeys, storyOf } from '../data/story-quests';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { description, describedMenu } from '../ui/describe';
import { h, mdWindow } from '../ui/window';
import { portrait } from './loadout';

/**
 * The challenges menu (odd/tasks/roster-parity.md): every line's trial in
 * one list, reached from the dungeon select, the town exit and Phantump's
 * window (one module, three entry points). Each row says whether the player
 * has the line and whether the species picked now may enter (only a form of
 * the line may: core/challenge.ts); the side shows the line's portrait, the
 * trial's intro and which difficulty drops which Essence.
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

/** The row's state line: the line is missing, the species must change, or ready. */
export function rowHint(row: ChallengeRow): string {
  if (!row.open) return t('challenges.locked');
  return row.fits ? t('challenges.ready') : t('challenges.playWith').replace('{species}', t(`species.${row.form}`));
}

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

// It reuses the tutor's window styles (a long list that scrolls inside the window on a phone).
export function challengesWindow(options: ChallengesOptions): { element: HTMLElement; dispose(): void } {
  const rows = challengeRows(options.collection, options.species);
  const frame = h('div', { className: 'portrait-frame' });
  const intro = h('p', { className: 'dim' });
  const state = h('p');
  const drops = h('p', { className: 'dim', textContent: t('select.drops') });
  const senda = h('p', { className: 'dim' });
  const describe = (index: number) => {
    const row = rows[index];
    if (!row) return;
    frame.replaceChildren(...(options.sheets ? [portrait(options.sheets, row.form, 1.5)] : []));
    intro.textContent = t(row.dungeon.lore.loreKeys[0] ?? '');
    state.textContent = rowHint(row);
    senda.textContent = storyHint(row.dungeon.challenge!.line, options.collection.story) ?? '';
  };
  // Greyed rows stay reachable (the cursor shows why they are shut); confirming one does nothing.
  const items: ListItem[] = [
    ...rows.map((row) => ({
      label: t(row.dungeon.lore.nameKey),
      value: row.open ? t(`species.${row.form}`) : '-',
      className: rowEnabled(row, options.requireFit) ? 'shop-row' : 'shop-row is-disabled',
      tapToSelect: true,
      onConfirm: () => {
        if (rowEnabled(row, options.requireFit)) options.onChoose(row.dungeon.id);
      },
    })),
    { label: t('menu.back'), onConfirm: options.onBack },
  ];
  const list = cursorList({ items, onBack: options.onBack, onCursor: describe, label: t('challenges.title'), className: 'shop-list' });
  const desc = description(list, { describe, children: [h('div', { className: 'shop-effect' }, [frame, state, intro, senda, drops])] });
  desc.update();
  const element = mdWindow({ title: t('challenges.title'), className: 'shop gacha tutor challenges' }, [h('p', { textContent: t('challenges.text') }), describedMenu(list.element, desc.element)]);
  return { element, dispose: () => list.dispose() };
}
