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
  /** Mimikyu with its Disguise broken (drawn once the free hit of the room is spent). */
  mimikyuBusted: '0778/0001',
  zorua: '0570/0000',
  litwick: '0607/0000',
  cubone: '0104/0000',
  poochyena: '0261/0000',
  gastly: '0092/0000',
  aegislashShield: '0681/0000',
  aegislashBlade: '0681/0001',
  phantump: '0708/0000',
  pumpkabooSmall: '0710/0001',
  pumpkabooSuper: '0710/0003',
  foongus: '0590/0000',
  spinarak: '0167/0000',
  hoothoot: '0163/0000',
  trevenant: '0709/0000',
  decidueye: '0724/0000',
  // Experimental roster.
  zubat: '0041/0000',
  tentacool: '0072/0000',
  chinchou: '0170/0000',
  corphish: '0341/0000',
  clauncher: '0692/0000',
  wooper: '0194/0000',
  grimer: '0088/0000',
  koffing: '0109/0000',
  ekans: '0023/0000',
  croagunk: '0453/0000',
  stunky: '0434/0000',
  houndour: '0228/0000',
  slugma: '0218/0000',
  litleo: '0667/0000',
} as const;
