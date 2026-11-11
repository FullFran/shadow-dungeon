/**
 * Where the canvas HUD goes, as pure math (.agents/DESIGN.md §4 "Combat HUD"). The HUD is drawn in its own
 * "HUD space": the canvas divided by a HUD scale.
 *
 * HUD scale rule (second pass, owner 2026-11-04: minimalist and peripheral). The panels are authored for an 800x450
 * HUD space (their text is the 11 px pixel-font grid), so the scale is "how many times 800x450 fits the window",
 * rounded down to half steps and kept between 1 and 2:
 * - desktop: 1 up to 1599x899-ish windows (990x750 is 1), 1.5 at 1280x720 and 1440x900, 2 at 1920x1080 and above. A
 *   scale never passes 2: a bigger window shows more arena and a wider HUD space, not bigger panels.
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
const DESKTOP_STEP = { width: 800, height: 450 } as const;

/** The largest desktop HUD scale: bigger windows get a wider space, never bigger panels. */
const MAX_DESKTOP_SCALE = 2;

/** Panel sizes that do not depend on the variant, in HUD pixels. */
export const HUD_BOX = {
  margin: 8,
  slotGap: 4,
  /** The message log (src/adapters/message-log.ts): 2 lines of 12 px plus padding. */
  logWidth: 170,
  logHeight: 2 * 12 + 5,
  /** The minimap (src/adapters/minimap.ts): 4 HUD px per tile on desktop (3 on touch), 10 px from the top-right corner, a 4 px frame. */
  minimapTilePx: 4,
  minimapTilePxTouch: 3,
  minimapMargin: 10,
  minimapFrame: 4,
} as const;

/** Sizes per variant, in HUD pixels. */
export interface HudMetrics {
  margin: number;
  statusWidth: number;
  statusHeight: number;
  /** The row of floor and coin chips under the status window, and the extra line the held-items chip takes. */
  chipsHeight: number;
  chipHeight: number;
  /** The partner portrait box of the status window (a `sprite-box`: the creature is fitted whole inside). */
  portrait: number;
  partnerWidth: number;
  partnerHeight: number;
  partnerGap: number;
  slotGap: number;
  /** The boss block: name and epithet on one line, then the thin bar. */
  bossHeight: number;
  /** The boss block's bottom edge, from the bottom of the space. */
  bossBottom: number;
}

export const HUD_METRICS: Record<HudVariant, HudMetrics> = {
  regular: { margin: 8, statusWidth: 150, statusHeight: 44, chipsHeight: 15, chipHeight: 11, portrait: 36, partnerWidth: 150, partnerHeight: 20, partnerGap: 3, slotGap: 3, bossHeight: 26, bossBottom: 8 },
  compact: { margin: 6, statusWidth: 150, statusHeight: 44, chipsHeight: 15, chipHeight: 11, portrait: 36, partnerWidth: 104, partnerHeight: 20, partnerGap: 3, slotGap: 3, bossHeight: 26, bossBottom: 10 },
};

/** The regular metrics need this much height; a phone held sideways (320) and short windows use the compact ones. */
const REGULAR_MIN_HEIGHT = 340;

/** The pieces of a HUD space the layout reads; `scale` (backing px per HUD px) sizes the touch targets, 1.5 when absent. */
export type HudDims = Pick<HudSpace, 'width' | 'height'> & { scale?: number };

export const hudVariant = (space: Pick<HudSpace, 'height'>): HudVariant => (space.height >= REGULAR_MIN_HEIGHT ? 'regular' : 'compact');

/** Move slots are about 56 CSS px squares whatever the scale (owner 2026-11-04: bigger, so the key glyph fits whole), so a HUD px count that follows the scale. */
const SLOT_CSS = 56;
const DEFAULT_SCALE = 1.5;
export const slotSizeFor = (scale: number = DEFAULT_SCALE): number => Math.min(60, Math.max(24, Math.ceil(SLOT_CSS / scale)));

/** HUD scale: the canvas scale on touch; on desktop how many 800x450 fit the window, in half steps, between 1 and 2. */
export function hudScaleFor(viewportWidth: number, viewportHeight: number, pixelScale: number, touch: boolean): number {
  if (touch) return pixelScale;
  const steps = Math.min(viewportWidth / DESKTOP_STEP.width, viewportHeight / DESKTOP_STEP.height);
  return Math.min(MAX_DESKTOP_SCALE, Math.max(1, Math.floor(steps * 2) / 2));
}

/** The HUD space of a canvas of `canvasWidth` x `canvasHeight` backing pixels at `scale`. */
export const hudSpace = (canvasWidth: number, canvasHeight: number, scale: number): HudSpace => ({ scale, width: canvasWidth / scale, height: canvasHeight / scale });

export interface HudRects {
  variant: HudVariant;
  status: HudBox;
  /** The floor and coin chips under the status window (plus the held-items line when idle), which fade in combat. */
  chips: HudBox;
  /** Co-op partners' compact frames, in order, under the chips. */
  partners: HudBox[];
  /** Move slots in slot order: a 2x2 block (or a row of up to two) at the bottom right; none on touch (the thumb buttons carry the moves). */
  slots: HudBox[];
  /** The message log at its tallest (all lines showing), bottom left. */
  log: HudBox;
  /** The boss block (name, epithet, thin bar, pips), bottom centre. */
  boss: HudBox;
  /** The boss announcement strip, right above the boss block (drawn only while an event is announced). */
  caption: HudBox;
  minimap: HudBox | null;
}

/** Touch: the Pause button (src/ui/touch-layout.ts) holds the top-left corner, so the status window starts after it. */
export const TOUCH_STATUS_X = 68;

/** The status window: top left (touch: right of the Pause button). Its size never changes. */
export function statusRect(space: Pick<HudSpace, 'height'>, touch = false): HudBox {
  const m = HUD_METRICS[hudVariant(space)];
  return { x: touch ? TOUCH_STATUS_X : m.margin, y: m.margin, width: m.statusWidth, height: m.statusHeight };
}

/** The chips under the status window; `chip` adds the held-items line (shown only while idle). */
export function chipsRect(space: Pick<HudSpace, 'height'>, chip: boolean, touch = false): HudBox {
  const m = HUD_METRICS[hudVariant(space)];
  const status = statusRect(space, touch);
  return { x: status.x, y: status.y + status.height + 1, width: status.width, height: m.chipsHeight + (chip ? m.chipHeight : 0) };
}

/** The flash toast (level up, passive, disguise, dodge, item): a one-line plate, at most this wide and tall (HUD px). */
export const TOAST = { width: 190, height: 16, gap: 3 } as const;

/**
 * Where the flash toast goes (fix pass 3, owner 2026-11-04): in the left column under the status block, its chips and the
 * co-op frames, never in the arena's middle. It stays within the left quarter of the space so the central 50% x 50% is
 * clear whatever the window; on touch (the pause button holds the top-left corner) it starts at the margin.
 */
export function toastRect(space: Pick<HudSpace, 'width' | 'height'>, options: { partners?: number; touch?: boolean } = {}): HudBox {
  const touch = options.touch === true;
  const m = HUD_METRICS[hudVariant(space)];
  const chips = chipsRect(space, true, touch);
  const partners = options.partners ?? 0;
  const bottom = partners > 0 ? chips.y + chips.height + m.partnerGap + partners * (m.partnerHeight + m.partnerGap) - m.partnerGap : chips.y + chips.height;
  const x = touch ? m.margin : chipsRect(space, true, false).x;
  return { x, y: bottom + TOAST.gap, width: Math.max(0, Math.min(TOAST.width, Math.floor(space.width * 0.25) - x - 1)), height: TOAST.height };
}

/** The block the slots take (width x height) so the boss block can keep clear of it. */
function slotBlock(space: HudDims, count: number): { width: number; height: number } {
  const m = HUD_METRICS[hudVariant(space)];
  const slot = slotSizeFor(space.scale);
  return count > 2 ? { width: 2 * slot + m.slotGap, height: 2 * slot + m.slotGap } : { width: count * slot + Math.max(0, count - 1) * m.slotGap, height: slot };
}

/**
 * Move slot `index` of `count`: small square slots in the bottom-right corner, a row up to two, a 2x2 block for more
 * (fast and heavy on top, boost and area under them). Touch draws none: the bottom right is the action buttons'.
 */
export function slotRect(space: HudDims, index: number, count: number): HudBox {
  const m = HUD_METRICS[hudVariant(space)];
  const slot = slotSizeFor(space.scale);
  const block = slotBlock(space, count);
  const left = space.width - m.margin - block.width;
  const top = space.height - m.margin - block.height;
  if (count <= 2) return { x: left + index * (slot + m.slotGap), y: top, width: slot, height: slot };
  return { x: left + (index % 2) * (slot + m.slotGap), y: top + Math.floor(index / 2) * (slot + m.slotGap), width: slot, height: slot };
}

/** The minimap tile in HUD px: 4 on desktop (the size it had before the HUD scale rule), 3 on touch. */
export const minimapTilePx = (touch: boolean): number => (touch ? HUD_BOX.minimapTilePxTouch : HUD_BOX.minimapTilePx);

/** The minimap frame for a `cols` x `rows` grid; the map itself starts `minimapFrame` inside. */
export function minimapRect(space: Pick<HudSpace, 'width'>, cols: number, rows: number, tilePx: number = HUD_BOX.minimapTilePx): HudBox {
  const { minimapMargin: margin, minimapFrame: frame } = HUD_BOX;
  return { x: space.width - margin - cols * tilePx - frame, y: margin - frame, width: cols * tilePx + 2 * frame, height: rows * tilePx + 2 * frame };
}

/** The boss bar itself: the fill is `thick` HUD px, the dark outline and gilt hairline make the frame (11 HUD px: 16.5 CSS px at 1440x900). */
export const BOSS_BAR = { thick: 5, frame: 11 } as const;

/** The share of the space's height left under the boss block on desktop. */
const BOSS_LIFT = 0.06;

/** Boss block width as a share of the space: a thin bar, not a banner. */
const BOSS_SHARE = 0.4;
/** Touch: the bar keeps clear of the thumb buttons. */
const BOSS_TOUCH = { share: 0.5, max: 300 } as const;

/**
 * The boss block, bottom centre: 40% of the width on desktop (never reaching into the slot block or the log), about half
 * on touch. `slots` is how many slot windows are drawn (0 on touch).
 */
export function bossRect(space: HudDims, slots = 4, touch = false): HudBox {
  const m = HUD_METRICS[hudVariant(space)];
  let width: number;
  // Raised off the bottom edge: 6% of the space's height stays under the bar (owner 2026-11-04), clear of the hint bar's row.
  let bottom = Math.max(m.bossBottom, Math.round(space.height * BOSS_LIFT));
  if (touch) {
    width = Math.min(Math.round(space.width * BOSS_TOUCH.share), BOSS_TOUCH.max);
    // Above the message log of the bottom-left corner (the log stays at the bottom on touch).
    bottom = m.margin + HUD_BOX.logHeight + m.slotGap;
  } else {
    const reserve = Math.max(slotBlock(space, Math.max(1, slots)).width, HUD_BOX.logWidth) + m.margin + m.slotGap * 2;
    width = Math.min(Math.round(space.width * BOSS_SHARE), space.width - 2 * reserve);
  }
  width = Math.max(200, Math.min(width, space.width - 2 * m.margin));
  return { x: Math.round((space.width - width) / 2), y: space.height - bottom - m.bossHeight, width, height: m.bossHeight };
}

/** The announcement's move name in HUD px: about 28 CSS px on desktop (26 to 30 at every scale), 18 on touch. */
export const captionNameSize = (scale: number, touch: boolean): number => (touch ? 18 : Math.round(28 / scale));

/** Name, rule and the sign and cue line, with room for the filigree: what the announcement takes in height (HUD px). */
const captionHeightFor = (scale: number, touch: boolean): number => captionNameSize(scale, touch) + (touch ? 22 : 26);

/**
 * The boss announcement (owner 2026-11-04): the top centre, its bottom edge on the arena-centre line (a quarter of the height) so
 * it never enters the central 50% x 50%, below the place where the location plaque shows on area entry. On touch it takes
 * the stretch between the status window and the minimap.
 */
export function captionRect(space: HudDims, _slots = 4, touch = false): HudBox {
  const scale = space.scale ?? DEFAULT_SCALE;
  const m = HUD_METRICS[hudVariant(space)];
  const height = captionHeightFor(scale, touch);
  if (touch) {
    const status = statusRect(space, true);
    const minimapLeft = space.width - HUD_BOX.minimapMargin - 40 * HUD_BOX.minimapTilePxTouch - 2 * HUD_BOX.minimapFrame;
    const x = status.x + status.width + 4;
    return { x, y: m.margin, width: Math.max(120, minimapLeft - 4 - x), height };
  }
  const width = Math.max(280, Math.min(460, Math.round(space.width * 0.36)));
  return { x: Math.round((space.width - width) / 2), y: Math.floor(space.height * 0.25) - height, width, height };
}

/** What the hint bar must keep clear of in a boss fight: the boss block (the announcement is at the top now). */
export function bossStackRect(space: HudDims, slots = 4, touch = false): HudBox {
  return bossRect(space, slots, touch);
}

export interface HudRectsOptions {
  /** The held-items line is showing (idle only: it is hidden in combat). */
  chip: boolean;
  slots: number;
  minimap?: { cols: number; rows: number };
  touch?: boolean;
  /** Kept for callers that still pass it: the log is always the bottom-left corner now. */
  boss?: boolean;
  /** Co-op partners (their frames sit under the chips). */
  partners?: number;
}

export function hudRects(space: HudDims, options: HudRectsOptions): HudRects {
  const touch = options.touch === true;
  const variant = hudVariant(space);
  const m = HUD_METRICS[variant];
  const status = statusRect(space, touch);
  const chips = chipsRect(space, options.chip, touch);
  const boss = bossRect(space, touch ? 0 : options.slots, touch);
  const caption = captionRect(space, touch ? 0 : options.slots, touch);
  const partners = Array.from({ length: options.partners ?? 0 }, (_, i): HudBox => ({ x: status.x, y: chips.y + chips.height + m.partnerGap + i * (m.partnerHeight + m.partnerGap), width: m.partnerWidth, height: m.partnerHeight }));
  return {
    variant,
    status,
    chips,
    partners,
    slots: touch ? [] : Array.from({ length: options.slots }, (_, i) => slotRect(space, i, options.slots)),
    log: { x: m.margin, y: space.height - m.margin - HUD_BOX.logHeight, width: HUD_BOX.logWidth, height: HUD_BOX.logHeight },
    boss,
    caption,
    minimap: options.minimap ? minimapRect(space, options.minimap.cols, options.minimap.rows, minimapTilePx(touch)) : null,
  };
}

/** The hint bar's free band: from the left and right edge and from the bottom edge, in HUD px (src/ui/play-hints-model.ts `HintBand`). */
export interface BandLike {
  left: number;
  right: number;
  bottom: number;
}

/**
 * During a boss fight's first seconds the hint bar rises over the boss block and its announcement strip so the three
 * never share the bottom edge (it hides after 5 s). Only `bottom` changes.
 */
export function liftHintBand<B extends BandLike>(band: B, boss: HudBox | null, space: Pick<HudSpace, 'height'>): B {
  if (!boss) return band;
  return { ...band, bottom: Math.max(band.bottom, space.height - boss.y + HUD_BOX.slotGap) };
}
