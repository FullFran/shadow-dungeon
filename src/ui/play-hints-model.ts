import { INTERACT_KEY_CODES, LOCK_KEYS, MAP_KEY, MENU_KEY, MOVE_KEY_CODES, ROLL_KEY, SLOT_KEY_CODES, SPECTATE_KEY, keyLabel } from '../adapters/bindings';
import { GAMEPAD_HELP, buttonName, type PadStyle } from '../app/gamepad-help-data';
import type { FightKind } from './combat-hud-model';
import { HUD_BOX, type HudDims, hudRects } from './hud-layout';

/**
 * What the in-game hint bar shows (.agents/DESIGN.md §4 "Hint bar"): the actions available right now with the
 * glyph of the device in use. Pure. Keyboard glyphs come from the same binding table the input code reads
 * (src/adapters/bindings.ts) and the pad glyphs from the controller help table (app/gamepad-help-data.ts), so a
 * label can never differ from the key or button that does the thing. Touch shows nothing: its buttons are on screen.
 */
export type HintDevice = 'keyboard' | 'gamepad' | 'touch';
export type HintPlace = 'town' | 'run';
export type HintId = 'move' | 'attack' | 'roll' | 'lock' | 'map' | 'wheel' | 'menu' | 'next';

export interface HintContext {
  device: HintDevice;
  place: HintPlace;
  /** The floor has a minimap to show. */
  minimap: boolean;
  /** Co-op, fainted: watching a teammate. */
  spectating: boolean;
  padStyle: PadStyle;
}

export interface HintGlyph {
  kind: 'key' | 'pad';
  /** A `KeyboardEvent.code`, or a pad button id (gamepad-help-data.ts). */
  id: string;
  label: string;
}

export interface Hint {
  id: HintId;
  /** Catalog key of the action's short name. */
  labelKey: string;
  glyphs: HintGlyph[];
}

const LABELS: Record<HintId, string> = {
  move: 'hint.move',
  attack: 'hint.attack',
  roll: 'controls.short.roll',
  lock: 'controls.short.lock',
  map: 'hint.map',
  wheel: 'hint.wheel',
  menu: 'controls.short.menu',
  next: 'spectate.next',
};

const keys = (codes: readonly string[]): HintGlyph[] => codes.map((id) => ({ kind: 'key', id, label: keyLabel(id) }));
const pad = (buttons: readonly string[], style: PadStyle): HintGlyph[] => buttons.map((id) => ({ kind: 'pad', id, label: buttonName(id, style) }));
const row = (context: 'combat' | 'menus', action: string): readonly string[] => GAMEPAD_HELP[context].find((r) => r.action === action)?.buttons ?? [];

/** The first of each side's keys, up-left-down-right (WASD). */
const MOVE_FIRST = [MOVE_KEY_CODES.up[0], MOVE_KEY_CODES.left[0], MOVE_KEY_CODES.down[0], MOVE_KEY_CODES.right[0]];

function keyboardGlyphs(id: HintId): readonly string[] {
  switch (id) {
    case 'move':
      return MOVE_FIRST;
    case 'attack':
      return SLOT_KEY_CODES.map((slot) => slot[0]!);
    case 'roll':
      return [ROLL_KEY];
    case 'lock':
      return [LOCK_KEYS[0]!];
    case 'map':
    case 'wheel':
      return [MAP_KEY];
    case 'menu':
      return [MENU_KEY];
    case 'next':
      return [SPECTATE_KEY];
  }
}

function padGlyphs(id: HintId): readonly string[] {
  switch (id) {
    case 'move':
      return row('combat', 'move');
    case 'attack':
      return ['fast', 'heavy', 'boost', 'area'].map((action) => row('combat', action)[0]!);
    case 'roll':
      return row('combat', 'roll');
    case 'lock':
      return [row('combat', 'lock')[0]!];
    case 'map':
    case 'wheel':
      return row('combat', 'minimap');
    case 'menu':
      return row('combat', 'menu');
    case 'next':
      return [];
  }
}

function idsFor(ctx: HintContext): HintId[] {
  if (ctx.device === 'touch') return [];
  if (ctx.place === 'town') return ['move', 'wheel', 'menu'];
  // A fainted co-op player cannot move or attack; only the keyboard has a key for the next teammate.
  if (ctx.spectating) return [...(ctx.device === 'keyboard' ? (['next'] as const) : []), ...(ctx.minimap ? (['map'] as const) : []), 'menu'];
  return ['move', 'attack', 'roll', 'lock', ...(ctx.minimap ? (['map'] as const) : []), 'menu'];
}

export function hintsFor(ctx: HintContext): Hint[] {
  return idsFor(ctx).map((id) => ({
    id,
    labelKey: LABELS[id],
    glyphs: ctx.device === 'gamepad' ? pad(padGlyphs(id), ctx.padStyle) : keys(keyboardGlyphs(id)),
  }));
}

/** Changes whenever the bar would look different (device, pad style, which hints). */
export const hintSignature = (ctx: HintContext, hints: readonly Hint[]): string => `${ctx.device}${ctx.device === 'gamepad' ? `:${ctx.padStyle}` : ''}|${ctx.place}|${hints.map((h) => h.id).join(',')}`;

export interface HintFade {
  /** Tells the fade the context now on screen; a different one shows the bar again. */
  touch(signature: string, nowMs: number): void;
  visible(nowMs: number): boolean;
}

/** The bar stays this long after the context last changed. */
export const HINT_HOLD_MS = 5000;

export function createHintFade(holdMs = HINT_HOLD_MS): HintFade {
  let last: string | null = null;
  let since = 0;
  return {
    touch(signature, nowMs) {
      if (signature === last) return;
      last = signature;
      since = nowMs;
    },
    visible: (nowMs) => last !== null && nowMs - since < holdMs,
  };
}

/** The free stretch along the bottom edge, in HUD pixels: between the message log and the first move slot, on the HUD's own bottom margin. */
export interface HintBand {
  left: number;
  right: number;
  bottom: number;
}

export function hintBand(space: HudDims, slots: number): HintBand {
  const { margin, slotGap: gap } = HUD_BOX;
  const rects = hudRects(space, { chip: false, slots });
  const bottomRow = rects.slots.filter((slot) => slot.y + slot.height >= space.height - margin);
  const right = bottomRow.length > 0 ? Math.min(...bottomRow.map((slot) => slot.x)) - gap : space.width - margin;
  return { left: rects.log.x + rects.log.width + gap, right, bottom: margin };
}

/**
 * The glyphs of the "use what is in range" action, for the world tooltip and the dialogue box (the bar no longer
 * carries it): the town answers to E (Enter and Space too), the pad to its confirm button, touch taps the element.
 */
export function interactGlyphs(device: HintDevice, style: PadStyle): HintGlyph[] {
  if (device === 'touch') return [];
  if (device === 'gamepad') return pad(row('menus', 'confirm'), style);
  return keys(INTERACT_KEY_CODES.slice(0, 1));
}

export interface HintSizes {
  /** Chip height, CSS px. */
  chip: number;
  /** Keycap height. */
  keycap: number;
  /** Label font size. */
  label: number;
  /** Pad glyph height. */
  pad: number;
  /** Whether the action names show next to the glyphs; a fight shows keycaps only. */
  labels: boolean;
}

/**
 * Owner, 2026-11-04 ("más grande las ayudas visuales"): the bar is sized from the window's height. Desktop never goes
 * under a 40 px chip, a 28 px keycap and a 16 px label; only a short window (a landscape laptop pushed to its limit)
 * steps down, so the bar keeps clear of the HUD there.
 */
export function hintSizes(windowHeight: number, fight: FightKind = 'calm'): HintSizes {
  // Fix pass 3 (owner, 2026-11-04): with enemies near or a boss fight the bar was the largest thing on screen, so it
  // shrinks to a row of small keycaps (no labels, 28 px chips); the large size stays for the calm and the town.
  if (fight !== 'calm') return { chip: 28, keycap: 20, label: 12, pad: 20, labels: false };
  if (windowHeight >= 800) return { chip: 48, keycap: 32, label: 18, pad: 30, labels: true };
  if (windowHeight >= 540) return { chip: 42, keycap: 28, label: 16, pad: 26, labels: true };
  return { chip: 34, keycap: 24, label: 14, pad: 22, labels: true };
}
