import type { DungeonDef, DungeonId, TilePalette } from './dungeons';
import type { EliteTrait } from './difficulty';
import type { SpeciesId } from './species';

/**
 * The Sima del Eclipse remaster (docs/gdd.md §3 "La Sima del Eclipse"):
 * depth bands, floor events and its own boss, as data. Every value is
 * provisional. The core reads it through `ENDLESS` (data/endless.ts) and
 * core/sima.ts.
 */

export type SimaBandId = 'crypt' | 'forest' | 'caves' | 'swamp' | 'abyss';

/**
 * A depth band: the look of a stretch of floors. The first ones borrow a
 * dungeon's palette (and decoration); the abyss has its own palette and
 * floats its rooms over the void (presentation only: walls still block).
 */
export interface SimaBand {
  id: SimaBandId;
  /** First floor of the band; it lasts until the next band's. */
  fromFloor: number;
  /** A dungeon's palette (by id) or the band's own. */
  palette: DungeonId | TilePalette;
  decor?: DungeonDef['decor'];
  /** Rooms are rock islands over the void, with red light falling through it. */
  abyss?: true;
  nameKey: string;
  subtitleKey: string;
  /** One line per floor on the floor card, in turn. */
  loreKeys: readonly string[];
}

/** The abyss: violet void, rust-red rock, the eclipse's light on the rims. */
export const ABYSS_PALETTE: TilePalette = {
  tileFloorA: '#3a2a33',
  tileFloorB: '#3f2d37',
  tileWallTop: '#0c0710',
  tileWallBlock: '#140b17',
  tileWallFace: '#2a1620',
  tileWallLip: '#a2433f',
  mapRim: '#7a2a3a',
  floorA: '#2c1f28',
  floorB: '#31222c',
  wall: '#06030a',
  wallEdge: '#a2433f',
  pillarTop: '#5a3446',
  pillarSide: '#331c2a',
};

const loreKeys = (band: SimaBandId, count: number): string[] => Array.from({ length: count }, (_, i) => `sima.band.${band}.lore.${i + 1}`);

/** Bands every 10 floors; append one to deepen the Sima (the last one lasts forever). */
export const SIMA_BANDS: readonly SimaBand[] = [
  { id: 'crypt', fromFloor: 1, palette: 'crypt-of-the-sword-king', decor: 'crypt', nameKey: 'sima.band.crypt.name', subtitleKey: 'sima.band.crypt.subtitle', loreKeys: loreKeys('crypt', 4) },
  { id: 'forest', fromFloor: 11, palette: 'misty-forest', decor: 'forest', nameKey: 'sima.band.forest.name', subtitleKey: 'sima.band.forest.subtitle', loreKeys: loreKeys('forest', 4) },
  // Integration (2026-10-25): the Flooded Caves and the Toxic Swamp lend their look to the next two strata; the abyss comes after them.
  { id: 'caves', fromFloor: 21, palette: 'flooded-caves', decor: 'caves', nameKey: 'sima.band.caves.name', subtitleKey: 'sima.band.caves.subtitle', loreKeys: loreKeys('caves', 4) },
  { id: 'swamp', fromFloor: 31, palette: 'toxic-swamp', decor: 'swamp', nameKey: 'sima.band.swamp.name', subtitleKey: 'sima.band.swamp.subtitle', loreKeys: loreKeys('swamp', 4) },
  { id: 'abyss', fromFloor: 41, palette: ABYSS_PALETTE, abyss: true, nameKey: 'sima.band.abyss.name', subtitleKey: 'sima.band.abyss.subtitle', loreKeys: loreKeys('abyss', 5) },
];

/**
 * Tougher, not more (user feedback 2026-10-25): depth brings elites, tinted
 * enemies with one extra trait from the game's one trait table
 * (data/difficulty.ts `ELITE_TRAIT_DEFS`). The Sima draws from all six traits
 * (tough, frenzied, swift, volley for casters only, armored, enrage) and its
 * elites spawn with `hpScale` more HP on top of their trait's. Chance per
 * enemy: `start` from `fromFloor`, + `perFloor`, at most `max`; the run's tier
 * chance applies too, and the larger of the two wins (core/sima.ts
 * `eliteRuleAt`).
 */
export interface SimaElites {
  fromFloor: number;
  start: number;
  perFloor: number;
  max: number;
  /** Elites spawn with this much more HP (on top of the floor's scale and the trait's). */
  hpScale: number;
  traits: readonly EliteTrait[];
  /**
   * Deep elites (from `pierceRoll.fromFloor`) sometimes strike positionally:
   * their attacks ignore roll i-frames (`EnemyState.pierceRoll`, the rule of
   * docs/gdd.md §9).
   */
  pierceRoll: { fromFloor: number; chance: number };
}

export const SIMA_ELITES: SimaElites = {
  fromFloor: 6,
  start: 0.06,
  perFloor: 0.015,
  max: 0.4,
  hpScale: 1.35,
  traits: ['swift', 'volley', 'armored', 'enrage', 'tough', 'frenzied'],
  pierceRoll: { fromFloor: 21, chance: 0.3 },
};

/**
 * Mixed squads: a room's enemies replaced by a set that combines roles (a
 * tank with a caster behind it, two blades with a gunner...), from
 * `minDepth` on. Never more enemies than the room had. Append to add one.
 */
export interface SimaSquad {
  minDepth: number;
  members: readonly SpeciesId[];
}

export const SIMA_SQUADS: readonly SimaSquad[] = [
  { minDepth: 4, members: ['golett', 'duskull'] },
  { minDepth: 6, members: ['pawniard', 'gastly', 'pawniard'] },
  { minDepth: 8, members: ['croagunk', 'spinarak'] },
  { minDepth: 10, members: ['pumpkaboo-super', 'hoothoot', 'litleo'] },
  { minDepth: 12, members: ['grimer', 'houndour', 'chinchou'] },
  { minDepth: 15, members: ['clauncher', 'pawniard', 'koffing'] },
  // The Flooded Caves and the Toxic Swamp (integration): a pincer tank with a gunner, a mortar behind a dasher, a sniper with a roller.
  { minDepth: 12, members: ['krabby', 'remoraid'] },
  { minDepth: 16, members: ['shellos', 'krabby', 'tentacool'] },
  { minDepth: 18, members: ['salandit', 'skrelp'] },
  { minDepth: 22, members: ['venipede', 'skrelp', 'salandit'] },
];

/** Chance that a room with two or more enemies holds a squad instead: from floor 4, rising, capped. */
export const SQUAD_CHANCE = { fromFloor: 4, start: 0.15, perFloor: 0.015, max: 0.5 } as const;

/**
 * Floor events (data-driven, seeded): at most one per floor, from floor 2,
 * never on an echo or an urgent floor, never in the start room. Each kind
 * shows up from `minDepth` with its `weight`. Set pieces, not padding: the
 * rooms around them keep their low counts.
 */
/** Enemies no hit can fell (the hunter): hits on them are shrugged off. */
export const UNKILLABLE: readonly SpeciesId[] = ['eclipse-hunter'];

export type SimaEventKind = 'vault' | 'shrine' | 'monsterHouse' | 'crystal' | 'merchant' | 'nest' | 'waves' | 'ambush' | 'hunter';

export interface SimaEventWeight {
  kind: SimaEventKind;
  minDepth: number;
  weight: number;
}

/** What a pact gives or takes while it lasts (`healShare` and `timeMs` once, on accepting). */
export interface PactEffect {
  playerDamage?: number;
  enemySpeed?: number;
  enemyDamage?: number;
  healShare?: number;
  timeMs?: number;
}

export type PactId = 'edge' | 'blood' | 'sand';

/** A shrine of the eclipse's trade (Hades style): a blessing for a curse. */
export interface SimaPact {
  id: PactId;
  blessing: PactEffect;
  curse: PactEffect;
}

export interface SimaEvents {
  /** Chance of an event on a floor: `start` from `fromFloor`, + `perFloor`, at most `max`. */
  fromFloor: number;
  start: number;
  perFloor: number;
  max: number;
  /** The most that chance can reach after the difficulty tier scales it (plain floors must stay); none in the Sima. */
  cap?: number;
  kinds: readonly SimaEventWeight[];
  /** A player this close to an event's object touches it (px). */
  touchRadius: number;
  /** Treasure vault: guards in the room (tougher), the chest opens once they are down. */
  vault: { guards: number; guardHp: number };
  /** Monster house: this many more sleepers in one room; they all wake as a player walks in. */
  monsterHouse: { extra: number };
  /** Time crystal: +`bonusMs` if touched before it fades (`fadeMs` from the floor's start). */
  crystal: { bonusMs: number; fadeMs: number };
  /** Merchant echo: run Pokémonedas for an Oran Berry (heals `berryHeal` of max HP, `berries` per visit) or one held item. */
  merchant: { berryPrice: number; berryHeal: number; berries: number; itemPrice: number };
  /** Eclipse shrine: the pact lasts this floor and the next `floors - 1`; on nightmare the curse bites `nightmareCurse` times harder. */
  shrine: { floors: number; pacts: readonly SimaPact[]; nightmareCurse: number };
  /** Monster nest: a hittable nest that hatches a weak enemy every `spawnEveryMs` (glowing `telegraphMs` before) while a player is near, at most `maxAlive` of its brood at once. Its brood pays nothing. */
  nest: { species: SpeciesId; brood: readonly SpeciesId[]; spawnEveryMs: number; telegraphMs: number; maxAlive: number };
  /** Wave room: walking in locks its doors; waves of this many enemies, `pauseMs` between them; clearing it pays time and an item pick. */
  waves: { waves: readonly number[]; pauseMs: number; bonusMs: number };
  /** Ambush: crossing into the room makes the ground crack under `count` hidden enemies for `tellMs`, then they burst out. */
  ambush: { count: number; tellMs: number };
  /** Hunter floor: an unkillable pursuer comes out of the start room `delayMs` after the floor begins; the stairs are the way out. */
  hunter: { species: SpeciesId; delayMs: number };
}

export const SIMA_EVENTS: SimaEvents = {
  fromFloor: 2,
  start: 0.35,
  perFloor: 0.01,
  max: 0.6,
  kinds: [
    { kind: 'crystal', minDepth: 2, weight: 3 },
    { kind: 'vault', minDepth: 3, weight: 2 },
    { kind: 'merchant', minDepth: 3, weight: 2 },
    { kind: 'shrine', minDepth: 4, weight: 2 },
    { kind: 'ambush', minDepth: 4, weight: 2 },
    { kind: 'nest', minDepth: 5, weight: 2 },
    { kind: 'monsterHouse', minDepth: 6, weight: 2 },
    { kind: 'waves', minDepth: 7, weight: 2 },
    { kind: 'hunter', minDepth: 9, weight: 1 },
  ],
  touchRadius: 26,
  vault: { guards: 2, guardHp: 1.5 },
  monsterHouse: { extra: 5 },
  crystal: { bonusMs: 20_000, fadeMs: 40_000 },
  merchant: { berryPrice: 8, berryHeal: 0.4, berries: 2, itemPrice: 20 },
  shrine: {
    floors: 3,
    nightmareCurse: 1.5,
    pacts: [
      { id: 'edge', blessing: { playerDamage: 1.3 }, curse: { enemySpeed: 1.2 } },
      { id: 'blood', blessing: { healShare: 1, playerDamage: 1.1 }, curse: { enemyDamage: 1.3 } },
      { id: 'sand', blessing: { timeMs: 30_000 }, curse: { enemySpeed: 1.1, enemyDamage: 1.15 } },
    ],
  },
  nest: { species: 'eclipse-nest', brood: ['zubat', 'pumpkaboo-small', 'poochyena'], spawnEveryMs: 5000, telegraphMs: 1200, maxAlive: 3 },
  waves: { waves: [2, 3, 3], pauseMs: 1500, bonusMs: 15_000 },
  ambush: { count: 3, tellMs: 900 },
  hunter: { species: 'eclipse-hunter', delayMs: 7000 },
};

/** What the floor events of a dungeon other than the Sima tune: how often they come and which, from which floor. */
export interface FloorEventTuning {
  fromFloor: number;
  start: number;
  perFloor: number;
  max: number;
  cap: number;
  kinds: readonly SimaEventWeight[];
}

/**
 * The Sima's events as a dungeon without its clock plays them (owner 2026-10-30,
 * odd/tasks/boss-items-events.md): most held items outside bosses come from them,
 * so a chest weighs most. Every value is provisional. No time crystal (it only
 * pays clock) nor hunter (it only works under the clock's pressure); no pact paid
 * in time, and a cleared wave room pays only its pick. Coins are not halved here as in the
 * Sima, so the merchant asks more; a monster house is smaller, its floors shallower.
 */
export const floorEvents = (tuning: FloorEventTuning): SimaEvents => ({
  ...SIMA_EVENTS,
  ...tuning,
  monsterHouse: { extra: 3 },
  merchant: { ...SIMA_EVENTS.merchant, berryPrice: 12, itemPrice: 30 },
  shrine: { ...SIMA_EVENTS.shrine, pacts: SIMA_EVENTS.shrine.pacts.filter((p) => !p.blessing.timeMs) },
  waves: { ...SIMA_EVENTS.waves, bonusMs: 0 },
});
