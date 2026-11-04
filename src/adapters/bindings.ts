/**
 * The keyboard bindings of the play view, in one place: the input mapping (src/adapters/input.ts), the town
 * (src/town/scene.ts), the run's own keys (src/app/game.ts) and the hint bar (src/ui/play-hints-model.ts) all read
 * these, so a label on screen can never differ from the key that does the thing. `KeyboardEvent.code` values.
 */

/** Direction keys by side: WASD and the arrows together. The first of each is the one the hints show. */
export const MOVE_KEY_CODES = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
} as const;

/**
 * Keys of each slot (fast, heavy, boost, area). R/F sit next to Q/E under the left hand; 1/2 are the alternative.
 * None clashes with Shift, Space, E, Q, M (mute), Tab, Esc, F3 or F11; 1-3 also pick an item, but the item pick
 * suspends the game input.
 */
export const SLOT_KEY_CODES: readonly (readonly string[])[] = [['KeyQ'], ['KeyE'], ['KeyR', 'Digit1'], ['KeyF', 'Digit2']];

/** The roll (a press, along the held direction). */
export const ROLL_KEY = 'Space';
/** Lock on (per lock type). */
export const LOCK_KEYS: readonly string[] = ['ShiftLeft', 'ShiftRight'];
/** The Esc menu (the town menu in the town). */
export const MENU_KEY = 'Escape';
/** The minimap in a run; the quick wheel in the town. */
export const MAP_KEY = 'Tab';
/** Co-op, fainted: the camera moves on to the next standing teammate. */
export const SPECTATE_KEY = 'KeyQ';
/** Talk to, read or use what is in range in the town. */
export const INTERACT_KEY_CODES: readonly string[] = ['KeyE', 'Enter', 'NumpadEnter', 'Space'];
/**
 * Fullscreen in play: F11 (the browser's own key, taken so the game goes fullscreen with its chrome hidden) and
 * Alt+Enter. F is the area slot, so it cannot be it.
 */
export const FULLSCREEN_KEY = 'F11';

/** The key as a short label for a keycap: KeyW -> W, Digit1 -> 1, ShiftLeft -> Shift, Escape -> Esc. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Shift')) return 'Shift';
  const names: Record<string, string> = { Escape: 'Esc', Space: 'Space', Tab: 'Tab', Enter: 'Enter', NumpadEnter: 'Enter', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return names[code] ?? code;
}
