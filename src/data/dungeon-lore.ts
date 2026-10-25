/**
 * Lore of each dungeon as data (i18n keys): its name, a subtitle for the
 * title card and a few lines of legend. Not shown anywhere yet; the plan is
 * an intro card on entering the dungeon. Provisional, see docs/gdd.md §3.
 */
export interface DungeonLore {
  id: string;
  nameKey: string;
  subtitleKey: string;
  loreKeys: readonly string[];
  /** A short line per floor for the floor card (Touhou style); index 0 is floor 1 (shown under the entry title). */
  floorKeys?: readonly string[];
}

export const DUNGEON_LORE: readonly DungeonLore[] = [
  {
    id: 'crypt-of-the-sword-king',
    nameKey: 'dungeon.crypt.name',
    subtitleKey: 'dungeon.crypt.subtitle',
    loreKeys: ['dungeon.crypt.lore.1', 'dungeon.crypt.lore.2'],
    floorKeys: [1, 2, 3, 4, 5, 6].map((floor) => `dungeon.crypt.floor.${floor}`),
  },
  {
    id: 'misty-forest',
    nameKey: 'dungeon.forest.name',
    subtitleKey: 'dungeon.forest.subtitle',
    loreKeys: ['dungeon.forest.lore.1', 'dungeon.forest.lore.2'],
  },
];
