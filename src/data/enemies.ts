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
  /** Erratic flier (Zubat): weaves sideways while it closes in, `amplitude` of the forward speed, one sway per `periodMs`. */
  weave?: { amplitude: number; periodMs: number };
  /** The aim stops tracking the player this long before the lunge (Ekans' coil): the locked lane is the dodge cue. */
  lockMs?: number;
  /**
   * A second cut right after the first lunge (Pawniard): a short, re-aimed
   * wind-up and lunge, so rolling into it on the first one gets punished.
   */
  followUp?: { telegraphMs: number; lungeMs: number; lungeDistance: number };
  /**
   * A fake-out (Impidimp): the first wind-up (`telegraphMs`, lane and all) is
   * a feint; it then sidesteps across the line to the player, harmless, and
   * winds up the real lunge (`telegraphMs` here, re-aimed) from the side.
   * `count` feints before the real one (default 1).
   */
  feint?: { telegraphMs: number; sidestepMs: number; sidestepDistance: number; count?: number };
}

/** A shot that bends towards the nearest player for a while (Duskull's will-o-wisp). */
export interface SteerDef {
  degPerSec: number;
  /** Steering stops after this long; it then flies straight. */
  ms: number;
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
  projectile: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number; steer?: SteerDef };
  /**
   * Throws a whole ring instead of a ball or a fan (Drifloon): `count` shots
   * evenly around it, one aimed at the player; every other cast turns the
   * ring by half a step, so the gaps move. `waves` rings per cast,
   * `waveGapMs` apart, each turned half a step from the last (default 1).
   */
  ring?: { count: number; waves?: number; waveGapMs?: number };
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

/** Aegislash's phase-2 spell cards (docs/gdd.md, Cripta). */
export type AegislashCard = 'midnight' | 'oaths' | 'shadow';

/** An enemy shot (shape, speed, life). */
export type ShotDef = EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };

/**
 * Aegislash's second phase, "El Rey desenvaina": at half HP a long,
 * harmless unsheathing (the opening), then faster stance swaps, and after
 * every Blade stance one named spell card in turn. Midnight: a spin that hits
 * a ring around it and throws a ring of blades. Oaths: planted shield that
 * guards from every side while it fires fans of blades (hide behind a pillar),
 * then lowers it. Shadow: a wall of shadow swords sweeps the throne room from
 * one end to the other, with a gap away from the player; the pillars stop the
 * swords of their column.
 */
export interface AegislashPhase2Def {
  /** Fraction of max HP at or below which it starts. */
  threshold: number;
  unsheatheMs: number;
  transformMs: number;
  shieldMaxMs: number;
  shieldDamageToBreak: number;
  bladeMaxMs: number;
  bladeCombosPerStance: number;
  cards: readonly AegislashCard[];
  midnight: { telegraphMs: number; radius: number; strikeMs: number; attack: EnemyAttackDef; blades: { count: number; shot: ShotDef }; recoverMs: number };
  oaths: { telegraphMs: number; volleys: number; perVolley: number; spreadDegrees: number; gapMs: number; blade: ShotDef; recoverMs: number };
  shadow: { telegraphMs: number; lanes: number; spacing: number; gapWidth: number; sword: ShotDef; sweepMs: number; recoverMs: number };
}

export interface AegislashDef {
  kind: 'boss';
  /** i18n keys of the phase-2 spell cards and of the unsheathing, shown when they start. */
  cardNames: Readonly<Record<AegislashCard | 'unsheathe', string>>;
  phase2: AegislashPhase2Def;
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
  cardNames: {
    unsheathe: 'spell.aegislash.unsheathe',
    midnight: 'spell.aegislash.midnight',
    oaths: 'spell.aegislash.oaths',
    shadow: 'spell.aegislash.shadow',
  },
  phase2: {
    threshold: 0.5,
    unsheatheMs: 1600,
    transformMs: 600,
    shieldMaxMs: 6000,
    shieldDamageToBreak: 80,
    bladeMaxMs: 6000,
    bladeCombosPerStance: 1,
    cards: ['midnight', 'oaths', 'shadow'],
    midnight: {
      telegraphMs: 1100,
      radius: 110,
      strikeMs: 220,
      attack: { power: 34, type: 'ghost' },
      blades: { count: 12, shot: { power: 18, type: 'steel', speed: 120, radius: 7, lifetimeMs: 4000 } },
      recoverMs: 1500,
    },
    oaths: { telegraphMs: 800, volleys: 3, perVolley: 5, spreadDegrees: 60, gapMs: 750, blade: { power: 15, type: 'steel', speed: 150, radius: 6, lifetimeMs: 4000 }, recoverMs: 1600 },
    shadow: { telegraphMs: 1300, lanes: 5, spacing: 30, gapWidth: 96, sword: { power: 30, type: 'ghost', speed: 160, radius: 9, lifetimeMs: 5000 }, sweepMs: 900, recoverMs: 1400 },
  },
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
  /** Floats over obstacles (Tentacool drifts). */
  floats?: true;
  /** A lingering hazard left where it slams (Tentacool's poison, Wooper's mud). */
  puddle?: HazardDef;
  /** Hazards dropped behind it every `everyMs` while it walks (Grimer's sludge trail). */
  trail?: { everyMs: number; puddle: HazardDef };
  /**
   * Frontal slam (Golett): only a sector of this many degrees in front is hit,
   * and the aim is fixed when the wind-up starts (step around it).
   */
  arcDegrees?: number;
  /**
   * A leap instead of a stomp (Shroomish): the wind-up marks the landing spot
   * (towards the player, at most `distance` away), which stops following
   * `lockMs` before take-off; it flies there for `airMs` (harmless) and the
   * slam hits around the landing spot.
   */
  leap?: { distance: number; airMs: number; lockMs: number };
}

/** A lingering ground hazard: a still projectile that hits whoever walks in, once, and fades after `lifetimeMs`. */
export type HazardDef = EnemyAttackDef & { radius: number; lifetimeMs: number };

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

/*
 * Experimental roster (docs/gdd.md "Plantel experimental"): the Flooded
 * Caves and Toxic Swamp species of docs/species-candidates.md plus three Fire
 * species, first tried in the Sima del Eclipse. Every attack follows the same
 * souls contract: a telegraph that shows where it lands, a dodge window (the
 * telegraph itself, or the last part of it once the aim locks) and a punish
 * window after it (`recoverMs`). Values are provisional.
 */

/** Crabs (Corphish, Clauncher): keep a distance band, telegraph a lane, then a water jet down it; the shell blocks frontal hits except while recovering. */
export interface BeamDef {
  kind: 'beam';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  minDistance: number;
  maxDistance: number;
  /** Slow turning makes flanking the shell possible. */
  turnRateDegPerSec: number;
  telegraphMs: number;
  /** The lane stops following the player this long before the jet. */
  lockMs: number;
  /** The jet's active window. */
  beamMs: number;
  length: number;
  width: number;
  attack: EnemyAttackDef;
  recoverMs: number;
  cooldownMs: number;
  /** Frontal sector that blocks hits (chip damage only) outside the recovery. */
  guard?: { arcDegrees: number; chipFactor: number };
}

/** Chinchou: its lure glows, then an electric ring sweeps out from its body to `radius`; roll through it or stay outside. */
export interface PulseDef {
  kind: 'pulse';
  poise: PoiseDef;
  aggroRange: number;
  speed: number;
  minDistance: number;
  maxDistance: number;
  telegraphMs: number;
  /** Time the ring takes to sweep out to `radius`. */
  pulseMs: number;
  radius: number;
  /** Thickness of the ring's front. */
  width: number;
  attack: EnemyAttackDef;
  recoverMs: number;
  cooldownMs: number;
}

/** Breath attacks in a frontal cone: Houndour's flamethrower, Stunky's spray (turned away, leaving a cloud). */
export interface ConeDef {
  kind: 'cone';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  /** Starts the wind-up when the player is this close. */
  engageRange: number;
  telegraphMs: number;
  breathMs: number;
  reach: number;
  arcDegrees: number;
  attack: EnemyAttackDef;
  recoverMs: number;
  cooldownMs: number;
  /** Turns its back to spray (Stunky): only the look changes. */
  turnsAway?: true;
  /** A cloud left in the cone when the breath ends. */
  linger?: HazardDef;
}

/** Slugma: lobs a lava blob at where the player stands; the landing circle is marked until impact and leaves a lava pool. */
export interface MortarDef {
  kind: 'mortar';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  minDistance: number;
  maxDistance: number;
  /** Farthest landing point from its body. */
  maxThrow: number;
  /** Tracks the player; the landing point is fixed when it ends. */
  telegraphMs: number;
  /** Flight time: the marked circle is the dodge window. */
  flightMs: number;
  /** The last part of the flight that hits (the landing). */
  impactMs: number;
  radius: number;
  attack: EnemyAttackDef;
  pool: HazardDef;
  recoverMs: number;
  cooldownMs: number;
}

/** Koffing: floats close and puffs gas clouds; when its HP drops low it swells and explodes (a big marked ring), unless killed first. */
export interface BomberDef {
  kind: 'bomber';
  poise: PoiseDef;
  floats: true;
  aggroRange: number;
  speed: number;
  /** Stops drifting closer at this distance. */
  keepDistance: number;
  puffRange: number;
  telegraphMs: number;
  cloud: HazardDef;
  recoverMs: number;
  cooldownMs: number;
  explode: {
    /** Starts the fuse once its HP is at or below this share of its max. */
    belowHp: number;
    /** The fuse: cannot be staggered; killing it in time cancels the blast. */
    telegraphMs: number;
    blastMs: number;
    radius: number;
    attack: EnemyAttackDef;
  };
}

/**
 * Croagunk: closes in and takes a counter stance. Hitting it during the
 * stance is blocked and answered with a fast counter-punch; if nobody
 * bites, the stance ends in a slower Poison Jab. Both end in a recovery.
 */
export interface CounterDef {
  kind: 'counter';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  engageRange: number;
  stanceMs: number;
  counter: { telegraphMs: number; lungeMs: number; lungeDistance: number; attack: EnemyAttackDef };
  jab: { telegraphMs: number; lungeMs: number; lungeDistance: number; attack: EnemyAttackDef };
  recoverMs: number;
  cooldownMs: number;
}

export const ZUBAT: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1.3, knockbackScale: 1.4 },
  floats: true,
  weave: { amplitude: 0.9, periodMs: 700 },
  aggroRange: 600,
  walkSpeed: 95,
  stalkRange: 120,
  lungeRange: 120,
  telegraphMs: 500,
  lungeMs: 240,
  lungeDistance: 170,
  attack: { power: 22, type: 'flying' },
  hitRecoverMs: 450,
  missRecoverMs: 900,
  cooldownMs: 1100,
};

export const EKANS: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  lockMs: 300,
  aggroRange: 550,
  walkSpeed: 60,
  stalkRange: 150,
  lungeRange: 150,
  telegraphMs: 800,
  lungeMs: 260,
  lungeDistance: 200,
  attack: { power: 34, type: 'poison' },
  hitRecoverMs: 500,
  missRecoverMs: 1300,
  cooldownMs: 1500,
};

export const TENTACOOL: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.8, knockbackScale: 0.6 },
  floats: true,
  aggroRange: 500,
  walkSpeed: 40,
  slamRange: 60,
  telegraphMs: 650,
  slamMs: 140,
  radius: 46,
  attack: { power: 28, type: 'poison' },
  recoverMs: 1000,
  cooldownMs: 1600,
  puddle: { power: 16, type: 'poison', radius: 26, lifetimeMs: 3500 },
};

export const WOOPER: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.5, knockbackScale: 0.5 },
  aggroRange: 500,
  walkSpeed: 34,
  slamRange: 70,
  telegraphMs: 950,
  slamMs: 180,
  radius: 64,
  attack: { power: 36, type: 'ground' },
  recoverMs: 1400,
  cooldownMs: 1700,
  puddle: { power: 14, type: 'water', radius: 34, lifetimeMs: 3000 },
};

export const GRIMER: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.4, knockbackScale: 0.3 },
  aggroRange: 500,
  walkSpeed: 30,
  slamRange: 55,
  telegraphMs: 900,
  slamMs: 160,
  radius: 50,
  attack: { power: 32, type: 'poison' },
  recoverMs: 1300,
  cooldownMs: 1500,
  trail: { everyMs: 450, puddle: { power: 12, type: 'poison', radius: 14, lifetimeMs: 4000 } },
};

export const CORPHISH: BeamDef = {
  kind: 'beam',
  poise: { hitstunScale: 0.6, knockbackScale: 0.5 },
  aggroRange: 550,
  walkSpeed: 55,
  minDistance: 90,
  maxDistance: 170,
  turnRateDegPerSec: 140,
  telegraphMs: 700,
  lockMs: 250,
  beamMs: 260,
  length: 190,
  width: 18,
  attack: { power: 30, type: 'water' },
  recoverMs: 1000,
  cooldownMs: 1700,
  guard: { arcDegrees: 120, chipFactor: 0.2 },
};

export const CLAUNCHER: BeamDef = {
  kind: 'beam',
  poise: { hitstunScale: 0.8, knockbackScale: 0.7 },
  aggroRange: 700,
  walkSpeed: 40,
  minDistance: 180,
  maxDistance: 300,
  turnRateDegPerSec: 90,
  telegraphMs: 1100,
  lockMs: 350,
  beamMs: 200,
  length: 340,
  width: 12,
  attack: { power: 40, type: 'water' },
  recoverMs: 1300,
  cooldownMs: 2400,
  guard: { arcDegrees: 90, chipFactor: 0.25 },
};

export const CHINCHOU: PulseDef = {
  kind: 'pulse',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 600,
  speed: 50,
  minDistance: 60,
  maxDistance: 120,
  telegraphMs: 900,
  pulseMs: 450,
  radius: 110,
  width: 10,
  attack: { power: 28, type: 'electric' },
  recoverMs: 900,
  cooldownMs: 2000,
};

export const HOUNDOUR: ConeDef = {
  kind: 'cone',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 600,
  walkSpeed: 85,
  engageRange: 90,
  telegraphMs: 600,
  breathMs: 500,
  reach: 100,
  arcDegrees: 50,
  attack: { power: 30, type: 'fire' },
  recoverMs: 900,
  cooldownMs: 1500,
};

export const STUNKY: ConeDef = {
  kind: 'cone',
  poise: { hitstunScale: 1.2, knockbackScale: 1.2 },
  turnsAway: true,
  aggroRange: 550,
  walkSpeed: 80,
  engageRange: 70,
  telegraphMs: 550,
  breathMs: 300,
  reach: 70,
  arcDegrees: 70,
  attack: { power: 20, type: 'poison' },
  recoverMs: 800,
  cooldownMs: 1700,
  linger: { power: 14, type: 'poison', radius: 22, lifetimeMs: 2500 },
};

export const SLUGMA: MortarDef = {
  kind: 'mortar',
  poise: { hitstunScale: 0.7, knockbackScale: 0.5 },
  aggroRange: 600,
  walkSpeed: 30,
  minDistance: 100,
  maxDistance: 220,
  maxThrow: 260,
  telegraphMs: 700,
  flightMs: 650,
  impactMs: 100,
  radius: 40,
  attack: { power: 34, type: 'fire' },
  pool: { power: 16, type: 'fire', radius: 30, lifetimeMs: 3500 },
  recoverMs: 900,
  cooldownMs: 2200,
};

export const LITLEO: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 650,
  speed: 60,
  minDistance: 120,
  maxDistance: 220,
  telegraphMs: 600,
  castMs: 250,
  recoverMs: 500,
  cooldownMs: 1700,
  projectile: { power: 30, type: 'fire', speed: 150, radius: 8, lifetimeMs: 2500 },
};

export const KOFFING: BomberDef = {
  kind: 'bomber',
  poise: { hitstunScale: 0.6, knockbackScale: 0.8 },
  floats: true,
  aggroRange: 550,
  speed: 38,
  keepDistance: 50,
  puffRange: 80,
  telegraphMs: 600,
  cloud: { power: 22, type: 'poison', radius: 34, lifetimeMs: 3000 },
  recoverMs: 800,
  cooldownMs: 2400,
  explode: { belowHp: 0.35, telegraphMs: 1500, blastMs: 150, radius: 95, attack: { power: 60, type: 'poison' } },
};

export const CROAGUNK: CounterDef = {
  kind: 'counter',
  poise: { hitstunScale: 0.8, knockbackScale: 0.7 },
  aggroRange: 550,
  walkSpeed: 70,
  engageRange: 80,
  stanceMs: 1200,
  counter: { telegraphMs: 320, lungeMs: 180, lungeDistance: 90, attack: { power: 48, type: 'fighting' } },
  jab: { telegraphMs: 450, lungeMs: 200, lungeDistance: 80, attack: { power: 30, type: 'poison' } },
  recoverMs: 1100,
  cooldownMs: 1500,
};

/** Where an experimental species is meant to live once its dungeon exists. */
export type FutureDungeon = 'flooded-caves' | 'toxic-swamp' | 'undecided';

export interface ExperimentalEnemy {
  species: SpeciesId;
  /** Suggested first floor (depth) it may appear on. */
  minDepth: number;
  /** Relative spawn weight once allowed. */
  weight: number;
  /** Comes in groups of this many. */
  pack?: number;
  /** Suggested Pokémonedas per defeat (the run tally pays a flat `COINS.perEnemy` today). */
  coins: number;
  futureDungeon: FutureDungeon;
}

/** The experimental roster: every species is in the Sima del Eclipse pool (data/endless.ts, `ENDLESS_POOL`); no other dungeon draws from it yet. */
export const EXPERIMENTAL_ENEMIES: readonly ExperimentalEnemy[] = [
  { species: 'zubat', minDepth: 1, weight: 3, pack: 3, coins: 1, futureDungeon: 'flooded-caves' },
  { species: 'stunky', minDepth: 1, weight: 2, pack: 2, coins: 1, futureDungeon: 'toxic-swamp' },
  { species: 'ekans', minDepth: 2, weight: 2, coins: 1, futureDungeon: 'toxic-swamp' },
  { species: 'litleo', minDepth: 2, weight: 2, coins: 1, futureDungeon: 'undecided' },
  { species: 'tentacool', minDepth: 2, weight: 2, coins: 1, futureDungeon: 'flooded-caves' },
  { species: 'corphish', minDepth: 3, weight: 2, coins: 2, futureDungeon: 'flooded-caves' },
  { species: 'chinchou', minDepth: 3, weight: 2, coins: 2, futureDungeon: 'flooded-caves' },
  { species: 'houndour', minDepth: 3, weight: 2, coins: 2, futureDungeon: 'undecided' },
  { species: 'koffing', minDepth: 3, weight: 1, coins: 2, futureDungeon: 'toxic-swamp' },
  { species: 'grimer', minDepth: 4, weight: 1, coins: 2, futureDungeon: 'toxic-swamp' },
  { species: 'wooper', minDepth: 4, weight: 1, coins: 2, futureDungeon: 'flooded-caves' },
  { species: 'slugma', minDepth: 4, weight: 1, coins: 2, futureDungeon: 'undecided' },
  { species: 'clauncher', minDepth: 5, weight: 1, coins: 3, futureDungeon: 'flooded-caves' },
  { species: 'croagunk', minDepth: 5, weight: 1, coins: 3, futureDungeon: 'toxic-swamp' },
];

/** Sableye's spell cards (Crypt mid-boss). */
export type ThiefCard = 'glint' | 'gems';

/**
 * Sableye, "el ladrón de gemas" (Crypt mid-boss): two spell cards in order.
 * Glint: it blinks out, glints where it will reappear beside the player
 * (the warning), reappears and slashes in a straight line, three times; a
 * slash that lands steals the last held item (core/stolen.ts) until the
 * player hits it back. Gems: it blinks to the middle of the vault and throws
 * rings of stolen gems whose gaps turn between rings. It rests in between.
 */
export interface ThiefDef {
  kind: 'thief';
  poise: PoiseDef;
  bar: true;
  aggroRange: number;
  walkSpeed: number;
  keepDistance: number;
  restMs: number;
  cards: readonly ThiefCard[];
  cardNames: Readonly<Record<ThiefCard, string>>;
  blink: {
    vanishMs: number;
    /** Glint at the spot it reappears on: the warning before the slash. */
    telegraphMs: number;
    /** It reappears this far from the player, a third of a turn around from where it was. */
    distance: number;
    slashMs: number;
    slashDistance: number;
    reach: number;
    attack: EnemyAttackDef;
    blinks: number;
    recoverMs: number;
  };
  gems: { vanishMs: number; telegraphMs: number; rings: number; perRing: number; gapMs: number; gem: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number }; recoverMs: number };
  /** A stolen item comes back after this long at the latest. */
  stealMs: number;
}

export const DUSKULL: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1, knockbackScale: 0.8 },
  floats: true,
  aggroRange: 650,
  speed: 34,
  minDistance: 70,
  maxDistance: 190,
  telegraphMs: 850,
  castMs: 300,
  recoverMs: 700,
  cooldownMs: 2600,
  projectile: { power: 28, type: 'fire', speed: 70, radius: 8, lifetimeMs: 5200, steer: { degPerSec: 65, ms: 2200 } },
};

export const GOLETT: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.2, knockbackScale: 0.05 },
  aggroRange: 520,
  walkSpeed: 32,
  slamRange: 100,
  telegraphMs: 1000,
  slamMs: 180,
  radius: 110,
  arcDegrees: 100,
  attack: { power: 46, type: 'ground' },
  recoverMs: 1400,
  cooldownMs: 1600,
};

export const PAWNIARD: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1.2, knockbackScale: 1.3 },
  aggroRange: 600,
  walkSpeed: 96,
  stalkRange: 105,
  lungeRange: 95,
  telegraphMs: 480,
  lungeMs: 170,
  lungeDistance: 110,
  attack: { power: 20, type: 'steel' },
  hitRecoverMs: 500,
  missRecoverMs: 900,
  cooldownMs: 1300,
  followUp: { telegraphMs: 260, lungeMs: 150, lungeDistance: 90 },
};

export const SABLEYE: ThiefDef = {
  kind: 'thief',
  poise: { hitstunScale: 0, knockbackScale: 0.15 },
  bar: true,
  aggroRange: 900,
  walkSpeed: 70,
  keepDistance: 170,
  restMs: 1300,
  cards: ['glint', 'gems'],
  cardNames: { glint: 'spell.sableye.glint', gems: 'spell.sableye.gems' },
  blink: {
    vanishMs: 450,
    telegraphMs: 650,
    distance: 95,
    slashMs: 220,
    slashDistance: 130,
    reach: 6,
    attack: { power: 26, type: 'dark' },
    blinks: 3,
    recoverMs: 1400,
  },
  gems: { vanishMs: 450, telegraphMs: 900, rings: 3, perRing: 12, gapMs: 800, gem: { power: 20, type: 'dark', speed: 105, radius: 6, lifetimeMs: 5000 }, recoverMs: 1500 },
  stealMs: 9000,
};

/*
 * Misty Forest remaster (docs/gdd.md, Bosque Brumoso): three more species,
 * each with its own trick. Impidimp feints a lunge and strikes from the side;
 * Shroomish leaps onto a marked spot; Drifloon lets go of rings of
 * will-o-wisps whose gaps turn between casts. Values are provisional.
 */
export const IMPIDIMP: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1.1, knockbackScale: 1.2 },
  aggroRange: 600,
  walkSpeed: 88,
  stalkRange: 120,
  lungeRange: 120,
  telegraphMs: 560,
  lungeMs: 200,
  lungeDistance: 130,
  attack: { power: 26, type: 'dark' },
  hitRecoverMs: 500,
  missRecoverMs: 1000,
  cooldownMs: 1600,
  feint: { telegraphMs: 420, sidestepMs: 260, sidestepDistance: 70 },
};

export const SHROOMISH: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.9, knockbackScale: 0.8 },
  aggroRange: 520,
  walkSpeed: 48,
  slamRange: 170,
  telegraphMs: 700,
  slamMs: 140,
  radius: 34,
  attack: { power: 30, type: 'grass' },
  recoverMs: 1000,
  cooldownMs: 1600,
  leap: { distance: 160, airMs: 420, lockMs: 250 },
};

export const DRIFLOON: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1.2, knockbackScale: 1.3 },
  floats: true,
  aggroRange: 600,
  speed: 40,
  minDistance: 90,
  maxDistance: 180,
  telegraphMs: 800,
  castMs: 300,
  recoverMs: 700,
  cooldownMs: 2400,
  projectile: { power: 22, type: 'fire', speed: 60, radius: 7, lifetimeMs: 5000 },
  ring: { count: 8 },
};

export type EnemyDef = PoochyenaDef | GastlyDef | AegislashDef | SlammerDef | SporeDef | ArcherDef | ThiefDef | BeamDef | PulseDef | ConeDef | MortarDef | BomberDef | CounterDef;

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
  zubat: ZUBAT,
  tentacool: TENTACOOL,
  chinchou: CHINCHOU,
  corphish: CORPHISH,
  clauncher: CLAUNCHER,
  wooper: WOOPER,
  grimer: GRIMER,
  koffing: KOFFING,
  ekans: EKANS,
  croagunk: CROAGUNK,
  stunky: STUNKY,
  houndour: HOUNDOUR,
  slugma: SLUGMA,
  litleo: LITLEO,
  duskull: DUSKULL,
  golett: GOLETT,
  pawniard: PAWNIARD,
  sableye: SABLEYE,
  impidimp: IMPIDIMP,
  shroomish: SHROOMISH,
  drifloon: DRIFLOON,
};

/** i18n key of a boss's spell card (Decidueye, Sableye, Aegislash's phase 2), if `stance` is one. */
export function spellCardKey(species: SpeciesId, stance: string | null | undefined): string | null {
  const def = ENEMY_BEHAVIOUR[species];
  if (!def || !stance || !('cardNames' in def)) return null;
  return (def.cardNames as Readonly<Record<string, string>>)[stance] ?? null;
}

const DEFAULT_POISE: PoiseDef = { hitstunScale: 1, knockbackScale: 1 };

export const poiseOf = (species: SpeciesId): PoiseDef => ENEMY_BEHAVIOUR[species]?.poise ?? DEFAULT_POISE;

/** Floaters ignore obstacles (walls still confine them). */
export const floatsOf = (species: SpeciesId): boolean => {
  const def = ENEMY_BEHAVIOUR[species];
  return def !== undefined && 'floats' in def && def.floats === true;
};
