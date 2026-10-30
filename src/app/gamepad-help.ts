import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';

/**
 * "Controles del mando": what each button does, for Xbox and PlayStation pads,
 * by position (adapters/gamepad.ts has the mapping; tests/app/gamepad-help.test.ts
 * holds this table to it).
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

export const GAMEPAD_HELP: { combat: readonly HelpRow[]; menus: readonly HelpRow[] } = {
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

const STYLE = `
.controls-window { width: min(640px, calc(100vw - 16px)); }
/* A tall list on a phone: the body scrolls inside the screen, clear of the footer and the touch "Atrás" button. */
.controls-window .md-window-body { max-height: calc(100dvh - 150px); overflow-y: auto; overscroll-behavior: contain; scrollbar-color: var(--md-cursor) transparent; }
html.touch .controls-window { margin-top: 52px; }
.controls-window table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; font-size: 14px; }
.controls-window th { text-align: left; color: var(--md-cursor); font-weight: normal; }
.controls-window td, .controls-window th { padding: 2px 8px 2px 0; }
.controls-window td + td, .controls-window th + th { white-space: nowrap; }
`;

function table(title: string, rows: readonly HelpRow[]): HTMLElement[] {
  const names = (row: HelpRow, style: PadStyle) => row.buttons.map((b) => buttonName(b, style)).join(' / ');
  return [
    h('h3', { className: 'dim', textContent: title }),
    h('table', {}, [
      h('tr', {}, [h('th', { textContent: '' }), h('th', { textContent: 'Xbox' }), h('th', { textContent: 'PlayStation' })]),
      ...rows.map((row) => h('tr', {}, [h('td', { textContent: t(`controls.${row.action}`) }), h('td', { textContent: names(row, 'xbox') }), h('td', { textContent: names(row, 'playstation') })])),
    ]),
  ];
}

export function controlsWindow(onBack: () => void): { element: HTMLElement; dispose(): void } {
  const list = cursorList({ onBack, label: t('title.controls'), items: [{ label: t('menu.back'), onConfirm: onBack }] });
  const element = mdWindow({ title: t('title.controls'), className: 'shop controls-window' }, [h('style', { textContent: STYLE }), ...table(t('controls.combat'), GAMEPAD_HELP.combat), ...table(t('controls.menus'), GAMEPAD_HELP.menus), h('p', { className: 'dim', textContent: t('controls.note') }), list.element]);
  return { element, dispose: () => list.dispose() };
}
