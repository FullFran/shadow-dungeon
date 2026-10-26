import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachInput, toPlayerInput, type RawInput } from '../../src/adapters/input';
import { IDLE_TOUCH, mergeInputs, touchToPlayerInput, type TouchAimContext } from '../../src/adapters/touch';
import { vec } from '../../src/core/vec';

/**
 * Playtest 2026-10-26 ("solo me iba a la derecha"): the adapters' part of the
 * roll direction. Arrow keys move in the dungeon too, and the mouse aim counts
 * as a live pointer (a neutral roll goes at it) only while the mouse moved
 * after the last direction key; touch never claims it.
 */
const view = { x: 0, y: 0, width: 512, height: 320 };
const raw = (overrides: Partial<RawInput> = {}): RawInput => ({ keys: new Set(), buttons: new Set(), mouse: vec(0, 0), rollPressed: false, wheel: 0, ...overrides });

describe('arrow keys move in the dungeon, like in the town', () => {
  const move = (...codes: string[]) => toPlayerInput(raw({ keys: new Set(codes) }), view, 1).move;
  it('maps each arrow to its axis', () => {
    expect(move('ArrowLeft')).toEqual({ x: -1, y: 0 });
    expect(move('ArrowRight')).toEqual({ x: 1, y: 0 });
    expect(move('ArrowUp')).toEqual({ x: 0, y: -1 });
    expect(move('ArrowDown')).toEqual({ x: 0, y: 1 });
    expect(move('ArrowUp', 'ArrowLeft')).toEqual({ x: -1, y: -1 });
  });
  it('arrows and WASD on the same side do not add up past 1; opposite sides cancel', () => {
    expect(move('KeyA', 'ArrowLeft')).toEqual({ x: -1, y: 0 });
    expect(move('KeyA', 'ArrowRight')).toEqual({ x: 0, y: 0 });
  });
});

describe('aimPointer from the raw input', () => {
  it('follows the raw pointerLive flag (absent = false)', () => {
    expect(toPlayerInput(raw(), view, 1).aimPointer).toBe(false);
    expect(toPlayerInput(raw({ pointerLive: true }), view, 1).aimPointer).toBe(true);
  });
});

describe('the input device tracks whether the mouse aim is live', () => {
  let win: EventTarget;
  const canvas = () =>
    Object.assign(new EventTarget(), { width: 100, height: 100, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }) as unknown as HTMLCanvasElement;
  const key = (type: string, code: string, repeat = false) => Object.assign(new Event(type, { cancelable: true }), { code, repeat });
  const mouseMove = () => Object.assign(new Event('mousemove'), { clientX: 30, clientY: 40 });
  beforeEach(() => {
    win = Object.assign(new EventTarget(), { innerHeight: 600 });
    vi.stubGlobal('window', win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is off until the mouse moves, then on until a direction key is pressed', () => {
    const device = attachInput(canvas());
    expect(device.take().pointerLive).toBe(false);
    win.dispatchEvent(mouseMove());
    expect(device.take().pointerLive).toBe(true);
    // Space and the slot keys keep the cursor as the aim.
    win.dispatchEvent(key('keydown', 'Space'));
    expect(device.take().pointerLive).toBe(true);
    win.dispatchEvent(key('keydown', 'KeyD'));
    expect(device.take().pointerLive).toBe(false);
    win.dispatchEvent(mouseMove());
    expect(device.take().pointerLive).toBe(true);
    win.dispatchEvent(key('keydown', 'ArrowUp'));
    expect(device.take().pointerLive).toBe(false);
    device.dispose();
  });

  it('records arrow keys as held game keys', () => {
    const device = attachInput(canvas());
    const down = key('keydown', 'ArrowLeft');
    win.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(device.take().keys.has('ArrowLeft')).toBe(true);
    device.dispose();
  });
});

describe('touch never claims a live pointer', () => {
  const ctx: TouchAimContext = { view, pixelScale: 2, playerPos: { x: 100, y: 100 }, facing: { x: 1, y: 0 }, enemies: [], lockType: 'toggle', locked: false, autoAim: true };
  it('a touch frame has no pointer aim', () => {
    expect(touchToPlayerInput({ ...IDLE_TOUCH, roll: true }, ctx).aimPointer).toBe(false);
  });
  it('the merged input keeps the mouse pointer unless touch takes the aim', () => {
    const mouse = toPlayerInput(raw({ pointerLive: true }), view, 1);
    expect(mergeInputs(mouse, touchToPlayerInput({ ...IDLE_TOUCH, roll: true }, ctx)).aimPointer).toBe(true);
    expect(mergeInputs(mouse, touchToPlayerInput({ ...IDLE_TOUCH, fast: true }, ctx)).aimPointer).toBe(false);
  });
  it('joystick held while tapping roll: the merged input keeps the joystick direction and the roll edge', () => {
    const keyboard = toPlayerInput(raw(), view, 1);
    const merged = mergeInputs(keyboard, touchToPlayerInput({ ...IDLE_TOUCH, move: { x: -0.8, y: 0 }, roll: true }, ctx));
    expect(merged.move).toEqual({ x: -0.8, y: 0 });
    expect(merged.roll).toBe(true);
  });
});
