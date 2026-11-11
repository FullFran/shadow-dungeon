import { portraitAssetUrl } from './bundled-art';
import { portraitFor, type PortraitEmotion } from '../data/portraits';
import { SPECIES, type SpeciesId } from '../data/species';
import { lookKey, SPRITE_KEYS, SPRITES } from '../data/sprites';
import '../styles/face-portrait.css';
import { opaqueBounds } from '../ui/sprite-bounds';
import { TYPE_COLORS } from '../ui/tokens';
import { sheetImage, sheetKey, type SheetStore } from './assets';
import { frameAtTime } from './sprite-anim';

/** The URL the browser loads a portrait from (one place, so a sprite loader can later route it). */
/** A bundled portrait (src/data/bundled-art.ts); an empty URL makes the img fail, so the head crop takes over. */
export const portraitUrl = (file: string): string => portraitAssetUrl(file) ?? '';

/**
 * A speaker's Mystery Dungeon portrait for a dialogue line (issue #47): the image of that look in that emotion (Normal
 * when it has none), or null when the look has no portrait at all, so the view shows no frame. The file loads only now,
 * when the line is shown: nothing is fetched up front. `onFail` runs if it fails to load (the view hides the frame).
 */
export function speakerFace(spriteKey: string, emotion: PortraitEmotion, onFail: () => void): HTMLImageElement | null {
  const found = portraitFor(spriteKey, emotion);
  const url = found ? portraitUrl(found.file) : '';
  if (!url) return null;
  const img = document.createElement('img');
  img.className = 'speaker-face';
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('error', onFail, { once: true });
  img.src = url;
  return img;
}

export interface FaceOptions {
  /** Outer side of the frame in CSS px. */
  size: number;
  shiny?: boolean;
  female?: boolean;
  /** Sheets for the cropped-head fallback (a portrait file that is missing or fails to load). */
  sheets?: Promise<SheetStore>;
  /** Extra class on the frame. */
  className?: string;
}

/**
 * The species' face in a framed relic avatar (owner, 2026-11-04; .agents/DESIGN.md §4 "Face avatar"): the PMDCollab
 * portrait (src/data/portraits.ts) crisp and pixelated inside a gilt ring with the first type's colour as its inner
 * edge. With no portrait for the look, or when the file fails to load, the head of the idle frame is cropped
 * instead; never a broken image. This is the one place portraits load, so a loader can route it later.
 */
export function facePortrait(species: SpeciesId, options: FaceOptions): HTMLElement {
  const def = SPECIES[species];
  const key = lookKey(SPRITE_KEYS[def.sprite], options.shiny ?? false, options.female ?? false);
  const frame = document.createElement('span');
  frame.className = `face${options.className ? ` ${options.className}` : ''}`;
  frame.style.setProperty('--face-size', `${options.size}px`);
  frame.style.setProperty('--face-edge', TYPE_COLORS[def.types[0] ?? 'normal'].core);
  frame.setAttribute('aria-hidden', 'true');
  const head = () => {
    frame.replaceChildren(headCrop(key, options.sheets));
    frame.dataset.source = 'head';
  };
  const found = portraitFor(key);
  if (!found) {
    head();
    return frame;
  }
  const img = document.createElement('img');
  img.className = 'face-img';
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('error', head, { once: true });
  img.src = portraitUrl(found.file);
  frame.dataset.source = found.kind;
  frame.append(img);
  return frame;
}

/** The top of the idle frame, cropped to what the animation covers: the head, when no face portrait exists. */
function headCrop(key: string, sheets: Promise<SheetStore> | undefined): HTMLElement {
  const meta = SPRITES.sprites[key]?.anims.Idle;
  const canvas = document.createElement('canvas');
  canvas.className = 'face-img face-head';
  canvas.width = canvas.height = 1;
  if (!meta || !sheets) return canvas;
  void sheets.then((store) => {
    const image = store.get(sheetKey(key, meta.file));
    const ctx = canvas.getContext('2d');
    if (!image || !ctx) return;
    const b = opaqueBounds(image, meta.frameCount, meta.frameWidth, meta.frameHeight);
    const side = Math.min(b.w, Math.max(8, Math.round(b.h * 0.6)));
    canvas.width = canvas.height = side;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, b.x + Math.round((b.w - side) / 2), b.y, side, side, 0, 0, side, side);
  });
  return canvas;
}

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
  void sheets.then(async (store) => {
    const image = await sheetImage(store, sheetKey(spriteKey, meta.file));
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
