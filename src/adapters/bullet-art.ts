import type { ProjectileState } from '../core/state';
import type { Vec2 } from '../core/vec';
import type { PokemonType } from '../data/types';
import { TYPE_COLORS } from '../ui/tokens';

/**
 * Enemy bullets as pixel art, one look per Pokémon type (docs/gdd.md, «Balas
 * enemigas»; design in docs/research/boss-patterns.md §5). Every bullet has a
 * bright, near-white core whose radius is exactly its hitbox radius; its type
 * colour, shape and glow sit outside the core, never past 1.6 times the
 * hitbox, and never hurt. A 1 px dark outline makes it read on bright and
 * dark floors. Everything here is pure: cells are painted as palette roles
 * and RGBA bytes (bullet-atlas.ts bakes them once into one atlas and draws
 * one image per bullet).
 */

/** How far colour and glow may reach, as a multiple of the hitbox radius. */
export const GLOW_REACH = 1.6;
/** The outline key of every bullet (the pixel-art outline of the game's icons). */
export const OUTLINE = '#140c11';
/** A core never reads smaller than this on screen, in CSS pixels across, at the smallest phone view (568×320). */
export const MIN_CORE_SCREEN_PX = 4;

export type BulletSize = 'S' | 'M' | 'L';
export const BULLET_SIZES: readonly BulletSize[] = ['S', 'M', 'L'];
/** Hitbox radii of each size class: S needles (fast aimed shots), M orbs (rings, spirals, curtains), L big shots (slow, homing). */
export const SIZE_CLASS_RADII: Record<BulletSize, readonly number[]> = { S: [2, 3, 4, 5], M: [6, 7], L: [8, 9, 10, 12, 16] };

/** The size class of a hitbox radius. */
export function sizeClass(radius: number): BulletSize {
  return radius < 6 ? 'S' : radius < 8 ? 'M' : 'L';
}

export type BulletShape = 'orb' | 'knuckle' | 'blade' | 'wisp' | 'leaf' | 'feather' | 'thread' | 'bubble' | 'spark' | 'ember' | 'drop' | 'shard' | 'pebble' | 'crystal' | 'disc' | 'star' | 'scale' | 'crescent';
/** `velocity`: points along its flight; `spin`: turns on itself; `still`: always upright. S bullets always point along their flight (needles). */
export type BulletFacing = 'velocity' | 'spin' | 'still';

export interface BulletLook {
  shape: BulletShape;
  facing: BulletFacing;
  /** Poison's droplet: the whole rim in the type's dark edge colour. */
  darkRim?: true;
}

/** One shape per type (colour comes from `TYPE_COLORS`). */
export const BULLET_LOOKS: Record<PokemonType, BulletLook> = {
  normal: { shape: 'orb', facing: 'still' },
  fighting: { shape: 'knuckle', facing: 'still' },
  steel: { shape: 'blade', facing: 'velocity' },
  ghost: { shape: 'wisp', facing: 'velocity' },
  grass: { shape: 'leaf', facing: 'spin' },
  flying: { shape: 'feather', facing: 'velocity' },
  bug: { shape: 'thread', facing: 'velocity' },
  water: { shape: 'bubble', facing: 'still' },
  electric: { shape: 'spark', facing: 'still' },
  fire: { shape: 'ember', facing: 'velocity' },
  poison: { shape: 'drop', facing: 'velocity', darkRim: true },
  rock: { shape: 'shard', facing: 'spin' },
  ground: { shape: 'pebble', facing: 'spin' },
  ice: { shape: 'crystal', facing: 'velocity' },
  psychic: { shape: 'disc', facing: 'velocity' },
  fairy: { shape: 'star', facing: 'spin' },
  dragon: { shape: 'scale', facing: 'velocity' },
  dark: { shape: 'crescent', facing: 'velocity' },
};

/** Palette roles of a painted cell. */
export const ROLE = { empty: 0, glow: 1, outline: 2, body: 3, shade: 4, rim: 5, core: 6, ring: 7 } as const;

/** Directions (or spin steps) baked per bullet, and animation frames per direction. */
export const BULLET_DIRS = 16;
export const BULLET_ANIMS = 2;
/** Steps of a hanging shot's closing ring. */
export const HANG_STEPS = 4;
/** Bigger hitboxes draw the radius-16 bake scaled up (the core still matches). */
export const MAX_BAKED_RADIUS = 16;

/** Flight frames baked for a type: every direction by every animation frame. */
export function bulletFrameCount(type: PokemonType): number {
  void type;
  return BULLET_DIRS * BULLET_ANIMS;
}

/** Side of a bullet's square cell in pixels: even, so the hitbox centre sits on a pixel corner. */
export function cellSize(radius: number): number {
  return 2 * Math.ceil(GLOW_REACH * radius) + 2;
}

export interface BulletCell {
  size: number;
  /** One `ROLE` per pixel, row by row. */
  roles: Uint8Array;
  /** The pixels' colours, RGBA. */
  rgba: Uint8ClampedArray;
}

/** Whether (u, v), in hitbox radii (u along the bullet's facing), is inside the shape. `anim` is 0 or 1. */
function inShape(shape: BulletShape, u: number, v: number, anim: number): boolean {
  const d = Math.sqrt(u * u + v * v);
  const au = Math.abs(u);
  const av = Math.abs(v);
  switch (shape) {
    case 'orb':
      return d <= 1.35;
    case 'knuckle':
      // A rounded square with a ridge of knuckles on its front.
      return au ** 4 + av ** 4 <= 1.3 ** 4 || (u > 0 && u <= 1.55 && av <= 1.1 && Math.cos(v * 4.2) > 0.1);
    case 'blade':
      // A sword: the point ahead, a crossguard behind the core and a short hilt.
      if (u >= 0) return av <= 1.05 * (1 - u / 1.6);
      return (u >= -1.05 && av <= 0.8) || (u >= -1.35 && u <= -1.0 && av <= 1.45) || (u >= -1.6 && av <= 0.35);
    case 'wisp': {
      // A flame with a wavering tail behind it.
      if (d <= 1.15) return true;
      if (u >= 0 || u < -1.6) return false;
      const sway = 0.3 * Math.sin(u * 3 + anim * Math.PI);
      return Math.abs(v - sway) <= 0.95 * (1 + u / 1.6);
    }
    case 'leaf':
      // A lens pointed at both ends, with a stalk.
      return av <= 1.15 * (1 - (u / 1.55) ** 2) || (u <= -1.3 && u >= -1.6 && av <= 0.2);
    case 'feather':
      // An arrowhead ahead, fletching with a notch behind.
      if (u >= 0) return av <= 1.15 * (1 - u / 1.6);
      return u >= -1.6 && av <= 1.0 + 0.25 * (-u / 1.6) && !(u < -1.05 && av < 0.4);
    case 'thread':
      // A knot with a silk thread trailing behind.
      return d <= 1.2 || (u < 0 && u >= -1.6 && Math.abs(v - 0.15 * Math.sin(u * 5 + anim * Math.PI)) <= 0.3);
    case 'bubble':
      // A hollow film around the core, a highlight on its upper left.
      return (d >= 1.18 && d <= 1.5) || (u < -0.5 && v < -0.5 && d <= 1.5 && d >= 1.05);
    case 'spark':
      // A diamond spark that flickers its spikes.
      return au + av <= (anim ? 1.55 : 1.35) || (anim === 1 && (au <= 0.22 || av <= 0.22) && d <= 1.6);
    case 'ember': {
      // A teardrop with its flame trailing behind.
      if (d <= 1.2) return true;
      const tail = anim ? 1.6 : 1.4;
      return u < 0 && u >= -tail && av <= 1.2 * (1 + u / tail);
    }
    case 'drop':
      // A droplet falling point first.
      return d <= 1.25 || (u > 0 && u <= 1.6 && av <= 1.25 * (1 - u / 1.6));
    case 'shard':
      // An angular shard, uneven on purpose.
      return au * 0.95 + av * 0.45 <= 1.5 && av <= 1.2 && u + v * 0.8 <= 1.3 && -u + v * 0.6 <= 1.35;
    case 'pebble':
      // A lumpy stone.
      return d <= 1.3 + 0.14 * Math.sin(3 * Math.atan2(v, u));
    case 'crystal':
      // A long hexagonal crystal.
      return av <= 0.95 && au + 0.6 * av <= 1.6;
    case 'disc':
      // A disc seen edge-on, across its flight.
      return (u / 0.95) ** 2 + (v / 1.55) ** 2 <= 1;
    case 'star':
      // A four-point star.
      return Math.sqrt(au) + Math.sqrt(av) <= Math.sqrt(1.6) || d <= 1.12;
    case 'scale':
      // A round scale with two fins swept back.
      return d <= 1.25 || (u < 0 && u >= -1.55 && Math.abs(av - 0.8) <= 0.3 * (1 + (u + 0.6) / 0.95));
    case 'crescent':
      // A crescent behind the core, its horns forward.
      return d <= 1.5 && (u - 0.75) ** 2 + v * v >= 1.15 ** 2;
  }
}

/** A colour as RGB bytes. */
function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): [number, number, number] {
  const x = rgb(a);
  const y = rgb(b);
  return [0, 1, 2].map((i) => Math.round(x[i]! + (y[i]! - x[i]!) * t)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** The colours of one type's bullet by role: core bright (its glow, lightened), a highlight rim on the core's lit side, body in its colour (its edge colour when the colour itself is pale). */
export function bulletPalette(type: PokemonType): Record<Exclude<keyof typeof ROLE, 'empty'>, [number, number, number]> {
  const c = TYPE_COLORS[type];
  const body = luminance(c.core) > 0.72 ? c.edge : c.core;
  return {
    core: mix(c.glow, '#ffffff', 0.45),
    rim: rgb(c.glow),
    body: rgb(body),
    shade: body === c.edge ? mix(c.edge, OUTLINE, 0.45) : rgb(c.edge),
    outline: rgb(OUTLINE),
    glow: rgb(c.glow),
    ring: rgb('#ffffff'),
  };
}

/** Alpha of each role (glow is soft; it pulses on big bullets). */
function roleAlpha(role: number, big: boolean, anim: number): number {
  if (role === ROLE.glow) return big ? (anim ? 0.6 : 0.32) : 0.4;
  return 1;
}

const ROLE_NAMES = Object.keys(ROLE) as (keyof typeof ROLE)[];
/** Each type's palette by role index (painting a cell reads it per pixel). */
const paletteByRole = new Map<PokemonType, [number, number, number][]>();

function colour(cell: BulletCell, type: PokemonType, big: boolean, anim: number): BulletCell {
  let palette = paletteByRole.get(type);
  if (!palette) {
    const named = bulletPalette(type);
    palette = ROLE_NAMES.map((name) => (name === 'empty' ? [0, 0, 0] : named[name]));
    paletteByRole.set(type, palette);
  }
  for (let i = 0; i < cell.roles.length; i++) {
    const role = cell.roles[i]!;
    if (role === ROLE.empty) continue;
    const [r, g, b] = palette[role]!;
    cell.rgba[i * 4] = r;
    cell.rgba[i * 4 + 1] = g;
    cell.rgba[i * 4 + 2] = b;
    cell.rgba[i * 4 + 3] = Math.round(255 * roleAlpha(role, big, anim));
  }
  return cell;
}

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const DIRS8 = [...DIRS4, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** The role at (x, y); outside the cell is empty. */
function roleAt(roles: Uint8Array, size: number, x: number, y: number): number {
  return x < 0 || y < 0 || x >= size || y >= size ? ROLE.empty : roles[y * size + x]!;
}

/** Whether a neighbour of (x, y) along `dirs` has a role in [min, max] (plain loops: this runs per pixel of every baked cell). */
function touches(roles: Uint8Array, size: number, x: number, y: number, dirs: readonly (readonly [number, number])[], min: number, max: number): boolean {
  for (let i = 0; i < dirs.length; i++) {
    const role = roleAt(roles, size, x + dirs[i]![0], y + dirs[i]![1]);
    if (role >= min && role <= max) return true;
  }
  return false;
}

/** Which direction and animation frame a flight frame index holds. */
export function decodeFrame(frame: number): { dir: number; anim: number } {
  return { dir: Math.floor(frame / BULLET_ANIMS) % BULLET_DIRS, anim: frame % BULLET_ANIMS };
}

/**
 * Paints one flight frame of a type's bullet for a whole-pixel hitbox
 * `radius`: the core is every pixel whose centre lies within the radius (a
 * disc exactly the hitbox), then the shape's body with a highlight rim
 * against the core and shading on its lower right, a 1 px outline around
 * it all, and a soft glow where there is still room under 1.6 radii.
 */
export function paintBullet(type: PokemonType, radius: number, frame: number): BulletCell {
  const look = BULLET_LOOKS[type];
  const size = cellSize(radius);
  const c = size / 2;
  const reach = GLOW_REACH * radius;
  const big = sizeClass(radius) === 'L';
  const needle = sizeClass(radius) === 'S';
  const { dir, anim } = decodeFrame(frame);
  // Still shapes stay upright unless they are needles; every other one turns with its frame.
  const angle = look.facing === 'still' && !needle ? 0 : (dir / BULLET_DIRS) * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const roles = new Uint8Array(size * size);
  const dist = (x: number, y: number): number => Math.sqrt((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - c;
      const py = y + 0.5 - c;
      const d = Math.sqrt(px * px + py * py);
      if (d <= radius) {
        roles[y * size + x] = ROLE.core;
        continue;
      }
      if (d > reach - 1) continue;
      let u = (px * cos + py * sin) / radius;
      let v = (-px * sin + py * cos) / radius;
      // Needles: the shape drawn long and thin along the flight.
      if (needle) {
        u /= 1.3;
        v /= 0.8;
      }
      if (inShape(look.shape, u, v, anim)) roles[y * size + x] = ROLE.body;
    }
  }
  // The rim against the core, and the shade on the far side from the light (lower right), or all round for a dark rim.
  const shaded: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (roles[y * size + x] !== ROLE.body) continue;
      const touchesCore = touches(roles, size, x, y, DIRS4, ROLE.core, ROLE.core);
      const touchesOut = touches(roles, size, x, y, DIRS4, ROLE.empty, ROLE.empty);
      if (touchesCore && x + y + 1 < size) roles[y * size + x] = ROLE.rim;
      else if (touchesOut && (look.darkRim || x + y + 1 > size)) shaded.push(y * size + x);
    }
  }
  for (const i of shaded) roles[i] = ROLE.shade;
  // The outline: every empty pixel beside the bullet, within the reach.
  const outline: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (roles[y * size + x] !== ROLE.empty || dist(x, y) > reach + 0.5) continue;
      if (touches(roles, size, x, y, DIRS4, ROLE.body, ROLE.ring)) outline.push(y * size + x);
    }
  }
  for (const i of outline) roles[i] = ROLE.outline;
  // The glow: one soft pixel round the outline where it still fits.
  const glow: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (roles[y * size + x] !== ROLE.empty || dist(x, y) > reach + 0.5) continue;
      if (touches(roles, size, x, y, DIRS8, ROLE.outline, ROLE.outline)) glow.push(y * size + x);
    }
  }
  for (const i of glow) roles[i] = ROLE.glow;
  return colour({ size, roles, rgba: new Uint8ClampedArray(size * size * 4) }, type, big, anim);
}

/** The ring of a hanging shot at `step` (0: wide, just placed; last: tight, about to fly again), white ticks between dark ones, like a clock's dial. */
export function paintHangRing(type: PokemonType, radius: number, step: number): BulletCell {
  const size = cellSize(radius);
  const c = size / 2;
  const reach = GLOW_REACH * radius;
  const t = HANG_STEPS > 1 ? step / (HANG_STEPS - 1) : 1;
  const ringAt = Math.max(radius + 0.5, reach - 0.25 - t * (reach - radius - 0.5));
  const roles = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - c;
      const py = y + 0.5 - c;
      const d = Math.sqrt(px * px + py * py);
      if (Math.abs(d - ringAt) > 0.5 || d > reach + 0.5) continue;
      const tick = Math.floor(((Math.atan2(py, px) + Math.PI) / (Math.PI * 2)) * 12);
      roles[y * size + x] = tick % 2 === 0 ? ROLE.ring : ROLE.outline;
    }
  }
  return colour({ size, roles, rgba: new Uint8ClampedArray(size * size * 4) }, type, false, 0);
}

/** The ring step of a hanging shot `progress` (0..1) through its wait. */
export function hangRingStep(progress: number): number {
  return Math.max(0, Math.min(HANG_STEPS - 1, Math.floor(progress * HANG_STEPS)));
}

/** The whole-pixel radius a hitbox is baked at (fractional and huge ones are scaled from it). */
export function bakedRadiusOf(radius: number): number {
  return Math.max(1, Math.min(MAX_BAKED_RADIUS, Math.round(radius)));
}

export interface SpriteRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface BulletSprite extends SpriteRect {
  bakedRadius: number;
  frame: number;
  ring?: SpriteRect & { step: number };
}

export interface BulletPose {
  state: 'flying' | 'hanging';
  /** Facing, radians (its velocity, or the last one it had while hanging). */
  angle?: number;
  /** A hanging shot's progress through its wait, 0..1; unknown: the ring ticks round on its own. */
  hang?: number;
}

/** Spin: one sixteenth of a turn every this many ms. */
const SPIN_STEP_MS = 70;
/** Animation frames swap every this many ms (L bullets pulse slower). */
const ANIM_MS = 120;
const PULSE_MS = 220;
/** Without a known wait, a hanging ring goes round its steps this fast. */
const HANG_TICK_MS = 250;

/**
 * Where and which frame to draw a bullet of hitbox `radius` at `pos`: the
 * cell is scaled by radius / baked radius so its core's drawn radius equals
 * the hitbox, and centred on the shot.
 */
export function bulletSprite(type: PokemonType, radius: number, pos: Vec2, timeMs: number, pose: BulletPose): BulletSprite {
  const look = BULLET_LOOKS[type];
  const bakedRadius = bakedRadiusOf(radius);
  const size = cellSize(bakedRadius);
  const scale = radius / bakedRadius;
  const turn = (a: number): number => (((Math.round((a / (Math.PI * 2)) * BULLET_DIRS) % BULLET_DIRS) + BULLET_DIRS) % BULLET_DIRS);
  const spins = look.facing === 'spin' && sizeClass(radius) !== 'S';
  const dir = spins ? Math.floor(timeMs / SPIN_STEP_MS) % BULLET_DIRS : turn(pose.angle ?? 0);
  const anim = Math.floor(timeMs / (sizeClass(radius) === 'L' ? PULSE_MS : ANIM_MS)) % BULLET_ANIMS;
  const dw = size * scale;
  const rect = { dx: pos.x - dw / 2, dy: pos.y - dw / 2, dw, dh: dw };
  const sprite: BulletSprite = { bakedRadius, frame: dir * BULLET_ANIMS + anim, ...rect };
  if (pose.state === 'hanging') sprite.ring = { step: pose.hang === undefined ? Math.floor(timeMs / HANG_TICK_MS) % HANG_STEPS : hangRingStep(pose.hang), ...rect };
  return sprite;
}

export type BulletArt = { kind: 'bullet'; state: 'flying' | 'hanging' } | { kind: 'still' } | { kind: 'player' };

/**
 * Which drawing a shot gets: every moving enemy shot is a bullet; an enemy
 * shot that was seen flying and now stands still is hanging (it will fly
 * again); one born still is a lingering cloud, puddle or roots (move-vfx.ts).
 * Player shots keep their own looks, so the two never read alike.
 */
export function bulletArt(p: Pick<ProjectileState, 'owner' | 'vel'> & Partial<Pick<ProjectileState, 'type'>>, seenMoving: boolean): BulletArt {
  if (p.owner !== 'enemy') return { kind: 'player' };
  if (p.vel.x !== 0 || p.vel.y !== 0) return { kind: 'bullet', state: 'flying' };
  return seenMoving ? { kind: 'bullet', state: 'hanging' } : { kind: 'still' };
}

/** The height enemy shots fly at above their ground position (their shadow stays on the ground), as every shot is drawn. */
export const SHOT_LIFT = 6;

/**
 * A hanging shot's progress through its wait, 0..1, when the core gives one
 * (a `hold` with `leftMs` left of `forMs`); undefined otherwise (the ring
 * then ticks round on its own). Read structurally so rendering does not
 * depend on how the core stores it.
 */
export function hangProgress(p: object): number | undefined {
  const hold = (p as { hold?: { leftMs?: unknown; forMs?: unknown } }).hold;
  if (!hold || typeof hold.leftMs !== 'number' || typeof hold.forMs !== 'number' || hold.forMs <= 0) return undefined;
  return Math.max(0, Math.min(1, 1 - hold.leftMs / hold.forMs));
}
