import { describe, expect, it, vi } from 'vitest';
import { enterImmersive, toggleFullscreen, type FullscreenDeps, type ImmersiveDeps } from '../../src/ui/fullscreen';

function deps(o: Partial<ImmersiveDeps> = {}): ImmersiveDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    standalone: false,
    fullscreenElement: null,
    requestFullscreen: vi.fn(() => {
      calls.push('fullscreen');
      return Promise.resolve();
    }),
    lockOrientation: vi.fn(() => {
      calls.push('lock');
      return Promise.resolve();
    }),
    ...o,
  };
}

describe('immersive mode on a phone run (fullscreen + landscape lock)', () => {
  it('asks for fullscreen, then locks landscape', async () => {
    const d = deps();
    await enterImmersive(d);
    expect(d.calls).toEqual(['fullscreen', 'lock']);
  });

  it('does nothing when installed (standalone) or already fullscreen, beyond the orientation lock', async () => {
    const installed = deps({ standalone: true });
    await enterImmersive(installed);
    expect(installed.calls).toEqual(['lock']);
    const already = deps({ fullscreenElement: {} });
    await enterImmersive(already);
    expect(already.calls).toEqual(['lock']);
  });

  it('is a quiet no-op where the browser offers neither (iPhone Safari)', async () => {
    await expect(enterImmersive(deps({ requestFullscreen: null, lockOrientation: null }))).resolves.toBeUndefined();
  });

  it('never throws when the browser refuses', async () => {
    const d = deps({ requestFullscreen: () => Promise.reject(new Error('no gesture')), lockOrientation: () => Promise.reject(new Error('not supported')) });
    await expect(enterImmersive(d)).resolves.toBeUndefined();
  });
});

describe('the fullscreen toggle (hub button, play view button, F11, Alt+Enter)', () => {
  const toggle = (o: Partial<FullscreenDeps> = {}) => {
    const calls: string[] = [];
    const d: FullscreenDeps = {
      fullscreenElement: null,
      request: () => (calls.push('enter'), Promise.resolve()),
      exit: () => (calls.push('exit'), Promise.resolve()),
      ...o,
    };
    return { d, calls };
  };

  it('enters when the page is not fullscreen and leaves when it is', async () => {
    const out = toggle();
    await expect(toggleFullscreen(out.d)).resolves.toBe(true);
    expect(out.calls).toEqual(['enter']);
    const inside = toggle({ fullscreenElement: {} });
    await expect(toggleFullscreen(inside.d)).resolves.toBe(true);
    expect(inside.calls).toEqual(['exit']);
  });

  it('says false, never throws, where the browser refuses or has no Fullscreen API', async () => {
    await expect(toggleFullscreen(toggle({ request: () => Promise.reject(new Error('no gesture')) }).d)).resolves.toBe(false);
    await expect(toggleFullscreen(toggle({ request: null, exit: null }).d)).resolves.toBe(false);
  });
});
