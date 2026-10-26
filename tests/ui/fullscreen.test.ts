import { describe, expect, it, vi } from 'vitest';
import { enterImmersive, type ImmersiveDeps } from '../../src/ui/fullscreen';

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
