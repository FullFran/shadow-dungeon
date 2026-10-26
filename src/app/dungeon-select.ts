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
 * floor on this device. Below them, under "Retos", the challenge dungeons
 * of the lines the player owns (odd/tasks/gacha-evolutions.md T4).
 */
export interface DungeonSelectOptions {
  records: Records;
  cleared: ReadonlySet<string>;
  /** The open challenge dungeons (core/challenge.ts `openChallenges`); none by default. */
  challenges?: readonly DungeonDef[];
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
  // Header rows take a list slot too: index the choices like the list (null on the header).
  const challenges = options.challenges ?? [];
  const choices = [...dungeonChoices(options.cleared), ...(challenges.length > 0 ? [null] : []), ...challenges.map((dungeon) => ({ dungeon, unlocked: true }))];
  const subtitle = h('p', { className: 'dim' });
  const best = h('p');
  const legend = h('p', { className: 'dim' });
  const describe = (index: number) => {
    const choice = choices[index];
    if (!choice) return;
    subtitle.textContent = choice.unlocked ? t(choice.dungeon.lore.subtitleKey) : lockedHint(choice.dungeon);
    // A challenge says which difficulty drops which Essence instead of its best floor.
    best.textContent = !choice.unlocked ? '' : choice.dungeon.challenge ? t('select.drops') : bestFloorText(options.records, choice.dungeon);
    // The first line of its legend, once it is open.
    legend.textContent = choice.unlocked ? t(choice.dungeon.lore.loreKeys[0] ?? '') : '';
  };
  const items: ListItem[] = choices.map((choice) =>
    choice === null
      ? { header: true, label: t('select.challenges') }
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
