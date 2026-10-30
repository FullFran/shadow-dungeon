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

export interface Gamepads {
  /** One combat step's frame; idle outside combat or without a controller. */
  take(): TouchFrame;
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
  const emitter = keyEmitter((type, code, repeat) => {
    (document.activeElement ?? window).dispatchEvent(new KeyboardEvent(type, { code, key: keyOf(code), repeat, bubbles: true, cancelable: true }));
  });
  let combat = false;
  let memory = padMemory(null);
  let frameId = 0;
  const keysOf = (state: PadState | null): Set<string> => (!state ? new Set() : combat ? padCombatKeys(state) : padKeys(state));
  const tick = (nowMs: number) => {
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
    setCombat(next) {
      if (next === combat) return;
      combat = next;
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
