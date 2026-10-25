import type { SpeciesId } from './species';
import type { PokemonType } from './types';

/**
 * Enemy behaviour tuning (docs/gdd.md §4, "Contenido del primer prototipo").
 * Telegraph durations are data on purpose: difficulty can scale them later
 * without touching the state machines. Distances in world pixels, times in ms,
 * speeds in px/s.
 */

/** An enemy attack that damages the player, resolved with the normal damage formula. */
export interface EnemyAttackDef {
  power: number;
  type: PokemonType;
}

/** How an enemy reacts to the player's hits. */
export interface PoiseDef {
  /** Scales the hitstun of incoming hits (0 = never staggered). */
  hitstunScale: number;
  /** Scales the knockback of incoming hits. */
  knockbackScale: number;
}

export interface PoochyenaDef {
  kind: 'lunger';
  poise: PoiseDef;
  /** Starts hunting when the player comes this close. */
  aggroRange: number;
  walkSpeed: number;
  /** While the lunge is on cooldown it circles the player at this distance. */
  stalkRange: number;
  /** Starts the telegraph when the player is this close and the cooldown is over. */
  lungeRange: number;
  /** Wind-up ("Charge" animation): tracks the player, then commits the lunge direction. */
  telegraphMs: number;
  lungeMs: number;
  lungeDistance: number;
  attack: EnemyAttackDef;
  /** Recovery after the lunge connects. */
  hitRecoverMs: number;
  /** Recovery after a missed or dodged lunge: the punish window. */
  missRecoverMs: number;
  cooldownMs: number;
  /** Flies or phases: goes straight over walls and obstacles (no path finding), only the map bounds confine it. */
  floats?: true;
  /** HP it takes back when its lunge connects (Phantump's grab). */
  drainHp?: number;
}

export interface GastlyDef {
  kind: 'caster';
  poise: PoiseDef;
  /** Floats over obstacles (only the room bounds confine it); walking casters slide along walls. */
  floats?: true;
  /** Several projectiles in a fan per cast (Spinarak's threads); one when absent. */
  spread?: { count: number; degrees: number };
  aggroRange: number;
  speed: number;
  /** Preferred distance band to the player. */
  minDistance: number;
  maxDistance: number;
  telegraphMs: number;
  /** Time spent in the cast animation after the ball leaves. */
  castMs: number;
  recoverMs: number;
  cooldownMs: number;
  projectile: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };
}

export const POOCHYENA: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 600,
  walkSpeed: 75,
  stalkRange: 130,
  lungeRange: 115,
  telegraphMs: 550,
  lungeMs: 260,
  lungeDistance: 150,
  attack: { power: 40, type: 'dark' },
  hitRecoverMs: 450,
  missRecoverMs: 1100,
  cooldownMs: 900,
};

export const GASTLY: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  floats: true,
  aggroRange: 700,
  speed: 55,
  minDistance: 120,
  maxDistance: 230,
  telegraphMs: 650,
  castMs: 250,
  recoverMs: 500,
  cooldownMs: 1800,
  projectile: { power: 40, type: 'poison', speed: 95, radius: 7, lifetimeMs: 4500 },
};

/** One blow of the Blade-stance combo. */
export interface ComboHitDef {
  telegraphMs: number;
  strikeMs: number;
  /** Forward step during the strike. */
  lungeDistance: number;
  /** Frontal sector hit by the blow. */
  range: number;
  arcDegrees: number;
  attack: EnemyAttackDef;
}

export interface AegislashDef {
  kind: 'boss';
  poise: PoiseDef;
  aggroRange: number;
  /** Telegraphed stance change; it neither blocks nor attacks meanwhile (an opening). */
  transformMs: number;
  shield: {
    walkSpeed: number;
    /** Slow turning is what makes flanking work. */
    turnRateDegPerSec: number;
    /** Hits arriving from inside this frontal sector are blocked. */
    blockArcDegrees: number;
    /** Fraction of the damage a blocked hit still deals (0 = none). */
    chipFactor: number;
    bashRange: number;
    bashTelegraphMs: number;
    bashMs: number;
    bashDistance: number;
    bashRecoverMs: number;
    bashCooldownMs: number;
    bash: EnemyAttackDef;
    /** Changes to Blade after this long in Shield... */
    maxMs: number;
    /** ...or after taking this much damage (flank hits) in Shield. */
    damageToBreak: number;
  };
  blade: {
    walkSpeed: number;
    turnRateDegPerSec: number;
    /** Starts a combo when the player is this close. */
    engageRange: number;
    combo: readonly ComboHitDef[];
    /** Recovery after the last blow of a combo: the clear opening. */
    recoverMs: number;
    comboCooldownMs: number;
    /** Back to Shield after this many combos, or after `maxMs`. */
    combosPerStance: number;
    maxMs: number;
  };
}

export const AEGISLASH: AegislashDef = {
  kind: 'boss',
  poise: { hitstunScale: 0, knockbackScale: 0.15 },
  aggroRange: 900,
  transformMs: 900,
  shield: {
    walkSpeed: 35,
    turnRateDegPerSec: 75,
    blockArcDegrees: 130,
    chipFactor: 0,
    bashRange: 85,
    bashTelegraphMs: 700,
    bashMs: 220,
    bashDistance: 110,
    bashRecoverMs: 700,
    bashCooldownMs: 2200,
    bash: { power: 35, type: 'steel' },
    maxMs: 10000,
    damageToBreak: 120,
  },
  blade: {
    walkSpeed: 100,
    turnRateDegPerSec: 540,
    engageRange: 90,
    combo: [
      { telegraphMs: 480, strikeMs: 140, lungeDistance: 40, range: 52, arcDegrees: 130, attack: { power: 22, type: 'ghost' } },
      { telegraphMs: 260, strikeMs: 140, lungeDistance: 40, range: 52, arcDegrees: 130, attack: { power: 22, type: 'ghost' } },
      { telegraphMs: 420, strikeMs: 180, lungeDistance: 70, range: 60, arcDegrees: 160, attack: { power: 30, type: 'ghost' } },
    ],
    recoverMs: 1400,
    comboCooldownMs: 700,
    combosPerStance: 2,
    maxMs: 9000,
  },
};

/**
 * Tanks: walk in slowly, telegraph a long wind-up, then slam the ground
 * around them (a ring to roll out of or through); Trevenant also throws a
 * ring of leaves with each slam.
 */
export interface SlammerDef {
  kind: 'slammer';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  /** Starts the wind-up when the player is this close and the cooldown is over. */
  slamRange: number;
  telegraphMs: number;
  /** The slam's active window. */
  slamMs: number;
  /** Radius of the slam around its body. */
  radius: number;
  attack: EnemyAttackDef;
  /** After the slam: the punish window. */
  recoverMs: number;
  cooldownMs: number;
  /** Projectiles thrown evenly around it when it slams. */
  ring?: { count: number; projectile: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number } };
  /** Shows the boss bar (a mid-boss). */
  bar?: true;
}

/** Foongus: never moves; when the player comes close it puffs, then leaves a spore cloud where it stands. */
export interface SporeDef {
  kind: 'spore';
  poise: PoiseDef;
  triggerRange: number;
  telegraphMs: number;
  /** The cloud: a projectile that does not move, hits once, and fades after `lifetimeMs`. */
  cloud: EnemyAttackDef & { radius: number; lifetimeMs: number };
  recoverMs: number;
  cooldownMs: number;
}

/** A Decidueye spell card (docs/gdd.md, Bosque Brumoso): its i18n name key. */
export type ArcherCard = 'volley' | 'fan' | 'dive';

export type ArrowDef = EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };

/**
 * Decidueye: three spell cards in a fixed order, each announced by name and
 * telegraphed. Volley: aimed arrows one after another (keep moving). Fan:
 * it fades out, reappears at the edge of the clearing farthest from the
 * player and fires fans of leaves whose gaps shift between fans. Dive: a
 * long, tracked wind-up, then a straight dive across the clearing (roll
 * sideways) and a long recovery to punish.
 */
export interface ArcherDef {
  kind: 'archer';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  /** It drifts to stay this far from the player between cards. */
  keepDistance: number;
  /** Pause between two cards. */
  restMs: number;
  cards: readonly ArcherCard[];
  /** i18n key of each card's name, shown when it starts. */
  cardNames: Readonly<Record<ArcherCard, string>>;
  volley: { telegraphMs: number; shots: number; gapMs: number; arrow: ArrowDef; recoverMs: number };
  fan: { vanishMs: number; telegraphMs: number; fans: number; leaves: number; spreadDegrees: number; gapMs: number; leaf: ArrowDef; recoverMs: number; edgeInset: number };
  dive: { telegraphMs: number; diveMs: number; distance: number; reach: number; attack: EnemyAttackDef; recoverMs: number };
}

export const PHANTUMP: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  floats: true,
  drainHp: 10,
  aggroRange: 500,
  walkSpeed: 46,
  stalkRange: 110,
  lungeRange: 95,
  telegraphMs: 650,
  lungeMs: 300,
  lungeDistance: 110,
  attack: { power: 30, type: 'ghost' },
  hitRecoverMs: 550,
  missRecoverMs: 1200,
  cooldownMs: 1400,
};

export const PUMPKABOO_SMALL: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1.2, knockbackScale: 1.4 },
  aggroRange: 600,
  walkSpeed: 92,
  stalkRange: 90,
  lungeRange: 80,
  telegraphMs: 420,
  lungeMs: 180,
  lungeDistance: 80,
  attack: { power: 16, type: 'ghost' },
  hitRecoverMs: 400,
  missRecoverMs: 750,
  cooldownMs: 1000,
};

export const HOOTHOOT: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  floats: true,
  aggroRange: 650,
  walkSpeed: 70,
  stalkRange: 150,
  lungeRange: 140,
  telegraphMs: 750,
  lungeMs: 340,
  lungeDistance: 210,
  attack: { power: 30, type: 'flying' },
  hitRecoverMs: 500,
  missRecoverMs: 1300,
  cooldownMs: 1700,
};

export const SPINARAK: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  spread: { count: 3, degrees: 28 },
  aggroRange: 600,
  speed: 50,
  minDistance: 110,
  maxDistance: 200,
  telegraphMs: 700,
  castMs: 300,
  recoverMs: 600,
  cooldownMs: 2300,
  projectile: { power: 20, type: 'bug', speed: 115, radius: 5, lifetimeMs: 2600 },
};

export const PUMPKABOO_SUPER: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.25, knockbackScale: 0.3 },
  aggroRange: 500,
  walkSpeed: 36,
  slamRange: 70,
  telegraphMs: 900,
  slamMs: 160,
  radius: 62,
  attack: { power: 42, type: 'ghost' },
  recoverMs: 1300,
  cooldownMs: 1500,
};

export const FOONGUS: SporeDef = {
  kind: 'spore',
  poise: { hitstunScale: 1, knockbackScale: 0 },
  triggerRange: 95,
  telegraphMs: 700,
  cloud: { power: 26, type: 'poison', radius: 38, lifetimeMs: 2600 },
  recoverMs: 900,
  cooldownMs: 2600,
};

export const TREVENANT: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0, knockbackScale: 0.1 },
  bar: true,
  aggroRange: 900,
  walkSpeed: 44,
  slamRange: 95,
  telegraphMs: 1000,
  slamMs: 200,
  radius: 85,
  attack: { power: 38, type: 'ghost' },
  recoverMs: 1400,
  cooldownMs: 1100,
  ring: { count: 10, projectile: { power: 20, type: 'grass', speed: 85, radius: 7, lifetimeMs: 4200 } },
};

export const DECIDUEYE: ArcherDef = {
  kind: 'archer',
  poise: { hitstunScale: 0, knockbackScale: 0.1 },
  aggroRange: 900,
  walkSpeed: 60,
  keepDistance: 150,
  restMs: 1400,
  cards: ['volley', 'fan', 'dive'],
  cardNames: { volley: 'spell.decidueye.volley', fan: 'spell.decidueye.fan', dive: 'spell.decidueye.dive' },
  volley: { telegraphMs: 900, shots: 5, gapMs: 480, arrow: { power: 24, type: 'ghost', speed: 230, radius: 5, lifetimeMs: 2400 }, recoverMs: 900 },
  fan: {
    vanishMs: 700,
    telegraphMs: 800,
    fans: 3,
    leaves: 7,
    spreadDegrees: 80,
    gapMs: 650,
    leaf: { power: 22, type: 'grass', speed: 120, radius: 6, lifetimeMs: 6000 },
    recoverMs: 1100,
    edgeInset: 80,
  },
  dive: { telegraphMs: 1100, diveMs: 420, distance: 460, reach: 8, attack: { power: 44, type: 'flying' }, recoverMs: 1700 },
};

export type EnemyDef = PoochyenaDef | GastlyDef | AegislashDef | SlammerDef | SporeDef | ArcherDef;

/** Behaviour per enemy species; species without an entry never act. */
export const ENEMY_BEHAVIOUR: Partial<Record<SpeciesId, EnemyDef>> = {
  poochyena: POOCHYENA,
  gastly: GASTLY,
  aegislash: AEGISLASH,
  phantump: PHANTUMP,
  'pumpkaboo-small': PUMPKABOO_SMALL,
  'pumpkaboo-super': PUMPKABOO_SUPER,
  foongus: FOONGUS,
  spinarak: SPINARAK,
  hoothoot: HOOTHOOT,
  trevenant: TREVENANT,
  decidueye: DECIDUEYE,
};

const DEFAULT_POISE: PoiseDef = { hitstunScale: 1, knockbackScale: 1 };

export const poiseOf = (species: SpeciesId): PoiseDef => ENEMY_BEHAVIOUR[species]?.poise ?? DEFAULT_POISE;

/** Floaters ignore obstacles (walls still confine them). */
export const floatsOf = (species: SpeciesId): boolean => {
  const def = ENEMY_BEHAVIOUR[species];
  return def !== undefined && 'floats' in def && def.floats === true;
};
