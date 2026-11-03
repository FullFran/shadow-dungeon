import { MATERIAL_TIERS, type MaterialTier } from '../../data/player-evolutions';
import type { PixelIcon } from '../pixel-icons';

/**
 * Original colour pixel icons of the Evolución and Mejoras windows (16x16,
 * ink outline #140c11, 4 to 5 colours; .agents/DESIGN.md §4): one essence gem
 * per material tier, the chain arrow and the awakening spark. Each is a small
 * shape filled by a rule, shaded in a few tones and ringed with the ink
 * outline, so every icon has the same weight. Plain `PixelIcon` maps, drawn
 * with `pixelSvgOf`.
 */
const SIZE = 16;
const INK = '#140c11';

/** Fills `shape` (a tone letter or null per cell), then rings it with ink 'k'. */
function build(shape: (x: number, y: number) => string | null, palette: Record<string, string>): PixelIcon {
  const fill = Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => shape(x, y)));
  const at = (x: number, y: number) => fill[y]?.[x] ?? null;
  const rows = fill.map((line, y) =>
    line
      .map((tone, x) => {
        if (tone) return tone;
        const near = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        return near ? 'k' : '.';
      })
      .join(''),
  );
  return { palette: { k: INK, ...palette }, rows };
}

/** A faceted gem: crown, girdle and pavilion, lit from the top left. */
const gem = (tones: { h: string; c: string; m: string; d: string }): PixelIcon =>
  build((x, y) => {
    const yc = y - 2;
    if (yc < 0 || yc > 11) return null;
    const xc = x + 0.5 - 8;
    const half = (yc <= 3 ? 3 + yc * 0.8 : 5.4 - (yc - 3) * 0.65) + 0.5;
    if (Math.abs(xc) > half) return null;
    if (yc <= 3) return xc < -1.5 && yc < 3 ? 'h' : xc > 2 ? 'm' : 'c';
    if (yc === 4) return 'd';
    return xc < -1 ? 'c' : xc > 1 ? 'd' : 'm';
  }, tones);

/** Essence colour per tier: the difficulty that drops it (normal teal, hard gold, nightmare violet). */
const ESSENCE_TONES: Record<MaterialTier, { h: string; c: string; m: string; d: string }> = {
  normal: { h: '#d8fff4', c: '#5ed0b8', m: '#2f9a8c', d: '#1d6a66' },
  hard: { h: '#fff1c2', c: '#ffbf5e', m: '#e08a2e', d: '#9a5418' },
  nightmare: { h: '#f0dcff', c: '#b57cff', m: '#7b4ad6', d: '#4a2a8a' },
};

const arrow = build((x, y) => {
  const yc = y + 0.5 - 8;
  const body = x >= 1 && x <= 8 && Math.abs(yc) <= 1.5;
  const head = x >= 8 && x <= 13 && Math.abs(yc) <= 13.5 - x;
  if (!body && !head) return null;
  return yc < -0.9 ? 'l' : yc > 1 ? 'd' : 'g';
}, { l: '#fff1c2', g: '#e2b866', d: '#9a7a3a' });

/** A four-point spark: what an awakening step adds. */
const awaken = build((x, y) => {
  const xc = Math.abs(x + 0.5 - 8);
  const yc = Math.abs(y + 0.5 - 8);
  if (xc ** 0.6 + yc ** 0.6 > 5.6 ** 0.6) return null;
  return xc + yc < 2 ? 'w' : x > 8 && y > 8 ? 'd' : 'g';
}, { w: '#fff8e0', g: '#ffbf5e', d: '#c7782a' });

export const EVOLVE_SHOP_ICONS: Record<string, PixelIcon> = {
  ...Object.fromEntries(MATERIAL_TIERS.map((tier) => [`essence-${tier}`, gem(ESSENCE_TONES[tier])])),
  arrow,
  awaken,
};
