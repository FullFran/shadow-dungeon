import { t } from '../i18n';

/**
 * The keyboard and mouse bindings of the play view, in one place: the input mapping (src/adapters/input.ts), the
 * town (src/town/scene.ts), the run's own keys (src/app/game.ts), the hint bar (src/ui/play-hints-model.ts), the
 * move slots' keycaps and the tutorial signs all read the active table here, so a label on screen can never differ
 * from the key that does the thing. Players rebind them in Settings > Keyboard and mouse (issue #62); the constants
 * below are the defaults. `KeyboardEvent.code` values; mouse buttons are `Mouse<button>`.
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
  if (code.startsWith('Control')) return 'Ctrl';
  if (code.startsWith('Alt')) return 'Alt';
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const names: Record<string, string> = { Escape: 'Esc', Space: 'Space', Tab: 'Tab', Enter: 'Enter', NumpadEnter: 'Enter', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return names[code] ?? code;
}

// ---- rebinding (issue #62)

/** Every action the player can rebind, in the order the Settings section lists them. */
export const BIND_ACTIONS = ['up', 'down', 'left', 'right', 'fast', 'heavy', 'boost', 'area', 'roll', 'lock', 'item', 'itemNext', 'map', 'menu', 'mute', 'interact', 'run', 'spectate'] as const;
export type BindAction = (typeof BIND_ACTIONS)[number];

/** A `KeyboardEvent.code`, `Mouse<button>`, or nothing. */
export type Binding = string | null;
/** Two inputs per action: the primary (what the hints show) and an alternative. */
export type Bindings = Readonly<Record<BindAction, readonly [Binding, Binding]>>;

/**
 * The defaults: exactly the fixed keys the game had before rebinding (pinned by tests/adapters/key-bindings.test.ts),
 * plus the bag's (odd/tasks/items-bag.md): G uses the selected consumable, X selects the next one.
 */
export const DEFAULT_BINDINGS: Bindings = {
  up: [MOVE_KEY_CODES.up[0], MOVE_KEY_CODES.up[1]],
  down: [MOVE_KEY_CODES.down[0], MOVE_KEY_CODES.down[1]],
  left: [MOVE_KEY_CODES.left[0], MOVE_KEY_CODES.left[1]],
  right: [MOVE_KEY_CODES.right[0], MOVE_KEY_CODES.right[1]],
  fast: ['KeyQ', 'Mouse0'],
  heavy: ['KeyE', 'Mouse2'],
  boost: ['KeyR', 'Digit1'],
  area: ['KeyF', 'Digit2'],
  roll: [ROLL_KEY, null],
  lock: ['ShiftLeft', 'Mouse1'],
  item: ['KeyG', null],
  itemNext: ['KeyX', null],
  map: [MAP_KEY, null],
  menu: [MENU_KEY, null],
  mute: ['KeyM', null],
  interact: ['KeyE', null],
  run: ['ShiftLeft', null],
  spectate: [SPECTATE_KEY, null],
};

/**
 * Where each action is read: in a run (fighting), in the town, or watching a teammate (co-op, fainted). Two actions
 * clash only when they share a place, so E can be the heavy slot in a run and talk in the town.
 */
type Place = 'run' | 'town' | 'watch';
const PLACES: Record<BindAction, readonly Place[]> = {
  up: ['run', 'town'],
  down: ['run', 'town'],
  left: ['run', 'town'],
  right: ['run', 'town'],
  fast: ['run'],
  heavy: ['run'],
  boost: ['run'],
  area: ['run'],
  roll: ['run'],
  lock: ['run'],
  item: ['run'],
  itemNext: ['run'],
  map: ['run', 'town', 'watch'],
  menu: ['run', 'town', 'watch'],
  mute: ['run', 'watch'],
  interact: ['town'],
  run: ['town'],
  spectate: ['watch'],
};

/** Keys no action can take: Esc cancels and opens the menu, Enter confirms, F1/F3/F11 are help, overlay and fullscreen, the OS keys. */
const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'F1', 'F3', 'F11', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu', 'CapsLock', 'NumLock', 'ScrollLock', 'PrintScreen', 'Pause']);
/** Slots that cannot change: Esc always opens the menu (the gamepad and every window close with it). */
const FIXED: Partial<Record<BindAction, readonly [boolean, boolean]>> = { menu: [true, false] };

export const isFixedSlot = (action: BindAction, slot: 0 | 1): boolean => FIXED[action]?.[slot] ?? false;
const isMouse = (input: string): boolean => /^Mouse[0-4]$/.test(input);
/** Mouse buttons are read only in a run (src/adapters/input.ts): actions of the town or the menus cannot take one. */
const takesMouse = (action: BindAction): boolean => PLACES[action].every((p) => p === 'run');

/** The right-hand Shift, Ctrl and Alt bind as the left ones, so either side of the keyboard does the action. */
export function normalizeInput(code: string): string {
  const match = /^(Shift|Control|Alt)Right$/.exec(code);
  return match ? `${match[1]}Left` : code;
}

/** `MouseEvent.button` as a binding. */
export const inputOf = (button: number): string => `Mouse${button}`;

/** A valid binding: a plausible `KeyboardEvent.code` or mouse button 0-4. */
const plausible = (input: unknown): input is string => typeof input === 'string' && (isMouse(input) || /^[A-Z][A-Za-z0-9]{1,24}$/.test(input));

/** Two actions share a place (so they cannot share an input), or are the same action. */
const sharePlace = (a: BindAction, b: BindAction): boolean => a === b || PLACES[a].some((p) => PLACES[b].includes(p));

export interface BindingSlot {
  action: BindAction;
  slot: 0 | 1;
}

/** Every pair of slots holding the same input in a shared place. Empty for a usable table. */
export function bindingConflicts(table: Bindings): [BindingSlot, BindingSlot][] {
  const slots: (BindingSlot & { input: string })[] = [];
  for (const action of BIND_ACTIONS) {
    table[action].forEach((input, slot) => {
      if (input) slots.push({ action, slot: slot as 0 | 1, input });
    });
  }
  const out: [BindingSlot, BindingSlot][] = [];
  slots.forEach((a, i) => {
    for (const b of slots.slice(i + 1)) if (a.input === b.input && sharePlace(a.action, b.action)) out.push([{ action: a.action, slot: a.slot }, { action: b.action, slot: b.slot }]);
  });
  return out;
}

export type RebindResult =
  | { kind: 'ok'; bindings: Bindings }
  /** The input was on `other`, which now holds this slot's old input (or nothing, when that would clash). */
  | { kind: 'swapped'; bindings: Bindings; other: BindingSlot }
  | { kind: 'refused'; reason: 'reserved' | 'mouse' | 'fixed' };

const withSlot = (table: Bindings, action: BindAction, slot: 0 | 1, input: Binding): Bindings => {
  const pair: [Binding, Binding] = [...table[action]];
  pair[slot] = input;
  return { ...table, [action]: pair };
};

/**
 * `action`'s `slot` set to `input`. Conflict policy (documented in docs/gdd.md, Controles): when another action of
 * the same place already uses the input, the two swap (that action takes this slot's old input), so a table never
 * holds a conflict and nothing is lost silently; when the old input would itself clash there, that slot is left
 * empty instead. Reserved keys, mouse buttons on actions outside combat and the menu's Esc are refused.
 */
export function rebind(table: Bindings, action: BindAction, slot: 0 | 1, rawInput: string): RebindResult {
  const input = normalizeInput(rawInput);
  if (isFixedSlot(action, slot)) return { kind: 'refused', reason: 'fixed' };
  if (RESERVED.has(input)) return { kind: 'refused', reason: 'reserved' };
  if (isMouse(input) && !takesMouse(action)) return { kind: 'refused', reason: 'mouse' };
  const previous = table[action][slot];
  if (previous === input) return { kind: 'ok', bindings: table };
  let other: BindingSlot | undefined;
  for (const a of BIND_ACTIONS) {
    table[a].forEach((held, s) => {
      if (held === input && sharePlace(a, action) && !(a === action && s === slot)) other = { action: a, slot: s as 0 | 1 };
    });
  }
  let next = withSlot(table, action, slot, input);
  if (!other) return { kind: 'ok', bindings: next };
  next = withSlot(next, other.action, other.slot, previous);
  // The old input may clash in a place only the other action has (Q would land on the map, where it is spectate):
  // it stays empty then. A mouse button cannot move onto an action that takes none either.
  if (previous && (bindingConflicts(next).length > 0 || (isMouse(previous) && !takesMouse(other.action)))) next = withSlot(next, other.action, other.slot, null);
  return { kind: 'swapped', bindings: next, other };
}

/** The defaults, for "Restablecer". */
export const resetBindings = (): Bindings => DEFAULT_BINDINGS;

/**
 * Stored bindings, each slot kept only when valid (a plausible input, not reserved, a mouse button only where one
 * is read) and when it does not clash with a slot kept before it; everything else takes the default (or empty, when
 * the default would clash). The menu's first key is always Esc.
 */
export function sanitizeBindings(stored: unknown): Bindings {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return DEFAULT_BINDINGS;
  const source = stored as Partial<Record<string, unknown>>;
  let table: Bindings = Object.fromEntries(BIND_ACTIONS.map((a) => [a, [null, null]])) as unknown as Bindings;
  const fits = (action: BindAction, slot: 0 | 1, input: string): boolean => {
    if (isFixedSlot(action, slot) || RESERVED.has(input) || (isMouse(input) && !takesMouse(action))) return false;
    return bindingConflicts(withSlot(table, action, slot, input)).length === 0;
  };
  // Stored slots first, so a player's choice wins over a default it displaced.
  for (const action of BIND_ACTIONS) {
    const pair = source[action];
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    for (const slot of [0, 1] as const) {
      const input = pair[slot];
      if (input === null && !isFixedSlot(action, slot)) table = withSlot(table, action, slot, '');
      else if (plausible(input) && fits(action, slot, normalizeInput(input))) table = withSlot(table, action, slot, normalizeInput(input));
    }
  }
  for (const action of BIND_ACTIONS) {
    for (const slot of [0, 1] as const) {
      const held = table[action][slot];
      if (held === '') table = withSlot(table, action, slot, null);
      else if (held === null) {
        const fallback = DEFAULT_BINDINGS[action][slot];
        table = withSlot(table, action, slot, fallback && (isFixedSlot(action, slot) || fits(action, slot, fallback)) ? fallback : null);
      }
    }
  }
  return table;
}

let active: Bindings = DEFAULT_BINDINGS;

/** The table the game reads now (the player's, from the settings; src/app/main.ts sets it). */
export const activeBindings = (): Bindings => active;
export function setActiveBindings(table: Bindings): void {
  active = table;
}

/** The keyboard codes of an action (a bound Shift, Ctrl or Alt counts on both sides). */
export function codesOf(action: BindAction, table: Bindings = active): string[] {
  return table[action].flatMap((input) => {
    if (!input || isMouse(input)) return [];
    const right = /^(Shift|Control|Alt)Left$/.exec(input);
    return right ? [input, `${right[1]}Right`] : [input];
  });
}

/** The mouse buttons of an action. */
export const mouseButtonsOf = (action: BindAction, table: Bindings = active): number[] => table[action].flatMap((input) => (input && isMouse(input) ? [Number(input.slice(5))] : []));

/** The first input of an action, the one a keycap hint shows (null when it has none). */
export const primaryOf = (action: BindAction, table: Bindings = active): string | null => table[action][0] ?? table[action][1];

/**
 * The key does the action. Synthetic events (`isTrusted` false: the gamepad sends Esc, Tab, arrows and Enter)
 * always read the defaults, so the pad keeps working whatever the keyboard is bound to.
 */
export function boundTo(action: BindAction, code: string, table: Bindings = active, trusted = true): boolean {
  return codesOf(action, trusted ? table : DEFAULT_BINDINGS).includes(code);
}

/** The keycap text of an input, in the current language: mouse buttons and a few keys have names (`short` for small keycaps). */
export function inputLabel(input: string, tr: (key: string) => string = t, short = false): string {
  // Keycaps keep the plain key names (Space); sentences name some keys in the language (Espacio).
  if (!isMouse(input) && short) return keyLabel(input);
  const key = isMouse(input) ? `bind.mouse.${input.slice(5)}${short ? '.short' : ''}` : `bind.key.${input}`;
  const named = tr(key);
  return named !== key ? named : keyLabel(input);
}

/**
 * The inputs of an action as tutorial-sign text, each in [brackets] (src/ui/tutorial-sign.ts): "[Q] o [Clic
 * izquierdo]". `move` packs the four directions: "[WASD] o [↑←↓→]" (a slot whose four are single characters joins
 * them, else they are spaced).
 */
export function bindingsHint(action: BindAction | 'move', table: Bindings = active, tr: (key: string) => string = t): string {
  const groups: string[] = [];
  if (action === 'move') {
    for (const slot of [0, 1] as const) {
      const inputs = (['up', 'left', 'down', 'right'] as const).map((a) => table[a][slot]).filter((input): input is string => !!input);
      const labels = inputs.map((input) => inputLabel(input, tr));
      const arrows = tr('bind.arrows');
      if (inputs.join() === 'ArrowUp,ArrowLeft,ArrowDown,ArrowRight' && arrows !== 'bind.arrows') groups.push(arrows);
      else if (labels.length > 0) groups.push(labels.every((l) => [...l].length === 1) ? labels.join('') : labels.join(' '));
    }
  } else {
    for (const input of table[action]) if (input) groups.push(inputLabel(input, tr));
  }
  return groups.map((g) => `[${g}]`).join(` ${tr('bind.or')} `);
}

/**
 * A catalog text with its binding placeholders filled: `{bind:<action>}` (or `{bind:move}`) becomes every bound
 * input in [brackets] (`bindingsHint`), `{key:<action>}` the short label of its first input.
 */
export function fillBindings(text: string, table: Bindings = active, tr: (key: string) => string = t): string {
  return text.replace(/\{(bind|key):([a-z]+)\}/g, (match, kind: string, name: string) => {
    if (kind === 'bind' && (name === 'move' || (BIND_ACTIONS as readonly string[]).includes(name))) return bindingsHint(name as BindAction | 'move', table, tr);
    if (kind === 'key' && (BIND_ACTIONS as readonly string[]).includes(name)) {
      const input = primaryOf(name as BindAction, table);
      return input ? inputLabel(input, tr, true) : '—';
    }
    return match;
  });
}

/** What a key does in the town (src/town/scene.ts). */
export type TownAction = 'up' | 'down' | 'left' | 'right' | 'run' | 'map' | 'menu' | 'interact';
const TOWN_ACTIONS: readonly TownAction[] = ['up', 'down', 'left', 'right', 'run', 'map', 'menu', 'interact'];
/** Keys that always talk in the town too (the confirm keys), unless the player bound them to another town action. */
const TOWN_CONFIRM_KEYS: readonly string[] = INTERACT_KEY_CODES.filter((code) => code !== 'KeyE');

/** The town action of a key, through the player's bindings (synthetic pad keys through the defaults); null for none. */
export function townActionOf(code: string, table: Bindings = active, trusted = true): TownAction | null {
  const source = trusted ? table : DEFAULT_BINDINGS;
  const action = TOWN_ACTIONS.find((a) => codesOf(a, source).includes(code));
  if (action) return action;
  return TOWN_CONFIRM_KEYS.includes(code) ? 'interact' : null;
}
