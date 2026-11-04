/**
 * The world-anchored interaction tooltip (.agents/DESIGN.md §4 "World tooltip"), pure: which verb the target's real
 * interaction deserves and where the tooltip goes on screen. The DOM side is src/ui/world-tooltip.ts. It replaced the
 * interact chip of the bottom bar and the floating "E / Enter: leer" text (owner, 2026-11-04: "cuando haya que
 * interactuar, que salga como tooltip cerca de lo que vas a hacer, mejor rediseñado").
 */

/** What using the target does, as a verb. */
export type InteractKind = 'talk' | 'read' | 'travel' | 'enter' | 'shop' | 'learn' | 'summon' | 'evolve' | 'signal';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TooltipPlacement {
  /** Top-left of the tooltip, in CSS px of the viewport. */
  x: number;
  y: number;
  /** Above the target (arrow down) or below it (arrow up). */
  side: 'above' | 'below';
  /** The arrow's tip, from the tooltip's left edge: always over the target. */
  arrowX: number;
}

/** The town target kinds `nearestInteractable` can pick (src/town/scene.ts), with the stall an NPC opens. */
export interface InteractSource {
  kind: 'npc' | 'board' | 'waystone' | 'shrine' | 'beacon' | 'lore';
  npc?: { opens?: string };
}

const NPC_VERB: Readonly<Record<string, InteractKind>> = { shop: 'shop', tutor: 'learn', gacha: 'summon', evolve: 'evolve' };

/** The verb of the interaction the E key would run on this target. */
export function interactKind(source: InteractSource): InteractKind {
  switch (source.kind) {
    case 'npc':
      return (source.npc?.opens && NPC_VERB[source.npc.opens]) || 'talk';
    case 'board':
    case 'lore':
      return 'read';
    case 'waystone':
      return 'travel';
    case 'shrine':
      return 'enter';
    case 'beacon':
      return 'signal';
  }
}

export const interactLabelKey = (kind: InteractKind): string => `interact.${kind}`;

/** The tooltip rises into place in this long (none under prefers-reduced-motion). */
export const TOOLTIP_RISE_MS = 120;
/** Smallest touch target (Fitts): a touch tooltip is a button at least this tall and wide. */
export const TOUCH_MIN = 44;

const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export interface PlaceOptions {
  /** The target's on-screen box (its sprite or tile), CSS px. */
  target: Box;
  /** The tooltip's measured size, arrow included. */
  size: { w: number; h: number };
  viewport: { w: number; h: number };
  /** The player's on-screen sprite box: the tooltip never covers it. */
  avoid?: Box | null;
  margin?: number;
  /** Space between the tooltip and the target. */
  gap?: number;
}

/**
 * Above the target and centred on it, clamped to the screen; below it when there is no room above; slid sideways past
 * the player's sprite when that is what stands in the way. Never over the target, never over the player, whenever any
 * of those spots allows it (otherwise the one that covers the least).
 */
export function placeTooltip({ target, size, viewport, avoid = null, margin = 8, gap = 10 }: PlaceOptions): TooltipPlacement {
  const centre = target.x + target.w / 2;
  const clampX = (x: number): number => Math.max(margin, Math.min(viewport.w - size.w - margin, x));
  const aboveY = target.y - gap - size.h;
  const belowY = target.y + target.h + gap;
  const middle = clampX(centre - size.w / 2);
  const xs = [middle];
  if (avoid) xs.push(clampX(avoid.x - size.w - 6), clampX(avoid.x + avoid.w + 6));
  const candidates = xs.flatMap((x) => [{ x, y: aboveY, side: 'above' as const }, { x, y: belowY, side: 'below' as const }]);
  const inside = (c: { y: number }): boolean => c.y >= margin && c.y + size.h <= viewport.h - margin;
  const cost = (c: { x: number; y: number }): number => {
    const box = { x: c.x, y: c.y, w: size.w, h: size.h };
    return overlap(box, target) * 4 + (avoid ? overlap(box, avoid) : 0);
  };
  const fits = candidates.filter(inside);
  const pool = fits.length > 0 ? fits : candidates.map((c) => ({ ...c, y: Math.max(margin, Math.min(viewport.h - size.h - margin, c.y)) }));
  const best = pool.find((c) => cost(c) === 0) ?? pool.reduce((a, b) => (cost(b) < cost(a) ? b : a));
  return { x: best.x, y: best.y, side: best.side, arrowX: Math.max(14, Math.min(size.w - 14, centre - best.x)) };
}
