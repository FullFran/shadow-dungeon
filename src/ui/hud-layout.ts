/**
 * Where the canvas HUD goes, as pure math (.agents/DESIGN.md §4 "Combat HUD"). The HUD is drawn in its own
 * "HUD space": the canvas divided by a HUD scale.
 *
 * HUD scale rule. The panels are authored for a 640x360 HUD space (their text is the 11 px pixel-font grid), so the
 * scale is "how many times 640x360 fits the window":
 * - desktop: 2 at 1280x720, 3 at 1920x1080, 4 at 2560x1440; below 2 it moves in half steps (1.5 at 1024x640) and never
 *   drops under 1. Between whole steps it rounds down with a 0.35 bias, so 1700x950 (2.64) stays at 2 and gets a
 *   wider space instead of oversized panels.
 * - touch: the canvas scale, so the HUD space is the 512x320 (or wider) view of a phone held sideways, which gets the
 *   compact variant of every panel.
 * A space 340 or more high uses the regular metrics, a lower one the compact metrics.
 */
export interface HudBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HudSpace {
  /** Backing-store pixels per HUD pixel. */
  scale: number;
  width: number;
  height: number;
}

export type HudVariant = 'regular' | 'compact';

/** The HUD space (in HUD px) the panels are authored for; one scale step is this much of the window. */
const DESKTOP_STEP = { width: 640, height: 360 } as const;

/** Bias of the whole-step rounding: 0.35 means 2.65 steps already count as 3. */
const ROUND_BIAS = 0.35;

/** Panel sizes that do not depend on the variant, in HUD pixels. */
export const HUD_BOX = {
  margin: 8,
  slotGap: 4,
  /** The message log (src/adapters/message-log.ts): 4 lines of 13 px plus padding, 236 wide. */
  logWidth: 236,
  logHeight: 4 * 13 + 9,
  /** The minimap (src/adapters/minimap.ts): 3 px per tile, 10 px from the top-right corner, a 4 px frame. */
  minimapTilePx: 3,
  minimapMargin: 10,
  minimapFrame: 4,
} as const;

/** Sizes per variant, in HUD pixels. */
export interface HudMetrics {
  margin: number;
  statusWidth: number;
  statusHeight: number;
  /** The one-line held-items chip under the status window. */
  chipHeight: number;
  /** The partner portrait box of the status window (a `sprite-box`: the creature is fitted whole inside). */
  portrait: number;
  partnerWidth: number;
  partnerHeight: number;
  partnerGap: number;
  /** A move slot is a square. */
  slot: number;
  slotGap: number;
  /** The boss block: name, epithet, bar and pips. */
  bossHeight: number;
  /** The boss block's bottom edge, from the bottom of the space. */
  bossBottom: number;
}

export const HUD_METRICS: Record<HudVariant, HudMetrics> = {
  regular: { margin: 8, statusWidth: 214, statusHeight: 78, chipHeight: 12, portrait: 44, partnerWidth: 214, partnerHeight: 22, partnerGap: 3, slot: 44, slotGap: 4, bossHeight: 64, bossBottom: 8 },
  compact: { margin: 6, statusWidth: 178, statusHeight: 62, chipHeight: 11, portrait: 36, partnerWidth: 78, partnerHeight: 22, partnerGap: 3, slot: 34, slotGap: 4, bossHeight: 52, bossBottom: 10 },
};

/** The regular metrics need this much height; a phone held sideways (320) and short windows use the compact ones. */
const REGULAR_MIN_HEIGHT = 340;

export const hudVariant = (space: Pick<HudSpace, 'height'>): HudVariant => (space.height >= REGULAR_MIN_HEIGHT ? 'regular' : 'compact');

/** HUD scale: the canvas scale on touch; on desktop how many 640x360 fit the window (whole steps from 2, half steps below). */
export function hudScaleFor(viewportWidth: number, viewportHeight: number, pixelScale: number, touch: boolean): number {
  if (touch) return pixelScale;
  const steps = Math.min(viewportWidth / DESKTOP_STEP.width, viewportHeight / DESKTOP_STEP.height);
  const scale = steps >= 2 ? Math.floor(steps + ROUND_BIAS) : Math.floor(steps * 2) / 2;
  return Math.max(1, scale);
}

/** The HUD space of a canvas of `canvasWidth` x `canvasHeight` backing pixels at `scale`. */
export const hudSpace = (canvasWidth: number, canvasHeight: number, scale: number): HudSpace => ({ scale, width: canvasWidth / scale, height: canvasHeight / scale });

export interface HudRects {
  variant: HudVariant;
  status: HudBox;
  /** Co-op partners' compact frames, in order: under the status window (touch: to its right). */
  partners: HudBox[];
  /** Move slots in slot order: a 2x2 block (or a row of up to two) at the bottom right; on touch not drawn (the thumb buttons carry the moves). */
  slots: HudBox[];
  /** The message log at its tallest (all lines showing). */
  log: HudBox;
  /** The boss block (name, epithet, bar, pips), bottom centre. */
  boss: HudBox;
  minimap: HudBox | null;
}

/** The status window: top left; one line taller with the held-items chip. */
export function statusRect(space: Pick<HudSpace, 'height'>, chip: boolean): HudBox {
  const m = HUD_METRICS[hudVariant(space)];
  return { x: m.margin, y: m.margin, width: m.statusWidth, height: m.statusHeight + (chip ? m.chipHeight : 0) };
}

/** Where the slot windows go on touch: the bottom right belongs to the action buttons (index.html `.touch-cluster`). */
export interface SlotPlacement {
  touch?: boolean;
  /** The status window carries the held-items chip (touch: the slots sit under it). */
  chip?: boolean;
}

/** Touch slot windows are not drawn; their boxes only reserve a clear spot under the status window for the layout checks. */
const TOUCH_SLOT = { width: 84, height: 30, gap: 4 } as const;

/** The block the slots take (width x height) so the boss block can keep clear of it. */
function slotBlock(space: Pick<HudSpace, 'height'>, count: number): { width: number; height: number } {
  const m = HUD_METRICS[hudVariant(space)];
  return count > 2 ? { width: 2 * m.slot + m.slotGap, height: 2 * m.slot + m.slotGap } : { width: count * m.slot + Math.max(0, count - 1) * m.slotGap, height: m.slot };
}

/**
 * Move slot `index` of `count`. Desktop: square relic slots in the bottom-right corner, a row up to two, a 2x2 block for
 * more (fast and heavy on top, boost and area under them). Touch: the bottom right is the action buttons', so the (undrawn)
 * windows sit in rows of two under the status window.
 */
export function slotRect(space: Pick<HudSpace, 'width' | 'height'>, index: number, count: number, placement: SlotPlacement = {}): HudBox {
  const m = HUD_METRICS[hudVariant(space)];
  if (placement.touch) {
    const status = statusRect(space, placement.chip === true);
    const column = count > 2 ? index % 2 : index;
    const row = count > 2 ? Math.floor(index / 2) : 0;
    return { x: m.margin + column * (TOUCH_SLOT.width + TOUCH_SLOT.gap), y: status.y + status.height + TOUCH_SLOT.gap + row * (TOUCH_SLOT.height + TOUCH_SLOT.gap), width: TOUCH_SLOT.width, height: TOUCH_SLOT.height };
  }
  const block = slotBlock(space, count);
  const left = space.width - m.margin - block.width;
  const top = space.height - m.margin - block.height;
  if (count <= 2) return { x: left + index * (m.slot + m.slotGap), y: top, width: m.slot, height: m.slot };
  return { x: left + (index % 2) * (m.slot + m.slotGap), y: top + Math.floor(index / 2) * (m.slot + m.slotGap), width: m.slot, height: m.slot };
}

/** The minimap frame for a `cols` x `rows` grid; the map itself starts `minimapFrame` inside. */
export function minimapRect(space: Pick<HudSpace, 'width'>, cols: number, rows: number): HudBox {
  const { minimapTilePx: px, minimapMargin: margin, minimapFrame: frame } = HUD_BOX;
  return { x: space.width - margin - cols * px - frame, y: margin - frame, width: cols * px + 2 * frame, height: rows * px + 2 * frame };
}

/** Boss block width as a share of the space: the Souls bar is long. */
const BOSS_SHARE = 0.57;
/** Touch: the bar keeps clear of the thumb buttons. */
const BOSS_TOUCH = { share: 0.55, max: 340 } as const;

/**
 * The boss block, bottom centre: ~57% of the width on desktop (never reaching into the slot block), about half on touch.
 * `slots` is how many slot windows are drawn (0 on touch).
 */
export function bossRect(space: Pick<HudSpace, 'width' | 'height'>, slots = 4, touch = false): HudBox {
  const m = HUD_METRICS[hudVariant(space)];
  let width: number;
  let bottom = m.bossBottom;
  if (touch) {
    width = Math.min(Math.round(space.width * BOSS_TOUCH.share), BOSS_TOUCH.max);
    // Above the message log of the bottom-left corner (the log stays at the bottom on touch).
    bottom = m.margin + HUD_BOX.logHeight + m.slotGap;
  } else {
    const reserve = slotBlock(space, Math.max(1, slots)).width + m.margin + m.slotGap * 2;
    width = Math.min(Math.round(space.width * BOSS_SHARE), space.width - 2 * reserve);
  }
  width = Math.max(200, Math.min(width, space.width - 2 * m.margin));
  return { x: Math.round((space.width - width) / 2), y: space.height - bottom - m.bossHeight, width, height: m.bossHeight };
}

export interface HudRectsOptions {
  chip: boolean;
  slots: number;
  minimap?: { cols: number; rows: number };
  touch?: boolean;
  /** A boss fight is on (default true: the layout always reserves the boss block); false drops the log to the bottom edge. */
  boss?: boolean;
  /** Co-op partners (their frames sit under the status window). */
  partners?: number;
}

export function hudRects(space: Pick<HudSpace, 'width' | 'height'>, options: HudRectsOptions): HudRects {
  const touch = options.touch === true;
  const variant = hudVariant(space);
  const m = HUD_METRICS[variant];
  const status = statusRect(space, options.chip);
  const boss = bossRect(space, touch ? 0 : options.slots, touch);
  const partners = Array.from({ length: options.partners ?? 0 }, (_, i): HudBox =>
    touch
      ? { x: status.x + status.width + m.partnerGap + i * (m.partnerWidth + m.partnerGap), y: m.margin, width: m.partnerWidth, height: m.partnerHeight }
      : { x: m.margin, y: status.y + status.height + m.partnerGap + i * (m.partnerHeight + m.partnerGap), width: m.partnerWidth, height: m.partnerHeight },
  );
  const lifted = options.boss !== false && !touch;
  const logBottom = lifted ? boss.y - m.slotGap : space.height - m.margin;
  return {
    variant,
    status,
    partners,
    slots: Array.from({ length: options.slots }, (_, i) => slotRect(space, i, options.slots, { touch, chip: options.chip })),
    log: { x: m.margin, y: logBottom - HUD_BOX.logHeight, width: HUD_BOX.logWidth, height: HUD_BOX.logHeight },
    boss,
    minimap: options.minimap ? minimapRect(space, options.minimap.cols, options.minimap.rows) : null,
  };
}

/** The hint bar's free band: from the left and right edge and from the bottom edge, in HUD px (src/ui/play-hints-model.ts `HintBand`). */
export interface BandLike {
  left: number;
  right: number;
  bottom: number;
}

/**
 * During a boss fight the hint bar rises over the boss block so the two never share the bottom edge. Only `bottom`
 * changes: the band's sides already clear the message log (which sits over the boss block's left) and the slots.
 */
export function liftHintBand<B extends BandLike>(band: B, boss: HudBox | null, space: Pick<HudSpace, 'height'>): B {
  if (!boss) return band;
  return { ...band, bottom: Math.max(band.bottom, space.height - boss.y + HUD_BOX.slotGap) };
}
