import { hubStep } from './title-hub';

/**
 * Keys of a card-grid window (the Pokémon picker's, reused by Evolución and
 * Mejoras): arrows or WASD move focus across the cards and the buttons by
 * position (`hubStep`), Esc goes back. Returns the function that stops it.
 */
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

export interface GridNavOptions {
  /** The window: when it leaves the page the listener removes itself. */
  win: HTMLElement;
  /** Every focusable control in reading order. */
  controls(): HTMLElement[];
  /** Where focus goes when nothing in the window has it yet. */
  fallback(): HTMLElement | undefined;
  onBack(): void;
}

export function gridNav(options: GridNavOptions): () => void {
  const stop = () => window.removeEventListener('keydown', onKey);
  function onKey(e: KeyboardEvent): void {
    if (!options.win.isConnected) {
      stop();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onBack();
      return;
    }
    const dir = KEYS[e.code];
    if (!dir) return;
    e.preventDefault();
    const controls = options.controls();
    const at = controls.indexOf(document.activeElement as HTMLElement);
    if (at < 0) {
      options.fallback()?.focus();
      return;
    }
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    controls[Number(hubStep(points, String(at), dir))]?.focus();
  }
  window.addEventListener('keydown', onKey);
  return stop;
}
