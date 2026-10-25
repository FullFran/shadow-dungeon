import type { FloorKind } from '../data/dungeon';
import { t } from '../i18n';
import { drawPanel, pixelText } from '../ui/canvas';
import { canvasFont, PALETTE } from '../ui/tokens';
import { floorLabel } from './hud';

/**
 * The floor title card shown on entering each floor (Mystery Dungeon style):
 * dungeon name, "Floor N", the collapse warning on urgent floors and the
 * escape time of the collapse floor just left. Game input keeps working
 * while it shows; it only fades over the view.
 */
export interface FloorCard {
  /** Name of the dungeon (already translated); the game title when absent. */
  dungeon?: string;
  floor: number;
  kind: FloorKind;
  /** The collapse floor just escaped, if the previous floor was one. */
  escape: { floor: number; ms: number } | null;
  /** Real time the card appeared. */
  shownAtMs: number;
}

export const CARD = {
  fadeInMs: 300,
  holdMs: 1500,
  /** Collapse warnings stay a little longer. */
  urgentHoldMs: 2200,
  fadeOutMs: 600,
} as const;

const holdOf = (card: Pick<FloorCard, 'kind'>) => (card.kind === 'normal' ? CARD.holdMs : CARD.urgentHoldMs);

/** Opacity of the card `ageMs` after it appeared: fade in, hold, fade out, then 0 for good. */
export function cardAlpha(card: Pick<FloorCard, 'kind'>, ageMs: number): number {
  if (ageMs < 0) return 0;
  if (ageMs < CARD.fadeInMs) return ageMs / CARD.fadeInMs;
  const out = ageMs - CARD.fadeInMs - holdOf(card);
  if (out <= 0) return 1;
  return Math.max(0, 1 - out / CARD.fadeOutMs);
}

/** "0:42", "1:05": minutes and seconds, rounded down. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The card's text lines, top to bottom. */
export function cardLines(card: FloorCard): { dungeon: string; floor: string; warning: string | null; bonus: string | null } {
  return {
    dungeon: card.dungeon ?? t('app.title'),
    floor: floorLabel(card.floor),
    warning: card.kind === 'normal' ? null : t(`card.${card.kind}`),
    bonus: card.escape ? t('card.escaped').replace('{time}', formatClock(card.escape.ms)) : null,
  };
}

/** Draws the card in view units (the caller has applied the pixel scale): a window in the middle of the view. */
export function drawFloorCard(ctx: CanvasRenderingContext2D, card: FloorCard, nowMs: number, width: number, height: number): void {
  const alpha = cardAlpha(card, nowMs - card.shownAtMs);
  if (alpha <= 0) return;
  const lines = cardLines(card);
  const extra = (lines.warning ? 1 : 0) + (lines.bonus ? 1 : 0);
  const w = 232;
  const h = 50 + extra * 14;
  const x = Math.round((width - w) / 2);
  // Rises a few pixels as it fades in.
  const y = Math.round(height / 2 - h / 2 - 24 + 4 * (1 - Math.min(1, alpha * 2)));
  const urgent = lines.warning !== null;
  drawPanel(ctx, x, y, w, h, { alpha: alpha * 0.95, border: urgent ? PALETTE.eclipseGlow : PALETTE.border });
  ctx.globalAlpha = alpha;
  const cx = width / 2;
  ctx.font = canvasFont();
  pixelText(ctx, lines.dungeon, cx, y + 16, PALETTE.textDim, 'center');
  ctx.font = canvasFont(22, true);
  pixelText(ctx, lines.floor, cx, y + 39, PALETTE.text, 'center');
  ctx.font = canvasFont();
  let line = y + 56;
  if (lines.warning) {
    pixelText(ctx, lines.warning, cx, line, PALETTE.eclipseGlow, 'center');
    line += 14;
  }
  if (lines.bonus) pixelText(ctx, lines.bonus, cx, line, PALETTE.cursor, 'center');
  ctx.globalAlpha = 1;
}
