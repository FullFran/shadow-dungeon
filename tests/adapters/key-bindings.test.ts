import { afterEach, describe, expect, it } from 'vitest';
import {
  BIND_ACTIONS,
  DEFAULT_BINDINGS,
  bindingConflicts,
  bindingsHint,
  boundTo,
  codesOf,
  inputOf,
  mouseButtonsOf,
  primaryOf,
  rebind,
  resetBindings,
  sanitizeBindings,
  setActiveBindings,
  activeBindings,
  type Bindings,
} from '../../src/adapters/bindings';
import { toPlayerInput, type RawInput } from '../../src/adapters/input';
import { vec } from '../../src/core/vec';

const view = { x: 0, y: 0, width: 512, height: 320 };
const raw = (overrides: Partial<RawInput> = {}): RawInput => ({ keys: new Set(), buttons: new Set(), mouse: vec(0, 0), rollPressed: false, wheel: 0, ...overrides });

afterEach(() => setActiveBindings(DEFAULT_BINDINGS));

describe('key bindings: defaults (issue #62)', () => {
  it('pins the keyboard and mouse defaults exactly as they were before rebinding existed', () => {
    expect(DEFAULT_BINDINGS).toEqual({
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      fast: ['KeyQ', 'Mouse0'],
      heavy: ['KeyE', 'Mouse2'],
      boost: ['KeyR', 'Digit1'],
      area: ['KeyF', 'Digit2'],
      roll: ['Space', null],
      lock: ['ShiftLeft', 'Mouse1'],
      map: ['Tab', null],
      menu: ['Escape', null],
      mute: ['KeyM', null],
      interact: ['KeyE', null],
      run: ['ShiftLeft', null],
      spectate: ['KeyQ', null],
    });
    expect(Object.keys(DEFAULT_BINDINGS).sort()).toEqual([...BIND_ACTIONS].sort());
  });

  it('the defaults have no conflict (E, Q and Shift are shared only by actions of different places)', () => {
    expect(bindingConflicts(DEFAULT_BINDINGS)).toEqual([]);
  });

  it('with the defaults the play input is the one of before: WASD and arrows, Q/E/R/F/1/2, LMB/RMB, Shift either side and MMB lock', () => {
    const at = (keys: string[], buttons: number[] = []) => toPlayerInput(raw({ keys: new Set(keys), buttons: new Set(buttons) }), view, 1);
    expect(at(['KeyW']).move).toEqual({ x: 0, y: -1 });
    expect(at(['ArrowLeft']).move).toEqual({ x: -1, y: 0 });
    expect(at(['KeyD', 'ArrowRight']).move).toEqual({ x: 1, y: 0 });
    expect(at(['KeyA', 'KeyD']).move).toEqual({ x: 0, y: 0 });
    expect(at(['KeyQ']).slots).toEqual([true, false, false, false]);
    expect(at(['KeyE']).slots).toEqual([false, true, false, false]);
    expect(at(['KeyR']).slots).toEqual([false, false, true, false]);
    expect(at(['Digit2']).slots).toEqual([false, false, false, true]);
    expect(at([], [0]).slots).toEqual([true, false, false, false]);
    expect(at([], [0]).slotMouse).toEqual([true, false, false, false]);
    expect(at([], [2]).slotMouse).toEqual([false, true, false, false]);
    expect(at([], [0]).click).toBe(true);
    expect(at(['ShiftLeft']).lock).toBe(true);
    expect(at(['ShiftRight']).lock).toBe(true);
    expect(at([], [1]).lock).toBe(true);
    expect(at(['Space']).lock).toBe(false);
  });
});

describe('key bindings: rebinding', () => {
  it('a free key replaces the slot and the action answers to it, the old key no longer', () => {
    const result = rebind(DEFAULT_BINDINGS, 'roll', 0, 'KeyC');
    expect(result.kind).toBe('ok');
    if (result.kind === 'refused') return;
    expect(result.bindings.roll).toEqual(['KeyC', null]);
    expect(boundTo('roll', 'KeyC', result.bindings)).toBe(true);
    expect(boundTo('roll', 'Space', result.bindings)).toBe(false);
  });

  it('a key another action of the same place uses is swapped: that action takes the old key, and the player is told which', () => {
    const result = rebind(DEFAULT_BINDINGS, 'roll', 0, 'KeyQ');
    expect(result.kind).toBe('swapped');
    if (result.kind !== 'swapped') return;
    expect(result.bindings.roll[0]).toBe('KeyQ');
    expect(result.bindings.fast[0]).toBe('Space');
    expect(result.other).toEqual({ action: 'fast', slot: 0 });
    expect(bindingConflicts(result.bindings)).toEqual([]);
  });

  it('a key shared only with an action of another place is no conflict (E heavy in a run, E talk in the town)', () => {
    const result = rebind(DEFAULT_BINDINGS, 'interact', 0, 'KeyQ');
    expect(result.kind).toBe('ok');
  });

  it('a swap that would clash elsewhere clears the other slot instead', () => {
    // Tab (the map, every place) onto the fast slot: Q would go to the map, but Q is the spectate key there.
    const result = rebind(DEFAULT_BINDINGS, 'fast', 0, 'Tab');
    expect(result.kind).toBe('swapped');
    if (result.kind !== 'swapped') return;
    expect(result.bindings.map[0]).toBe(null);
    expect(bindingConflicts(result.bindings)).toEqual([]);
  });

  it('the same key on the other slot of the same action swaps the two slots', () => {
    const result = rebind(DEFAULT_BINDINGS, 'fast', 1, 'KeyQ');
    expect(result.kind).toBe('swapped');
    if (result.kind === 'refused') return;
    expect(result.bindings.fast).toEqual(['Mouse0', 'KeyQ']);
  });

  it('refuses the reserved keys (Esc cancels, Enter confirms, F1/F3/F11 belong to help, overlay and fullscreen)', () => {
    for (const code of ['Escape', 'Enter', 'NumpadEnter', 'F1', 'F3', 'F11', 'MetaLeft']) {
      expect(rebind(DEFAULT_BINDINGS, 'roll', 0, code)).toEqual({ kind: 'refused', reason: 'reserved' });
    }
  });

  it('mouse buttons only bind combat actions (the town and the menus read no mouse button)', () => {
    expect(rebind(DEFAULT_BINDINGS, 'roll', 1, 'Mouse3').kind).toBe('ok');
    expect(rebind(DEFAULT_BINDINGS, 'interact', 1, 'Mouse3')).toEqual({ kind: 'refused', reason: 'mouse' });
    expect(rebind(DEFAULT_BINDINGS, 'map', 1, 'Mouse4')).toEqual({ kind: 'refused', reason: 'mouse' });
  });

  it('the menu keeps Esc fixed: only its second key can change', () => {
    expect(rebind(DEFAULT_BINDINGS, 'menu', 0, 'KeyP')).toEqual({ kind: 'refused', reason: 'fixed' });
    expect(rebind(DEFAULT_BINDINGS, 'menu', 1, 'KeyP').kind).toBe('ok');
  });

  it('the right-hand Shift, Ctrl and Alt bind as the left one, so either side works', () => {
    const result = rebind(DEFAULT_BINDINGS, 'roll', 0, 'ControlRight');
    if (result.kind === 'refused') throw new Error('refused');
    expect(result.bindings.roll[0]).toBe('ControlLeft');
    expect(boundTo('roll', 'ControlRight', result.bindings)).toBe(true);
    expect(boundTo('roll', 'ControlLeft', result.bindings)).toBe(true);
  });

  it('resetBindings gives back every default', () => {
    expect(resetBindings()).toEqual(DEFAULT_BINDINGS);
  });
});

describe('key bindings: the play input reads the active table', () => {
  it('rebinding the slots, the roll and the lock changes what toPlayerInput reports, and mouse buttons aim', () => {
    let table: Bindings = DEFAULT_BINDINGS;
    for (const [action, slot, input] of [
      ['fast', 0, 'KeyJ'],
      ['heavy', 1, 'Mouse4'],
      ['lock', 0, 'KeyL'],
      ['up', 0, 'KeyI'],
    ] as const) {
      const result = rebind(table, action, slot, input);
      if (result.kind === 'refused') throw new Error(action);
      table = result.bindings;
    }
    setActiveBindings(table);
    expect(activeBindings()).toBe(table);
    const at = (keys: string[], buttons: number[] = []) => toPlayerInput(raw({ keys: new Set(keys), buttons: new Set(buttons) }), view, 1);
    expect(at(['KeyJ']).slots[0]).toBe(true);
    expect(at(['KeyQ']).slots[0]).toBe(false);
    expect(at([], [4]).slots[1]).toBe(true);
    expect(at([], [4]).slotMouse[1]).toBe(true);
    expect(at([], [2]).slots[1]).toBe(false);
    expect(at(['KeyL']).lock).toBe(true);
    expect(at(['ShiftLeft']).lock).toBe(false);
    expect(at(['KeyI']).move).toEqual({ x: 0, y: -1 });
    expect(at(['KeyW']).move).toEqual({ x: 0, y: 0 });
    expect(at(['ArrowUp']).move).toEqual({ x: 0, y: -1 });
  });

  it('synthetic key events (the gamepad sends Esc and Tab) always resolve through the defaults', () => {
    const result = rebind(DEFAULT_BINDINGS, 'map', 0, 'KeyN');
    if (result.kind === 'refused') throw new Error('refused');
    setActiveBindings(result.bindings);
    expect(boundTo('map', 'Tab')).toBe(false);
    expect(boundTo('map', 'Tab', activeBindings(), false)).toBe(true);
    expect(boundTo('map', 'KeyN')).toBe(true);
  });
});

describe('key bindings: lookups and labels', () => {
  it('codes, mouse buttons and the primary input of an action', () => {
    expect(codesOf('lock')).toEqual(['ShiftLeft', 'ShiftRight']);
    expect(mouseButtonsOf('lock')).toEqual([1]);
    expect(primaryOf('fast')).toBe('KeyQ');
    expect(inputOf(0)).toBe('Mouse0');
  });

  it('the hint of an action names every bound input in brackets', () => {
    const tr = (key: string) => ({ 'bind.mouse.0': 'Clic izquierdo', 'bind.or': 'o', 'bind.key.Space': 'Espacio', 'bind.arrows': 'flechas' })[key] ?? key;
    expect(bindingsHint('fast', DEFAULT_BINDINGS, tr)).toBe('[Q] o [Clic izquierdo]');
    expect(bindingsHint('roll', DEFAULT_BINDINGS, tr)).toBe('[Espacio]');
    expect(bindingsHint('move', DEFAULT_BINDINGS, tr)).toBe('[WASD] o [flechas]');
    expect(bindingsHint('move', DEFAULT_BINDINGS, (k) => k === 'bind.or' ? 'o' : k)).toBe('[WASD] o [↑←↓→]');
  });
});

describe('key bindings: sanitize', () => {
  it('keeps valid stored slots and drops the rest to the default, never leaving a conflict', () => {
    const stored = { roll: ['KeyC', null], fast: ['Escape', 'Mouse0'], heavy: 'nope', nonsense: ['KeyZ', null], lock: ['KeyC', 'Mouse1'], menu: ['KeyP', 'KeyO'] };
    const clean = sanitizeBindings(stored);
    expect(clean.roll).toEqual(['KeyC', null]);
    // Reserved Esc is not kept.
    expect(clean.fast).toEqual(DEFAULT_BINDINGS.fast);
    expect(clean.heavy).toEqual(DEFAULT_BINDINGS.heavy);
    // The menu's first key stays Esc.
    expect(clean.menu).toEqual(['Escape', 'KeyO']);
    expect(bindingConflicts(clean)).toEqual([]);
    expect(sanitizeBindings(undefined)).toEqual(DEFAULT_BINDINGS);
    expect(sanitizeBindings('x')).toEqual(DEFAULT_BINDINGS);
  });
});
