import type { Arena, Rect, WorldState } from '../core/state';
import type { Vec2 } from '../core/vec';

/**
 * Pure presentation math: interpolation between fixed steps and the camera.
 * The simulation runs at a fixed rate; frames render at `alpha` (0..1) of
 * the way from the previous step to the current one.
 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** Interpolated position of an entity by id; new entities (no previous position) render where they are. */
export function interpolatedPositions(prev: WorldState, current: WorldState, alpha: number): Map<string, Vec2> {
  const before = new Map<string, Vec2>();
  before.set('player', prev.player.pos);
  for (const e of prev.enemies) before.set(e.id, e.pos);
  for (const p of prev.projectiles) before.set(p.id, p.pos);

  const out = new Map<string, Vec2>();
  const put = (id: string, pos: Vec2) => {
    const from = before.get(id);
    out.set(id, from ? lerpVec(from, pos, alpha) : pos);
  };
  put('player', current.player.pos);
  for (const e of current.enemies) put(e.id, e.pos);
  for (const p of current.projectiles) put(p.id, p.pos);
  return out;
}

/** World rectangle shown on screen, centred on `focus` and kept inside the arena when it fits. */
export function cameraView(focus: Vec2, viewWidth: number, viewHeight: number, arena: Arena): Rect {
  const axis = (center: number, size: number, limit: number) =>
    limit <= size ? (limit - size) / 2 : Math.min(limit - size, Math.max(0, center - size / 2));
  return {
    x: axis(focus.x, viewWidth, arena.width),
    y: axis(focus.y, viewHeight, arena.height),
    width: viewWidth,
    height: viewHeight,
  };
}

/** Canvas pixel -> world point, given the camera view and the integer pixel scale. */
export function screenToWorld(screen: Vec2, view: Rect, pixelScale: number): Vec2 {
  return { x: view.x + screen.x / pixelScale, y: view.y + screen.y / pixelScale };
}

/** Largest integer scale at which the view fits the window (at least 1), for crisp pixel art. */
export function pixelScaleFor(windowWidth: number, windowHeight: number, viewWidth: number, viewHeight: number): number {
  return Math.max(1, Math.floor(Math.min(windowWidth / viewWidth, windowHeight / viewHeight)));
}
