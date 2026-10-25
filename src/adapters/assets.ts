import { SPRITES } from '../data/sprites';

/** Loaded sprite sheets by "<dex>/<form>/<file>". Missing sheets are skipped, the renderer draws a placeholder. */
export type SheetStore = ReadonlyMap<string, HTMLImageElement>;

export const sheetKey = (sprite: string, file: string): string => `${sprite}/${file}`;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Loads every sheet listed in the sprite meta from public/sprites. */
export async function loadSheets(): Promise<SheetStore> {
  const base = `${import.meta.env.BASE_URL}sprites/`;
  const files = new Set<string>();
  for (const [sprite, meta] of Object.entries(SPRITES.sprites)) {
    for (const anim of Object.values(meta.anims)) files.add(sheetKey(sprite, anim.file));
  }
  const entries = await Promise.all([...files].map(async (key) => [key, await loadImage(base + key)] as const));
  const store = new Map<string, HTMLImageElement>();
  for (const [key, image] of entries) if (image) store.set(key, image);
  return store;
}
