/**
 * The end screen's entrance as data (owner, 2026-11-04; .agents/DESIGN.md §5), pure: the veil fades, the title rises, the sprite
 * appears, the tiles stagger in 60 ms apart, the seal slams, the reward counts up, then the actions go live. The input is never
 * blocked past 1.2 s (Doherty) and any key or click skips to the final state; reduced motion is instant.
 */
export const ACTIONS_LIVE_MAX_MS = 1200;
export const TILE_STAGGER_MS = 60;

export interface EndTimelineInput {
  /** Stat tiles on screen. */
  tiles: number;
  /** A new-best seal will slam in. */
  seal: boolean;
  /** The headline reward the count climbs to (0: no reward row to count). */
  rewardAmount: number;
  reduced: boolean;
}

export interface EndTimeline {
  /** How long the veil fades in. */
  veilMs: number;
  titleAt: number;
  spriteAt: number;
  tileAt: number[];
  sealAt: number | null;
  rewardsAt: number | null;
  /** How long the reward count takes (0: show the final figure at once). */
  countMs: number;
  /** When the buttons answer; before it a press only skips. */
  actionsAt: number;
}

/** 300 to 800 ms, longer for a bigger purse. */
export const countMsFor = (amount: number): number => Math.min(800, 300 + Math.round(Math.max(0, amount) * 2.5));

export function endTimeline(input: EndTimelineInput): EndTimeline {
  const { tiles, seal, rewardAmount, reduced } = input;
  if (reduced) {
    return { veilMs: 0, titleAt: 0, spriteAt: 0, tileAt: Array<number>(tiles).fill(0), sealAt: seal ? 0 : null, rewardsAt: rewardAmount > 0 ? 0 : null, countMs: 0, actionsAt: 0 };
  }
  const veilMs = 150;
  const titleAt = veilMs;
  const spriteAt = 300;
  const firstTile = 420;
  const tileAt = Array.from({ length: tiles }, (_, i) => firstTile + i * TILE_STAGGER_MS);
  const lastTile = tileAt.length > 0 ? tileAt[tileAt.length - 1]! : firstTile;
  const sealAt = seal ? Math.min(lastTile + 120, 1000) : null;
  const rewardsAt = rewardAmount > 0 ? firstTile + TILE_STAGGER_MS : null;
  const countMs = rewardsAt === null ? 0 : Math.min(countMsFor(rewardAmount), ACTIONS_LIVE_MAX_MS - rewardsAt);
  const ends = [lastTile + 200, sealAt === null ? 0 : sealAt + 200, rewardsAt === null ? 0 : rewardsAt + countMs];
  return { veilMs, titleAt, spriteAt, tileAt, sealAt, rewardsAt, countMs, actionsAt: Math.min(ACTIONS_LIVE_MAX_MS, Math.max(...ends)) };
}

/** The figure shown `elapsed` ms into a count of `durationMs`: eased out, whole numbers, exact at the end, never above the amount. */
export function countAt(amount: number, elapsed: number, durationMs: number): number {
  if (durationMs <= 0 || elapsed >= durationMs) return amount;
  if (elapsed <= 0) return 0;
  const t = elapsed / durationMs;
  return Math.min(amount, Math.floor(amount * (1 - (1 - t) ** 3)));
}

/** Whether the buttons answer: their time has come, or the player skipped the entrance. */
export const isLive = (timeline: EndTimeline, elapsed: number, skipped: boolean): boolean => skipped || elapsed >= timeline.actionsAt;

/** A figure's text split around its number, so the number can count: «+42 P» with 42 gives ['+', ' P']; null when the number is not in the text. */
export function countParts(value: string, amount: number): [string, string] | null {
  const at = value.indexOf(String(amount));
  return at < 0 ? null : [value.slice(0, at), value.slice(at + String(amount).length)];
}
