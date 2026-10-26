import { dragAim, IDLE_TOUCH, joystickVector, swipeSteps, type CastMode, type TouchFrame } from '../adapters/touch';
import type { Vec2 } from '../core/vec';
import type { SlotButtonState } from '../adapters/touch-slots';
import { onTouchPrefs, touchPrefs } from '../adapters/touch-mode';
import { combatLayout, hitButton, type Insets, type TouchLayout } from './touch-layout';
import { h } from './window';

/**
 * On-screen touch controls (shown only with `html.touch`, see index.html):
 * a floating joystick in one half (it appears where the thumb lands; the
 * left half, the right one when left-handed), free taps in the other half (in
 * canvas pixels of `tapTarget`), and the buttons placed by the pure layout in
 * src/ui/touch-layout.ts (main attack in the thumb corner, an arc around it,
 * Pause and Map in the top corners; safe areas, size, opacity and hand from
 * the touch preferences). Every finger is routed by where it lands (the
 * layout's hit test, with a little slop around each button) and then followed
 * by its pointer id on the window, never by the event target: a browser that
 * retargets a second touch to the first one's capture (seen in Firefox) still
 * gets move + attack at once. Buttons show a pressed state.
 * Button ids `roll`, `fast`, `heavy`, `boost`, `area` and `lock` feed the `TouchFrame`
 * (src/adapters/touch.ts maps it onto PlayerInput); others only call
 * `onPress`. A button with `swipe` reports horizontal swipe steps instead of
 * a tap when dragged. A slot button dragged past a dead zone aims its slot
 * (`aimPreview` for the renderer); its cast mode says when it presses.
 */
export interface TouchButtonSpec {
  id: string;
  label: string;
  /** Extra classes: `big` (main actions), `small` (boost / area), `top` (small corner button), `wide`. */
  className?: string;
  swipe?: boolean;
  onPress?(): void;
}

export interface TouchControlsOptions {
  buttons: TouchButtonSpec[];
  /** Canvas the free taps are measured against; without it the other half takes no taps. */
  tapTarget?: HTMLCanvasElement;
  /** Called on a free tap (after it is recorded for `take`). */
  onTap?(): void;
  className?: string;
  /** How each slot button (fast, heavy, boost, area) casts (src/adapters/touch.ts `slotCastMode`); default `press`. */
  castMode?(id: string): CastMode;
}

export interface TouchControls {
  element: HTMLElement;
  /** State for the next simulation step; edges (roll, lock tap, swipe, tap, a release cast) are consumed. */
  take(): TouchFrame;
  /** The joystick vector right now (not consumed). */
  move(): Vec2;
  setHidden(id: string, hidden: boolean): void;
  setLabel(id: string, label: string): void;
  /** A slot button's move: its name as the label, the cooldown sweep and seconds, rank pips, ready / running / charge (src/adapters/touch-slots.ts). */
  setSlot(id: string, name: string, state: SlotButtonState | null): void;
  /** Suspended (a menu is open): everything is released and new touches are ignored. */
  setSuspended(suspended: boolean): void;
  /** The direction of a slot button being dragged to aim (for the aim preview), or null. */
  aimPreview(): Vec2 | null;
  /** Places the buttons again (after a resize or a preference change; also done on its own). */
  relayout(): void;
  dispose(): void;
}

/** Joystick radius in CSS pixels and dead zone as a fraction of it. */
export const STICK = { radius: 56, deadZone: 0.18 } as const;
/** Horizontal drag per target switch on a swipe button, CSS pixels. */
export const SWIPE_STEP_PX = 36;
/** A free tap: released within this time and distance. */
const TAP = { ms: 350, px: 14 } as const;
/** Slot buttons and their slot index. */
const SLOT_OF: Record<string, number> = { fast: 0, heavy: 1, boost: 2, area: 3 };

/** What a finger drives until it lifts. */
interface Gesture {
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  /** Let go without effect (cancel, blur, suspend). */
  drop(): void;
}

export function createTouchControls(options: TouchControlsOptions): TouchControls {
  const knob = h('div', { className: 'touch-knob' });
  const stick = h('div', { className: 'touch-stick' }, [knob]);
  const stickZone = h('div', { className: 'touch-zone touch-zone-left' });
  const tapZone = h('div', { className: 'touch-zone touch-zone-right' });
  const insetProbe = h('div', { className: 'touch-insets' });
  const element = h('div', { className: ['touch-layer', options.className ?? ''].filter(Boolean).join(' ') }, [stickZone, tapZone, stick, insetProbe]);
  element.addEventListener('contextmenu', (e) => e.preventDefault());

  let suspended = false;
  let layout: TouchLayout | null = null;
  let move: Vec2 = { x: 0, y: 0 };
  const held = new Set<string>();
  let roll = false;
  let lockTap = false;
  let swipe = 0;
  let tap: Vec2 | null = null;
  /** The slot button held to aim (hold / release modes) and its drag direction so far. */
  let aiming: { id: string; slot: number; dir: Vec2 | null } | null = null;
  /** Release-mode casts waiting for the next step: the slot is held for that one step with the aim it was lifted with. */
  const casts: { id: string; slot: number; dir: Vec2 | null }[] = [];
  const buttons = new Map<string, HTMLButtonElement>();
  const specs = new Map<string, TouchButtonSpec>();
  const gestures = new Map<number, Gesture>();
  const slotKeys = new Map<string, string>();

  const showStick = (visible: boolean) => stick.classList.toggle('is-visible', visible);
  const placeKnob = (offset: Vec2) => {
    const len = Math.hypot(offset.x, offset.y);
    const k = len > STICK.radius ? STICK.radius / len : 1;
    knob.style.transform = `translate(${offset.x * k}px, ${offset.y * k}px)`;
  };

  let stickBusy = false;
  const stickGesture = (e: PointerEvent): Gesture | null => {
    if (stickBusy) return null;
    stickBusy = true;
    const origin = { x: e.clientX, y: e.clientY };
    stick.style.left = `${origin.x}px`;
    stick.style.top = `${origin.y}px`;
    showStick(true);
    const end = () => {
      stickBusy = false;
      move = { x: 0, y: 0 };
      showStick(false);
      placeKnob({ x: 0, y: 0 });
    };
    return {
      move(ev) {
        const point = { x: ev.clientX, y: ev.clientY };
        move = joystickVector(origin, point, STICK.radius, STICK.deadZone);
        placeKnob({ x: point.x - origin.x, y: point.y - origin.y });
      },
      up: end,
      drop: end,
    };
  };

  const tapGesture = (e: PointerEvent): Gesture => {
    const start = { x: e.clientX, y: e.clientY, at: e.timeStamp };
    return {
      move() {},
      up(ev) {
        const canvas = options.tapTarget;
        if (!canvas || suspended || !Number.isFinite(ev.clientX)) return;
        if (ev.timeStamp - start.at > TAP.ms || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > TAP.px) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
        tap = { x: ((ev.clientX - rect.left) * canvas.width) / rect.width, y: ((ev.clientY - rect.top) * canvas.height) / rect.height };
        options.onTap?.();
      },
      drop() {},
    };
  };

  /** Buttons with a finger on them (a second finger on a held button is ignored). */
  const busy = new Set<string>();
  const buttonGesture = (spec: TouchButtonSpec, e: PointerEvent): Gesture | null => {
    if (busy.has(spec.id)) return null;
    const button = buttons.get(spec.id)!;
    const slot = SLOT_OF[spec.id];
    const mode: CastMode = slot === undefined ? 'press' : (options.castMode?.(spec.id) ?? 'press');
    const start = { x: e.clientX, y: e.clientY };
    let swiped = 0;
    busy.add(spec.id);
    // A release-mode button only aims while held; it casts when lifted.
    if (mode !== 'release') held.add(spec.id);
    if (slot !== undefined && mode !== 'press') aiming = { id: spec.id, slot, dir: null };
    button.classList.add('is-pressed');
    if (spec.id === 'roll') roll = true;
    spec.onPress?.();
    const end = () => {
      busy.delete(spec.id);
      held.delete(spec.id);
      if (aiming?.id === spec.id) aiming = null;
      button.classList.remove('is-pressed', 'is-aiming');
    };
    return {
      move(ev) {
        if (aiming?.id === spec.id) {
          aiming = { ...aiming, dir: dragAim(start, { x: ev.clientX, y: ev.clientY }) };
          button.classList.toggle('is-aiming', aiming.dir !== null);
        }
        if (!spec.swipe) return;
        const steps = swipeSteps(ev.clientX - start.x, SWIPE_STEP_PX);
        if (steps !== swiped) {
          swipe += steps - swiped;
          swiped = steps;
        }
      },
      up() {
        if (!suspended) {
          if (spec.id === 'lock' && swiped === 0) lockTap = true;
          if (slot !== undefined && mode === 'release') casts.push({ id: spec.id, slot, dir: aiming?.id === spec.id ? aiming.dir : null });
        }
        end();
      },
      drop: end,
    };
  };

  for (const spec of options.buttons) {
    const button = h('button', { type: 'button', className: ['touch-button', `touch-${spec.id}`, spec.className ?? ''].filter(Boolean).join(' ') }, [
      h('span', { className: 'touch-label', textContent: spec.label }),
      h('span', { className: 'touch-cd' }),
      h('span', { className: 'touch-pips' }),
    ]);
    button.setAttribute('aria-label', spec.label);
    buttons.set(spec.id, button);
    specs.set(spec.id, spec);
    // Keyboard and mouse clicks do nothing extra: the pointer router below is the input.
    element.append(button);
  }

  /** A finger lands on the layer: a shown button under it (with slop), else the joystick half, else the tap half. */
  const onDown = (e: PointerEvent) => {
    if (!layout || !(e.target instanceof Node) || !element.contains(e.target)) return;
    e.preventDefault();
    if (suspended || gestures.has(e.pointerId)) return;
    const point = { x: e.clientX, y: e.clientY };
    const shown = Object.fromEntries(Object.entries(layout.buttons).filter(([id]) => !buttons.get(id)?.hidden));
    const id = hitButton({ ...layout, buttons: shown }, point);
    const zone = layout.stickZone;
    const inStick = point.x >= zone.x && point.x < zone.x + zone.width;
    const spec = id ? specs.get(id) : undefined;
    const gesture = spec ? buttonGesture(spec, e) : inStick ? stickGesture(e) : tapGesture(e);
    if (gesture) gestures.set(e.pointerId, gesture);
  };
  const onMove = (e: PointerEvent) => gestures.get(e.pointerId)?.move(e);
  const onUp = (e: PointerEvent) => {
    const gesture = gestures.get(e.pointerId);
    if (!gesture) return;
    gestures.delete(e.pointerId);
    gesture.up(e);
  };
  const onCancel = (e: PointerEvent) => {
    const gesture = gestures.get(e.pointerId);
    gestures.delete(e.pointerId);
    gesture?.drop();
  };
  // Safety net: when the last finger lifts, nothing may stay held, even if a pointerup was lost
  // (seen in Firefox when two fingers lift in the same frame). A lost tap is not replayed.
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length > 0 || gestures.size === 0) return;
    const ending = [...gestures.values()];
    gestures.clear();
    for (const gesture of ending) (e.type === 'touchcancel' ? gesture.drop() : gesture.up(e as unknown as PointerEvent));
  };
  window.addEventListener('touchend', onTouchEnd, { capture: true });
  window.addEventListener('touchcancel', onTouchEnd, { capture: true });
  window.addEventListener('pointerdown', onDown, { capture: true, passive: false });
  window.addEventListener('pointermove', onMove, { capture: true });
  window.addEventListener('pointerup', onUp, { capture: true });
  window.addEventListener('pointercancel', onCancel, { capture: true });

  /** Safe-area insets as the CSS sees them (`env()` is only readable through a styled element). */
  const readInsets = (): Insets => {
    const style = getComputedStyle(insetProbe);
    const px = (v: string) => Number.parseFloat(v) || 0;
    return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
  };
  const place = (el: HTMLElement, x: number, y: number, width: number, height: number) => {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  };
  const relayout = () => {
    if (!element.isConnected) return;
    const prefs = touchPrefs();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    layout = combatLayout(viewport, readInsets(), [...buttons.keys()], prefs);
    for (const [id, button] of buttons) {
      const at = layout.buttons[id];
      if (at) place(button, at.x - at.width / 2, at.y - at.height / 2, at.width, at.height);
    }
    const zone = layout.stickZone;
    place(stickZone, zone.x, zone.y, zone.width, zone.height);
    place(tapZone, zone.x === 0 ? zone.width : 0, 0, viewport.width - zone.width, viewport.height);
    element.style.setProperty('--touch-alpha', String(prefs.opacity));
  };
  const onResize = () => relayout();
  window.addEventListener('resize', onResize);
  const stopPrefs = onTouchPrefs(() => relayout());
  // Placed once attached (the insets and the viewport need the document).
  requestAnimationFrame(relayout);

  const releaseAll = () => {
    for (const gesture of gestures.values()) gesture.drop();
    gestures.clear();
    aiming = null;
    casts.length = 0;
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
      // One release-mode cast per step, held for that step with the aim it was lifted with.
      const cast = casts.shift();
      const on = (id: string) => held.has(id) || cast?.id === id;
      const aim = cast ? { slot: cast.slot, dir: cast.dir } : aiming && held.has(aiming.id) ? { slot: aiming.slot, dir: aiming.dir } : null;
      const frame: TouchFrame = { move, roll, fast: on('fast'), heavy: on('heavy'), boost: on('boost'), area: on('area'), lockHeld: held.has('lock'), lockTap, swipe, tap, aim };
      roll = false;
      lockTap = false;
      swipe = 0;
      tap = null;
      return frame;
    },
    move: () => (suspended ? { x: 0, y: 0 } : move),
    aimPreview: () => (suspended ? null : (aiming?.dir ?? null)),
    setHidden(id, hidden) {
      const button = buttons.get(id);
      if (button && button.hidden !== hidden) button.hidden = hidden;
    },
    setLabel(id, label) {
      const button = buttons.get(id);
      const text = button?.querySelector('.touch-label');
      if (button && text && text.textContent !== label) {
        text.textContent = label;
        button.setAttribute('aria-label', label);
      }
    },
    setSlot(id, name, state) {
      const button = buttons.get(id);
      if (!button) return;
      // Written only when something shown changes (this runs every frame).
      const key = state ? `${name}|${state.cooldown.toFixed(2)}|${state.seconds}|${state.rank}|${state.ready}|${state.active}|${state.charge.toFixed(2)}` : '';
      if (slotKeys.get(id) === key) return;
      slotKeys.set(id, key);
      if (!state) return;
      this.setLabel(id, name);
      button.style.setProperty('--cd', state.cooldown.toFixed(3));
      button.style.setProperty('--charge', state.charge.toFixed(3));
      button.classList.toggle('is-cooling', state.seconds !== null);
      button.classList.toggle('is-starved', !state.ready && state.seconds === null);
      button.classList.toggle('is-active', state.active);
      button.querySelector('.touch-cd')!.textContent = state.seconds === null ? '' : String(state.seconds);
      const pips = button.querySelector('.touch-pips')!;
      const want = state.rank > 0 ? `${state.rank}/${state.maxRank}` : '';
      if (pips.getAttribute('data-rank') !== want) {
        pips.setAttribute('data-rank', want);
        pips.replaceChildren(...(state.rank > 0 ? Array.from({ length: state.maxRank }, (_, i) => h('i', { className: i < state.rank ? 'on' : '' })) : []));
      }
    },
    setSuspended(next) {
      suspended = next;
      releaseAll();
    },
    relayout,
    dispose() {
      releaseAll();
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('touchend', onTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', onTouchEnd, { capture: true });
      window.removeEventListener('pointermove', onMove, { capture: true });
      window.removeEventListener('pointerup', onUp, { capture: true });
      window.removeEventListener('pointercancel', onCancel, { capture: true });
      stopPrefs();
      element.remove();
    },
  };
}
