/**
 * Touch mode (settings: Auto / On / Off). Auto switches the touch UI on after
 * the first touch on the page (`pointerType === 'touch'`). The DOM side only
 * sets `html.touch`; the CSS and the touch controls follow that class, so a
 * desktop that is never touched looks and plays exactly as before.
 */
export const TOUCH_MODES = ['auto', 'on', 'off'] as const;
export type TouchMode = (typeof TOUCH_MODES)[number];

export function touchActive(mode: TouchMode, sawTouch: boolean): boolean {
  return mode === 'on' || (mode === 'auto' && sawTouch);
}

let mode: TouchMode = 'auto';
let sawTouch = false;
let installed = false;
const listeners = new Set<(on: boolean) => void>();

function apply(): void {
  const on = touchActive(mode, sawTouch);
  document.documentElement.classList.toggle('touch', on);
  for (const listener of listeners) listener(on);
}

/** Whether the touch UI is on right now. */
export function isTouchUi(): boolean {
  return touchActive(mode, sawTouch);
}

/** Calls `listener` whenever the touch UI turns on or off; returns the unsubscribe. */
export function onTouchUi(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Applies the setting; the first call also starts watching for the first touch. */
export function setTouchMode(next: TouchMode): void {
  mode = next;
  if (typeof window === 'undefined') return;
  if (!installed) {
    installed = true;
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch' && !sawTouch) {
          sawTouch = true;
          apply();
        }
      },
      { capture: true },
    );
  }
  apply();
}

/** Touch button preferences (settings: size, opacity, left-handed); src/ui/touch-layout.ts places the buttons with them. */
export interface TouchPrefs {
  scale: number;
  opacity: number;
  leftHanded: boolean;
}

export const DEFAULT_TOUCH_PREFS: TouchPrefs = { scale: 1, opacity: 1, leftHanded: false };

let prefs: TouchPrefs = DEFAULT_TOUCH_PREFS;
const prefListeners = new Set<(prefs: TouchPrefs) => void>();

export const touchPrefs = (): TouchPrefs => prefs;

export function setTouchPrefs(next: TouchPrefs): void {
  if (next.scale === prefs.scale && next.opacity === prefs.opacity && next.leftHanded === prefs.leftHanded) return;
  prefs = next;
  for (const listener of prefListeners) listener(prefs);
}

/** Calls `listener` when the touch preferences change; returns the unsubscribe. */
export function onTouchPrefs(listener: (prefs: TouchPrefs) => void): () => void {
  prefListeners.add(listener);
  return () => prefListeners.delete(listener);
}
