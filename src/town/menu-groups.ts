import type { MenuGeometry } from './sheet-model';
import { TOWN_SERVICES, type TownService } from './town-menu';

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

/**
 * The options column, the same on every map (owner, 2026-11-04: "el menú solo debe cambiar el mapa, lo demás debe ser igual
 * siempre"): every available service in menu order, pins or not, but those another kept window hosts (HOSTED_BY).
 */
export function townMenuOptions(available: ReadonlySet<TownService>): TownService[] {
  return menuOptionServices(TOWN_SERVICES.filter((s) => available.has(s)), available);
}

/** Icon grid tile side for a column count (CSS px): 72, 64, then 58 for five columns (still >= 44). */
export const gridTile = (cols: number): number => (cols <= 3 ? 72 : cols === 4 ? 64 : 58);

export type OptionsMode = 'list' | 'cols' | 'grid';

/** Row, header and gap sizes of the options column, CSS px (src/styles/town-map.css reads the same numbers). */
export const OPTION_ROW = 56;
/** The row height when two columns of 56 px rows still do not fit (a 1280x720 window with every option): 48 px, still >= 44. */
export const OPTION_ROW_DENSE = 48;
export const OPTION_ROW_GAP = 2;
/** A group's header line, on every group (a lone option reads as part of the group above without it). */
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
  /** Rows of OPTION_ROW_DENSE instead of OPTION_ROW (two columns only). */
  dense: boolean;
  /** Height the options need and the height there is (CSS px): needed <= available means no scroll. */
  needed: number;
  available: number;
}

export const groupHeight = (n: number, row: number = OPTION_ROW): number => GROUP_HEADER + n * row + Math.max(0, n - 1) * OPTION_ROW_GAP;
const stack = (sizes: readonly number[], row: number = OPTION_ROW): number => sizes.reduce((sum, n) => sum + groupHeight(n, row), 0) + Math.max(0, sizes.length - 1) * GROUP_GAP;

/**
 * How the options are laid out for a window: a single list when it fits (rows >= 56 px), two columns of groups when it does not,
 * and an icon grid (labels under 32 px icons) on a short landscape window. `needed <= available` is the no-scroll guarantee.
 */
export function optionsLayout(sizes: readonly number[], geo: MenuGeometry): OptionsLayout {
  const available = geo.optionsBox.h;
  const all = sizes.map((_, i) => i);
  if (geo.compact) {
    const items = sizes.reduce((a, b) => a + b, 0) + 1;
    const need = (cols: number): number => Math.ceil(items / cols) * gridTile(cols) + (Math.ceil(items / cols) - 1) * GRID_GAP;
    const gridCols = [3, 4, 5].find((cols) => need(cols) <= available) ?? 5;
    return { mode: 'grid', columns: [all], gridCols, dense: false, needed: need(gridCols), available };
  }
  const list = PRIMARY_BLOCK + stack(sizes);
  if (list <= available) return { mode: 'list', columns: [all], gridCols: 0, dense: false, needed: list, available };
  if (sizes.length < 2) return { mode: 'list', columns: [all], gridCols: 0, dense: false, needed: list, available };
  // Two columns: the most balanced split of the groups (each column keeps menu order), so the options never need a scroll.
  const split = (row: number) => {
    let best = { left: all.slice(0, Math.ceil(sizes.length / 2)), height: Infinity };
    for (let mask = 1; mask < (1 << sizes.length) - 1; mask++) {
      const left = all.filter((i) => mask & (1 << i));
      const right = all.filter((i) => !(mask & (1 << i)));
      if (!left.includes(0)) continue;
      const height = Math.max(stack(left.map((i) => sizes[i]!), row), stack(right.map((i) => sizes[i]!), row));
      if (height < best.height) best = { left, height };
    }
    return best;
  };
  const roomy = split(OPTION_ROW);
  const dense = PRIMARY_BLOCK + roomy.height > available;
  const best = dense ? split(OPTION_ROW_DENSE) : roomy;
  const right = all.filter((i) => !best.left.includes(i));
  return { mode: 'cols', columns: [best.left, right], gridCols: 0, dense, needed: PRIMARY_BLOCK + best.height, available };
}
