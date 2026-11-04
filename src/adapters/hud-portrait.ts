import type { PlayerState } from '../core/state';
import { SPRITES } from '../data/sprites';
import { spriteFit } from '../ui/sprite-fit';
import type { HudBox } from '../ui/hud-layout';
import { sheetKey, type SheetStore } from './assets';
import { frameAtTime } from './sprite-anim';
import { playerSprite } from './sprite-anim';

/**
 * The partner's portrait in the status window and the co-op frames (.agents/DESIGN.md §4 "Sprite fit rule"): the idle
 * animation drawn whole inside a fixed box, cropped to the pixels the animation really covers so the box fits the
 * creature itself, standing on the bottom edge. Never cropped, never stretched.
 */
export type PortraitDrawer = (ctx: CanvasRenderingContext2D, player: Pick<PlayerState, 'species' | 'disguiseBroken' | 'shiny' | 'female'>, box: HudBox, timeMs: number, dim?: boolean) => void;

interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The union of the opaque pixels of every idle frame, in frame pixels (cached per sheet). */
function opaqueCrop(image: HTMLImageElement, frames: number, fw: number, fh: number): Crop {
  const scratch = document.createElement('canvas');
  scratch.width = fw * frames;
  scratch.height = fh;
  const c = scratch.getContext('2d', { willReadFrequently: true });
  if (!c) return { x: 0, y: 0, w: fw, h: fh };
  c.drawImage(image, 0, 0, fw * frames, fh, 0, 0, fw * frames, fh);
  const data = c.getImageData(0, 0, fw * frames, fh).data;
  let minX = fw;
  let minY = fh;
  let maxX = -1;
  let maxY = -1;
  for (let f = 0; f < frames; f++)
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        if ((data[((y * fw * frames) + f * fw + x) * 4 + 3] ?? 0) < 16) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return maxX < 0 ? { x: 0, y: 0, w: fw, h: fh } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function createPortraitDrawer(sheets: SheetStore): PortraitDrawer {
  const crops = new Map<string, Crop>();
  return (ctx, player, box, timeMs, dim = false) => {
    const sprite = playerSprite(player);
    const meta = SPRITES.sprites[sprite]?.anims.Idle;
    const image = meta && sheets.get(sheetKey(sprite, meta.file));
    if (!meta || !image) return;
    let crop = crops.get(sprite);
    if (!crop) {
      crop = opaqueCrop(image, meta.frameCount, meta.frameWidth, meta.frameHeight);
      crops.set(sprite, crop);
    }
    const fit = spriteFit(crop.w, crop.h, box.width, box.height);
    const frame = frameAtTime(meta.durations, timeMs, true);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (dim) ctx.globalAlpha *= 0.45;
    ctx.drawImage(image, frame * meta.frameWidth + crop.x, crop.y, crop.w, crop.h, Math.round(box.x + fit.x), Math.round(box.y + fit.y), Math.round(fit.width), Math.round(fit.height));
    ctx.restore();
  };
}
