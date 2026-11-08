import { SPRITES } from '../data/sprites';
import { sheetKey } from './asset-keys';
import type { SheetImage, SheetStore } from './assets';

type AnimMeta = (typeof SPRITES)['sprites'][string]['anims'][string];

/**
 * Which sheet to draw a creature's animation with (owner 2026-11-08: a magenta square flashed for a moment when a
 * Pokémon started walking). Sheets load by need (assets.ts), so the first steps can ask for a Walk sheet that is
 * still on its way: the creature keeps its Idle sheet until then. `loading` = draw nothing this frame; `missing` =
 * nothing is loaded or loading (a broken key or a store without loading, like a test Map).
 */
export type AnimSheet = { kind: 'sheet'; anim: string; meta: AnimMeta; image: SheetImage } | { kind: 'loading' } | { kind: 'missing' };

const FALLBACK = 'Idle';

export function resolveAnimSheet(sheets: Pick<SheetStore, 'get' | 'pending'>, sprite: string, anim: string): AnimSheet {
  const anims = SPRITES.sprites[sprite]?.anims;
  if (!anims) return { kind: 'missing' };
  let loading = false;
  for (const name of anim === FALLBACK ? [anim] : [anim, FALLBACK]) {
    const meta = anims[name];
    if (!meta) continue;
    const key = sheetKey(sprite, meta.file);
    const image = sheets.get(key);
    if (image) return { kind: 'sheet', anim: name, meta, image };
    if (sheets.pending?.(key)) loading = true;
  }
  return loading ? { kind: 'loading' } : { kind: 'missing' };
}
