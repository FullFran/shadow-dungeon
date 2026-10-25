import { t } from '../i18n';
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
  /** The last time added, when it was (real ms) and why (`sima.bonus.<reason>`), shown for a moment. */
  bonus?: ClockBonus | null;
}

export interface ClockBonus {
  ms: number;
  shownAtMs: number;
  /** descend, echo, crystal, waves, shrine. */
  reason?: string;
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

/** The time popup now: "+40 s" large under the clock, with why under it; null once gone. */
export function bonusPopup(bonus: ClockBonus, nowMs: number, translate: (key: string) => string): { text: string; reason: string | null; size: number; alpha: number; rise: number } | null {
  const age = (nowMs - bonus.shownAtMs) / BONUS_SHOW_MS;
  if (age < 0 || age >= 1) return null;
  // It pops in large, settles, and fades in its last third.
  const pop = age < 0.1 ? 1.3 - 3 * age : 1;
  return {
    text: bonusText(bonus.ms),
    reason: bonus.reason ? translate(`sima.bonus.${bonus.reason}`) : null,
    size: Math.round(16 * pop),
    alpha: age < 0.66 ? 1 : Math.max(0, (1 - age) / 0.34),
    rise: Math.round(age * 8),
  };
}

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
  const popup = clock.bonus ? bonusPopup(clock.bonus, nowMs, t) : null;
  if (popup) {
    // A dark pill behind the big green "+N s", and its reason under it.
    const y = 46 - popup.rise;
    ctx.globalAlpha = popup.alpha * 0.6;
    ctx.fillStyle = '#000000';
    ctx.fillRect(cx - 40, y - popup.size + 1, 80, popup.size + (popup.reason ? 13 : 4));
    ctx.globalAlpha = popup.alpha;
    ctx.font = canvasFont(popup.size, true);
    pixelText(ctx, popup.text, cx, y, PALETTE.good, 'center');
    if (popup.reason) {
      ctx.font = canvasFont();
      pixelText(ctx, popup.reason, cx, y + 11, PALETTE.textDim, 'center');
    }
    ctx.globalAlpha = 1;
  }
}
