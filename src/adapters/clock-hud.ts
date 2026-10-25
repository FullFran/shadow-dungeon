import { clockText } from '../core/endless';
import { pixelText } from '../ui/canvas';
import { canvasFont, PALETTE } from '../ui/tokens';

/**
 * The endless dungeon's run clock on the HUD: large at the top centre, red
 * and pulsing once it is low, with "+40 s" under it when time is added.
 * Presentation only; the clock itself is the run's (core/endless.ts).
 */
export interface RunClock {
  ms: number;
  /** Under this the clock turns red, pulses and ticks. */
  lowMs: number;
  /** The last time added and when it was (real ms), shown for a moment. */
  bonus?: { ms: number; shownAtMs: number } | null;
}

export const BONUS_SHOW_MS = 1600;

/** Text, colour and size of the clock now: red with a once-a-second pulse when low. */
export function clockLook(ms: number, lowMs: number, nowMs: number): { text: string; color: string; scale: number } {
  const text = clockText(ms);
  if (ms > lowMs) return { text, color: PALETTE.text, scale: 1 };
  const beat = Math.abs(Math.sin((nowMs / 1000) * Math.PI));
  return { text, color: PALETTE.danger, scale: 1 + 0.15 * beat };
}

/** True when the clock crossed a whole second while low (play one tick); never at 0 or above `lowMs`. */
export const tickDue = (beforeMs: number, afterMs: number, lowMs: number): boolean =>
  afterMs > 0 && afterMs <= lowMs && Math.ceil(afterMs / 1000) < Math.ceil(beforeMs / 1000);

/** "+40 s" (rounded to whole seconds). */
export const bonusText = (ms: number): string => `+${Math.round(ms / 1000)} s`;

export function drawRunClock(ctx: CanvasRenderingContext2D, clock: RunClock, nowMs: number, width: number): void {
  const look = clockLook(clock.ms, clock.lowMs, nowMs);
  const cx = Math.round(width / 2);
  const size = Math.round(20 * look.scale);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#000000';
  ctx.fillRect(cx - 34, 4, 68, 24);
  ctx.globalAlpha = 1;
  ctx.font = canvasFont(size, true);
  pixelText(ctx, look.text, cx, 24, look.color, 'center');
  const bonus = clock.bonus;
  if (bonus && nowMs - bonus.shownAtMs < BONUS_SHOW_MS) {
    const age = (nowMs - bonus.shownAtMs) / BONUS_SHOW_MS;
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.font = canvasFont();
    pixelText(ctx, bonusText(bonus.ms), cx, 40 - Math.round(age * 6), PALETTE.good, 'center');
    ctx.globalAlpha = 1;
  }
}
