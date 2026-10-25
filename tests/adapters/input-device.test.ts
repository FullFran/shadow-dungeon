import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachInput } from '../../src/adapters/input';

/** Minimal DOM stand-ins (the suite runs in node): plain EventTargets and Events with the fields input.ts reads. */
function fakeCanvas(): HTMLCanvasElement {
  return Object.assign(new EventTarget(), {
    width: 100,
    height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}

const key = (type: string, code: string) => Object.assign(new Event(type, { cancelable: true }), { code, repeat: false });
const mouse = (type: string, button: number) => Object.assign(new Event(type, { cancelable: true }), { button, clientX: 10, clientY: 20 });

describe('input device while the menu is open', () => {
  let win: EventTarget;
  beforeEach(() => {
    win = Object.assign(new EventTarget(), { innerHeight: 600 });
    vi.stubGlobal('window', win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('suspending clears held keys and buttons and ignores input until resumed', () => {
    const canvas = fakeCanvas();
    const device = attachInput(canvas);
    win.dispatchEvent(key('keydown', 'KeyW'));
    win.dispatchEvent(key('keydown', 'Space'));
    canvas.dispatchEvent(mouse('mousedown', 0));
    expect(device.take().keys.has('KeyW')).toBe(true);

    win.dispatchEvent(key('keydown', 'ShiftLeft'));
    device.setSuspended(true);
    const open = device.take();
    expect([...open.keys]).toEqual([]);
    expect([...open.buttons]).toEqual([]);
    expect(open.rollPressed).toBe(false);

    // Clicks and keys while the menu is up never reach the game.
    canvas.dispatchEvent(mouse('mousedown', 0));
    win.dispatchEvent(key('keydown', 'KeyD'));
    win.dispatchEvent(key('keydown', 'Space'));
    const during = device.take();
    expect([...during.keys]).toEqual([]);
    expect([...during.buttons]).toEqual([]);
    expect(during.rollPressed).toBe(false);

    device.setSuspended(false);
    const closed = device.take();
    expect([...closed.keys]).toEqual([]);
    expect([...closed.buttons]).toEqual([]);
    win.dispatchEvent(key('keydown', 'KeyA'));
    expect([...device.take().keys]).toEqual(['KeyA']);
    device.dispose();
  });
});
