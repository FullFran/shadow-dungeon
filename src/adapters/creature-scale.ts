/**
 * How big a Pokémon is DRAWN in the world (owner, 2026-11-04: "Haz los pokemon también más grandes, ahora mismo están
 * demasiado pequeños"). One constant for every draw path: the dungeon renderer (player, remote players, enemies,
 * bosses, clones) and the town renderer (player, partners, villagers, walkers, co-op walkers).
 *
 * It is presentation only. Hitboxes (`radius`), collision, lock-on, AI ranges, telegraphs and network state never read
 * it, so the sim and the proofs are unchanged. The creature grows around its feet (the sheet anchor stays on the
 * entity's ground position), so depth sorting by feet is untouched.
 *
 * Why 1.5: the sheets are 24-56 px frames with the body filling about half of it, against 32 px tiles and houses drawn
 * at 2x, so a 1x creature reads as an ant. 1.5 turns the common 32x48 frame into 48x72 (one and a half tiles wide):
 * clearly bigger, still fits a doorway (the hitbox is unchanged, only the art overlaps the frame) and the tallest
 * frame (48x96) stays under 4.5 tiles. At the 2x desktop zoom every source pixel is exactly 3 device pixels, so the
 * art stays crisp; 2x would make a villager taller than the houses' doors.
 */
export const CREATURE_SCALE = 1.5;

export interface CreatureMeta {
  frameWidth: number;
  frameHeight: number;
  /** The feet inside the frame (defaults to the horizontal middle, three quarters down). */
  anchor?: { x: number; y: number } | null;
}

export interface CreatureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

/** Where a frame is drawn: `scaleBy` is the entity's own factor (a herald, a wound) on top of the shared scale. */
export function creatureRect(meta: CreatureMeta, pos: Point, scaleBy = 1): CreatureRect {
  const k = CREATURE_SCALE * scaleBy;
  const anchor = meta.anchor ?? { x: meta.frameWidth / 2, y: meta.frameHeight * 0.75 };
  return { x: Math.round(pos.x - anchor.x * k), y: Math.round(pos.y - anchor.y * k), width: meta.frameWidth * k, height: meta.frameHeight * k };
}

/** One frame of a sheet at the creature scale, nearest-neighbour (the one drawImage every creature goes through). */
export function drawCreatureFrame(ctx: CanvasRenderingContext2D, image: CanvasImageSource, meta: CreatureMeta, frame: number, row: number, pos: Point, scaleBy = 1, lift = 0): void {
  const rect = creatureRect(meta, { x: pos.x, y: pos.y + lift }, scaleBy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame * meta.frameWidth, row * meta.frameHeight, meta.frameWidth, meta.frameHeight, rect.x, rect.y, rect.width, rect.height);
}

/**
 * Runs `draw` with the world scaled around `pos` (the feet), for what belongs to the creature but is not its sheet:
 * its shadow, name tag, marks and status icons grow with it and stay put on the ground.
 */
export function withCreatureScale(ctx: CanvasRenderingContext2D, pos: Point, draw: () => void): void {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.scale(CREATURE_SCALE, CREATURE_SCALE);
  ctx.translate(-pos.x, -pos.y);
  draw();
  ctx.restore();
}
