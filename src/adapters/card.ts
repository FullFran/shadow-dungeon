import type { FloorKind } from '../data/dungeon';
import { t } from '../i18n';
import { floorLabel } from './hud';

/**
 * The floor title card shown on entering each floor (Mystery Dungeon style):
 * dungeon name, "Floor N", the collapse warning on urgent floors and the
 * escape time of the collapse floor just left. Game input keeps working
 * while it shows; it only fades over the view.
 */
export interface FloorCard {
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

const holdOf = (card: Pick<FloorCard, 'kind'>) => (card.kind === 'collapse' ? CARD.urgentHoldMs : CARD.holdMs);

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
    dungeon: t('app.title'),
    floor: floorLabel(card.floor),
    warning: card.kind === 'collapse' ? t('card.collapse') : null,
    bonus: card.escape ? t('card.escaped').replace('{time}', formatClock(card.escape.ms)) : null,
  };
}

function shadowed(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Draws the card in view units (the caller has applied the pixel scale). */
export function drawFloorCard(ctx: CanvasRenderingContext2D, card: FloorCard, nowMs: number, width: number, height: number): void {
  const alpha = cardAlpha(card, nowMs - card.shownAtMs);
  if (alpha <= 0) return;
  const lines = cardLines(card);
  const cx = width / 2;
  const top = height / 2 - 34;
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = '#07060b';
  ctx.fillRect(0, top - 18, width, lines.warning || lines.bonus ? 84 : 58);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 9px monospace';
  shadowed(ctx, lines.dungeon, cx, top, '#b9a4ff');
  ctx.font = 'bold 18px monospace';
  shadowed(ctx, lines.floor, cx, top + 22, '#e8e4f0');
  ctx.font = 'bold 10px monospace';
  if (lines.warning) shadowed(ctx, lines.warning, cx, top + 42, '#ff8a3d');
  if (lines.bonus) shadowed(ctx, lines.bonus, cx, top + (lines.warning ? 56 : 42), '#ffd36b');
  ctx.globalAlpha = 1;
}
