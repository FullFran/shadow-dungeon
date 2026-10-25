import { t, type Language } from '../i18n';
import type { Settings } from './settings';
import { el, languageRow, lockRow, soundRow, type UpdateSettings } from './settings-panel';

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

export interface MenuSettings {
  get(): Settings;
  update: UpdateSettings;
  /** Applies a new language to the page (title, `lang`). */
  setLanguage(language: Language): void;
}

/**
 * Builds the Esc menu overlay inside `parent`: resume, quick settings, restart
 * room, quit. Returns a function that removes it.
 */
export function openPauseMenu(parent: HTMLElement, settings: MenuSettings, actions: MenuActions): () => void {
  const overlay = el('div', { className: 'overlay' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  function render(): void {
    const current = settings.get();
    const button = (key: string, onClick: () => void, className = '') => {
      const node = el('button', { type: 'button', className, textContent: t(key) });
      node.addEventListener('click', onClick);
      return node;
    };
    const resume = button('pause.resume', actions.resume, 'primary');
    const panel = el('div', { className: 'panel' }, [
      el('h1', { textContent: t('pause.title') }),
      el('div', { className: 'row' }, [resume, button('pause.restart', actions.restart), button('pause.quit', actions.quit)]),
      el('h2', { textContent: t('pause.settings') }),
      languageRow(current, (language) => {
        settings.update({ language });
        settings.setLanguage(language);
        render();
      }),
      lockRow(current, settings.update),
      soundRow(current, settings.update),
    ]);
    overlay.setAttribute('aria-label', t('pause.title'));
    overlay.replaceChildren(panel);
    if (overlay.isConnected) resume.focus();
  }

  render();
  parent.append(overlay);
  overlay.querySelector<HTMLButtonElement>('button.primary')?.focus();
  return () => overlay.remove();
}
