import { NIGHTMARE_BAND } from '../data/nightmare-band';

/**
 * The Nightmare card HP band's factors (odd/tasks/nightmare-tuning.md N1,
 * data/nightmare-band.ts), from kill margins measured with no band
 * (tools/nightmare-band.ts). A card's segment HP is what its margin divides
 * by, so a factor `f` turns a margin `m` into `m / f`.
 */
export interface BandSample {
  card: string;
  /** A case the band is checked on (a card boss in its own arena: guardians, Senda shadows and wounds). */
  home: boolean;
  /** Kill margin with no band (the worst starter's). */
  margin: number;
  /** The case's kill target (src/sim/prove.ts `KILL_MARGIN`). */
  target: number;
  /** A recorded kill gap (src/sim/kill-gaps.ts): it bounds nothing. */
  gap?: boolean;
}

/** Headroom so that boss HP rounding never pushes a margin past the ceiling or under a target. */
const CEILING_AIM = NIGHTMARE_BAND.max - 0.01;
const TARGET_AIM = 0.005;
const ceil2 = (x: number): number => Math.ceil(x * 100 - 1e-9) / 100;
const floor2 = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;

/**
 * Per card: the smallest factor that brings every home case under the
 * ceiling, but never one that drops any case (a Sima echo, a reused road
 * boss) under its own target; a card held back by that is `capped`.
 * Cards already in the band get no factor (they are left alone). A
 * `current` factor within 0.01 of the measured one is kept while it still
 * meets both bounds, so boss HP rounding never churns the table.
 */
export function bandFactors(samples: readonly BandSample[], current: Readonly<Partial<Record<string, number>>> = {}): { factors: Record<string, number>; capped: string[] } {
  const factors: Record<string, number> = {};
  const capped: string[] = [];
  const counted = samples.filter((s) => !s.gap && Number.isFinite(s.margin) && s.margin > 0);
  for (const card of [...new Set(counted.map((s) => s.card))].sort()) {
    const mine = counted.filter((s) => s.card === card);
    const high = Math.max(0, ...mine.filter((s) => s.home).map((s) => s.margin));
    if (high <= NIGHTMARE_BAND.max) continue;
    const want = ceil2(high / CEILING_AIM);
    const limit = Math.min(...mine.map((s) => floor2(s.margin / (s.target + TARGET_AIM))));
    const measured = Math.min(want, limit);
    if (measured < want) capped.push(card);
    const kept = current[card];
    const f = kept !== undefined && Math.abs(kept - measured) <= 0.01 + 1e-9 && kept <= limit && high / kept <= NIGHTMARE_BAND.max ? kept : measured;
    if (f > 1) factors[card] = f;
  }
  return { factors, capped };
}
