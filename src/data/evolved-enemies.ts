import type { BeamDef, BomberDef, ConeDef, CounterDef, EnemyDef, GastlyDef, PoochyenaDef, SlammerDef } from './enemies';
import type { SpeciesId } from './species';

/*
 * Evolved forms (data/evolutions.ts, docs/gdd.md §3 "Evoluciones"): each one
 * plays its base form's state machine (core/enemies.ts, core/roster.ts) with
 * its line's tell and escalates it: a longer or wider pattern, one more move
 * (a re-aimed second strike, a ring, a hazard, a tier-gated trick played from
 * easy) and more poise. Every damaging wind-up keeps the souls contract (a
 * telegraph that shows the strike, a dodge window, a recovery to punish) and
 * the tier floors still apply (core/difficulty.ts `effectiveTelegraphMs`).
 * Literals on purpose: data/enemies.ts imports this file, so nothing here may
 * read its values at load time. Values are provisional.
 */

// Crypt of the Sword King.

/** Mightyena: Poochyena's lunge, longer, then a second re-aimed bite on every tier; it howls its pack in on hard. */
export const MIGHTYENA: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 0.7, knockbackScale: 0.7 },
  aggroRange: 620,
  walkSpeed: 80,
  stalkRange: 140,
  lungeRange: 125,
  telegraphMs: 600,
  lungeMs: 280,
  lungeDistance: 170,
  attack: { power: 46, type: 'dark' },
  hitRecoverMs: 450,
  missRecoverMs: 1150,
  cooldownMs: 1100,
  followUp: { telegraphMs: 340, lungeMs: 240, lungeDistance: 130 },
  howl: { minDifficulty: 'hard', telegraphMs: 500, range: 240 },
};

/** Haunter: Gastly's slow ball, and the second aimed ball Gastly keeps for hard on every tier; a fan of three on hard. */
export const HAUNTER: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 0.9, knockbackScale: 0.9 },
  floats: true,
  aggroRange: 700,
  speed: 60,
  minDistance: 120,
  maxDistance: 240,
  telegraphMs: 650,
  castMs: 300,
  recoverMs: 550,
  cooldownMs: 1800,
  projectile: { power: 40, type: 'poison', speed: 100, radius: 7, lifetimeMs: 4500 },
  secondBall: { minDifficulty: 'easy', delayMs: 220 },
  hardSpread: { minDifficulty: 'hard', count: 3, degrees: 32 },
};

/** Gengar: a ring of shadow balls around it (one aimed at you) and a second aimed ball part way into the cast. */
export const GENGAR: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 0.5, knockbackScale: 0.6 },
  floats: true,
  aggroRange: 720,
  speed: 50,
  minDistance: 130,
  maxDistance: 250,
  telegraphMs: 850,
  castMs: 380,
  recoverMs: 800,
  cooldownMs: 2500,
  projectile: { power: 32, type: 'poison', speed: 80, radius: 8, lifetimeMs: 5000 },
  ring: { count: 10 },
  secondBall: { minDifficulty: 'easy', delayMs: 260 },
};

/** Dusclops: Duskull's homing will-o-wisp, two at a time from both sides (three on hard); slow and hard to stagger. */
export const DUSCLOPS: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 0.6, knockbackScale: 0.5 },
  floats: true,
  aggroRange: 650,
  speed: 30,
  minDistance: 80,
  maxDistance: 200,
  telegraphMs: 900,
  castMs: 320,
  recoverMs: 800,
  cooldownMs: 2800,
  projectile: { power: 30, type: 'fire', speed: 70, radius: 9, lifetimeMs: 5400, steer: { degPerSec: 65, ms: 2400 } },
  spread: { count: 2, degrees: 50 },
  hardSpread: { minDifficulty: 'hard', count: 3, degrees: 70 },
};

/** Bisharp: Pawniard's quick cuts, all three from easy (Pawniard keeps the third for hard); it stands its ground better. */
export const BISHARP: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 0.6, knockbackScale: 0.6 },
  aggroRange: 620,
  walkSpeed: 92,
  stalkRange: 110,
  lungeRange: 100,
  telegraphMs: 520,
  lungeMs: 180,
  lungeDistance: 120,
  attack: { power: 28, type: 'steel' },
  hitRecoverMs: 500,
  missRecoverMs: 1050,
  cooldownMs: 1500,
  followUp: { telegraphMs: 300, lungeMs: 160, lungeDistance: 100 },
  thirdCut: { minDifficulty: 'easy', telegraphMs: 420, lungeMs: 190, lungeDistance: 120 },
};

// Misty Forest.

/** Breloom: Shroomish's leap, farther, and a ring of spores flies out where it lands. */
export const BRELOOM: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.6, knockbackScale: 0.6 },
  aggroRange: 540,
  walkSpeed: 54,
  slamRange: 210,
  telegraphMs: 720,
  slamMs: 150,
  radius: 40,
  attack: { power: 34, type: 'grass' },
  recoverMs: 1050,
  cooldownMs: 1800,
  leap: { distance: 220, airMs: 460, lockMs: 260 },
  ring: { count: 6, projectile: { power: 14, type: 'grass', speed: 70, radius: 6, lifetimeMs: 3000 } },
};

/** Drifblim: Drifloon's ring of will-o-wisps, ten wide and twice per cast, the second turned half a step. */
export const DRIFBLIM: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1, knockbackScale: 1.1 },
  floats: true,
  aggroRange: 620,
  speed: 38,
  minDistance: 100,
  maxDistance: 200,
  telegraphMs: 850,
  castMs: 320,
  recoverMs: 800,
  cooldownMs: 2700,
  projectile: { power: 24, type: 'fire', speed: 60, radius: 7, lifetimeMs: 5200 },
  ring: { count: 10, waves: 2, waveGapMs: 380 },
};

/** Morgrem: Impidimp's fake-out twice before the real lunge, which reaches farther and hits harder. */
export const MORGREM: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 0.9, knockbackScale: 1 },
  aggroRange: 620,
  walkSpeed: 90,
  stalkRange: 125,
  lungeRange: 125,
  telegraphMs: 560,
  lungeMs: 220,
  lungeDistance: 150,
  attack: { power: 34, type: 'dark' },
  hitRecoverMs: 500,
  missRecoverMs: 1100,
  cooldownMs: 1700,
  feint: { telegraphMs: 420, sidestepMs: 260, sidestepDistance: 80, count: 2 },
};

/** Noctowl: Hoothoot's long dive, longer still, and a second re-aimed dive on every tier (a third on hard). */
export const NOCTOWL: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 0.8, knockbackScale: 0.8 },
  floats: true,
  aggroRange: 680,
  walkSpeed: 74,
  stalkRange: 160,
  lungeRange: 160,
  telegraphMs: 750,
  lungeMs: 360,
  lungeDistance: 250,
  attack: { power: 34, type: 'flying' },
  hitRecoverMs: 500,
  missRecoverMs: 1300,
  cooldownMs: 1800,
  followUp: { telegraphMs: 400, lungeMs: 320, lungeDistance: 200 },
};

/** Ariados: Spinarak's threads, five wide, and one more thread aimed at you part way into the cast. */
export const ARIADOS: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 0.9, knockbackScale: 0.9 },
  spread: { count: 5, degrees: 56 },
  aggroRange: 640,
  speed: 52,
  minDistance: 120,
  maxDistance: 220,
  telegraphMs: 720,
  castMs: 340,
  recoverMs: 650,
  cooldownMs: 2500,
  projectile: { power: 22, type: 'bug', speed: 120, radius: 5, lifetimeMs: 2800 },
  secondBall: { minDifficulty: 'easy', delayMs: 260 },
};

// Flooded Caves.

/** Golbat: Zubat's weaving swoop, a second re-aimed swoop on every tier (Zubat's waits for hard), and it drains on a hit. */
export const GOLBAT: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1.1, knockbackScale: 1.2 },
  floats: true,
  weave: { amplitude: 0.8, periodMs: 800 },
  drainHp: 8,
  aggroRange: 620,
  walkSpeed: 98,
  stalkRange: 130,
  lungeRange: 130,
  telegraphMs: 520,
  lungeMs: 260,
  lungeDistance: 190,
  attack: { power: 28, type: 'flying' },
  hitRecoverMs: 450,
  missRecoverMs: 950,
  cooldownMs: 1250,
  followUp: { telegraphMs: 340, lungeMs: 230, lungeDistance: 150 },
};

/** Kingler: Krabby's sideways scuttle and Crabhammer, heavier, and the second pincer Krabby keeps for hard on every tier. */
export const KINGLER: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 0.6, knockbackScale: 0.6 },
  aggroRange: 580,
  walkSpeed: 74,
  stalkRange: 125,
  lungeRange: 120,
  telegraphMs: 680,
  lungeMs: 240,
  lungeDistance: 140,
  attack: { power: 42, type: 'water' },
  hitRecoverMs: 500,
  missRecoverMs: 1100,
  cooldownMs: 1500,
  scuttle: 1.6,
  followUp: { telegraphMs: 380, lungeMs: 200, lungeDistance: 110 },
};

/** Octillery: Remoraid's Octazooka down the locked lane, five shots instead of three; on hard the first one is a fan of three. */
export const OCTILLERY: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 0.8, knockbackScale: 0.9 },
  aggroRange: 660,
  speed: 55,
  minDistance: 140,
  maxDistance: 250,
  telegraphMs: 680,
  castMs: 650,
  recoverMs: 750,
  cooldownMs: 2400,
  projectile: { power: 22, type: 'water', speed: 210, radius: 6, lifetimeMs: 1900 },
  burst: { shots: 5, gapMs: 130 },
  hardSpread: { minDifficulty: 'hard', count: 3, degrees: 26 },
};

/** Crawdaunt: Corphish's jet and shell, a wider guard, and the jet again after a short re-aim on every tier. */
export const CRAWDAUNT: BeamDef = {
  kind: 'beam',
  poise: { hitstunScale: 0.45, knockbackScale: 0.4 },
  aggroRange: 560,
  walkSpeed: 58,
  minDistance: 90,
  maxDistance: 180,
  turnRateDegPerSec: 150,
  telegraphMs: 720,
  lockMs: 260,
  beamMs: 260,
  length: 210,
  width: 20,
  attack: { power: 34, type: 'water' },
  recoverMs: 1050,
  cooldownMs: 1900,
  guard: { arcDegrees: 140, chipFactor: 0.15 },
  repeat: { minDifficulty: 'easy', telegraphMs: 460, times: 1 },
};

// Toxic Swamp.

/** Arbok: Ekans' coiled lunge, longer, its poison puddle on every tier (Ekans waits for hard), and a second strike on hard. */
export const ARBOK: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 0.7, knockbackScale: 0.7 },
  lockMs: 300,
  aggroRange: 580,
  walkSpeed: 64,
  stalkRange: 165,
  lungeRange: 165,
  telegraphMs: 820,
  lungeMs: 280,
  lungeDistance: 230,
  attack: { power: 40, type: 'poison' },
  hitRecoverMs: 500,
  missRecoverMs: 1300,
  cooldownMs: 1700,
  landingHazard: { minDifficulty: 'easy', hazard: { power: 16, type: 'poison', radius: 26, lifetimeMs: 3200 } },
  followUp: { telegraphMs: 420, lungeMs: 260, lungeDistance: 180 },
  followUpFrom: 'hard',
};

/** Skuntank: Stunky's turned-away spray, wider and longer, a bigger cloud, and the tail tracks you slowly from normal on. */
export const SKUNTANK: ConeDef = {
  kind: 'cone',
  poise: { hitstunScale: 0.9, knockbackScale: 0.9 },
  turnsAway: true,
  aggroRange: 560,
  walkSpeed: 76,
  engageRange: 85,
  telegraphMs: 600,
  breathMs: 380,
  reach: 95,
  arcDegrees: 80,
  attack: { power: 24, type: 'poison' },
  recoverMs: 850,
  cooldownMs: 1800,
  linger: { power: 16, type: 'poison', radius: 30, lifetimeMs: 3000 },
  sweep: { minDifficulty: 'normal', degPerSec: 40 },
};

/** Weezing: Koffing's gas, bigger clouds from farther, and a wider blast behind a longer fuse. */
export const WEEZING: BomberDef = {
  kind: 'bomber',
  poise: { hitstunScale: 0.5, knockbackScale: 0.6 },
  floats: true,
  aggroRange: 560,
  speed: 36,
  keepDistance: 60,
  puffRange: 95,
  telegraphMs: 650,
  cloud: { power: 24, type: 'poison', radius: 44, lifetimeMs: 3400 },
  recoverMs: 850,
  cooldownMs: 2200,
  explode: { belowHp: 0.35, telegraphMs: 1700, blastMs: 160, radius: 120, attack: { power: 60, type: 'poison' } },
};

/** Muk: Grimer's slam and sludge trail, wider, and a pool of sludge left where it slams. */
export const MUK: SlammerDef = {
  kind: 'slammer',
  poise: { hitstunScale: 0.3, knockbackScale: 0.2 },
  aggroRange: 500,
  walkSpeed: 30,
  slamRange: 65,
  telegraphMs: 950,
  slamMs: 180,
  radius: 66,
  attack: { power: 36, type: 'poison' },
  recoverMs: 1400,
  cooldownMs: 1600,
  trail: { everyMs: 400, puddle: { power: 12, type: 'poison', radius: 18, lifetimeMs: 4500 } },
  puddle: { power: 16, type: 'poison', radius: 34, lifetimeMs: 3500 },
};

/** Toxicroak: Croagunk's counter stance, a harder counter, and the Poison Jab chained once on every tier (Croagunk waits for hard). */
export const TOXICROAK: CounterDef = {
  kind: 'counter',
  poise: { hitstunScale: 0.6, knockbackScale: 0.5 },
  aggroRange: 560,
  walkSpeed: 74,
  engageRange: 85,
  stanceMs: 1100,
  counter: { telegraphMs: 320, lungeMs: 180, lungeDistance: 100, attack: { power: 50, type: 'fighting' } },
  jab: { telegraphMs: 450, lungeMs: 220, lungeDistance: 95, attack: { power: 34, type: 'poison' } },
  recoverMs: 1100,
  cooldownMs: 1500,
  repeat: { minDifficulty: 'easy', telegraphMs: 380, times: 1 },
};

// The Sima's own.

/** Houndoom: Houndour's flamethrower, longer, turning after you on every tier (Houndour waits for hard), and it leaves embers. */
export const HOUNDOOM: ConeDef = {
  kind: 'cone',
  poise: { hitstunScale: 0.7, knockbackScale: 0.7 },
  aggroRange: 620,
  walkSpeed: 86,
  engageRange: 110,
  telegraphMs: 650,
  breathMs: 600,
  reach: 130,
  arcDegrees: 55,
  attack: { power: 32, type: 'fire' },
  recoverMs: 950,
  cooldownMs: 1700,
  sweep: { minDifficulty: 'easy', degPerSec: 55 },
  linger: { power: 14, type: 'fire', radius: 24, lifetimeMs: 2500 },
};

/** Every evolution's behaviour (merged into data/enemies.ts `ENEMY_BEHAVIOUR`). */
export const EVOLVED_BEHAVIOUR: Partial<Record<SpeciesId, EnemyDef>> = {
  mightyena: MIGHTYENA,
  haunter: HAUNTER,
  gengar: GENGAR,
  dusclops: DUSCLOPS,
  bisharp: BISHARP,
  breloom: BRELOOM,
  drifblim: DRIFBLIM,
  morgrem: MORGREM,
  noctowl: NOCTOWL,
  ariados: ARIADOS,
  golbat: GOLBAT,
  kingler: KINGLER,
  octillery: OCTILLERY,
  crawdaunt: CRAWDAUNT,
  arbok: ARBOK,
  skuntank: SKUNTANK,
  weezing: WEEZING,
  muk: MUK,
  toxicroak: TOXICROAK,
  houndoom: HOUNDOOM,
};
