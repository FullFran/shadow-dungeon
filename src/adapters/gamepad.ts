import { IDLE_TOUCH, joystickVector, type TouchFrame } from './touch';
import type { Vec2 } from '../core/vec';

/**
 * A controller (Gamepad API, `standard` mapping), in one place. Outside combat
 * it acts as keys, so every screen, the town and the cinematics work as they
 * are. In combat it feeds a `TouchFrame`, the path touch already takes to the
 * PlayerInput: analogue move, auto-aim, charge while held, right stick to aim.
 * The core and the net protocol never know about it.
 */

/** Standard mapping: Xbox names (A is Cross, B Circle, X Square, Y Triangle). */
export const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 } as const;

export const STICK_DEAD_ZONE = 0.2;
/** How far a stick must lean to count as an arrow key. */
export const STICK_KEY_LEAN = 0.5;

/** What is read from a controller each time. */
export interface PadState {
  axes: readonly number[];
  pressed: ReadonlySet<number>;
}

/** The Gamepad API's fields this reads, so tests need no browser. */
export interface PadSource {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export function readPad(pad: PadSource): PadState {
  const pressed = new Set<number>();
  pad.buttons.forEach((b, i) => {
    if (b.pressed || b.value > 0.5) pressed.add(i);
  });
  return { axes: pad.axes, pressed };
}

const stick = (state: PadState, x: number, y: number): Vec2 => joystickVector({ x: 0, y: 0 }, { x: state.axes[x] ?? 0, y: state.axes[y] ?? 0 }, 1, STICK_DEAD_ZONE);

/** The keys the pad holds outside combat: arrows, Enter, Escape and the 1 to 3 of the item picks. */
export function padKeys(state: PadState): Set<string> {
  const keys = new Set<string>();
  const on = (button: number) => state.pressed.has(button);
  const x = state.axes[0] ?? 0;
  const y = state.axes[1] ?? 0;
  if (on(PAD.up) || y <= -STICK_KEY_LEAN) keys.add('ArrowUp');
  if (on(PAD.down) || y >= STICK_KEY_LEAN) keys.add('ArrowDown');
  if (on(PAD.left) || x <= -STICK_KEY_LEAN) keys.add('ArrowLeft');
  if (on(PAD.right) || x >= STICK_KEY_LEAN) keys.add('ArrowRight');
  if (on(PAD.a)) keys.add('Enter');
  if (on(PAD.b) || on(PAD.start)) keys.add('Escape');
  if (on(PAD.x)) keys.add('Digit1');
  if (on(PAD.y)) keys.add('Digit2');
  if (on(PAD.rb)) keys.add('Digit3');
  if (on(PAD.back)) keys.add('Tab');
  return keys;
}

/** The keys that also work in combat: the menu and the minimap. */
export function padCombatKeys(state: PadState): Set<string> {
  const keys = new Set<string>();
  if (state.pressed.has(PAD.start)) keys.add('Escape');
  if (state.pressed.has(PAD.back)) keys.add('Tab');
  return keys;
}

/** `KeyboardEvent.key` of a synthetic key; screens read `code`, the prologue's skip reads `key`. */
export const keyOf = (code: string): string => (code.startsWith('Digit') ? code.slice(5) : code);

/** Slot of each button, in slot order (fast, heavy, boost, area). */
const SLOT_BUTTONS = [PAD.x, PAD.y, PAD.lb, PAD.rb] as const;

/** What a combat frame remembers: the buttons last seen, and the aim of each slot held. */
export interface PadMemory {
  pressed: ReadonlySet<number>;
  aims: readonly (Vec2 | null)[];
}

/** Starting from what is held now, so a button held across a change of mode fires nothing. */
export const padMemory = (state: PadState | null): PadMemory => ({ pressed: state?.pressed ?? new Set(), aims: [null, null, null, null] });

/**
 * One step of combat. A slot's button is the slot held, as on touch: a charged
 * move charges while held. The right stick aims the slot held, and it stays
 * aimed if the stick recentres first. The step after the button lifts still
 * carries its aim, because that is the step that fires a charged move.
 */
export function padFrame(state: PadState, memory: PadMemory): { frame: TouchFrame; memory: PadMemory } {
  const on = (button: number) => state.pressed.has(button);
  const edge = (button: number) => on(button) && !memory.pressed.has(button);
  const right = stick(state, 2, 3);
  const pushed = right.x !== 0 || right.y !== 0;
  const held = SLOT_BUTTONS.map(on);
  const aims = held.map((isHeld, slot) => (isHeld ? (pushed ? right : (memory.aims[slot] ?? null)) : null));
  // Only a button actually lifted this step: one held over a mode change never fired.
  const lifted = SLOT_BUTTONS.findIndex((button) => memory.pressed.has(button) && !on(button));
  const slot = held.findIndex(Boolean);
  const aim = lifted >= 0 ? { slot: lifted, dir: memory.aims[lifted] ?? null } : slot >= 0 ? { slot, dir: aims[slot] ?? null } : null;
  return {
    frame: {
      ...IDLE_TOUCH,
      move: stick(state, 0, 1),
      roll: edge(PAD.a),
      fast: held[0]!,
      heavy: held[1]!,
      boost: held[2]!,
      area: held[3]!,
      lockHeld: on(PAD.lt) || on(PAD.r3),
      lockTap: edge(PAD.lt) || edge(PAD.r3),
      swipe: (edge(PAD.right) ? 1 : 0) - (edge(PAD.left) ? 1 : 0),
      aim,
      // The bag (odd/tasks/items-bag.md): RT uses the selected consumable, the D-pad's down and up pick the next or previous one.
      // Only when pressed: an idle pad still gives the idle frame.
      ...(edge(PAD.rt) ? { item: true } : {}),
      ...(edge(PAD.down) !== edge(PAD.up) ? { itemCycle: edge(PAD.down) ? 1 : -1 } : {}),
    },
    memory: { pressed: state.pressed, aims },
  };
}

/** The first delay and the pace of a held arrow, in ms. */
export const KEY_REPEAT = { delayMs: 400, everyMs: 130 } as const;
const REPEATS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export interface KeyEmitter {
  /** Applies the keys held now: downs, ups and repeats, in `send`. */
  update(keys: ReadonlySet<string>, nowMs: number): void;
  /** Lets go of everything sent, and ignores what is held until it is released (a change of mode). */
  rearm(keys: ReadonlySet<string>): void;
}

/** Turns the keys a pad holds into key events. A key held across `rearm` sends nothing, not even its release. */
export function keyEmitter(send: (type: 'keydown' | 'keyup', code: string, repeat: boolean) => void): KeyEmitter {
  const down = new Map<string, number>();
  const ignored = new Set<string>();
  return {
    update(keys, nowMs) {
      for (const code of [...ignored]) if (!keys.has(code)) ignored.delete(code);
      for (const code of [...down.keys()]) {
        if (keys.has(code)) continue;
        down.delete(code);
        send('keyup', code, false);
      }
      for (const code of keys) {
        if (ignored.has(code)) continue;
        const next = down.get(code);
        if (next === undefined) {
          down.set(code, nowMs + KEY_REPEAT.delayMs);
          send('keydown', code, false);
        } else if (REPEATS.has(code) && nowMs >= next) {
          down.set(code, nowMs + KEY_REPEAT.everyMs);
          send('keydown', code, true);
        }
      }
    },
    rearm(keys) {
      for (const code of down.keys()) send('keyup', code, false);
      down.clear();
      ignored.clear();
      for (const code of keys) ignored.add(code);
    },
  };
}

/** The focused element, as far as a key's default action cares. */
export interface FocusedControl {
  tag: string;
  /** An input's type. */
  type?: string;
  /** A link with somewhere to go. */
  href?: boolean;
  disabled?: boolean;
}

/** Inputs a real Enter (or Space, which the pad has not) activates: the rest are fields to type in, or a file picker that only opens on a real gesture. */
const ACTIVATED_INPUTS = new Set(['button', 'submit', 'reset', 'image', 'checkbox', 'radio']);

/**
 * What the browser would have done with a real key that no screen took: a synthetic key runs no default action, so
 * a focused button never heard A (issue #32). Enter activates a focused control; the arrows and Tab move the focus
 * on, which is also how the pad leaves a text field it cannot type in. With nothing focused (the town, a cursor menu,
 * a run) nothing more happens.
 */
export function padKeyDefault(code: string, focused: FocusedControl | null): 'activate' | 'next' | 'previous' | null {
  if (!focused) return null;
  if (code === 'ArrowDown' || code === 'ArrowRight' || code === 'Tab') return 'next';
  if (code === 'ArrowUp' || code === 'ArrowLeft') return 'previous';
  if (code !== 'Enter' || focused.disabled) return null;
  const { tag } = focused;
  const activates = tag === 'BUTTON' || tag === 'SUMMARY' || (tag === 'A' && focused.href === true) || (tag === 'INPUT' && ACTIVATED_INPUTS.has(focused.type ?? 'text'));
  return activates ? 'activate' : null;
}

/** The page as the bridge sees it, so tests need no browser. */
export interface PadKeyPage<E = unknown> {
  focused(): E;
  /** The focused element as a control, or null for the page itself. */
  describe(element: E): FocusedControl | null;
  /** Dispatches the key on the element; false when a listener took it (`preventDefault`). */
  dispatch(element: E, type: 'keydown' | 'keyup', code: string, repeat: boolean): boolean;
  activate(element: E): void;
  moveFocus(element: E, step: 1 | -1): void;
}

/** One key of the pad: its event, then what a real key would do if no screen took it or moved the focus itself. */
export function sendPadKey<E>(page: PadKeyPage<E>, type: 'keydown' | 'keyup', code: string, repeat: boolean): void {
  const target = page.focused();
  const free = page.dispatch(target, type, code, repeat);
  if (type !== 'keydown' || !free || page.focused() !== target) return;
  const action = padKeyDefault(code, page.describe(target));
  if (action === 'activate' && !repeat) page.activate(target);
  else if (action === 'next' || action === 'previous') page.moveFocus(target, action === 'next' ? 1 : -1);
}

/** What the browser's own focus order would reach: visible, enabled, not hidden behind a window or made inert. */
const FOCUSABLE = 'button, a[href], summary, input, textarea, select, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const reachable = (el: HTMLElement): boolean =>
  !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert], [aria-hidden="true"]');

/** The page for the pad's keys: the focused element, kept inside the window it sits in (an open dialog owns the focus). */
export const browserPadKeyPage: PadKeyPage<Element | Window> = {
  focused: () => document.activeElement ?? window,
  describe(el) {
    if (!(el instanceof HTMLElement) || el === document.body) return null;
    return { tag: el.tagName, type: el instanceof HTMLInputElement ? el.type : undefined, href: el.hasAttribute('href'), disabled: (el as HTMLButtonElement).disabled === true };
  },
  dispatch: (el, type, code, repeat) => el.dispatchEvent(new KeyboardEvent(type, { code, key: keyOf(code), repeat, bubbles: true, cancelable: true })),
  activate: (el) => (el as HTMLElement).click(),
  moveFocus(el, step) {
    if (!(el instanceof HTMLElement)) return;
    const scope = el.closest('[aria-modal="true"], [role="dialog"], dialog') ?? document.body;
    const order = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((c) => c === el || reachable(c));
    const next = order[order.indexOf(el) + step];
    next?.focus();
    next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  },
};

/**
 * Losing the controller mid-run (issue #32, "a sensible pause"): true once when the last controller goes while it
 * plays (combat); losing it in a menu, a window or the town pauses nothing, then or later.
 */
export function padLossWatch(): { update(connected: number, combat: boolean): boolean } {
  let before = 0;
  return {
    update(connected, combat) {
      const lost = combat && before > 0 && connected === 0;
      before = connected;
      return lost;
    },
  };
}

export interface Gamepads {
  /** One combat step's frame; idle outside combat or without a controller. */
  take(): TouchFrame;
  /** True once after the last controller went away while it played (the run opens its menu). */
  lost(): boolean;
  /** In combat the pad plays; otherwise it acts as keys. */
  setCombat(combat: boolean): void;
  dispose(): void;
}

/** The first controller connected, read on every animation frame. */
export function createGamepads(options: { onConnect?(): void } = {}): Gamepads {
  const current = (): PadState | null => {
    const pad = navigator.getGamepads?.().find((p) => p !== null && p.connected);
    return pad ? readPad(pad) : null;
  };
  const emitter = keyEmitter((type, code, repeat) => sendPadKey(browserPadKeyPage, type, code, repeat));
  let combat = false;
  let memory = padMemory(null);
  let frameId = 0;
  const keysOf = (state: PadState | null): Set<string> => (!state ? new Set() : combat ? padCombatKeys(state) : padKeys(state));
  const loss = padLossWatch();
  let lost = false;
  const tick = (nowMs: number) => {
    if (loss.update((navigator.getGamepads?.() ?? []).filter((p) => p?.connected).length, combat)) lost = true;
    emitter.update(keysOf(current()), nowMs);
    frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);
  const onConnected = () => options.onConnect?.();
  window.addEventListener('gamepadconnected', onConnected);
  return {
    take() {
      if (!combat) return IDLE_TOUCH;
      const state = current();
      if (!state) {
        memory = padMemory(null);
        return IDLE_TOUCH;
      }
      const step = padFrame(state, memory);
      memory = step.memory;
      return step.frame;
    },
    lost() {
      const was = lost;
      lost = false;
      return was;
    },
    setCombat(next) {
      if (next === combat) return;
      combat = next;
      lost = false;
      const state = current();
      memory = padMemory(state);
      // What is held now belongs to the mode being left: it fires nothing in this one.
      emitter.rearm(state ? new Set([...padKeys(state), ...padCombatKeys(state)]) : new Set());
    },
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('gamepadconnected', onConnected);
      emitter.rearm(new Set());
    },
  };
}
