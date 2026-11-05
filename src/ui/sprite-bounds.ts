/** The pixels an idle animation really covers (union of every frame's opaque area), in frame coordinates. */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
const boundsCache = new WeakMap<CanvasImageSource, Bounds>();

export function opaqueBounds(image: CanvasImageSource, frames: number, fw: number, fh: number): Bounds {
  const cached = boundsCache.get(image);
  if (cached) return cached;
  const probe = document.createElement('canvas');
  probe.width = fw;
  probe.height = fh;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  let x0 = fw;
  let y0 = fh;
  let x1 = -1;
  let y1 = -1;
  if (ctx) {
    for (let f = 0; f < frames; f++) {
      ctx.clearRect(0, 0, fw, fh);
      ctx.drawImage(image, f * fw, 0, fw, fh, 0, 0, fw, fh);
      const data = ctx.getImageData(0, 0, fw, fh).data;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          if (data[(y * fw + x) * 4 + 3]! > 8) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
        }
      }
    }
  }
  const bounds = x1 < 0 ? { x: 0, y: 0, w: fw, h: fh } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  boundsCache.set(image, bounds);
  return bounds;
}

