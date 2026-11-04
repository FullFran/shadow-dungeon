import type { HeldItem } from '../adapters/hud';
import type { TilePalette } from '../data/dungeons';
import type { SpeciesId } from '../data/species';
import { t } from '../i18n';
import { h } from '../ui/window';
import type { PauseMapModel } from './pause-map';
import { pauseSummary, type MenuActions, type PauseRunInfo } from './pause-model';
import { pauseView, type PauseView } from './pause-view';
import { settingsView, type SettingsView } from './settings-view';
import type { SettingsAccess } from './settings-panel';

export { pauseEntries, restartLabel, type MenuActions, type PauseEntry } from './pause-model';

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

export type MenuSettings = SettingsAccess;

/** What the pause menu needs besides the actions: the run's own data and how to draw the partner. */
export interface PauseContext {
  info: PauseRunInfo;
  portrait?(species: SpeciesId): HTMLElement;
  /** The floor plan of the run (src/app/pause-map.ts) and the colours of its tileset. */
  map?: { model: PauseMapModel; palette: TilePalette } | null;
}

/**
 * Builds the pause menu overlay inside `parent` (src/app/pause-view.ts, the relic window; the model is
 * src/app/pause-model.ts). Settings open the shared Settings window over it and the report form takes its place;
 * Back returns to the menu with the cursor on the row that opened it. Esc itself is the game's key (it closes the
 * menu from the list); inside the settings it goes back one step. Returns a function that removes the overlay.
 */
export function openPauseMenu(parent: HTMLElement, settings: MenuSettings, actions: MenuActions, held: readonly HeldItem[], context: PauseContext): () => void {
  // `no-dismiss`: a press on the veil never closes this menu (ui/dismiss-model.ts); only Continuar, Esc and Start resume.
  const overlay = h('div', { className: 'overlay pause no-dismiss' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  let view: 'main' | 'settings' | 'report' = 'main';
  let current: { dispose(): void } | null = null;
  let opened = false;

  function render(returnTo?: 'settings' | 'report'): void {
    current?.dispose();
    current = null;
    if (view === 'report' && actions.openReport) {
      const report = actions.openReport(() => {
        view = 'main';
        render('report');
      });
      current = report;
      overlay.setAttribute('aria-label', t('title.report'));
      overlay.replaceChildren(h('div', { className: 'screen-row' }, [report.element]));
      return;
    }
    if (view === 'settings') {
      const access: MenuSettings = {
        ...settings,
        setLanguage(language) {
          settings.setLanguage(language);
          render();
        },
      };
      let sheet: SettingsView | null = null;
      const leave = () => {
        view = 'main';
        render('settings');
      };
      // Esc inside the settings goes back one step, not out of the pause: claimed before the game's own handler sees it.
      const onEsc = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        const open = (document.activeElement as HTMLElement | null)?.getAttribute('aria-expanded') === 'true';
        if (open || document.activeElement instanceof HTMLInputElement) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        leave();
      };
      window.addEventListener('keydown', onEsc, true);
      sheet = settingsView({ access, onBack: leave });
      current = {
        dispose: () => {
          window.removeEventListener('keydown', onEsc, true);
          sheet?.dispose();
        },
      };
      overlay.setAttribute('aria-label', t('pause.settings'));
      overlay.replaceChildren(sheet.element);
      return;
    }
    const main: PauseView = pauseView({
      actions,
      still: opened,
      ...(returnTo ? { initial: returnTo } : {}),
      summary: pauseSummary(context.info, held),
      ...(context.portrait ? { portrait: context.portrait } : {}),
      map: context.map ?? null,
      onSettings: () => {
        view = 'settings';
        render();
      },
      onReport: () => {
        view = 'report';
        render();
      },
    });
    current = main;
    opened = true;
    overlay.setAttribute('aria-label', t('pause.title'));
    overlay.replaceChildren(main.element);
  }

  render();
  parent.append(overlay);
  return () => {
    current?.dispose();
    overlay.remove();
  };
}
