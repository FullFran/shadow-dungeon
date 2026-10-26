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
} as const;
