import type { HeldItem } from '../adapters/hud';
import { ITEMS } from '../data/items';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';
import { settingItems, type SettingsAccess } from './settings-panel';

/**
 * Pause policy of the Esc menu. The solo demo pauses the simulation while the
 * menu is open. Future co-op will not pause (the menu opens while the game keeps
 * running, input to the game is still cut off), so co-op only flips this flag.
 */
export const PAUSE_ON_MENU = true;

/** Whether the simulation stands still this frame. */
export function simulationPaused(menuOpen: boolean, pauseOnMenu: boolean = PAUSE_ON_MENU): boolean {
  return menuOpen && pauseOnMenu;
}

export interface MenuActions {
  resume(): void;
  restart(): void;
  quit(): void;
}

export type MenuSettings = SettingsAccess;

/** The held items window: each item with its stacks and what it does, in its rarity colour. */
function itemsWindow(held: readonly HeldItem[]): HTMLElement {
  const body =
    held.length === 0
      ? [h('p', { className: 'dim', textContent: t('pause.noItems') })]
      : [
          h(
            'ul',
            { className: 'held-items' },
            held.map((item) =>
              h('li', { className: `rarity-${ITEMS[item.id].rarity}` }, [
                h('strong', { textContent: `${item.name}${item.count > 1 ? ` ×${item.count}` : ''}` }),
                h('div', { className: 'dim', textContent: item.description }),
              ]),
            ),
          ),
        ];
  return mdWindow({ title: t('pause.items'), className: 'items' }, body);
}

/**
 * Builds the Esc menu overlay inside `parent`: a cursor menu (resume, restart
 * floor, quick settings, quit) beside the held items. Esc itself is the
 * game's key (it closes the menu), so the list has no back action; the
 * settings view has a Back row. Returns a function that removes the overlay.
 */
export function openPauseMenu(parent: HTMLElement, settings: MenuSettings, actions: MenuActions, held: readonly HeldItem[] = []): () => void {
  const overlay = h('div', { className: 'overlay pause' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  let view: 'main' | 'settings' = 'main';
  let list: ReturnType<typeof cursorList> | null = null;
  let opened = false;

  function render(): void {
    list?.dispose();
    const access: MenuSettings = {
      ...settings,
      setLanguage(language) {
        settings.setLanguage(language);
        render();
      },
    };
    const main: ListItem[] = [
      { label: t('pause.resume'), onConfirm: actions.resume },
      { label: t('pause.restart'), onConfirm: actions.restart },
      {
        label: t('pause.settings'),
        onConfirm: () => {
          view = 'settings';
          render();
        },
      },
      { label: t('pause.quit'), onConfirm: actions.quit },
    ];
    const back = () => {
      view = 'main';
      render();
    };
    const current = cursorList({ items: view === 'main' ? main : [], label: t('pause.title') });
    list = current;
    // Settings rows rebuild in place after each change, keeping the cursor.
    const refreshSettings = () => current.setItems([...settingItems(access, refreshSettings), { label: t('menu.back'), onConfirm: back }]);
    if (view === 'settings') refreshSettings();
    const still = opened;
    opened = true;
    overlay.setAttribute('aria-label', t('pause.title'));
    overlay.replaceChildren(
      h('div', { className: 'screen-row' }, [
        mdWindow({ title: view === 'main' ? t('pause.title') : t('pause.settings'), className: view === 'main' ? 'pause-menu' : 'pause-settings', still }, [current.element]),
        view === 'main' ? itemsWindow(held) : null,
      ]),
    );
  }

  render();
  parent.append(overlay);
  return () => {
    list?.dispose();
    overlay.remove();
  };
}
