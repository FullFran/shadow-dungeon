import spriteMeta from './sprite-meta.json';

/** Typed view of the generated src/data/sprite-meta.json (see tools/fetch-sprites.mjs). */
export interface AnimMeta {
  /** Sheet file name inside public/sprites/<dex>/<form>/. */
  file: string;
  /** Concrete SpriteCollab animation the sheet came from (differs when a fallback was used). */
  source: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  /** Number of direction rows (8 for directional sheets). */
  rows: number;
  /** Per-frame duration in 1/60 s ticks. */
  durations: number[];
  rushFrame?: number;
  hitFrame?: number;
  returnFrame?: number;
  /** Ground point inside a frame, from the shadow sheet; null when unknown. */
  anchor: { x: number; y: number } | null;
}

export interface SpriteMeta {
  species: string;
  form: string;
  shadowSize: number;
  anims: Record<string, AnimMeta>;
}

export interface SpriteCatalog {
  directions: string[];
  ticksPerSecond: number;
  sprites: Record<string, SpriteMeta>;
}

export const SPRITES: SpriteCatalog = spriteMeta;

/** Sprite key "<dex4>/<form4>", also the folder under public/sprites. */
export const SPRITE_KEYS = {
  mimikyu: '0778/0000',
  poochyena: '0261/0000',
  gastly: '0092/0000',
  aegislashShield: '0681/0000',
  aegislashBlade: '0681/0001',
} as const;
