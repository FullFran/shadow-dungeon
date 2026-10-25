import type { PlayerInput, Rect } from '../core/state';
import type { Vec2 } from '../core/vec';
import { screenToWorld } from './view';

/**
 * Keyboard and mouse -> PlayerInput (docs/gdd.md §4 "Controles"):
 * WASD move, Space roll, LMB or Q fast slot, RMB or E heavy slot (hold to
 * charge), Shift or middle mouse toggle lock-on, LMB on an enemy locks it
 * (click-to-lock, Q never does), wheel switches target. The DOM part only
 * records raw state; `toPlayerInput` is the pure mapping.
 */
export interface RawInput {
  /** `KeyboardEvent.code`s currently held. */
  keys: ReadonlySet<string>;
  /** `MouseEvent.button`s currently held (0 left, 1 middle, 2 right). */
  buttons: ReadonlySet<number>;
  /** Cursor in canvas pixels. */
  mouse: Vec2;
  /** Space pressed since the last simulation step (edge). */
  rollPressed: boolean;
  /** Wheel deltaY in pixels since the last simulation step. */
  wheel: number;
}

const axis = (keys: ReadonlySet<string>, negative: string, positive: string) =>
  (keys.has(positive) ? 1 : 0) - (keys.has(negative) ? 1 : 0);

export function toPlayerInput(raw: RawInput, view: Rect, pixelScale: number): PlayerInput {
  const { keys, buttons } = raw;
  return {
    move: { x: axis(keys, 'KeyA', 'KeyD'), y: axis(keys, 'KeyW', 'KeyS') },
    aim: screenToWorld(raw.mouse, view, pixelScale),
    roll: raw.rollPressed,
    slots: [buttons.has(0) || keys.has('KeyQ'), buttons.has(2) || keys.has('KeyE')],
    lock: keys.has('ShiftLeft') || keys.has('ShiftRight') || buttons.has(1),
    click: buttons.has(0),
    wheel: raw.wheel,
    view,
  };
}

/** WheelEvent.deltaY in pixels whatever the deltaMode (lines ~ 33 px, pages ~ one screen). */
export function wheelPixels(deltaY: number, deltaMode: number, pageHeight = 600): number {
  if (deltaMode === 1) return deltaY * 33;
  if (deltaMode === 2) return deltaY * pageHeight;
  return deltaY;
}

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight']);

export interface InputDevice {
  /** Raw state for the next simulation step; edges (roll, wheel) are consumed. */
  take(): RawInput;
  /** Removes every listener. */
  dispose(): void;
}

/** Records keyboard and mouse state from the game canvas and the window. */
export function attachInput(canvas: HTMLCanvasElement): InputDevice {
  const keys = new Set<string>();
  const buttons = new Set<number>();
  let mouse: Vec2 = { x: 0, y: 0 };
  let rollPressed = false;
  let wheel = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.code === 'Space' && !e.repeat) rollPressed = true;
    keys.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    // Canvas pixels: the backing store may differ from the CSS size.
    mouse = { x: ((e.clientX - rect.left) * canvas.width) / rect.width, y: ((e.clientY - rect.top) * canvas.height) / rect.height };
  };
  const onMouseDown = (e: MouseEvent) => {
    onMouseMove(e);
    buttons.add(e.button);
    // Also stops middle-button autoscroll.
    e.preventDefault();
  };
  const onMouseUp = (e: MouseEvent) => buttons.delete(e.button);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    wheel += wheelPixels(e.deltaY, e.deltaMode, window.innerHeight);
  };
  const onContextMenu = (e: Event) => e.preventDefault();
  // Middle click would otherwise open links or paste on some platforms.
  const onAuxClick = (e: MouseEvent) => e.preventDefault();
  const onBlur = () => {
    keys.clear();
    buttons.clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('auxclick', onAuxClick);
  window.addEventListener('blur', onBlur);

  return {
    take() {
      const raw: RawInput = { keys: new Set(keys), buttons: new Set(buttons), mouse, rollPressed, wheel };
      rollPressed = false;
      wheel = 0;
      return raw;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('auxclick', onAuxClick);
      window.removeEventListener('blur', onBlur);
    },
  };
}
