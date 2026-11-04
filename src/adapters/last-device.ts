import { isTouchUi } from './touch-mode';

/**
 * The device the player used last, for the hint bar's glyphs (src/ui/play-hints.ts). A real key or a mouse is the
 * keyboard; a finger is touch; a pad is read from the Gamepad API (a pad plays natively in combat, so it makes no
 * events there) and from the key events its bridge makes for menus and the town (src/adapters/gamepad.ts: those are
 * not trusted events). Resting devices never switch it.
 */
export type LastDevice = 'keyboard' | 'gamepad' | 'touch';

/** Synthetic key events (`isTrusted` false) are the pad bridge's. */
export const deviceOfKey = (trusted: boolean): 'keyboard' | 'gamepad' => (trusted ? 'keyboard' : 'gamepad');

export const deviceOfPointer = (pointerType: string): 'touch' | 'keyboard' => (pointerType === 'touch' ? 'touch' : 'keyboard');

/** Past this a stick is pushed on purpose (the game's own dead zone is 0.2; a hair of drift never switches). */
const STICK_ON = 0.5;

/** A button is down or a stick is pushed. */
export const padTouched = (pad: { buttons: readonly { pressed: boolean }[]; axes: readonly number[] }): boolean =>
  pad.buttons.some((b) => b.pressed) || pad.axes.some((a) => Math.abs(a) >= STICK_ON);

export interface DeviceState {
  current(): LastDevice;
  /** Sets the device; true when it changed. */
  set(next: LastDevice): boolean;
}

export function createDeviceState(touch: boolean): DeviceState {
  let device: LastDevice = touch ? 'touch' : 'keyboard';
  return {
    current: () => device,
    set(next) {
      if (next === device) return false;
      device = next;
      return true;
    },
  };
}

export interface DeviceTracker {
  current(): LastDevice;
  /** Reads the pad now (call once a frame). */
  poll(): void;
  dispose(): void;
}

/** Listens to the window for the lifetime of a play view. */
export function trackLastDevice(): DeviceTracker {
  const state = createDeviceState(isTouchUi());
  const onKey = (e: KeyboardEvent) => void state.set(deviceOfKey(e.isTrusted));
  const onPointer = (e: PointerEvent) => void state.set(deviceOfPointer(e.pointerType));
  const onMove = (e: MouseEvent) => {
    // A mouse that is only being nudged or a touch's compatibility mouse events must not switch to the keyboard.
    if (e.isTrusted && (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2) && state.current() !== 'touch') state.set('keyboard');
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('mousemove', onMove, true);
  return {
    current: () => state.current(),
    poll() {
      const pads = navigator.getGamepads?.() ?? [];
      for (const pad of pads) if (pad?.connected && padTouched(pad)) return void state.set('gamepad');
    },
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('mousemove', onMove, true);
    },
  };
}
