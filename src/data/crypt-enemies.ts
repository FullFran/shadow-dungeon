import type { EnemyAttackDef, GastlyDef, PoiseDef } from './enemies';

/*
 * The Crypt's second wave of enemies (odd/tasks/enemy-variety-crypt.md,
 * docs/research/enemy-variety.md §4.2): three new behaviour archetypes
 * (boomerang, support, mimic) plus a light thief and an alarm. Same souls
 * contract as the rest: every attack or effect has a wind-up that shows it
 * and an opening after it. Values are provisional.
 */

/**
 * A boomerang (Honedge, a loose blade of the king's guard): it winds up
 * facing the player (the aim locks for the last part), spins out down the
 * lane and flies back to where it started. Both passes hit: dodge twice, the
 * second from behind. It hangs still for a while after (the opening).
 */
export interface BoomerangDef {
  kind: 'boomerang';
  poise: PoiseDef;
  floats?: true;
  aggroRange: number;
  walkSpeed: number;
  /** Starts the wind-up when the player is this close, in sight, and the cooldown is over. */
  engageRange: number;
  telegraphMs: number;
  /** The lane stops following the player this long before the throw. */
  lockMs: number;
  /** How far out the spin carries it. */
  reach: number;
  /** Time out and time back. */
  outMs: number;
  backMs: number;
  attack: EnemyAttackDef;
  recoverMs: number;
  cooldownMs: number;
}

/**
 * A support (Bronzor): it keeps its distance near its allies and rings
 * itself (a long, glowing channel); when the ring completes every awake ally
 * within `radius` gains one-hit armor (the next hit is shrugged off, as an
 * armored elite's). Any hit during the channel cancels it: kill it first.
 */
export interface SupportDef {
  kind: 'support';
  poise: PoiseDef;
  floats?: true;
  aggroRange: number;
  walkSpeed: number;
  /** Distance band it keeps to the player. */
  minDistance: number;
  maxDistance: number;
  channelMs: number;
  /** Allies within this distance of it are warded. */
  radius: number;
  recoverMs: number;
  cooldownMs: number;
}

/**
 * An alarm (Klefki): it keeps away from the player and jingles its keys (a
 * long channel with a ring); if the jingle completes, every sleeping enemy
 * within `wakeRadius` wakes and comes. A hit cancels it. On a key gate it is
 * the key's bearer whenever it is on the floor (core/gates.ts).
 */
export interface AlarmDef {
  kind: 'alarm';
  poise: PoiseDef;
  floats?: true;
  aggroRange: number;
  walkSpeed: number;
  minDistance: number;
  maxDistance: number;
  jingleMs: number;
  wakeRadius: number;
  recoverMs: number;
  cooldownMs: number;
  /** Carries the floor's key on a key gate. */
  keyBearer: true;
}

/**
 * A light thief (Murkrow): it circles, winds up a dive (the lane locks), and
 * a dive that hurts takes the player's last held item (core/stolen.ts, the
 * same borrowing as Sableye's: hitting it, felling it or waiting gets it
 * back). After a theft it flies off to the far side for `fleeMs`.
 */
export interface DiverDef {
  kind: 'diver';
  poise: PoiseDef;
  floats?: true;
  aggroRange: number;
  walkSpeed: number;
  circleRange: number;
  engageRange: number;
  telegraphMs: number;
  lockMs: number;
  diveMs: number;
  diveDistance: number;
  attack: EnemyAttackDef;
  /** How long a stolen item stays away at most. */
  stealMs: number;
  fleeMs: number;
  fleeSpeed: number;
  recoverMs: number;
  cooldownMs: number;
}

/**
 * A mimic's disguise (any behaviour may carry one, Yamask's caster does):
 * asleep it is drawn as a prop of the room's decor and it only wakes when a
 * player comes within `wakeRadius` (or hits it, or an alarm calls), never on
 * entering its room; it then takes `wakeMs` to rise (a short wind-up) before
 * it acts.
 */
export interface DisguiseDef {
  wakeRadius: number;
  wakeMs: number;
}

/**
 * A curse carried by a shot (Yamask's): the player it hurts recharges stamina
 * (the roll's fuel) at `regen` of the normal rate for `ms`. Each victim
 * applies it to itself (core/combat.ts), so only the shot's flag travels.
 */
export interface CurseDef {
  ms: number;
  regen: number;
}

/** The one curse of the game so far: its rate is fixed, only its length travels on the wire. */
export const CURSE_REGEN = 0.45;

/** The new behaviours of this batch (core/crypt-brains.ts). */
export type CryptDef = BoomerangDef | SupportDef | AlarmDef | DiverDef;

export const HONEDGE: BoomerangDef = {
  kind: 'boomerang',
  poise: { hitstunScale: 1, knockbackScale: 0.8 },
  floats: true,
  aggroRange: 620,
  walkSpeed: 62,
  engageRange: 200,
  telegraphMs: 650,
  lockMs: 220,
  reach: 190,
  outMs: 420,
  backMs: 520,
  attack: { power: 38, type: 'steel' },
  recoverMs: 1000,
  cooldownMs: 1500,
};

export const BRONZOR: SupportDef = {
  kind: 'support',
  poise: { hitstunScale: 1, knockbackScale: 0.6 },
  floats: true,
  aggroRange: 650,
  walkSpeed: 45,
  minDistance: 150,
  maxDistance: 270,
  channelMs: 1300,
  radius: 170,
  recoverMs: 700,
  cooldownMs: 4500,
};

export const KLEFKI: AlarmDef = {
  kind: 'alarm',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  floats: true,
  aggroRange: 600,
  walkSpeed: 58,
  minDistance: 170,
  maxDistance: 300,
  jingleMs: 2200,
  wakeRadius: 520,
  recoverMs: 900,
  cooldownMs: 6000,
  keyBearer: true,
};

export const MURKROW: DiverDef = {
  kind: 'diver',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  floats: true,
  aggroRange: 650,
  walkSpeed: 82,
  circleRange: 160,
  engageRange: 230,
  telegraphMs: 600,
  lockMs: 180,
  diveMs: 300,
  diveDistance: 220,
  attack: { power: 36, type: 'dark' },
  stealMs: 9000,
  fleeMs: 1400,
  fleeSpeed: 140,
  recoverMs: 900,
  cooldownMs: 2300,
};

/** Yamask: a grave mask among the decor; awake, a caster whose slow ball curses the roll's recharge. */
export const YAMASK: GastlyDef & { disguise: DisguiseDef } = {
  kind: 'caster',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 650,
  speed: 48,
  minDistance: 130,
  maxDistance: 240,
  telegraphMs: 700,
  castMs: 260,
  recoverMs: 600,
  cooldownMs: 2200,
  projectile: { power: 34, type: 'ghost', speed: 82, radius: 8, lifetimeMs: 4200, curse: { ms: 3500, regen: CURSE_REGEN } },
  disguise: { wakeRadius: 72, wakeMs: 450 },
};
