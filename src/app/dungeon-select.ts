import { dungeonChoices } from '../core/dungeon-select';
import { dungeonById, type DungeonDef, type DungeonId } from '../data/dungeons';
import type { Records } from '../town/records';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';

/**
 * The dungeon select (after the loadout, when more than one dungeon is
 * open): every dungeon in order, the locked ones greyed out with what opens
 * them, and a side window with the highlighted dungeon's subtitle and best
 * floor on this device. Below them, one "Desafíos" row opens the challenges
 * menu (app/challenges.ts; odd/tasks/roster-parity.md).
 */
export interface DungeonSelectOptions {
  records: Records;
  cleared: ReadonlySet<string>;
  /** Opens the challenges menu (a "Desafíos" row; absent: no row). */
  onChallenges?(): void;
  onChoose(dungeon: DungeonId): void;
  onBack(): void;
}

/** "Mejor planta: 4", or "-" before the first run there. */
export const bestFloorText = (records: Records, dungeon: DungeonDef): string =>
  t('select.best').replace('{floor}', String(records.dungeons[dungeon.id]?.bestFloor ?? '-'));

/** What opens a locked dungeon: "Vence al guardián de <dungeon>". */
export const lockedHint = (dungeon: DungeonDef): string =>
  dungeon.unlockedBy ? t('select.locked').replace('{dungeon}', t(dungeonById(dungeon.unlockedBy).lore.nameKey)) : '';

export function dungeonSelectScreen(options: DungeonSelectOptions): HTMLElement[] {
  // The challenges row takes a list slot too: index the choices like the list (null on it).
  const choices = [...dungeonChoices(options.cleared), ...(options.onChallenges ? [null] : [])];
  const subtitle = h('p', { className: 'dim' });
  const best = h('p');
  const legend = h('p', { className: 'dim' });
  const describe = (index: number) => {
    const choice = choices[index];
    if (choice === null) {
      subtitle.textContent = t('challenges.text');
      best.textContent = t('select.drops');
      legend.textContent = '';
      return;
    }
    if (!choice) return;
    subtitle.textContent = choice.unlocked ? t(choice.dungeon.lore.subtitleKey) : lockedHint(choice.dungeon);
    best.textContent = choice.unlocked ? bestFloorText(options.records, choice.dungeon) : '';
    // The first line of its legend, once it is open.
    legend.textContent = choice.unlocked ? t(choice.dungeon.lore.loreKeys[0] ?? '') : '';
  };
  const items: ListItem[] = choices.map((choice) =>
    choice === null
      ? { label: t('challenges.title'), onConfirm: () => options.onChallenges?.() }
      : {
          label: choice.unlocked ? t(choice.dungeon.lore.nameKey) : '???',
          disabled: !choice.unlocked,
          onConfirm: () => options.onChoose(choice.dungeon.id),
        },
  );
  const list = cursorList({ items, onBack: options.onBack, onCursor: describe, label: t('select.title') });
  describe(list.index());
  return [
    h('h1', { className: 'screen-title', textContent: t('select.title') }),
    h('div', { className: 'screen-row' }, [
      mdWindow({ title: t('select.title'), className: 'dungeons' }, [list.element]),
      mdWindow({ title: t('select.about'), className: 'dungeon-about' }, [subtitle, legend, best]),
    ]),
  ];
}
