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
  duskull: '0355/0000',
  golett: '0622/0000',
  pawniard: '0624/0000',
  sableye: '0302/0000',
  // Misty Forest remaster.
  impidimp: '0859/0000',
  shroomish: '0285/0000',
  drifloon: '0425/0000',
  // Flooded Caves.
  krabby: '0098/0000',
  shellos: '0422/0000',
  remoraid: '0223/0000',
  lanturn: '0171/0000',
  dhelmise: '0781/0000',
  // Toxic Swamp.
  venipede: '0543/0000',
  salandit: '0757/0000',
  skrelp: '0690/0000',
  salazzle: '0758/0000',
  nihilego: '0793/0000',
  // Evolved forms.
  mightyena: '0262/0000',
  haunter: '0093/0000',
  gengar: '0094/0000',
  dusclops: '0356/0000',
  bisharp: '0625/0000',
  breloom: '0286/0000',
  drifblim: '0426/0000',
  morgrem: '0860/0000',
  noctowl: '0164/0000',
  ariados: '0168/0000',
  golbat: '0042/0000',
  kingler: '0099/0000',
  octillery: '0224/0000',
  crawdaunt: '0342/0000',
  arbok: '0024/0000',
  skuntank: '0435/0000',
  weezing: '0110/0000',
  muk: '0089/0000',
  toxicroak: '0454/0000',
  houndoom: '0229/0000',
  // Mimikyu's Senda's shadows (data/story/mimikyu.ts).
  ditto: '0132/0000',
  polteageist: '0855/0000',
  jigglypuff: '0039/0000',
  pikachu: '0025/0000',
  hatterene: '0858/0000',
  // The Refugio's move tutor (odd/tasks/movepools.md).
  smeargle: '0235/0000',
  // The gacha's evolution lines (odd/tasks/gacha-evolutions.md).
  abra: '0063/0000',
  kadabra: '0064/0000',
  alakazam: '0065/0000',
  piplup: '0393/0000',
  prinplup: '0394/0000',
  empoleon: '0395/0000',
  shinx: '0403/0000',
  luxio: '0404/0000',
  luxray: '0405/0000',
  axew: '0610/0000',
  fraxure: '0611/0000',
  haxorus: '0612/0000',
  // The starters' evolved forms (odd/tasks/roster-parity.md).
  zoroark: '0571/0000',
  lampent: '0608/0000',
  chandelure: '0609/0000',
  marowak: '0105/0000',
  // The starters' Sendas' new bosses (docs/story-quests.md).
  mandibuzz: '0630/0000',
  kangaskhan: '0115/0000',
  dusknoir: '0477/0000',
  banette: '0354/0000',
  mismagius: '0429/0000',
  kecleon: '0352/0000',
  spiritomb: '0442/0000',
  // The gacha lines' Sendas' shadows (data/story/<line>.ts).
  munna: '0517/0000',
  drowzee: '0096/0000',
  mrMime: '0122/0000',
  hypno: '0097/0000',
  musharna: '0518/0000',
  glalie: '0362/0000',
  weavile: '0461/0000',
  mamoswine: '0473/0000',
  froslass: '0478/0000',
  lapras: '0131/0000',
  ampharos: '0181/0000',
  manectric: '0310/0000',
  absol: '0359/0000',
  electivire: '0466/0000',
  umbreon: '0197/0000',
  druddigon: '0621/0000',
  garchomp: '0445/0000',
  salamence: '0373/0000',
  dragonite: '0149/0000',
} as const;

/** A sheet folder of this build: a SPRITE_KEYS value. */
export type BaseSpriteKey = (typeof SPRITE_KEYS)[keyof typeof SPRITE_KEYS];

/** A shiny sheet folder: SpriteCollab's shiny of a form lives in its `0001` subfolder (odd/tasks/shiny-echo.md). */
export type ShinySpriteKey = `${BaseSpriteKey}/0001`;

/** The shiny sheet of `key` (playable species only have one: tests/data/shiny.test.ts). */
export const shinyKey = (key: BaseSpriteKey): ShinySpriteKey => `${key}/0001`;

/** A female sheet folder: SpriteCollab keeps them in `<form>/0000/0002`, the shiny's in `<form>/0001/0002` (odd/tasks/pokemon-gender.md). */
export type FemaleSpriteKey = `${BaseSpriteKey}/${'0000' | '0001'}/0002`;

/** The female sheet of `key`, or its shiny (only the species of core/gender.ts `FEMALE_ART` have one: tests/data/female-sprites.test.ts). */
export const femaleKey = (key: BaseSpriteKey, shiny = false): FemaleSpriteKey => `${key}/${shiny ? '0001' : '0000'}/0002`;

/** The sheet a player's look draws: female where that sheet exists (any other species ignores the flag), shiny if worn. */
export function lookKey(key: BaseSpriteKey, shiny = false, female = false): BaseSpriteKey | ShinySpriteKey | FemaleSpriteKey {
  const her = femaleKey(key, shiny);
  if (female && SPRITES.sprites[her]) return her;
  return shiny ? shinyKey(key) : key;
}
