/**
 * Where the canvas HUD goes, as pure math. The HUD is drawn in its own
 * "HUD space": the canvas divided by an integer HUD scale. On touch that scale
 * is the canvas scale, so the HUD space is the 512x320 view (readable on a
 * phone). On desktop the scale comes from the viewport instead, so a big
 * window shows more HUD space and the same panels take a small fraction of
 * the screen (1 at 1280x720, 2 at 1920x1080) instead of growing with the art.
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

/** Panel sizes, in HUD pixels. */
export const HUD_BOX = {
  margin: 6,
  statusWidth: 196,
  /** The status window without the held-items line. */
  statusHeight: 58,
  /** The one-line held-items chip under the passive line. */
  chipHeight: 11,
  slotWidth: 104,
  slotHeight: 30,
  slotGap: 4,
  /** The message log (src/adapters/message-log.ts): 4 lines of 13 px plus padding, 236 wide. */
  logWidth: 236,
  logHeight: 4 * 13 + 9,
  /** The minimap (src/adapters/minimap.ts): 3 px per tile, 10 px from the top-right corner, a 4 px frame. */
  minimapTilePx: 3,
  minimapMargin: 10,
  minimapFrame: 4,
  bossWidth: 260,
  /** The boss bar's top, from the bottom edge; its name sits 14 px above it. */
  bossFromBottom: 82,
  bossNameHeight: 14,
  bossBarHeight: 6,
} as const;

/** Viewport size (CSS px) per desktop HUD scale step. */
const DESKTOP_STEP = { width: 960, height: 540 } as const;

/** Integer HUD scale: the canvas scale on touch; on desktop one step per 960x540 of viewport, never above the canvas scale. */
export function hudScaleFor(viewportWidth: number, viewportHeight: number, pixelScale: number, touch: boolean): number {
  if (touch) return pixelScale;
  const steps = Math.floor(Math.min(viewportWidth / DESKTOP_STEP.width, viewportHeight / DESKTOP_STEP.height));
  return Math.max(1, Math.min(pixelScale, steps));
}

/** The HUD space of a canvas of `canvasWidth` x `canvasHeight` backing pixels at `scale`. */
export const hudSpace = (canvasWidth: number, canvasHeight: number, scale: number): HudSpace => ({ scale, width: canvasWidth / scale, height: canvasHeight / scale });

export interface HudRects {
  status: HudBox;
  /** Move slots, left to right, at the bottom right. */
  slots: HudBox[];
  /** The message log at its tallest (all lines showing), bottom left. */
  log: HudBox;
  /** The boss bar with its name line, bottom centre. */
  boss: HudBox;
  minimap: HudBox | null;
}

/** The status window: top left; one line taller with the held-items chip. */
export const statusRect = (chip: boolean): HudBox => ({
  x: HUD_BOX.margin,
  y: HUD_BOX.margin,
  width: HUD_BOX.statusWidth,
  height: HUD_BOX.statusHeight + (chip ? HUD_BOX.chipHeight : 0),
});

/** Move slot `index` of `count`, right-aligned at the bottom. */
export function slotRect(space: Pick<HudSpace, 'width' | 'height'>, index: number, count: number): HudBox {
  const { slotWidth: w, slotGap: gap, slotHeight: h, margin } = HUD_BOX;
  return { x: space.width - margin - (count - index) * (w + gap) + gap, y: space.height - margin - h, width: w, height: h };
}

/** The minimap frame for a `cols` x `rows` grid; the map itself starts `minimapFrame` inside. */
export function minimapRect(space: Pick<HudSpace, 'width'>, cols: number, rows: number): HudBox {
  const { minimapTilePx: px, minimapMargin: margin, minimapFrame: frame } = HUD_BOX;
  return { x: space.width - margin - cols * px - frame, y: margin - frame, width: cols * px + 2 * frame, height: rows * px + 2 * frame };
}

/** The boss bar box (name line included). */
export function bossRect(space: Pick<HudSpace, 'width' | 'height'>): HudBox {
  const width = Math.min(HUD_BOX.bossWidth, space.width - 40);
  const barY = space.height - HUD_BOX.bossFromBottom;
  return { x: Math.round((space.width - width) / 2), y: barY - HUD_BOX.bossNameHeight, width, height: HUD_BOX.bossNameHeight + HUD_BOX.bossBarHeight };
}

export function hudRects(space: Pick<HudSpace, 'width' | 'height'>, options: { chip: boolean; slots: number; minimap?: { cols: number; rows: number } }): HudRects {
  return {
    status: statusRect(options.chip),
    slots: Array.from({ length: options.slots }, (_, i) => slotRect(space, i, options.slots)),
    log: { x: HUD_BOX.margin, y: space.height - HUD_BOX.margin - HUD_BOX.logHeight, width: HUD_BOX.logWidth, height: HUD_BOX.logHeight },
    boss: bossRect(space),
    minimap: options.minimap ? minimapRect(space, options.minimap.cols, options.minimap.rows) : null,
  };
}
