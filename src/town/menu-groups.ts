import type { MenuGeometry } from './sheet-model';
import type { TownService } from './town-menu';

/**
 * The options beside the town map, grouped by purpose (owner, 2026-11-04: "todas las opciones del menú mejor presentadas,
 * estructuradas y posicionadas"; laws of UX: Common Region, Hick <= 4 groups). "Seguir" is not in a group: it is the one ember
 * call to action above them. Every town service belongs to exactly one group, so a map with few places on it (the road maps) still
 * lists the services it cannot show as pins; tests/town/menu-groups.test.ts walks all of them.
 */
export type MenuGlyph = TownService | 'title' | 'resume' | 'room';
export type MenuGroupId = 'team' | 'progress' | 'social' | 'system';

export interface MenuGroup {
  id: MenuGroupId;
  titleKey: string;
  services: readonly TownService[];
}

export const MENU_GROUPS: readonly MenuGroup[] = [
  { id: 'team', titleKey: 'townMenu.group.team', services: ['pokemon', 'evolve', 'tutor', 'shop', 'gacha'] },
  { id: 'progress', titleKey: 'townMenu.group.progress', services: ['dungeons', 'challenges', 'travel', 'shrine', 'board', 'achievements', 'gallery'] },
  { id: 'social', titleKey: 'townMenu.group.social', services: ['online', 'friends', 'account'] },
  { id: 'system', titleKey: 'townMenu.group.system', services: ['settings', 'controls'] },
];

/** The group of an option's glyph: the leaving rows (title, room) belong to the system group; "Seguir" to none. */
export function groupOfGlyph(glyph: MenuGlyph): MenuGroupId | null {
  if (glyph === 'resume') return null;
  if (glyph === 'title' || glyph === 'room') return 'system';
  return MENU_GROUPS.find((g) => g.services.includes(glyph))?.id ?? null;
}

/** The options split into their groups, in group order (menu order inside each), empty groups left out; "Seguir" is not grouped. */
export function groupOptions<T extends { glyph: MenuGlyph }>(options: readonly T[]): { id: MenuGroupId; titleKey: string; options: T[] }[] {
  const rank = (glyph: MenuGlyph): number => {
    const group = MENU_GROUPS.find((g) => g.id === groupOfGlyph(glyph));
    const inGroup = group?.services.indexOf(glyph as TownService) ?? -1;
    // Leaving rows come after the system group's services, in the order given.
    return inGroup >= 0 ? inGroup : 100;
  };
  return MENU_GROUPS.map((g) => ({
    id: g.id,
    titleKey: g.titleKey,
    options: options.filter((o) => groupOfGlyph(o.glyph) === g.id).sort((a, b) => rank(a.glyph) - rank(b.glyph)),
  })).filter((g) => g.options.length > 0);
}

export const HOSTED_BY: Partial<Record<TownService, TownService>> = { achievements: 'board' };

/** The loose services listed as options: those a kept service's window does not already host. */
export function menuOptionServices(loose: readonly TownService[], available: ReadonlySet<TownService>): TownService[] {
  return loose.filter((s) => {
    const host = HOSTED_BY[s];
    return host === undefined || !available.has(host);
  });
}

export type OptionsMode = 'list' | 'cols' | 'grid';

/** Row, header and gap sizes of the options column, CSS px (src/styles/town-map.css reads the same numbers). */
export const OPTION_ROW = 56;
export const OPTION_ROW_GAP = 2;
/** A group's header line; a group with a single option has none (it needs no label to be a region). */
export const GROUP_HEADER = 20;
export const GROUP_GAP = 6;
/** "Seguir" (56 px) and the gap under it. */
export const PRIMARY_BLOCK = 60;
export const ICON_SIZE = 36;
const GRID_GAP = 6;

export interface OptionsLayout {
  mode: OptionsMode;
  /** Group indexes per column (one column in list and grid mode). */
  columns: number[][];
  /** Columns of the icon grid (grid mode). */
  gridCols: number;
  /** Height the options need and the height there is (CSS px): needed <= available means no scroll. */
  needed: number;
  available: number;
}

const groupHeight = (n: number): number => (n > 1 ? GROUP_HEADER : 0) + n * OPTION_ROW + Math.max(0, n - 1) * OPTION_ROW_GAP;
const stack = (sizes: readonly number[]): number => sizes.reduce((sum, n) => sum + groupHeight(n), 0) + Math.max(0, sizes.length - 1) * GROUP_GAP;

/**
 * How the options are laid out for a window: a single list when it fits (rows >= 56 px), two columns of groups when it does not,
 * and an icon grid (labels under 32 px icons) on a short landscape window. `needed <= available` is the no-scroll guarantee.
 */
export function optionsLayout(sizes: readonly number[], geo: MenuGeometry): OptionsLayout {
  const available = geo.optionsBox.h;
  const all = sizes.map((_, i) => i);
  if (geo.compact) {
    const items = sizes.reduce((a, b) => a + b, 0) + 1;
    const tile = (cols: number): number => (cols === 3 ? 72 : 64);
    const need = (cols: number): number => Math.ceil(items / cols) * tile(cols) + (Math.ceil(items / cols) - 1) * GRID_GAP;
    const gridCols = need(3) <= available ? 3 : 4;
    return { mode: 'grid', columns: [all], gridCols, needed: need(gridCols), available };
  }
  const list = PRIMARY_BLOCK + stack(sizes);
  if (list <= available) return { mode: 'list', columns: [all], gridCols: 0, needed: list, available };
  // Two columns: the first k groups on the left, the rest on the right, whichever split is shortest.
  let best = { k: Math.max(1, Math.ceil(sizes.length / 2)), height: Infinity };
  for (let k = 1; k < sizes.length; k++) {
    const height = Math.max(stack(sizes.slice(0, k)), stack(sizes.slice(k)));
    if (height < best.height) best = { k, height };
  }
  if (sizes.length < 2) return { mode: 'list', columns: [all], gridCols: 0, needed: list, available };
  return { mode: 'cols', columns: [all.slice(0, best.k), all.slice(best.k)], gridCols: 0, needed: PRIMARY_BLOCK + best.height, available };
}
