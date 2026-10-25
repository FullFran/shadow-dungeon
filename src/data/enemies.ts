import { HERALD_BASE, type HeraldBaseDef } from './herald';
import type { Difficulty } from './difficulty';
import type { SpeciesId } from './species';
import type { PokemonType } from './types';
import { NIHILEGO, SALANDIT, SALAZZLE, SKRELP, VENIPEDE, type DasherDef, type QueenDef, type RollerDef, type SniperDef, type UltraDef } from './swamp-enemies';

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
  /**
   * A positional attack (a ground zone, a closing wall, a sweeping lane, a
   * pull): the roll's i-frames do not protect against it and it never counts
   * as a perfect dodge, so you walk or roll OUT of its area, not through it.
   * Drawn with its own telegraph (white and violet double border, a "!") and
   * warning sound; give it enough wind-up to reposition (core/hits.ts).
   * The forest uses it for Trevenant's roots and Decidueye's arrow rain.
   */
  pierceRoll?: boolean;
}

/**
 * A pattern only harder tiers play (docs/gdd.md §9): the core checks it with
 * `atLeast(worldDifficulty(state), minDifficulty)`. Every gated attack keeps a
 * telegraph of at least 280 ms and ends in a recovery (the punish window).
 */
export interface TierGate {
  minDifficulty: Difficulty;
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
  /** The follow-up only from this tier on (Zubat's second swoop); absent = every tier. */
  followUpFrom?: Difficulty;
  /** Harder tiers: a third cut after the follow-up (Pawniard), re-aimed after its own wind-up. */
  thirdCut?: TierGate & { telegraphMs: number; lungeMs: number; lungeDistance: number };
  /**
   * Harder tiers (Poochyena): on first spotting the player with a packmate
   * near, it howls (a harmless wind-up: an opening); packmates within `range`
   * have their lunge ready at once.
   */
  howl?: TierGate & { telegraphMs: number; range: number };
  /** Harder tiers (Ekans): a hazard left where the lunge ends. */
  landingHazard?: TierGate & { hazard: HazardDef };
  /**
   * A fake-out (Impidimp): the first wind-up (`telegraphMs`, lane and all) is
   * a feint; it then sidesteps across the line to the player, harmless, and
   * winds up the real lunge (`telegraphMs` here, re-aimed) from the side.
   * `count` feints before the real one (default 1).
   */
  feint?: { telegraphMs: number; sidestepMs: number; sidestepDistance: number; count?: number };
  /** A lingering flame left where each lunge ends (Pumpkaboo Small on hard). */
  ember?: HazardDef;
  /** Crab walk (Krabby): while closing in it moves this much sideways for every step towards the player. */
  scuttle?: number;
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
  /** Harder tiers: the cast becomes a fan (Duskull's twin wisps). */
  hardSpread?: TierGate & { count: number; degrees: number };
  /** Harder tiers (Gastly): a second ball `delayMs` into the cast, aimed anew. */
  secondBall?: TierGate & { delayMs: number };
  /**
   * Throws a whole ring instead of a ball or a fan (Drifloon): `count` shots
   * evenly around it, one aimed at the player; every other cast turns the
   * ring by half a step, so the gaps move. `waves` rings per cast,
   * `waveGapMs` apart, each turned half a step from the last (default 1).
   */
  ring?: { count: number; waves?: number; waveGapMs?: number };
  /** A burst down the lane locked at the end of the wind-up (Remoraid's Octazooka): `shots` in all, one every `gapMs`. */
  burst?: { shots: number; gapMs: number };
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
  howl: { minDifficulty: 'hard', telegraphMs: 500, range: 220 },
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
  secondBall: { minDifficulty: 'hard', delayMs: 200 },
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

/** A blow of the Blade combo only harder tiers add; `feint`: a held, longer wind-up that breaks the combo's rhythm. */
export type ExtraBlowDef = ComboHitDef & TierGate & { feint?: true };

/** Aegislash's phase-2 spell cards (docs/gdd.md, Cripta); `judgement` only on nightmare. */
export type AegislashCard = 'midnight' | 'oaths' | 'shadow' | 'judgement';

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
  /** Cards added to the rotation from a tier on (nightmare's Judgement). */
  extraCards: readonly (TierGate & { card: AegislashCard })[];
  /** Midnight's spin is positional from `pierceRollFrom` on (walk out of its ring). */
  midnight: { telegraphMs: number; radius: number; strikeMs: number; attack: EnemyAttackDef; pierceRollFrom: Difficulty; blades: { count: number; shot: ShotDef }; recoverMs: number };
  oaths: { telegraphMs: number; volleys: number; perVolley: number; spreadDegrees: number; gapMs: number; blade: ShotDef; recoverMs: number };
  shadow: { telegraphMs: number; lanes: number; spacing: number; gapWidth: number; sword: ShotDef; sweepMs: number; recoverMs: number };
  /**
   * Judgement (nightmare): two shadow walls, the second from the other end of
   * the throne room with its gap moved away from the player, after a second
   * wind-up of `secondTelegraphMs`. Positional, like Shadow.
   */
  judgement: { telegraphMs: number; secondTelegraphMs: number; sweepMs: number; recoverMs: number };
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
    /** Blows harder tiers add after `combo` (hard: a fourth blow with a delayed feint). */
    extraBlows: readonly ExtraBlowDef[];
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
    judgement: 'spell.aegislash.judgement',
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
    extraCards: [{ minDifficulty: 'nightmare', card: 'judgement' }],
    midnight: {
      telegraphMs: 1100,
      radius: 110,
      strikeMs: 220,
      attack: { power: 34, type: 'ghost' },
      pierceRollFrom: 'hard',
      blades: { count: 12, shot: { power: 18, type: 'steel', speed: 120, radius: 7, lifetimeMs: 4000 } },
      recoverMs: 1500,
    },
    oaths: { telegraphMs: 800, volleys: 3, perVolley: 5, spreadDegrees: 60, gapMs: 750, blade: { power: 15, type: 'steel', speed: 150, radius: 6, lifetimeMs: 4000 }, recoverMs: 1600 },
    // The shadow wall is positional on every tier (user feedback 2026-10-25): the gap lane is the way through, not a roll.
    shadow: { telegraphMs: 1300, lanes: 5, spacing: 30, gapWidth: 96, sword: { power: 30, type: 'ghost', speed: 160, radius: 9, lifetimeMs: 5000, pierceRoll: true }, sweepMs: 900, recoverMs: 1400 },
    judgement: { telegraphMs: 1300, secondTelegraphMs: 900, sweepMs: 900, recoverMs: 1800 },
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
    // Hard: the King holds the blade up (the feint) well past the combo's rhythm, then a wide cut; a roll timed on the rhythm comes too early.
    extraBlows: [{ minDifficulty: 'hard', feint: true, telegraphMs: 760, strikeMs: 200, lungeDistance: 60, range: 64, arcDegrees: 200, attack: { power: 30, type: 'ghost' } }],
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
  /** Harder tiers: a ring of slow shots thrown with the slam (Golett's aftershock of rubble). */
  hardRing?: TierGate & { count: number; projectile: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number } };
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
  /** A ring of slow spores thrown with the puff (Foongus on hard). */
  burst?: { count: number; shot: ShotDef };
}

/**
 * A Decidueye spell card (docs/gdd.md, Bosque Brumoso); `mist` is its fade
 * into phase 2, `rain`, `feathers` and `stitch` are phase-2 cards.
 */
export type ArcherCard = 'volley' | 'fan' | 'dive' | 'mist' | 'rain' | 'feathers' | 'stitch';

/**
 * Decidueye's second phase, "El Arquero se desvanece en la niebla": at half
 * HP it fades into the mist (a long, harmless opening), then plays denser
 * cards. Rain: the clearing is cut into lanes and arrows pour down every lane
 * but one; the safe lane moves one lane over each wave (positional: a roll
 * does not save you, `pierceRoll`; the trees stop arrows, so their shadow is
 * shelter too). Feathers: from the middle of the clearing, arms of feathers
 * wind out. Stitch: two shadow clones in the far corners and the archer
 * itself aim at one spot and each fire a line of arrows into it, three times,
 * re-aimed. Fan and Dive come back between them.
 */
export interface ArcherPhase2Def {
  threshold: number;
  mistMs: number;
  restMs: number;
  cards: readonly ArcherCard[];
  rain: { telegraphMs: number; waveTelegraphMs: number; waves: number; lanes: number; columnsPerLane: number; spawnMs: number; everyMs: number; arrow: ArrowDef; recoverMs: number };
  feathers: { vanishMs: number; telegraphMs: number; arms: number; turnDegrees: number; everyMs: number; bursts: number; feather: ArrowDef; recoverMs: number };
  stitch: { telegraphMs: number; gapMs: number; lockMs: number; stitches: number; arrowsPerLine: number; inset: number; arrow: ArrowDef; recoverMs: number };
}

/** Most enemy projectiles in the air at once; beyond it new ones are not thrown (performance; patterns only get sparser). */
export const ENEMY_SHOT_CAP = 160;

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
  cardNames: Readonly<Partial<Record<ArcherCard, string>>>;
  /** The phase at half HP (never in a Sima echo). */
  phase2: ArcherPhase2Def;
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

/** Trevenant's spell cards (Misty Forest mid-boss); `grove` is only dealt on hard and up (T4). */
export type TreantCard = 'roots' | 'spiral' | 'curse' | 'grove';

/**
 * Trevenant, the hollow's mid-boss: it walks in and slams (a ring around it
 * and a ring of leaves), then plays its next spell card, then slams again.
 * Roots: the hollow is split into lanes; every other lane is marked, then
 * roots burst from it (positional: a roll does not save you, `pierceRoll`),
 * then the other lanes. Spiral: arms of leaves wind out of it, every shot of
 * an arm far enough from the next to slip between. Curse: a ring of curses
 * is marked around the player, a gap left open on the side away from the
 * tree; the ring closes in to its centre, twice. Grove (hard and up): two
 * spirals winding opposite ways.
 */
export interface TreantDef {
  kind: 'treant';
  poise: PoiseDef;
  bar: true;
  aggroRange: number;
  walkSpeed: number;
  cards: readonly TreantCard[];
  cardNames: Readonly<Record<TreantCard, string>>;
  slam: {
    range: number;
    /** It slams anyway once it has walked this long. */
    approachMs: number;
    telegraphMs: number;
    slamMs: number;
    radius: number;
    attack: EnemyAttackDef;
    recoverMs: number;
    ring: { count: number; projectile: ShotDef };
  };
  /** `waveGapMs`: the wind-up of each later wave, marked once the last roots are gone. */
  roots: { telegraphMs: number; waveGapMs: number; waves: number; laneWidth: number; spacing: number; spike: HazardDef; recoverMs: number };
  spiral: { telegraphMs: number; arms: number; turnDegrees: number; everyMs: number; bursts: number; leaf: ShotDef; recoverMs: number };
  curse: { telegraphMs: number; lockMs: number; radius: number; count: number; gap: number; rings: number; ringGapMs: number; shot: ShotDef; recoverMs: number };
  /** The double spiral: as `spiral`, with this many arms each way. */
  grove: { arms: number; turnDegrees: number };
}

export const TREVENANT: TreantDef = {
  kind: 'treant',
  poise: { hitstunScale: 0, knockbackScale: 0.1 },
  bar: true,
  aggroRange: 900,
  walkSpeed: 44,
  cards: ['roots', 'spiral', 'curse'],
  cardNames: { roots: 'spell.trevenant.roots', spiral: 'spell.trevenant.spiral', curse: 'spell.trevenant.curse', grove: 'spell.trevenant.grove' },
  slam: {
    range: 95,
    approachMs: 3500,
    telegraphMs: 1000,
    slamMs: 200,
    radius: 85,
    attack: { power: 38, type: 'ghost' },
    recoverMs: 1400,
    ring: { count: 10, projectile: { power: 20, type: 'grass', speed: 85, radius: 7, lifetimeMs: 4200 } },
  },
  roots: {
    telegraphMs: 1100,
    waveGapMs: 700,
    waves: 2,
    laneWidth: 100,
    spacing: 36,
    spike: { power: 30, type: 'grass', radius: 24, lifetimeMs: 500, pierceRoll: true },
    recoverMs: 1300,
  },
  spiral: { telegraphMs: 900, arms: 4, turnDegrees: 18, everyMs: 200, bursts: 14, leaf: { power: 18, type: 'grass', speed: 95, radius: 6, lifetimeMs: 5000 }, recoverMs: 1300 },
  curse: { telegraphMs: 1000, lockMs: 300, radius: 160, count: 20, gap: 4, rings: 2, ringGapMs: 800, shot: { power: 22, type: 'ghost', speed: 80, radius: 7, lifetimeMs: 2000 }, recoverMs: 1400 },
  grove: { arms: 3, turnDegrees: 22 },
};

export const DECIDUEYE: ArcherDef = {
  kind: 'archer',
  poise: { hitstunScale: 0, knockbackScale: 0.1 },
  aggroRange: 900,
  walkSpeed: 60,
  keepDistance: 150,
  restMs: 1400,
  cards: ['volley', 'fan', 'dive'],
  cardNames: {
    volley: 'spell.decidueye.volley',
    fan: 'spell.decidueye.fan',
    dive: 'spell.decidueye.dive',
    mist: 'spell.decidueye.mist',
    rain: 'spell.decidueye.rain',
    feathers: 'spell.decidueye.feathers',
    stitch: 'spell.decidueye.stitch',
  },
  phase2: {
    threshold: 0.5,
    mistMs: 1600,
    restMs: 1200,
    cards: ['rain', 'fan', 'feathers', 'dive', 'stitch'],
    rain: {
      telegraphMs: 1200,
      waveTelegraphMs: 800,
      waves: 3,
      lanes: 8,
      columnsPerLane: 2,
      spawnMs: 400,
      everyMs: 100,
      arrow: { power: 22, type: 'ghost', speed: 520, radius: 5, lifetimeMs: 900, pierceRoll: true },
      recoverMs: 1300,
    },
    feathers: {
      vanishMs: 600,
      telegraphMs: 900,
      arms: 5,
      turnDegrees: 14,
      everyMs: 160,
      bursts: 16,
      feather: { power: 18, type: 'grass', speed: 115, radius: 5, lifetimeMs: 4500 },
      recoverMs: 1300,
    },
    stitch: { telegraphMs: 1000, gapMs: 700, lockMs: 300, stitches: 3, arrowsPerLine: 3, inset: 60, arrow: { power: 22, type: 'ghost', speed: 300, radius: 5, lifetimeMs: 2600 }, recoverMs: 1500 },
  },
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
  /** Harder tiers: the attack again right after, after its own wind-up (a longer combo); then the recovery. */
  repeat?: RepeatDef;
}

/** Harder tiers: an attack chained `times` more after a short re-aimed wind-up, before the usual recovery. */
export type RepeatDef = TierGate & { telegraphMs: number; times: number };

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
  repeat?: RepeatDef;
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
  /** Harder tiers (Houndour): the breath turns towards the player while it lasts, at this rate. */
  sweep?: TierGate & { degPerSec: number };
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
  repeat?: RepeatDef;
  /** The landing throws a ring of droplets outwards (Shellos from hard on). */
  splash?: { count: number; projectile: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number } };
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
  /** Harder tiers: the Poison Jab chained again. */
  repeat?: RepeatDef;
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
  // Hard: a second, re-aimed swoop.
  followUp: { telegraphMs: 320, lungeMs: 220, lungeDistance: 140 },
  followUpFrom: 'hard',
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
  landingHazard: { minDifficulty: 'hard', hazard: { power: 14, type: 'poison', radius: 22, lifetimeMs: 3000 } },
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
  repeat: { minDifficulty: 'hard', telegraphMs: 450, times: 1 },
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
  repeat: { minDifficulty: 'hard', telegraphMs: 500, times: 1 },
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
  sweep: { minDifficulty: 'hard', degPerSec: 70 },
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
  repeat: { minDifficulty: 'hard', telegraphMs: 450, times: 1 },
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
  repeat: { minDifficulty: 'hard', telegraphMs: 380, times: 1 },
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
  gems: {
    vanishMs: number;
    telegraphMs: number;
    rings: number;
    perRing: number;
    gapMs: number;
    gem: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };
    recoverMs: number;
    /**
     * Every tier: the gems burst out of the ground around it as the first ring
     * leaves (a positional zone, marked through the whole wind-up: walk out of
     * it), active for `activeMs`.
     */
    burst: { radius: number; activeMs: number; attack: EnemyAttackDef };
    /** Harder tiers: more rings. */
    extraRings: TierGate & { rings: number };
  };
  /** Harder tiers: more Glint blinks. */
  extraBlinks: TierGate & { blinks: number };
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
  // Hard: twin wisps that part and close in from both sides.
  hardSpread: { minDifficulty: 'hard', count: 2, degrees: 50 },
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
  hardRing: { minDifficulty: 'hard', count: 8, projectile: { power: 18, type: 'ground', speed: 70, radius: 7, lifetimeMs: 3200 } },
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
  // Hard: a third cut after a longer, readable wind-up (the rhythm breaks, then a wide opening).
  thirdCut: { minDifficulty: 'hard', telegraphMs: 380, lungeMs: 170, lungeDistance: 100 },
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
  gems: {
    vanishMs: 450,
    telegraphMs: 900,
    rings: 3,
    perRing: 12,
    gapMs: 800,
    gem: { power: 20, type: 'dark', speed: 105, radius: 6, lifetimeMs: 5000 },
    recoverMs: 1500,
    burst: { radius: 64, activeMs: 160, attack: { power: 22, type: 'dark', pierceRoll: true } },
    extraRings: { minDifficulty: 'hard', rings: 1 },
  },
  extraBlinks: { minDifficulty: 'nightmare', blinks: 1 },
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

// Flooded Caves (docs/species-candidates.md §2, Dungeon 3). Telegraphs >= 500 ms on easy.

/** Krabby: scuttles sideways around you, then a Crabhammer lunge; from hard on a second, re-aimed pincer follows. */
export const KRABBY: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 560,
  walkSpeed: 78,
  stalkRange: 120,
  lungeRange: 110,
  telegraphMs: 600,
  lungeMs: 220,
  lungeDistance: 125,
  attack: { power: 30, type: 'water' },
  hitRecoverMs: 450,
  missRecoverMs: 1000,
  cooldownMs: 1300,
  scuttle: 1.6,
};

/** Remoraid: keeps its distance and fires an Octazooka burst down the lane it locked (step sideways); from hard on the burst is longer. */
export const REMORAID: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1.1, knockbackScale: 1.2 },
  aggroRange: 650,
  speed: 62,
  minDistance: 130,
  maxDistance: 240,
  telegraphMs: 650,
  castMs: 420,
  recoverMs: 650,
  cooldownMs: 2100,
  projectile: { power: 20, type: 'water', speed: 200, radius: 6, lifetimeMs: 1800 },
  burst: { shots: 3, gapMs: 150 },
};

/** Shellos: crawls slowly and lobs mud where you stand (the circle follows you, then stays); from hard on the landing splashes droplets around it. */
export const SHELLOS: MortarDef = {
  kind: 'mortar',
  poise: { hitstunScale: 0.7, knockbackScale: 0.6 },
  aggroRange: 560,
  walkSpeed: 26,
  minDistance: 90,
  maxDistance: 210,
  maxThrow: 240,
  telegraphMs: 650,
  flightMs: 650,
  impactMs: 100,
  radius: 38,
  attack: { power: 28, type: 'ground' },
  pool: { power: 12, type: 'water', radius: 28, lifetimeMs: 3000 },
  recoverMs: 1000,
  cooldownMs: 2300,
};

/**
 * Spell cards of the bullet-hell bosses of the caves (Lanturn, Dhelmise) and
 * the phase-2 awakening. Each is one data pattern (core/danmaku.ts).
 */
export type DanmakuCard = 'bubbles' | 'lure' | 'surge' | 'deep' | 'undertow' | 'whirlpool' | 'kelp' | 'riptide' | 'bell' | 'maelstrom' | 'awaken';

export type DanmakuShot = EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };

/**
 * One spell card's pattern. Every bullet pattern leaves a way through:
 * rings miss `gap` bullets (the first gap faces the player, the next ones
 * turn by `gapTurnDeg`), spiral arms leave the space between them, lane walls
 * leave a lane `gapWidth` wide (shifting by `shiftPx` every other wave);
 * sweeps leave the sector behind their start; zones end at their edge.
 */
export type DanmakuPattern =
  | { kind: 'rings'; rings: number; perRing: number; gap: number; gapTurnDeg: number; gapMs: number; shot: DanmakuShot }
  | { kind: 'spiral'; arms: number; everyMs: number; durationMs: number; turnDegPerShot: number; shot: DanmakuShot }
  | { kind: 'lanes'; waves: number; gapMs: number; spacing: number; gapWidth: number; shiftPx: number; shot: DanmakuShot }
  /** An anchor or chain swung around the body: `sweepDeg` of a turn over `sweepMs`, hitting within `radius` near the arm. */
  | { kind: 'sweep'; radius: number; sweepDeg: number; sweepMs: number; armDeg: number; attack: EnemyAttackDef }
  /**
   * A marked circle that bursts: around the boss (`at: 'self'`) or where the
   * player stood (`at: 'target'`: the mark follows them until `lockMs` before
   * the end, the boss sinks and surfaces there); `ring` bullets fly out after.
   */
  | { kind: 'zone'; at: 'self' | 'target'; radius: number; lockMs: number; impactMs: number; attack: EnemyAttackDef; ring?: { count: number; gap: number; shot: DanmakuShot } };

export interface DanmakuCardDef {
  telegraphMs: number;
  recoverMs: number;
  pattern: DanmakuPattern;
}

/**
 * Bullet-hell bosses (docs/gdd.md, Cuevas Inundadas): spell cards in a fixed
 * order, each announced by name, telegraphed and followed by an opening; a
 * phase 2 below `phase2.belowHp` (once, never mid-card) changes the order and
 * the rest. Enemy shots never go over `maxShots` at once.
 */
export interface DanmakuDef {
  kind: 'danmaku';
  poise: PoiseDef;
  bar: true;
  aggroRange: number;
  walkSpeed: number;
  keepDistance: number;
  restMs: number;
  cards: readonly DanmakuCard[];
  cardNames: Readonly<Partial<Record<DanmakuCard, string>>>;
  patterns: Readonly<Partial<Record<DanmakuCard, DanmakuCardDef>>>;
  phase2?: { belowHp: number; transformMs: number; cards: readonly DanmakuCard[]; restMs: number };
  maxShots: number;
}

export const BUBBLE = (power: number, speed: number, radius = 7): DanmakuShot => ({ power, type: 'water', speed, radius, lifetimeMs: 6000 });

export const LANTURN_PATTERNS: Partial<Record<DanmakuCard, DanmakuCardDef>> = {
  bubbles: { telegraphMs: 800, recoverMs: 1300, pattern: { kind: 'rings', rings: 4, perRing: 20, gap: 3, gapTurnDeg: 40, gapMs: 700, shot: BUBBLE(18, 95) } },
  lure: { telegraphMs: 900, recoverMs: 1400, pattern: { kind: 'spiral', arms: 2, everyMs: 110, durationMs: 2600, turnDegPerShot: 13, shot: { power: 16, type: 'electric', speed: 120, radius: 5, lifetimeMs: 4500 } } },
  surge: { telegraphMs: 1300, recoverMs: 1600, pattern: { kind: 'zone', at: 'self', radius: 150, lockMs: 0, impactMs: 220, attack: { power: 34, type: 'electric', pierceRoll: true } } },
  deep: { telegraphMs: 900, recoverMs: 1500, pattern: { kind: 'rings', rings: 6, perRing: 28, gap: 4, gapTurnDeg: 25, gapMs: 520, shot: BUBBLE(16, 100, 6) } },
};

/**
 * Lanturn, "el farol del abismo" (caves mid-boss): bubble rings, a spiral of
 * sparks from its lure, and a discharge around its body that a roll does not
 * escape (walk out of the circle). Hard: three spiral arms; nightmare: an
 * extra card, a sea of lanterns (six denser rings).
 */
export const LANTURN: DanmakuDef = {
  kind: 'danmaku',
  poise: { hitstunScale: 0, knockbackScale: 0.15 },
  bar: true,
  aggroRange: 900,
  walkSpeed: 60,
  keepDistance: 130,
  restMs: 1300,
  cards: ['bubbles', 'lure', 'surge'],
  cardNames: { bubbles: 'spell.lanturn.bubbles', lure: 'spell.lanturn.lure', surge: 'spell.lanturn.surge', deep: 'spell.lanturn.deep' },
  patterns: LANTURN_PATTERNS,
  maxShots: 90,
};

const KELP = { power: 20, type: 'grass', speed: 150, radius: 8, lifetimeMs: 7000 } as const;

export const DHELMISE_PATTERNS: Partial<Record<DanmakuCard, DanmakuCardDef>> = {
  undertow: { telegraphMs: 1000, recoverMs: 1300, pattern: { kind: 'sweep', radius: 150, sweepDeg: 270, sweepMs: 900, armDeg: 26, attack: { power: 38, type: 'steel', pierceRoll: true } } },
  whirlpool: { telegraphMs: 900, recoverMs: 1300, pattern: { kind: 'spiral', arms: 2, everyMs: 120, durationMs: 3000, turnDegPerShot: 11, shot: BUBBLE(16, 110, 6) } },
  kelp: { telegraphMs: 1100, recoverMs: 1300, pattern: { kind: 'lanes', waves: 3, gapMs: 1100, spacing: 30, gapWidth: 96, shiftPx: 120, shot: KELP } },
  riptide: {
    telegraphMs: 1200,
    recoverMs: 1500,
    pattern: { kind: 'zone', at: 'target', radius: 72, lockMs: 400, impactMs: 220, attack: { power: 40, type: 'ghost', pierceRoll: true }, ring: { count: 16, gap: 3, shot: BUBBLE(16, 105, 6) } },
  },
  bell: { telegraphMs: 900, recoverMs: 1300, pattern: { kind: 'rings', rings: 5, perRing: 24, gap: 4, gapTurnDeg: 35, gapMs: 600, shot: { power: 18, type: 'ghost', speed: 100, radius: 7, lifetimeMs: 6000 } } },
  maelstrom: { telegraphMs: 1000, recoverMs: 1500, pattern: { kind: 'spiral', arms: 4, everyMs: 140, durationMs: 3200, turnDegPerShot: -9, shot: BUBBLE(15, 100, 6) } },
};

/**
 * Dhelmise, «el Ancla de los Juramentos Hundidos» (caves guardian): an
 * anchor swung around it (a positional sweep: step out of its reach or into
 * the open quarter behind it), a whirlpool spiral and kelp walls with a safe
 * lane. At half HP "El ancla despierta": it sinks and surfaces under you
 * (Riptide, positional), tolls the drowned bell (rings) and keeps the kelp
 * and the anchor. The hull and rocks of the wreck stop bubbles and kelp.
 * Hard: three whirlpool arms; nightmare: an extra phase-2 card, the
 * maelstrom (four arms turning the other way).
 */
export const DHELMISE: DanmakuDef = {
  kind: 'danmaku',
  poise: { hitstunScale: 0, knockbackScale: 0.05 },
  bar: true,
  aggroRange: 1000,
  walkSpeed: 55,
  keepDistance: 140,
  restMs: 1400,
  cards: ['undertow', 'whirlpool', 'kelp'],
  cardNames: {
    undertow: 'spell.dhelmise.undertow',
    whirlpool: 'spell.dhelmise.whirlpool',
    kelp: 'spell.dhelmise.kelp',
    riptide: 'spell.dhelmise.riptide',
    bell: 'spell.dhelmise.bell',
    maelstrom: 'spell.dhelmise.maelstrom',
    awaken: 'spell.dhelmise.awaken',
  },
  patterns: DHELMISE_PATTERNS,
  phase2: { belowHp: 0.5, transformMs: 1600, cards: ['riptide', 'kelp', 'bell', 'undertow'], restMs: 1100 },
  maxShots: 110,
};


export type EnemyDef = HeraldBaseDef | DanmakuDef | PoochyenaDef | GastlyDef | AegislashDef | SlammerDef | TreantDef | SporeDef | ArcherDef | ThiefDef | BeamDef | PulseDef | ConeDef | MortarDef | BomberDef | CounterDef | SwampDef | EclipseEchoDef;
/** The Toxic Swamp's new behaviours (data/swamp-enemies.ts, core/swamp-brains.ts). */
export type SwampDef = RollerDef | DasherDef | SniperDef | QueenDef | UltraDef;
/**
 * The Sima's hunter (data/sima.ts, hunter floors): it cannot be felled and it
 * keeps coming, but it walks slower than the player and far slower than a
 * roll, and its lunge winds up long and plainly. The stairs are the answer.
 */
export const ECLIPSE_HUNTER: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 0, knockbackScale: 0.2 },
  aggroRange: 5000,
  walkSpeed: 100,
  stalkRange: 120,
  lungeRange: 120,
  telegraphMs: 800,
  lungeMs: 260,
  lungeDistance: 140,
  attack: { power: 34, type: 'dark' },
  hitRecoverMs: 700,
  missRecoverMs: 1200,
  cooldownMs: 1200,
};

/** The Eclipse Echo's spell cards (data/sima.ts, every 10th Sima floor), in the order they join. */
export type EclipseCard = 'ring' | 'spiral' | 'corona' | 'lanes' | 'mirror' | 'noose';

/**
 * "Eco del Eclipse", the Sima's own boss: a corrupted shadow of Mimikyu that
 * floats at the top of an open arena and plays bullet-hell spell cards. Every
 * volley leaves a way through: rings carry a gap that turns a little each
 * wave, spirals and mirrored spirals keep wide angles between their arms,
 * lanes sweep down with a gap that never jumps further than a player can
 * walk. The corona burns the arena outside three pockets and the noose is a
 * closing ring with one gap: both ignore rolls (`pierceRoll`), position is
 * the answer. The first cards come on floor 10, one more each 10 floors (one
 * more from hard, data/sima-tricks.ts), at most all six. Enemy shots never pass `maxShots`.
 */
export interface EclipseEchoDef {
  kind: 'eclipse';
  poise: PoiseDef;
  bar: true;
  floats: true;
  aggroRange: number;
  /** It drifts to this point of the arena (shares of width and height) between cards. */
  hover: { x: number; y: number };
  driftSpeed: number;
  restMs: number;
  telegraphMs: number;
  recoverMs: number;
  cards: readonly EclipseCard[];
  cardNames: Readonly<Record<EclipseCard, string>>;
  /** Cards on its first floor; one more per further eclipse floor; `extraCards` more (0 here: data/sima-tricks.ts adds one from hard). */
  baseCards: number;
  extraCards: number;
  /** Its own cap of enemy shots in the air (under the global `ENEMY_SHOT_CAP`). */
  maxShots: number;
  shot: ShotDef;
  /** Rings of `count` with a gap of `gap` shots, turning `turn` shots each wave. */
  ring: { waves: number; count: number; gap: number; turn: number; intervalMs: number };
  /** `arms` arms turning `turnDeg` per emission. */
  spiral: { arms: number; emissions: number; intervalMs: number; turnDeg: number };
  /** Two spirals turning opposite ways. */
  mirror: { arms: number; emissions: number; intervalMs: number; turnDeg: number };
  /** Walls from the top edge, `spacing` px apart, with a gap `gapWidth` wide moving at most `maxShift` per wave. */
  lanes: { waves: number; intervalMs: number; spacing: number; gapWidth: number; maxShift: number; speed: number };
  /** The arena burns outside `pockets` safe circles (shown for `telegraphMs`); the flash lasts `flashMs`. */
  corona: { telegraphMs: number; flashMs: number; pockets: number; pocketRadius: number; ring: number; attack: EnemyAttackDef };
  /** A ring closing from `fromRadius` to `toRadius` around the arena's centre in `closeMs`, `width` thick, with a gap of `gapDegrees`. */
  noose: { telegraphMs: number; closeMs: number; fromRadius: number; toRadius: number; width: number; gapDegrees: number; attack: EnemyAttackDef };
}

export const ECLIPSE_ECHO: EclipseEchoDef = {
  kind: 'eclipse',
  poise: { hitstunScale: 0, knockbackScale: 0 },
  bar: true,
  floats: true,
  aggroRange: 900,
  hover: { x: 0.5, y: 0.36 },
  driftSpeed: 60,
  restMs: 1500,
  telegraphMs: 900,
  recoverMs: 1300,
  cards: ['ring', 'spiral', 'corona', 'lanes', 'mirror', 'noose'],
  cardNames: {
    ring: 'spell.eclipse.ring',
    spiral: 'spell.eclipse.spiral',
    corona: 'spell.eclipse.corona',
    lanes: 'spell.eclipse.lanes',
    mirror: 'spell.eclipse.mirror',
    noose: 'spell.eclipse.noose',
  },
  baseCards: 2,
  extraCards: 0,
  maxShots: 110,
  shot: { power: 16, type: 'dark', speed: 95, radius: 5, lifetimeMs: 7000 },
  ring: { waves: 4, count: 24, gap: 4, turn: 2, intervalMs: 900 },
  spiral: { arms: 3, emissions: 30, intervalMs: 120, turnDeg: 11 },
  mirror: { arms: 2, emissions: 26, intervalMs: 140, turnDeg: 13 },
  lanes: { waves: 4, intervalMs: 1100, spacing: 24, gapWidth: 84, maxShift: 100, speed: 85 },
  corona: { telegraphMs: 1500, flashMs: 300, pockets: 3, pocketRadius: 40, ring: 150, attack: { power: 30, type: 'dark', pierceRoll: true } },
  noose: { telegraphMs: 1100, closeMs: 2600, fromRadius: 380, toRadius: 50, width: 16, gapDegrees: 50, attack: { power: 26, type: 'dark', pierceRoll: true } },
};

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
  krabby: KRABBY,
  remoraid: REMORAID,
  shellos: SHELLOS,
  lanturn: LANTURN,
  dhelmise: DHELMISE,
  venipede: VENIPEDE,
  salandit: SALANDIT,
  skrelp: SKRELP,
  salazzle: SALAZZLE,
  nihilego: NIHILEGO,
  'eclipse-hunter': ECLIPSE_HUNTER,
  'eclipse-echo': ECLIPSE_ECHO,
  'sima-herald': HERALD_BASE,
};

/** i18n key of a boss's spell card (Decidueye, Sableye, Trevenant, Aegislash's phase 2), if `stance` is one. */
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
