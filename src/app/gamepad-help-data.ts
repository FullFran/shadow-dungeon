/**
 * "Controles del mando": what each button does, for Xbox and PlayStation pads, by position
 * (adapters/gamepad.ts has the mapping; tests/app/gamepad-help.test.ts holds this table to it).
 * Pure data: the window is `gamepad-help.ts`, the drawing `gamepad-pad.ts`.
 */
export type PadStyle = 'xbox' | 'playstation';

const NAMES: Record<string, Record<PadStyle, string>> = {
  a: { xbox: 'A', playstation: '✕' },
  b: { xbox: 'B', playstation: '○' },
  x: { xbox: 'X', playstation: '□' },
  y: { xbox: 'Y', playstation: '△' },
  lb: { xbox: 'LB', playstation: 'L1' },
  rb: { xbox: 'RB', playstation: 'R1' },
  lt: { xbox: 'LT', playstation: 'L2' },
  r3: { xbox: 'R3', playstation: 'R3' },
  start: { xbox: 'Start', playstation: 'Options' },
  back: { xbox: 'Back', playstation: 'Share' },
};

/** Sticks and the D-pad read the same on every pad. */
const SHARED: Record<string, string> = { leftStick: 'L ●', rightStick: 'R ●', dpadSides: '◀ ▶', dpad: '✚' };

export const buttonName = (button: string, style: PadStyle): string => NAMES[button]?.[style] ?? SHARED[button] ?? button;

export interface HelpRow {
  action: string;
  buttons: readonly string[];
}

export type HelpContext = 'combat' | 'menus';

export const GAMEPAD_HELP: Record<HelpContext, readonly HelpRow[]> = {
  combat: [
    { action: 'move', buttons: ['leftStick'] },
    { action: 'aim', buttons: ['rightStick'] },
    { action: 'roll', buttons: ['a'] },
    { action: 'fast', buttons: ['x'] },
    { action: 'heavy', buttons: ['y'] },
    { action: 'boost', buttons: ['lb'] },
    { action: 'area', buttons: ['rb'] },
    { action: 'lock', buttons: ['lt', 'r3'] },
    { action: 'target', buttons: ['dpadSides'] },
    { action: 'menu', buttons: ['start'] },
    { action: 'minimap', buttons: ['back'] },
  ],
  menus: [
    { action: 'navigate', buttons: ['leftStick', 'dpad'] },
    { action: 'confirm', buttons: ['a'] },
    { action: 'back', buttons: ['b', 'start'] },
    { action: 'item1', buttons: ['x'] },
    { action: 'item2', buttons: ['y'] },
    { action: 'item3', buttons: ['rb'] },
  ],
};
