import { DUNGEONS } from '../data/dungeons';
import type { WorldMapId } from '../data/world';
import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { description, describedMenu } from '../ui/describe';
import { h, mdWindow } from '../ui/window';
import type { TravelDestination, TravelDetail } from './travel';

/** A detail line of the travel window in the current language. */
export function detailText(detail: TravelDetail, tr: (key: string) => string = t): string {
  const def = detail.dungeon ? DUNGEONS.find((d) => d.id === detail.dungeon) : undefined;
  const name = def ? tr(def.lore.nameKey) : detail.nameKey ? tr(detail.nameKey) : '';
  return tr(detail.key).replace('{name}', name);
}

export interface TravelWindowOptions {
  destinations: readonly TravelDestination[];
  /** The map the walker is on (its row says "Aquí"). */
  current: WorldMapId;
  onTravel(destination: TravelDestination): void;
  onBack(): void;
}

/**
 * The "Viajar" window: the visited maps and the shortcuts in a cursor list,
 * what the highlighted one holds beside it, in the shared described menu
 * (fixed geometry: tools/mobile/menu-geometry.mjs `travel`).
 */
export function travelWindow(options: TravelWindowOptions): { element: HTMLElement; dispose(): void } {
  const detail = h('div', { className: 'shop-effect travel-detail' });
  const describe = (index: number) => {
    const dest = options.destinations[index];
    if (!dest) return detail.replaceChildren(h('p', { className: 'dim', textContent: t('travel.pick') }));
    const lines = dest.details.length > 0 ? dest.details.map((d) => detailText(d)) : [t('travel.quiet')];
    detail.replaceChildren(h('h3', { textContent: t(dest.nameKey) }), h('ul', { className: 'travel-lines' }, lines.map((line) => h('li', { textContent: line }))));
  };
  const list = cursorList({
    items: [
      ...options.destinations.map((dest) => ({
        label: t(dest.nameKey),
        ...(dest.map === options.current && dest.id === dest.map ? { value: t('travel.here') } : {}),
        tapToSelect: true,
        onConfirm: () => options.onTravel(dest),
      })),
      { label: t('menu.back'), onConfirm: options.onBack },
    ],
    onBack: options.onBack,
    onCursor: describe,
    label: t('travel.title'),
    className: 'shop-list',
  });
  const desc = description(list, { describe, children: [detail] });
  desc.update();
  const element = mdWindow({ title: t('travel.title'), className: 'shop travel' }, [h('p', { textContent: t('travel.text') }), describedMenu(list.element, desc.element)]);
  return { element, dispose: () => list.dispose() };
}
