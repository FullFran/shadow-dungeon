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
  /** The one-line summary under the title at rest ("Pokémon, Tutor, Tienda…"): the same on every map. */
  summaryKey: string;
  services: readonly TownService[];
}

export const MENU_GROUPS: readonly MenuGroup[] = [
  { id: 'team', titleKey: 'townMenu.group.team', summaryKey: 'townMenu.group.team.summary', services: ['pokemon', 'evolve', 'tutor', 'shop', 'gacha', 'items'] },
  { id: 'progress', titleKey: 'townMenu.group.progress', summaryKey: 'townMenu.group.progress.summary', services: ['dungeons', 'challenges', 'travel', 'shrine', 'board', 'achievements', 'gallery'] },
  { id: 'social', titleKey: 'townMenu.group.social', summaryKey: 'townMenu.group.social.summary', services: ['online', 'friends', 'account'] },
  { id: 'system', titleKey: 'townMenu.group.system', summaryKey: 'townMenu.group.system.summary', services: ['settings', 'controls'] },
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

export interface RestRow {
  kind: 'primary' | 'group';
  id: string;
  /** Options behind a group row (0 for Seguir). */
  count: number;
}

/**
 * What the column shows at rest (owner, 2026-11-04: "menos opciones de primeras"): Seguir and one row per group, nothing else.
 * Hick: five choices. The options appear on intent (src/town/menu-disclosure.ts).
 */
export function restColumn(options: readonly { glyph: MenuGlyph }[]): RestRow[] {
  return [{ kind: 'primary', id: 'resume', count: 0 }, ...groupOptions(options).map((g): RestRow => ({ kind: 'group', id: g.id, count: g.options.length }))];
}

/** Row, gap and padding sizes of the options column, CSS px (src/styles/town-map.css reads the same numbers). */
export const PRIMARY_BLOCK = 60;
export const ICON_SIZE = 36;
export const ROW_GAP = 2;
/** The open group's options sit in a tray with this much padding under them. */
export const TRAY_PAD = 4;
/** Seguir and the tile row in the compact variant. */
const COMPACT_PRIMARY = 48;
const COMPACT_GAP = 6;
const COMPACT_TILE_ROW = 56;
/** [group row, option row] pairs, roomiest first: group rows are never below 56 (Fitts), option rows never below 44. */
const ROW_STEPS: readonly (readonly [number, number])[] = [[72, 56], [64, 56], [56, 56], [56, 48], [56, 44]];

export interface DisclosureLayout {
  /** accordion: options expand in place under their row; tiles: four group tiles in a row and the open group's icon grid below. */
  mode: 'accordion' | 'tiles';
  groupRow: number;
  optionRow: number;
  /** Columns of the icon grid (tiles mode). */
  gridCols: number;
  /** Height the column needs with the biggest group open, and the height there is (CSS px): needed <= available means no scroll. */
  needed: number;
  available: number;
}

/**
 * How the column is laid out for a window. The tallest case is the biggest group open, so that is what must fit: the roomiest
 * step of ROW_STEPS that does, so the column is airy on a big window and never scrolls on a small one.
 */
export function disclosureLayout(sizes: readonly number[], geo: MenuGeometry): DisclosureLayout {
  const available = geo.optionsBox.h;
  const most = Math.max(0, ...sizes);
  if (geo.compact) {
    const need = (cols: number): number => COMPACT_PRIMARY + COMPACT_GAP + COMPACT_TILE_ROW + COMPACT_GAP + Math.ceil(most / cols) * gridTile(cols) + (Math.ceil(most / cols) - 1) * COMPACT_GAP;
    const gridCols = [3, 4, 5].find((c) => need(c) <= available) ?? 5;
    return { mode: 'tiles', groupRow: COMPACT_TILE_ROW, optionRow: gridTile(gridCols), gridCols, needed: need(gridCols), available };
  }
  const need = ([group, option]: readonly [number, number]): number => PRIMARY_BLOCK + sizes.length * group + Math.max(0, sizes.length - 1) * ROW_GAP + most * option + Math.max(0, most - 1) * ROW_GAP + TRAY_PAD;
  const step = ROW_STEPS.find((s) => need(s) <= available) ?? ROW_STEPS[ROW_STEPS.length - 1]!;
  return { mode: 'accordion', groupRow: step[0], optionRow: step[1], gridCols: 0, needed: need(step), available };
}
