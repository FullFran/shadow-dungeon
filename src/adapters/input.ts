import type { PlayerInput, Rect } from '../core/state';
import type { Vec2 } from '../core/vec';
import { screenToWorld } from './view';

/**
 * Keyboard and mouse -> PlayerInput (docs/gdd.md §4 "Controles"):
 * WASD or the arrow keys move, Space roll (along the held direction; with
 * none, at the lock, else at the cursor while the mouse is live, else the facing), LMB or Q fast slot, RMB or E heavy slot (hold to
 * charge), R or 1 boost slot, F or 2 area slot (keys only: they go along the
 * facing or at the lock), Shift or middle mouse lock on (per lock type), LMB on an enemy locks it
 * (click-to-lock, Q never does), wheel switches target. Without a lock, a
 * move started with the mouse aims at the cursor and one started with Q/E
 * along the facing (last WASD direction); `slotMouse` carries that source
 * and the mouse wins when both are held. The DOM part only records raw
 * state; `toPlayerInput` is the pure mapping.
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
  /**
   * The mouse moved (or clicked) after the last direction key press: the
   * cursor is where the player aims, so a neutral roll goes there. A
   * keyboard-only player's resting cursor goes stale on the next WASD press. Absent = false.
   */
  pointerLive?: boolean;
}

/** -1, 0 or 1 along one axis; WASD and the arrows together (same side counts once, opposite sides cancel). */
const axis = (keys: ReadonlySet<string>, negative: readonly string[], positive: readonly string[]) =>
  (positive.some((code) => keys.has(code)) ? 1 : 0) - (negative.some((code) => keys.has(code)) ? 1 : 0);

/** Direction keys by axis side, as in the town (src/town/scene.ts). */
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const MOVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

/**
 * Keys of each slot (fast, heavy, boost, area), by `KeyboardEvent.code`. R/F
 * sit next to Q/E under the left hand; 1/2 are the alternative. None clashes
 * with Shift, Space, E, Q, M (map), Tab, Esc or F3; 1–3 also pick an item,
 * but the item pick suspends the game input.
 */
export const SLOT_KEY_CODES: readonly (readonly string[])[] = [['KeyQ'], ['KeyE'], ['KeyR', 'Digit1'], ['KeyF', 'Digit2']];
/** Mouse button of each slot (left fast, right heavy); boost and area have none (middle is the lock). */
const SLOT_BUTTONS: readonly (number | undefined)[] = [0, 2];

export function toPlayerInput(raw: RawInput, view: Rect, pixelScale: number): PlayerInput {
  const { keys, buttons } = raw;
  return {
    move: { x: axis(keys, LEFT, RIGHT), y: axis(keys, UP, DOWN) },
    aim: screenToWorld(raw.mouse, view, pixelScale),
    aimPointer: raw.pointerLive ?? false,
    roll: raw.rollPressed,
    slots: SLOT_KEY_CODES.map((codes, i) => (SLOT_BUTTONS[i] !== undefined && buttons.has(SLOT_BUTTONS[i])) || codes.some((code) => keys.has(code))),
    slotMouse: SLOT_KEY_CODES.map((_, i) => SLOT_BUTTONS[i] !== undefined && buttons.has(SLOT_BUTTONS[i])),
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

const GAME_KEYS = new Set([...MOVE_KEYS, ...SLOT_KEY_CODES.flat(), 'Space', 'ShiftLeft', 'ShiftRight']);

export interface InputDevice {
  /** Raw state for the next simulation step; edges (roll, wheel) are consumed. */
  take(): RawInput;
  /**
   * While suspended (the Esc menu is open) every held key and button is
   * released and new presses are ignored, so menu clicks never attack and keys
   * held when the menu opened do not stay stuck. Resuming starts from nothing held.
   */
  setSuspended(suspended: boolean): void;
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
  let suspended = false;
  let pointerLive = false;

  const releaseAll = () => {
    keys.clear();
    buttons.clear();
    rollPressed = false;
    wheel = 0;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (suspended || !GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.code === 'Space' && !e.repeat) rollPressed = true;
    // Walking with the keys again: the cursor resting where it was is no longer the aim.
    if (MOVE_KEYS.has(e.code) && !e.repeat) pointerLive = false;
    keys.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    // Canvas pixels: the backing store may differ from the CSS size.
    mouse = { x: ((e.clientX - rect.left) * canvas.width) / rect.width, y: ((e.clientY - rect.top) * canvas.height) / rect.height };
    pointerLive = true;
  };
  const onMouseDown = (e: MouseEvent) => {
    onMouseMove(e);
    if (suspended) return;
    buttons.add(e.button);
    // Also stops middle-button autoscroll.
    e.preventDefault();
  };
  const onMouseUp = (e: MouseEvent) => buttons.delete(e.button);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (suspended) return;
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
      const raw: RawInput = { keys: new Set(keys), buttons: new Set(buttons), mouse, rollPressed, wheel, pointerLive };
      rollPressed = false;
      wheel = 0;
      return raw;
    },
    setSuspended(next) {
      suspended = next;
      releaseAll();
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
