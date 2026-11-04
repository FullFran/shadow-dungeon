import { SPRITES } from '../data/sprites';
import { PALETTE } from '../ui/tokens';
import { createAssetLoader, type AssetState, type Priority } from './asset-loader';
import { sheetKey } from './asset-keys';
import { appError, reportError } from './net-error';
import { hubKeys, idlePrefetchKeys, runKeys } from './sprite-sets';
import type { DungeonDef } from '../data/dungeons';
import type { SpeciesId } from '../data/species';

export { sheetKey };

/**
 * The shared image loader of the game (odd/tasks/loading-errors.md). Every
 * sprite sheet, town tile and portrait comes through here: one cache, one
 * request per URL, `high` before `low` priority, one retry, and a dim
 * silhouette when an image cannot be had (reported once to the error model,
 * `asset` kind). Nothing loads at boot unless a screen asks for it.
 */
export type SheetImage = HTMLImageElement | HTMLCanvasElement;

/**
 * What draw paths read: `get` returns the sheet when it is here (and otherwise
 * starts loading it for the next frame). `load` resolves once it is. A plain
 * Map satisfies the read half, which is what tests and tools pass.
 */
export interface SheetStore {
  get(key: string): SheetImage | undefined;
  load?(key: string): Promise<SheetImage>;
  /** True while the sheet is still on its way (a draw path then skips it instead of drawing a "missing" mark). */
  pending?(key: string): boolean;
}

/** The sheet as an image once it is available: through `load` where the store has one, else what `get` has now. */
export function sheetImage(store: SheetStore, key: string): Promise<SheetImage | undefined> {
  return store.load ? store.load(key) : Promise.resolve(store.get(key));
}

const SHEET_BASE = `${import.meta.env.BASE_URL}sprites/`;

/** A dim silhouette in every frame cell of the sheet `url` names (or one slab for an image that is not a sheet). */
function placeholderFor(url: string): SheetImage {
  const key = url.startsWith(SHEET_BASE) ? url.slice(SHEET_BASE.length) : '';
  const [dex, form, file] = key.split('/');
  const meta = dex && form && file ? Object.values(SPRITES.sprites[`${dex}/${form}`]?.anims ?? {}).find((a) => a.file === file) : undefined;
  const cols = meta?.frameCount ?? 1;
  const rows = meta?.rows ?? 1;
  const fw = meta?.frameWidth ?? 32;
  const fh = meta?.frameHeight ?? 32;
  const canvas = document.createElement('canvas');
  canvas.width = fw * cols;
  canvas.height = fh * rows;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = PALETTE.barBack;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * fw + fw / 2;
        const base = r * fh + fh * 0.82;
        // A head and a body: a creature-shaped blot, not a broken-image icon.
        ctx.beginPath();
        ctx.ellipse(cx, base - fh * 0.3, fw * 0.28, fh * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, base - fh * 0.62, fw * 0.17, fw * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return canvas;
}

async function loadDomImage(url: string, priority: Priority): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
  image.src = url;
  // Decoded off the main thread before anyone draws it: no first-draw hitch.
  await image.decode();
  return image;
}

const failedUrls: string[] = [];

const loader = createAssetLoader<SheetImage>({
  base: SHEET_BASE,
  maxActive: 8,
  lowActive: 2,
  loadImage: loadDomImage,
  placeholder: placeholderFor,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onFailure: (url) => {
    failedUrls.push(url);
    reportError(appError('asset'), 'sprite');
  },
});

/** The store every draw path reads. */
export const sheets: SheetStore = {
  get: (key) => loader.get(key),
  load: (key) => loader.sheet(key),
  pending: (key) => loader.state(key) === 'pending',
};

export type { AssetState, Priority };

/** Any image URL (a portrait, a tile) through the same cache; a failure resolves to the placeholder. */
export const image = (url: string, priority: Priority = 'high'): Promise<SheetImage> => loader.image(url, { priority });

export const sheet = (key: string, priority: Priority = 'high'): Promise<SheetImage> => loader.sheet(key, { priority });

export interface PreloadOptions {
  priority?: Priority;
  onProgress?(done: number, total: number): void;
}

/** Loads sheets; resolves when every one settled (a failed one counts, as its placeholder). */
export const preload = (keys: Iterable<string>, options: PreloadOptions = {}): Promise<void> => loader.preload(keys, options);

/** The sheets the hub paints for this partner. */
export const preloadHub = (species: SpeciesId, shiny: boolean, female: boolean, onProgress?: PreloadOptions['onProgress']): Promise<void> => preload(hubKeys(species, shiny, female), { ...(onProgress ? { onProgress } : {}) });

/** A run: the player and floor 1 now (with progress for the splash), the rest of the pool in the background. */
export async function preloadRun(dungeon: DungeonDef, species: SpeciesId, shiny: boolean, female: boolean, onProgress?: PreloadOptions['onProgress']): Promise<void> {
  const { now, later } = runKeys(dungeon, species, shiny, female);
  void preload(later, { priority: 'low' });
  await preload(now, { ...(onProgress ? { onProgress } : {}) });
}

let prefetched = false;

/**
 * Warms the idle sheets of every playable species while the browser has
 * nothing better to do (the picker, the gacha and the Maestro open instantly,
 * and the service worker keeps them for the next visit). Skipped on a
 * metered connection (Save-Data) or a slow one.
 */
export function prefetchWhenIdle(): void {
  if (prefetched || typeof window === 'undefined') return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return;
  prefetched = true;
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void }).requestIdleCallback;
  const start = () => void preload(idlePrefetchKeys(), { priority: 'low' });
  if (idle) idle(start, { timeout: 4000 });
  else setTimeout(start, 2000);
}

/** URLs that failed this session (the technical report lists them). */
export const failedAssets = (): readonly string[] => failedUrls;

/** The state of a sheet (tests and the diagnostics). */
export const sheetState = (key: string): AssetState => loader.state(key);
