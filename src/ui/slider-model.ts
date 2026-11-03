/**
 * Pure model of the game's slider (src/ui/slider.ts): where a pointer lands on
 * the track, what a key does. Values live in [min, max] on multiples of `step`
 * from `min`; `big` is the PageUp / PageDown jump (defaults to one step).
 */
export interface SliderRange {
  min: number;
  max: number;
  step: number;
  big?: number;
}

/** Nearest stop of the range, clamped, without float drift (0.15, not 0.15000000000000002). */
export function sliderSnap(value: number, range: SliderRange): number {
  const stops = Math.round((value - range.min) / range.step);
  const snapped = range.min + stops * range.step;
  return Number(Math.min(range.max, Math.max(range.min, snapped)).toFixed(6));
}

/** The value as a share of the track, 0..1. */
export const sliderShare = (value: number, range: SliderRange): number => (range.max === range.min ? 0 : Math.min(1, Math.max(0, (value - range.min) / (range.max - range.min))));

/** The value under a pointer at `x` over a track starting at `left` and `width` wide. */
export function sliderValueAt(x: number, left: number, width: number, range: SliderRange): number {
  if (width <= 0) return sliderSnap(range.min, range);
  const share = Math.min(1, Math.max(0, (x - left) / width));
  return sliderSnap(range.min + share * (range.max - range.min), range);
}

/** The value after a key, or null when the key is not the slider's. */
export function sliderKey(value: number, key: string, range: SliderRange): number | null {
  const big = range.big ?? range.step;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return sliderSnap(value + range.step, range);
    case 'ArrowLeft':
    case 'ArrowDown':
      return sliderSnap(value - range.step, range);
    case 'PageUp':
      return sliderSnap(value + big, range);
    case 'PageDown':
      return sliderSnap(value - big, range);
    case 'Home':
      return range.min;
    case 'End':
      return range.max;
    default:
      return null;
  }
}
