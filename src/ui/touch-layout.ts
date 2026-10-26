/**
 * Where the in-run touch buttons go, as pure math (CSS pixels). Genshin-style:
 * the left half is the floating joystick; the right thumb has one big main
 * attack (Fast) in the corner, Heavy and Roll hugging it (left and above),
 * Boost on the diagonal between them, and Area and the small Lock on an outer
 * arc; Pause and Map sit in the top corners, away from both thumbs. Sizes
 * follow a scale setting (never under 44 px), positions respect the safe-area
 * insets, and a left-handed layout is the exact mirror. A lone main button
 * (the town's Talk) takes Fast's spot. src/ui/touch-controls.ts applies it.
 */

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
    const clear = (x: number, y: number) => ring.every((o) => Math.hypot(o.x - x, o.y - y) >= o.width / 2 + size / 2 + gap);
    while (!clear(cx + r * Math.cos(angle), cy + r * Math.sin(angle))) r += 1;
    const place = { id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), width: size, height: size, round: true };
    ring.push(place);
    placed.push(place);
  }

  const cornerW = sized(CORNER.width, scale);
  const cornerH = sized(CORNER.height, scale);
  const top = safe.top + MARGIN + cornerH / 2;
  if (ids.includes('pause')) placed.push({ id: 'pause', x: safe.left + MARGIN + cornerW / 2, y: top, width: cornerW, height: cornerH, round: false });
  if (ids.includes('map')) placed.push({ id: 'map', x: W - safe.right - MARGIN - cornerW / 2, y: top, width: cornerW, height: cornerH, round: false });

  const buttons: Record<string, ButtonPlace> = {};
  for (const p of placed) buttons[p.id] = mirror ? { ...p, x: W - p.x } : p;
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
