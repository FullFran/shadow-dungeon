/**
 * Where the in-run touch buttons go, as pure math (CSS pixels). Genshin-style:
 * the left half is the floating joystick; the right thumb has one big main
 * attack (Fast) in the corner, Heavy and Roll hugging it (left and above),
 * Boost on the diagonal between them, and Area and the small Lock on an outer
 * arc (each clear of the others as a box, not only as a circle); Pause and Map
 * stack in the top-left corner for both hands (the canvas HUD's minimap holds the
 * top-right one, its status window starts right after them). Sizes
 * follow a scale setting (never under 44 px), positions respect the safe-area
 * insets, and a left-handed layout is the exact mirror. A lone main button
 * (the town's Talk) takes Fast's spot. src/ui/touch-controls.ts applies it.
 */

import { hudRects, hudScaleFor, hudSpace, TOUCH_STATUS_X } from './hud-layout';
import { playViewport } from '../adapters/viewport';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Button size settings (multipliers of the base sizes). */
export const TOUCH_SCALES = [0.85, 1, 1.2] as const;

export interface TouchLayoutOptions {
  scale?: number;
  leftHanded?: boolean;
}

/** A placed button: centre, size, and whether it is round (hit by distance) or a rounded rectangle. */
export interface ButtonPlace {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  round: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TouchLayout {
  buttons: Record<string, ButtonPlace>;
  /** Where a thumb landing starts the floating joystick. */
  stickZone: Rect;
}

/** Base diameters (px at scale 1). */
const SIZE = { main: 88, heavy: 64, roll: 64, boost: 56, area: 56, lock: 44 } as const;
const CORNER = { width: 72, height: 44 } as const;
const MIN = 44;
/** Distance from the safe edges, and between neighbours. */
const MARGIN = 14;
const GAP = 12;
/** Extra reach outside a button's edge that still hits it. */
const SLOP = 6;

/** Arc angles around the main button, degrees (screen: 180 = left, 270 = up). */
const ARC = { heavy: 180, roll: 270, boost: 225, area: 202.5, lock: 247.5 } as const;
type ArcId = keyof typeof ARC;
/** Inner ring first: each later button is pushed out until it clears the ones before it. */
const ARC_ORDER: readonly ArcId[] = ['heavy', 'roll', 'boost', 'area', 'lock'];
const MAIN_IDS = ['fast', 'talk'];

const sized = (base: number, scale: number): number => Math.max(MIN, Math.round(base * scale));

export function combatLayout(viewport: { width: number; height: number }, insets: Insets, ids: readonly string[], options: TouchLayoutOptions = {}): TouchLayout {
  const scale = options.scale ?? 1;
  const mirror = options.leftHanded === true;
  // Laid out for the right hand with the insets mirrored, then flipped.
  const safe = mirror ? { ...insets, left: insets.right, right: insets.left } : insets;
  const { width: W, height: H } = viewport;
  const placed: ButtonPlace[] = [];

  const main = sized(SIZE.main, scale);
  const cx = W - safe.right - MARGIN - main / 2;
  const cy = H - safe.bottom - MARGIN - main / 2;
  const mainId = ids.find((id) => MAIN_IDS.includes(id));
  const mainPlace: ButtonPlace = { id: mainId ?? 'fast', x: cx, y: cy, width: main, height: main, round: true };
  if (mainId) placed.push(mainPlace);

  const gap = Math.max(10, Math.round(GAP * scale));
  const ring: ButtonPlace[] = [mainPlace];
  for (const id of ARC_ORDER) {
    if (!ids.includes(id)) continue;
    const size = sized(SIZE[id], scale);
    const angle = (ARC[id] * Math.PI) / 180;
    let r = main / 2 + gap + size / 2;
    // Clear as boxes (what a browser measures), which is stricter than as circles on the diagonals.
    const clear = (x: number, y: number) => ring.every((o) => Math.max(Math.abs(o.x - x) - (o.width + size) / 2, Math.abs(o.y - y) - (o.height + size) / 2) >= gap);
    while (!clear(cx + r * Math.cos(angle), cy + r * Math.sin(angle))) r += 1;
    const place = { id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), width: size, height: size, round: true };
    ring.push(place);
    placed.push(place);
  }

  // Pause over Map in the top-left corner, as wide as the room before the canvas HUD's status window allows (never under 44 px).
  const zoom = Math.max(1, Math.min(W, H) / 320);
  const insetLeft = insets.left;
  const roomBefore = Math.floor(TOUCH_STATUS_X * zoom - insetLeft - MARGIN - 4);
  const cornerW = roomBefore >= MIN ? Math.min(sized(CORNER.width, scale), roomBefore) : H > W ? MIN : sized(CORNER.width, scale);
  const cornerH = sized(CORNER.height, scale);
  const corner: ButtonPlace[] = [];
  // A notch on the left (an iPhone in landscape) can leave less than a button's width before the status window: then Pause
  // and Map stand under the HUD's left column (status, chips, partners) instead of over it.
  // Portrait is covered by the rotate notice (src/ui/orientation-gate.ts): only landscape moves the corner.
  const fitsBefore = H > W || insetLeft + MARGIN + MIN + 4 <= TOUCH_STATUS_X * zoom;
  let top = safe.top + MARGIN + cornerH / 2;
  if (!fitsBefore) {
    const fit = playViewport(W, H, 3, true);
    const hud = hudSpace(fit.viewWidth * fit.pixelScale, fit.viewHeight * fit.pixelScale, hudScaleFor(W, H, fit.pixelScale, true));
    const rects = hudRects({ ...hud }, { chip: true, slots: 4, partners: 3, minimap: { cols: 60, rows: 40 }, touch: true });
    const bottom = Math.max(...[rects.status, rects.chips, ...rects.partners].map((p) => p.y + p.height)) * fit.zoom;
    top = bottom + MARGIN + cornerH / 2;
  }
  // Left hand with a notch on the left: the thumb cluster holds the left side under the HUD, so Pause joins Map in the other top corner.
  const pauseAcross = mirror && !fitsBefore;
  const acrossW = sized(CORNER.width, scale);
  const acrossTop = safe.top + MARGIN + cornerH / 2;
  if (ids.includes('pause') && pauseAcross) placed.push({ id: 'pause', x: safe.left + MARGIN + acrossW / 2, y: acrossTop, width: acrossW, height: cornerH, round: false });
  else if (ids.includes('pause')) corner.push({ id: 'pause', x: 0, y: top, width: cornerW, height: cornerH, round: false });
  // Right hand: Map under Pause. Left hand: the thumb cluster takes the left side, so Map goes to the other top corner.
  if (ids.includes('map') && !mirror) corner.push({ id: 'map', x: 0, y: top + (corner.length > 0 ? cornerH + 8 : 0), width: cornerW, height: cornerH, round: false });
  if (ids.includes('map') && mirror) placed.push({ id: 'map', x: safe.left + MARGIN + acrossW / 2, y: pauseAcross ? acrossTop + cornerH + 8 : acrossTop, width: acrossW, height: cornerH, round: false });

  const buttons: Record<string, ButtonPlace> = {};
  for (const p of placed) buttons[p.id] = mirror ? { ...p, x: W - p.x } : p;
  // Not mirrored: the corner stays where the HUD leaves room for it.
  for (const p of corner) buttons[p.id] = { ...p, x: insetLeft + MARGIN + cornerW / 2 };
  const half = W / 2;
  return { buttons, stickZone: { x: mirror ? half : 0, y: 0, width: half, height: H } };
}

/** The button under `point` (with a little slop), the nearest when slops overlap; null on open ground. */
export function hitButton(layout: TouchLayout, point: { x: number; y: number }): string | null {
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const b of Object.values(layout.buttons)) {
    let score: number;
    if (b.round) score = Math.hypot(point.x - b.x, point.y - b.y) - b.width / 2;
    else score = Math.max(Math.abs(point.x - b.x) - b.width / 2, Math.abs(point.y - b.y) - b.height / 2);
    if (score <= SLOP && score < bestScore) {
      best = b.id;
      bestScore = score;
    }
  }
  return best;
}
