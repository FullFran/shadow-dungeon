import { IDLE_TOUCH, joystickVector, swipeSteps, type TouchFrame } from '../adapters/touch';
import type { Vec2 } from '../core/vec';
import { h } from './window';

/**
 * On-screen touch controls (shown only with `html.touch`, see index.html):
 * a floating joystick in the left half (it appears where the thumb lands),
 * free taps in the right half (in canvas pixels of `tapTarget`), and a
 * cluster of buttons. Pointer events with pointer capture, so several
 * fingers work at once (move + attack); buttons show a pressed state.
 * Button ids `roll`, `fast`, `heavy` and `lock` feed the `TouchFrame`
 * (src/adapters/touch.ts maps it onto PlayerInput); others only call
 * `onPress`. A button with `swipe` reports horizontal swipe steps instead of
 * a tap when dragged.
 */
export interface TouchButtonSpec {
  id: string;
  label: string;
  /** Extra classes: `big` (main actions), `top` (small corner button), `wide`. */
  className?: string;
  swipe?: boolean;
  onPress?(): void;
}

export interface TouchControlsOptions {
  buttons: TouchButtonSpec[];
  /** Canvas the free taps are measured against; without it the right half takes no taps. */
  tapTarget?: HTMLCanvasElement;
  /** Called on a free tap (after it is recorded for `take`). */
  onTap?(): void;
  className?: string;
}

export interface TouchControls {
  element: HTMLElement;
  /** State for the next simulation step; edges (roll, lock tap, swipe, tap) are consumed. */
  take(): TouchFrame;
  /** The joystick vector right now (not consumed). */
  move(): Vec2;
  setHidden(id: string, hidden: boolean): void;
  setLabel(id: string, label: string): void;
  /** Suspended (a menu is open): everything is released and new touches are ignored. */
  setSuspended(suspended: boolean): void;
  dispose(): void;
}

/** Joystick radius in CSS pixels and dead zone as a fraction of it. */
export const STICK = { radius: 56, deadZone: 0.18 } as const;
/** Horizontal drag per target switch on a swipe button, CSS pixels. */
export const SWIPE_STEP_PX = 36;
/** A free tap: released within this time and distance. */
const TAP = { ms: 350, px: 14 } as const;

export function createTouchControls(options: TouchControlsOptions): TouchControls {
  const knob = h('div', { className: 'touch-knob' });
  const stick = h('div', { className: 'touch-stick' }, [knob]);
  const stickZone = h('div', { className: 'touch-zone touch-zone-left' });
  const tapZone = h('div', { className: 'touch-zone touch-zone-right' });
  const cluster = h('div', { className: 'touch-cluster' });
  const corner = h('div', { className: 'touch-corner' });
  const element = h('div', { className: ['touch-layer', options.className ?? ''].filter(Boolean).join(' ') }, [stickZone, tapZone, stick, cluster, corner]);
  element.addEventListener('contextmenu', (e) => e.preventDefault());

  let suspended = false;
  let move: Vec2 = { x: 0, y: 0 };
  let stickPointer: number | null = null;
  let stickOrigin: Vec2 = { x: 0, y: 0 };
  const held = new Set<string>();
  let roll = false;
  let lockTap = false;
  let swipe = 0;
  let tap: Vec2 | null = null;
  const buttons = new Map<string, HTMLButtonElement>();
  const releasers: (() => void)[] = [];

  const showStick = (visible: boolean) => stick.classList.toggle('is-visible', visible);
  const placeKnob = (offset: Vec2) => {
    const len = Math.hypot(offset.x, offset.y);
    const k = len > STICK.radius ? STICK.radius / len : 1;
    knob.style.transform = `translate(${offset.x * k}px, ${offset.y * k}px)`;
  };
  const releaseStick = () => {
    stickPointer = null;
    move = { x: 0, y: 0 };
    showStick(false);
    placeKnob({ x: 0, y: 0 });
  };

  stickZone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (suspended || stickPointer !== null) return;
    stickPointer = e.pointerId;
    stickZone.setPointerCapture?.(e.pointerId);
    stickOrigin = { x: e.clientX, y: e.clientY };
    stick.style.left = `${e.clientX}px`;
    stick.style.top = `${e.clientY}px`;
    showStick(true);
  });
  stickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointer) return;
    const point = { x: e.clientX, y: e.clientY };
    move = joystickVector(stickOrigin, point, STICK.radius, STICK.deadZone);
    placeKnob({ x: point.x - stickOrigin.x, y: point.y - stickOrigin.y });
  });
  const endStick = (e: PointerEvent) => {
    if (e.pointerId === stickPointer) releaseStick();
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);
  stickZone.addEventListener('lostpointercapture', endStick);

  const taps = new Map<number, { x: number; y: number; at: number }>();
  tapZone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (suspended) return;
    taps.set(e.pointerId, { x: e.clientX, y: e.clientY, at: e.timeStamp });
  });
  tapZone.addEventListener('pointerup', (e) => {
    const start = taps.get(e.pointerId);
    taps.delete(e.pointerId);
    const canvas = options.tapTarget;
    if (!start || !canvas || suspended) return;
    if (e.timeStamp - start.at > TAP.ms || Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP.px) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    tap = { x: ((e.clientX - rect.left) * canvas.width) / rect.width, y: ((e.clientY - rect.top) * canvas.height) / rect.height };
    options.onTap?.();
  });
  tapZone.addEventListener('pointercancel', (e) => taps.delete(e.pointerId));

  for (const spec of options.buttons) {
    const button = h('button', { type: 'button', className: ['touch-button', `touch-${spec.id}`, spec.className ?? ''].filter(Boolean).join(' '), textContent: spec.label });
    button.setAttribute('aria-label', spec.label);
    buttons.set(spec.id, button);
    let pointer: number | null = null;
    let startX = 0;
    let swiped = 0;
    const release = () => {
      if (pointer === null) return;
      pointer = null;
      held.delete(spec.id);
      button.classList.remove('is-pressed');
    };
    releasers.push(release);
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (suspended || pointer !== null) return;
      pointer = e.pointerId;
      button.setPointerCapture?.(e.pointerId);
      startX = e.clientX;
      swiped = 0;
      held.add(spec.id);
      button.classList.add('is-pressed');
      if (spec.id === 'roll') roll = true;
      spec.onPress?.();
    });
    button.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer || !spec.swipe) return;
      const steps = swipeSteps(e.clientX - startX, SWIPE_STEP_PX);
      if (steps !== swiped) {
        swipe += steps - swiped;
        swiped = steps;
      }
    });
    button.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pointer) return;
      if (spec.id === 'lock' && swiped === 0 && !suspended) lockTap = true;
      release();
    });
    button.addEventListener('pointercancel', (e) => {
      if (e.pointerId === pointer) release();
    });
    button.addEventListener('lostpointercapture', (e) => {
      if (e.pointerId === pointer) release();
    });
    // Keyboard and mouse clicks do nothing extra: the pointer events above are the input.
    (spec.className?.includes('top') ? corner : cluster).append(button);
  }

  const releaseAll = () => {
    releaseStick();
    for (const release of releasers) release();
    taps.clear();
    roll = false;
    lockTap = false;
    swipe = 0;
    tap = null;
  };
  const onBlur = () => releaseAll();
  window.addEventListener('blur', onBlur);

  return {
    element,
    take() {
      if (suspended) return IDLE_TOUCH;
      const frame: TouchFrame = { move, roll, fast: held.has('fast'), heavy: held.has('heavy'), lockHeld: held.has('lock'), lockTap, swipe, tap };
      roll = false;
      lockTap = false;
      swipe = 0;
      tap = null;
      return frame;
    },
    move: () => (suspended ? { x: 0, y: 0 } : move),
    setHidden(id, hidden) {
      const button = buttons.get(id);
      if (button && button.hidden !== hidden) button.hidden = hidden;
    },
    setLabel(id, label) {
      const button = buttons.get(id);
      if (button && button.textContent !== label) {
        button.textContent = label;
        button.setAttribute('aria-label', label);
      }
    },
    setSuspended(next) {
      suspended = next;
      releaseAll();
    },
    dispose() {
      window.removeEventListener('blur', onBlur);
      element.remove();
    },
  };
}
