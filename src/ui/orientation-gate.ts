import { t } from '../i18n';
import { pixelIconSvg } from './pixel-icons';
import { h } from './window';

/**
 * Landscape only on phones (owner 2026-11-08: "solo se pueda jugar en horizontal ... poner un aviso"). A touch screen
 * held in portrait gets a full-screen notice over every screen (the title, the windows, the town, a run) until it is
 * turned; the game underneath is untouched, and a solo run pauses (game.ts listens to `ROTATE_EVENT`). The manifest
 * already asks for landscape and fullscreen tries `screen.orientation.lock`; this covers the browsers that ignore both.
 */
export interface ScreenShape {
  touch: boolean;
  width: number;
  height: number;
}

/** The i18n keys of the notice (a test checks both languages). */
export const ROTATE_GATE_KEYS = ['touch.rotate.title', 'touch.rotate'] as const;

/** Fired on window when the notice covers the game (a run pauses on it). */
export const ROTATE_EVENT = 'rotate-blocked';

export function orientationBlocks(shape: ScreenShape): boolean {
  return shape.touch && shape.height > shape.width;
}

export interface OrientationGate {
  refresh(): void;
}

export function installOrientationGate(parent: HTMLElement = document.body): OrientationGate {
  const title = h('p', { className: 'rotate-gate-title' });
  const text = h('p', { className: 'rotate-gate-text' });
  const gate = h('div', { className: 'rotate-gate' }, [h('span', { className: 'rotate-gate-icon' }, [pixelIconSvg('rotate', 'px-icon')]), title, text]);
  gate.setAttribute('role', 'alertdialog');
  gate.setAttribute('aria-modal', 'true');
  const root = document.documentElement;
  let blocked = false;
  const update = (): void => {
    const now = orientationBlocks({ touch: root.classList.contains('touch'), width: window.innerWidth, height: window.innerHeight });
    if (now === blocked) return;
    blocked = now;
    root.classList.toggle('rotate-blocked', now);
    gate.setAttribute('aria-hidden', String(!now));
    if (now) window.dispatchEvent(new Event(ROTATE_EVENT));
  };
  const refresh = (): void => {
    title.textContent = t('touch.rotate.title');
    text.textContent = t('touch.rotate');
    gate.setAttribute('aria-label', t('touch.rotate.title'));
  };
  refresh();
  gate.setAttribute('aria-hidden', 'true');
  parent.append(gate);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  // Touch mode switches on with the first touch (adapters/touch-mode.ts): re-check when the class changes.
  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['class'] });
  update();
  return { refresh };
}
