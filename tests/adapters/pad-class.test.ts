import { describe, expect, it } from 'vitest';
import { installPadClass, type PadClassEnv } from '../../src/adapters/pad-class';
import type { LastDevice } from '../../src/adapters/last-device';

/** A fake page: listeners, connected pads, frames requested and the html classes. */
function fakeEnv(padsAtStart = 0) {
  const listeners = new Map<string, Set<() => void>>();
  const frames = new Map<number, () => void>();
  let nextFrame = 1;
  let requested = 0;
  let pads = padsAtStart;
  let device: LastDevice = 'keyboard';
  let disposed = false;
  const classes = new Set<string>();
  const env: PadClassEnv = {
    root: { classList: { toggle: (name: string, on?: boolean) => (on ? classes.add(name) : classes.delete(name), !!on) } },
    addEventListener: (type, fn) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn),
    removeEventListener: (type, fn) => void listeners.get(type)?.delete(fn),
    connectedPads: () => pads,
    requestAnimationFrame: (fn) => {
      requested++;
      const id = nextFrame++;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame: (id) => void frames.delete(id),
    tracker: () => ({ current: () => device, poll: () => {}, dispose: () => void (disposed = true) }),
  };
  const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
  const runFrames = () => {
    const due = [...frames.entries()];
    frames.clear();
    for (const [, fn] of due) fn();
  };
  return {
    env,
    classes,
    connect: () => (pads++, fire('gamepadconnected')),
    disconnect: () => (pads--, fire('gamepaddisconnected')),
    use: (next: LastDevice) => void (device = next),
    runFrames,
    pending: () => frames.size,
    requested: () => requested,
    disposed: () => disposed,
  };
}

describe('installPadClass', () => {
  it('requests no frame while no pad is connected', () => {
    const page = fakeEnv();
    installPadClass(page.env);
    expect(page.requested()).toBe(0);
    expect(page.pending()).toBe(0);
  });

  it('starts at install when a pad is already connected', () => {
    const page = fakeEnv(1);
    installPadClass(page.env);
    expect(page.pending()).toBe(1);
  });

  it('runs while a pad is connected, sets html.pad, and stops and drops it after the last disconnect', () => {
    const page = fakeEnv();
    installPadClass(page.env);
    page.connect();
    page.connect();
    expect(page.pending()).toBe(1);
    page.use('gamepad');
    page.runFrames();
    expect(page.classes.has('pad')).toBe(true);
    expect(page.pending()).toBe(1);
    page.disconnect();
    expect(page.pending()).toBe(1);
    page.disconnect();
    expect(page.pending()).toBe(0);
    expect(page.classes.has('pad')).toBe(false);
    const before = page.requested();
    page.runFrames();
    expect(page.requested()).toBe(before);
  });

  it('the keyboard or touch used last turns html.pad off', () => {
    const page = fakeEnv(1);
    installPadClass(page.env);
    page.use('gamepad');
    page.runFrames();
    page.use('touch');
    page.runFrames();
    expect(page.classes.has('pad')).toBe(false);
  });

  it('dispose stops the loop and the listeners', () => {
    const page = fakeEnv(1);
    const dispose = installPadClass(page.env);
    dispose();
    expect(page.pending()).toBe(0);
    expect(page.disposed()).toBe(true);
    page.connect();
    expect(page.pending()).toBe(0);
  });
});
