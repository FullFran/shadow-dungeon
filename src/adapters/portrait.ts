import { SPRITES } from '../data/sprites';
import { sheetKey, type SheetStore } from './assets';
import { frameAtTime } from './sprite-anim';

/**
 * A sprite's idle animation (first direction row) on a small canvas scaled
 * by a whole number, drawn from the loaded sheets. With no sprite data for
 * `spriteKey` (a species not fetched yet) it returns a "?" silhouette box.
 */
export function idlePortrait(spriteKey: string | null, sheets: Promise<SheetStore>, scale = 3): HTMLElement {
  const meta = spriteKey ? SPRITES.sprites[spriteKey]?.anims.Idle : undefined;
  if (!spriteKey || !meta) {
    const missing = document.createElement('div');
    missing.className = 'portrait-missing';
    missing.textContent = '?';
    return missing;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'portrait';
  canvas.width = meta.frameWidth;
  canvas.height = meta.frameHeight;
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  void sheets.then((store) => {
    const image = store.get(sheetKey(spriteKey, meta.file));
    const ctx = canvas.getContext('2d');
    if (!image || !ctx) return;
    const start = performance.now();
    const frame = (now: number) => {
      if (!canvas.isConnected) return;
      const f = frameAtTime(meta.durations, now - start, true);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, f * meta.frameWidth, 0, meta.frameWidth, meta.frameHeight, 0, 0, meta.frameWidth, meta.frameHeight);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return canvas;
}
