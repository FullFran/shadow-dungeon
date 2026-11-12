import { showsBar } from '../core/boss';
import { isDeclaring } from '../core/cards';
import type { WorldState } from '../core/state';
import type { CardOutcome } from '../data/cards';
import { t } from '../i18n';

/**
 * The spell card clock, readable at a glance (odd/tasks/last-phase-and-timer.md S3, docs/research/boss-timer.md):
 * the seconds left and a draining line (the share of the card's time), the capture seal (lit while the player has
 * not been hit during the card: breaking it in time captures it), the last seconds on several channels (red, larger
 * and pulsing digits, a tick every second), a word when each card ends, and a one-time tip saying what the clock is
 * for. Pure: `adapters/card-clock-hud.ts` draws it, app/game.ts plays the ticks.
 */
export const CARD_CLOCK = { urgentMs: 5000, pulseMs: 500 } as const;

/** The card's clock as the HUD gets it (core/boss.ts `BossBar`). */
export interface CardClock {
  leftMs: number;
  totalMs: number;
}

export interface CardClockView {
  /** Whole seconds left, rounded up. */
  seconds: number;
  /** Share of the card's time still to run (0..1): the draining line. */
  share: number;
  /** The last `CARD_CLOCK.urgentMs`: red, larger, pulsing, ticking. */
  urgent: boolean;
  /** Size of the digits: 1, or a pulse up to about 1.35 once urgent (a cue that does not need colour). */
  scale: number;
  /** The capture still possible (`live`), lost to a hit (`lost`), or not followed for this boss (null). */
  seal: 'live' | 'lost' | null;
}

/** What `cardClockView` needs to light the seal: the local player's capture watch (WorldState `capture`) and the bar's boss. */
export interface SealInput {
  capture: WorldState['capture'];
  enemyId: string;
}

export function cardClockView(clock: CardClock, seal: SealInput | null): CardClockView {
  const left = Math.max(0, clock.leftMs);
  const share = clock.totalMs > 0 ? Math.min(1, left / clock.totalMs) : 0;
  const urgent = left <= CARD_CLOCK.urgentMs;
  // The pulse peaks as each second starts: a beat in time with the ticks.
  const phase = (left % 1000) / 1000;
  const scale = urgent ? 1.15 + 0.2 * phase : 1;
  const watched = seal?.capture && seal.capture.enemyId === seal.enemyId ? seal.capture : null;
  return { seconds: Math.ceil(left / 1000), share, urgent, scale, seal: watched ? (watched.hit ? 'lost' : 'live') : null };
}

/**
 * The tick of the clock's last seconds, from the time left before and after a frame: `tick` each time the digits
 * drop within the last 5 s, `last` as they reach 1; null otherwise (no clock, a new card, or the card ending).
 */
export function cardTick(beforeMs: number | undefined, afterMs: number | undefined): 'tick' | 'last' | null {
  if (beforeMs === undefined || afterMs === undefined || afterMs <= 0 || afterMs >= beforeMs) return null;
  const now = Math.ceil(afterMs / 1000);
  if (now >= Math.ceil(beforeMs / 1000) || now > CARD_CLOCK.urgentMs / 1000) return null;
  return now === 1 ? 'last' : 'tick';
}

export type CardResultOutcome = Exclude<CardOutcome, 'start'>;

const OUTCOMES: ReadonlySet<string> = new Set(['broken', 'timeout', 'survived']);

/**
 * How a card just ended, read from two consecutive worlds on any peer: a boss that enters a declaration carries how
 * the previous card ended in `ai.attack` (core/cards.ts `declare`). The last card's end is the boss's fall (the big
 * "¡JEFE DERROTADO!" notice), not a result.
 */
export function cardResult(before: WorldState, after: WorldState): { enemyId: string; outcome: CardResultOutcome } | null {
  for (const enemy of after.enemies) {
    if (!enemy.alive || !showsBar(enemy) || !isDeclaring(enemy)) continue;
    const outcome = enemy.ai.attack;
    if (!outcome || !OUTCOMES.has(outcome)) continue;
    const was = before.enemies.find((e) => e.id === enemy.id);
    if (was && isDeclaring(was) && was.boss?.stance === enemy.boss?.stance) continue;
    return { enemyId: enemy.id, outcome: outcome as CardResultOutcome };
  }
  return null;
}

/** How long a result banner stays: in, hold, out. */
export const RESULT_TIMES = { enter: 150, hold: 1700, exit: 400 } as const;
export const RESULT_MS = RESULT_TIMES.enter + RESULT_TIMES.hold + RESULT_TIMES.exit;

export function resultAlpha(ageMs: number): number {
  if (ageMs <= 0 || ageMs >= RESULT_MS) return 0;
  if (ageMs < RESULT_TIMES.enter) return ageMs / RESULT_TIMES.enter;
  const out = ageMs - RESULT_TIMES.enter - RESULT_TIMES.hold;
  return out <= 0 ? 1 : 1 - out / RESULT_TIMES.exit;
}

export interface CardResultBanner {
  outcome: CardResultOutcome;
  heading: string;
  /** What it means: a timeout passes with no reward; a card broken while hurt was not mastered. Null when the capture notice says it. */
  sub: string | null;
  tone: 'good' | 'bad';
  shownAtMs: number;
}

/** The banner of a card's end; `captured`: the local player captured it (its own "¡Técnica dominada!" notice follows). */
export function cardResultBanner(outcome: CardResultOutcome, captured: boolean, shownAtMs: number): CardResultBanner {
  if (outcome === 'timeout') return { outcome, heading: t('card.clock.timeout'), sub: t('card.clock.noReward'), tone: 'bad', shownAtMs };
  return { outcome, heading: t(outcome === 'broken' ? 'card.clock.broken' : 'card.clock.survived'), sub: captured ? null : t('card.clock.unmastered'), tone: 'good', shownAtMs };
}

/** The one-time tip: true the first time (and marks it as seen), false after, or when the run has no tip store (Settings `cardTimerTipSeen`). */
export function takeCardTip(tip: { seen(): boolean; mark(): void } | undefined): boolean {
  if (!tip || tip.seen()) return false;
  tip.mark();
  return true;
}

/** How long the tip panel stays up (a slow reader on a phone). */
export const TIP_MS = 7000;

export const cardTipText = (): { title: string; body: string } => ({ title: t('card.clock.tipTitle'), body: t('card.clock.tip') });
