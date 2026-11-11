import { trackLastDevice, type DeviceTracker } from './last-device';

/** What the pad class needs from the page, so tests can fake it. */
export interface PadClassEnv {
  root: { classList: { toggle(name: string, force?: boolean): boolean } };
  addEventListener(type: 'gamepadconnected' | 'gamepaddisconnected', listener: () => void): void;
  removeEventListener(type: 'gamepadconnected' | 'gamepaddisconnected', listener: () => void): void;
  /** How many controllers are connected now. */
  connectedPads(): number;
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(id: number): void;
  tracker(): Pick<DeviceTracker, 'current' | 'poll' | 'dispose'>;
}

const browserEnv = (): PadClassEnv => ({
  root: document.documentElement,
  addEventListener: (type, listener) => window.addEventListener(type, listener),
  removeEventListener: (type, listener) => window.removeEventListener(type, listener),
  connectedPads: () => (navigator.getGamepads?.() ?? []).filter((pad) => pad?.connected).length,
  requestAnimationFrame: (callback) => requestAnimationFrame(callback),
  cancelAnimationFrame: (id) => cancelAnimationFrame(id),
  tracker: trackLastDevice,
});

/**
 * Keeps `html.pad` on while the controller is the device used last (src/adapters/last-device.ts), for the whole page,
 * so a dual hint (src/ui/device-hint.ts) shows its pad wording on every screen and in a run. The frame loop that reads
 * the pad runs only while a controller is connected: a page without one (most phones) requests no frames at all.
 */
export function installPadClass(env: PadClassEnv = browserEnv()): () => void {
  const device = env.tracker();
  let frame = 0;
  const tick = () => {
    device.poll();
    env.root.classList.toggle('pad', device.current() === 'gamepad');
    frame = env.requestAnimationFrame(tick);
  };
  const start = () => {
    if (!frame) frame = env.requestAnimationFrame(tick);
  };
  const stop = () => {
    if (frame) env.cancelAnimationFrame(frame);
    frame = 0;
    env.root.classList.toggle('pad', false);
  };
  const onDisconnect = () => {
    if (env.connectedPads() === 0) stop();
  };
  env.addEventListener('gamepadconnected', start);
  env.addEventListener('gamepaddisconnected', onDisconnect);
  if (env.connectedPads() > 0) start();
  return () => {
    stop();
    env.removeEventListener('gamepadconnected', start);
    env.removeEventListener('gamepaddisconnected', onDisconnect);
    device.dispose();
  };
}
