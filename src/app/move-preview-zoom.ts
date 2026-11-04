import type { SheetStore } from '../adapters/assets';
import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import { t } from '../i18n';
import { h, mdWindow } from '../ui/window';
import { createMovePreview } from './move-preview-view';
import '../styles/preview-zoom.css';

/**
 * The move preview enlarged (small screens, where the sheet's stage is a strip): a relic window over a dark
 * veil with one big stage and Back. Esc, Back or a press outside closes it; keys never reach the menu
 * underneath while it is open. Its own preview loop runs only while it is open.
 */
export function openPreviewZoom(options: { species: SpeciesId; move: MoveId; rank: number; sheets: Promise<SheetStore> }): void {
  const previous = document.activeElement as HTMLElement | null;
  const preview = createMovePreview({ sheets: options.sheets });
  const back = h('button', { className: 'pz-back', type: 'button', textContent: t('menu.back') });
  const stage = h('div', { className: 'pz-stage' }, [preview.element]);
  const win = mdWindow({ title: t(`move.${options.move}`), className: 'pz-window' }, [stage, back]);
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-label', t(`move.${options.move}`));
  const veil = h('div', { className: 'pz-veil' }, [win]);
  const close = (): void => {
    window.removeEventListener('keydown', onKey, true);
    preview.dispose();
    veil.remove();
    previous?.focus?.({ preventScroll: true });
  };
  const onKey = (e: KeyboardEvent): void => {
    // Captured before the menu underneath sees it.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  back.addEventListener('click', close);
  veil.addEventListener('pointerdown', (e) => {
    if (e.target === veil) close();
  });
  window.addEventListener('keydown', onKey, true);
  document.body.append(veil);
  preview.show(options.species, options.move, options.rank);
  back.focus({ preventScroll: true });
}
