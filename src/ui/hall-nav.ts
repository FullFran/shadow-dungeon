import { hubStep } from '../app/title-hub';

/**
 * Keyboard and pointer behaviour shared by the picker-style windows (hall of oaths, mission board):
 * arrows (and WASD) move focus across every control by position, Enter presses the focused
 * button, Esc or a press outside the window closes. The shared confirmation captures keys
 * first and sits outside the window, so neither reaches the menu while it is open.
 */
const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

export interface HallNavOptions {
  /** Every focusable control, in any order (their positions decide). */
  controls(): HTMLElement[];
  /** Where focus lands when nothing in the window has it yet. */
  start(): HTMLElement | undefined;
  onBack(): void;
}

/** Wires the window; returns the function that unwires it. */
export function hallNav(win: HTMLElement, options: HallNavOptions): () => void {
  let live = true;
  const stop = () => {
    live = false;
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!live) return;
    if (!win.isConnected) return stop();
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
      options.start()?.focus({ preventScroll: true });
      return;
    }
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    controls[Number(hubStep(points, String(at), dir))]?.focus({ preventScroll: true });
  };
  const onPointer = (e: PointerEvent) => {
    if (!live) return;
    if (!win.isConnected) return stop();
    const target = e.target as Element | null;
    if (!target || win.contains(target) || target.closest('.rc-veil')) return;
    options.onBack();
  };
  window.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPointer, true);
  queueMicrotask(() => options.start()?.focus({ preventScroll: true }));
  return stop;
}
