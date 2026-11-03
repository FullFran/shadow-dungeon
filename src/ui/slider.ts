import { sliderKey, sliderShare, sliderSnap, sliderValueAt, type SliderRange } from './slider-model';
import { h } from './window';

/**
 * The game's own slider (never a native range input): a track with a fill and
 * a square thumb, the ARIA slider pattern. A press on the track jumps to that
 * point and keeps dragging (pointer capture: the drag survives leaving the
 * track, on mouse, touch and pen). Keyboard: Left / Right step, Home / End
 * jump to the ends, PageUp / PageDown move by the big step; Up / Down are left
 * to the surrounding menu, which uses them to move between rows. The value
 * reads beside the track. `onInput` fires on every change while dragging,
 * `onCommit` once when the press or the key ends (a good moment to play a
 * preview sound). slider-model.ts is the tested maths.
 */
export interface SliderConfig {
  /** Accessible name (the row's label). */
  label: string;
  range: SliderRange;
  value: number;
  /** The text shown (and read) for a value; default "70 %". */
  format?(value: number): string;
  onInput(value: number): void;
  onCommit?(value: number): void;
  /** The id of the element that labels it, when the label is visible text. */
  labelledBy?: string;
}

export interface Slider {
  element: HTMLElement;
  /** The focusable part (role slider). */
  control: HTMLElement;
  value(): number;
  setValue(value: number): void;
  setDisabled(disabled: boolean): void;
}

const percent = (value: number): string => `${Math.round(value * 100)} %`;

const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

export function slider(config: SliderConfig): Slider {
  const format = config.format ?? percent;
  let value = sliderSnap(config.value, config.range);
  let dragging = false;
  let disabled = false;

  const fill = h('i', { className: 'sl-fill' });
  const thumb = h('b', { className: 'sl-thumb' });
  const track = h('span', { className: 'sl-track' }, [fill, thumb]);
  const readout = h('output', { className: 'sl-value' });
  const control = h('div', { className: 'sl-hit' }, [track]);
  control.tabIndex = 0;
  control.setAttribute('role', 'slider');
  if (config.labelledBy) control.setAttribute('aria-labelledby', config.labelledBy);
  else control.setAttribute('aria-label', config.label);
  control.setAttribute('aria-valuemin', String(config.range.min));
  control.setAttribute('aria-valuemax', String(config.range.max));
  control.setAttribute('aria-orientation', 'horizontal');
  const element = h('div', { className: 'sl' }, [control, readout]);

  function paint(): void {
    const share = sliderShare(value, config.range);
    element.style.setProperty('--sl-share', String(share));
    control.setAttribute('aria-valuenow', String(value));
    control.setAttribute('aria-valuetext', format(value));
    readout.textContent = format(value);
  }

  function set(next: number): boolean {
    if (next === value) return false;
    value = next;
    paint();
    config.onInput(value);
    return true;
  }

  const fromPointer = (e: PointerEvent): number => {
    const box = track.getBoundingClientRect();
    return sliderValueAt(e.clientX, box.left, box.width, config.range);
  };

  control.addEventListener('pointerdown', (e) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    control.focus({ preventScroll: true });
    dragging = true;
    control.classList.add('is-dragging');
    control.setPointerCapture?.(e.pointerId);
    set(fromPointer(e));
  });
  control.addEventListener('pointermove', (e) => {
    if (dragging) set(fromPointer(e));
  });
  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    control.classList.remove('is-dragging');
    if (control.hasPointerCapture?.(e.pointerId)) control.releasePointerCapture(e.pointerId);
    config.onCommit?.(value);
  };
  control.addEventListener('pointerup', release);
  control.addEventListener('pointercancel', release);

  control.addEventListener('keydown', (e) => {
    if (disabled || e.ctrlKey || e.altKey || e.metaKey || !KEYS.has(e.key)) return;
    const next = sliderKey(value, e.key, config.range);
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (set(next)) config.onCommit?.(value);
  });

  paint();
  return {
    element,
    control,
    value: () => value,
    setValue(next) {
      value = sliderSnap(next, config.range);
      paint();
    },
    setDisabled(next) {
      disabled = next;
      element.classList.toggle('is-disabled', next);
      if (next) control.setAttribute('aria-disabled', 'true');
      else control.removeAttribute('aria-disabled');
      control.tabIndex = next ? -1 : 0;
    },
  };
}
