import { trackLastDevice } from './last-device';

/**
 * Keeps `html.pad` on while the controller is the device used last (src/adapters/last-device.ts), for the whole page,
 * so a dual hint (src/ui/device-hint.ts) shows its pad wording on every screen and in a run.
 */
export function installPadClass(root: HTMLElement = document.documentElement): () => void {
  const device = trackLastDevice();
  let frame = 0;
  const tick = () => {
    device.poll();
    root.classList.toggle('pad', device.current() === 'gamepad');
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    device.dispose();
  };
}
