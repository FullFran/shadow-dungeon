import { CARD_RULES, type CardOutcome } from '../data/cards';

/**
 * Spell cards with HP segments and timers (data/cards.ts), pure. The API any
 * boss can use:
 *
 * - `cardHpFloor(maxHp, index, count)`: the HP where card `index` of `count`
 *   ends (equal segments; the last ends at 0).
 * - `cardSegment(hp, maxHp, count)`: which card the current HP belongs to.
 * - `cardEnd({ hp, maxHp, index, count, elapsedMs, timerMs })`: whether the
 *   card in play just ended, by `hp` (its segment emptied) or `timeout`.
 * - `timeoutHp(maxHp, index, count)`: the HP after a timeout (the bar drops
 *   to the segment floor, as Touhou moves on to the next card).
 * - `trackCapture(tracker, { card, nowMs, hurt, timerMs })`: one player's
 *   capture judge, fed every frame on every peer with the card on screen
 *   (the boss's stance, null when there is none), whether that player was
 *   hurt this frame and the card's timer; it returns the outcome of a card
 *   once the next one (or none) takes its place. It needs nothing from the
 *   network: guests judge their own player from the host's snapshots.
 * - `captureAward(outcome)`: the Pokémonedas a card pays its player.
 *
 * Banner: a boss announces each card with the existing `bossStance` event
 * and stance (the HUD banner reads the stance on every peer).
 */
export const cardHpFloor = (maxHp: number, index: number, count: number): number => Math.max(0, maxHp * (1 - (index + 1) / Math.max(1, count)));

/** The card the current HP belongs to (0-based). */
export function cardSegment(hp: number, maxHp: number, count: number): number {
  for (let i = 0; i < count - 1; i++) if (hp > cardHpFloor(maxHp, i, count)) return i;
  return Math.max(0, count - 1);
}

export interface CardClock {
  hp: number;
  maxHp: number;
  index: number;
  count: number;
  /** Time since the card started (enemy time). */
  elapsedMs: number;
  /** 0 = no timer. */
  timerMs: number;
}

/** Whether the card in play ended: its segment emptied (`hp`, which wins a tie) or its timer ran out. */
export function cardEnd(c: CardClock): 'hp' | 'timeout' | null {
  if (c.hp <= cardHpFloor(c.maxHp, c.index, c.count)) return 'hp';
  if (c.timerMs > 0 && c.elapsedMs >= c.timerMs) return 'timeout';
  return null;
}

/** The HP after card `index` timed out: its segment's floor (0 for the last card: the boss falls). */
export const timeoutHp = (maxHp: number, index: number, count: number): number => cardHpFloor(maxHp, index, count);

/** One player's view of the card in play. */
export interface CaptureTracker {
  card: string | null;
  startedAtMs: number;
  timerMs: number;
  hurt: boolean;
}

export const emptyCapture = (): CaptureTracker => ({ card: null, startedAtMs: 0, timerMs: 0, hurt: false });

export interface CaptureInput {
  /** The card on screen now (null: none, the boss fell or is not playing one). */
  card: string | null;
  /** This peer's clock. */
  nowMs: number;
  /** The player was hurt since the last call. */
  hurt: boolean;
  /** The timer of `card` (used when it starts). */
  timerMs: number;
}

/** Feeds one frame to a player's capture judge; returns the outcome of the card that just gave way. */
export function trackCapture(tracker: CaptureTracker, input: CaptureInput): { tracker: CaptureTracker; award: { card: string; outcome: CardOutcome } | null } {
  if (input.card === tracker.card) return { tracker: input.hurt && !tracker.hurt ? { ...tracker, hurt: true } : tracker, award: null };
  let award: { card: string; outcome: CardOutcome } | null = null;
  if (tracker.card !== null) {
    const elapsed = input.nowMs - tracker.startedAtMs;
    const timedOut = tracker.timerMs > 0 && elapsed >= tracker.timerMs - CARD_RULES.timeoutGraceMs;
    award = { card: tracker.card, outcome: timedOut ? 'timeout' : tracker.hurt ? 'cleared' : 'captured' };
  }
  const next: CaptureTracker = input.card === null ? emptyCapture() : { card: input.card, startedAtMs: input.nowMs, timerMs: input.timerMs, hurt: input.hurt };
  return { tracker: next, award };
}

/** Pokémonedas for one card's outcome (captures only). */
export const captureAward = (outcome: CardOutcome): number => (outcome === 'captured' ? CARD_RULES.captureCoins : 0);
