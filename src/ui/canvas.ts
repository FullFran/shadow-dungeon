import { PALETTE } from './tokens';

/**
 * The window language of the DOM menus, drawn on the game canvas in view
 * pixels (the caller has applied the integer pixel scale, so every rectangle
 * lands on whole screen pixels): a dark outline, a pale border with stepped
 * corners, a dark blue gradient and an inner shade line.
 */
export interface PanelOptions {
  /** Whole-panel opacity (fades). */
  alpha?: number;
  /** Fill opacity relative to `alpha`: lower lets the map show through (the minimap). */
  fill?: number;
  /** Border colour (rarity or warning accents). */
  border?: string;
}

/** A rectangle with corners cut in `r` one-pixel steps. */
function stepped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.fillRect(x + r, y, w - 2 * r, h);
  for (let k = 0; k < r; k++) ctx.fillRect(x + k, y + r - k, w - 2 * k, h - 2 * (r - k));
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, options: PanelOptions = {}): void {
  const alpha = options.alpha ?? 1;
  if (alpha <= 0) return;
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PALETTE.ink;
  stepped(ctx, x - 1, y - 1, w + 2, h + 2, 3);
  ctx.fillStyle = options.border ?? PALETTE.border;
  stepped(ctx, x, y, w, h, 2);
  ctx.globalAlpha = alpha * (options.fill ?? 1);
  ctx.fillStyle = PALETTE.ink;
  stepped(ctx, x + 1, y + 1, w - 2, h - 2, 1);
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, PALETTE.windowTop);
  gradient.addColorStop(1, PALETTE.windowBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = PALETTE.borderShade;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, h - 4);
  ctx.globalAlpha = 1;
}

/** Breaks the font's fi/fl/ff ligatures (they read as other letters) with a zero-width non-joiner. */
export const noLigatures = (text: string): string => text.replace(/f(?=[fil])/g, 'f‌');

/** Text with a one-pixel dark drop shadow, for legibility over the map. Keeps the current globalAlpha. */
export function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left'): void {
  const shown = noLigatures(text);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(shown, Math.round(x) + 1, Math.round(y) + 1);
  ctx.fillStyle = color;
  ctx.fillText(shown, Math.round(x), Math.round(y));
}

/** A bar with a dark frame: background, then the filled part. */
export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: number, color: string): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = PALETTE.barBack;
  ctx.fillRect(x, y, w, h);
  const filled = Math.round(w * Math.min(1, Math.max(0, fill)));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, filled, h);
  // A lighter top line gives the bar some volume.
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, filled, 1);
  ctx.globalAlpha = alpha;
}
