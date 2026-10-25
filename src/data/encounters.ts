import type { Difficulty } from './difficulty';
import type { SpeciesId } from './species';

/**
 * Encounters with a meaning (docs/gdd.md §3 "Encuentros con sentido",
 * docs/souls-difficulty-research.md P1-P3; user decision 2026-10-25: fewer
 * enemies, but ones that matter). Every floor enemy plays a role; a room
 * spends a threat budget on roles instead of drawing a raw count, so a
 * typical room is one to three enemies forming a readable combo (a brute in
 * front of a gunner, a controller with a skirmisher) and some rooms are
 * empty. Values are provisional (to be measured by the balance harness).
 */

/**
 * - `brute`: slow melee, hits hard, soaks.
 * - `skirmisher`: fast, darts in and out.
 * - `ranged`: shoots from afar, punishes standing still.
 * - `swarm`: weak, comes in numbers (`pack`).
 * - `controller`: denies space (spores, gas, pulses, sludge).
 * - `support`: makes the others better (kill it first). No species of the
 *   roster plays it today; a group's leader (its rally cry) fills it.
 */
export type EnemyRole = 'brute' | 'skirmisher' | 'ranged' | 'swarm' | 'controller' | 'support';

export const ENEMY_ROLES: readonly EnemyRole[] = ['brute', 'skirmisher', 'ranged', 'swarm', 'controller', 'support'];

/** Threat cost of one enemy of each role (a pack pays per unit). */
export const ROLE_COST: Readonly<Record<EnemyRole, number>> = {
  brute: 3,
  skirmisher: 2,
  ranged: 3,
  swarm: 1,
  controller: 4,
  support: 4,
};

/**
 * Where a role stands in its room: the front line takes the tiles nearest
 * the way in (walking distance from the floor's start), the back line the
 * farthest ones, so a gunner waits behind its brute instead of at the door.
 */
export const ROLE_LINE: Readonly<Record<EnemyRole, 'front' | 'back'>> = {
  brute: 'front',
  skirmisher: 'front',
  swarm: 'front',
  ranged: 'back',
  controller: 'back',
  support: 'back',
};

/** The role of every species that spawns on generated floors and in events (guardians, mid-bosses and players have none). */
export const SPECIES_ROLE: Readonly<Partial<Record<SpeciesId, EnemyRole>>> = {
  // Crypt
  poochyena: 'skirmisher',
  gastly: 'ranged',
  duskull: 'ranged',
  pawniard: 'skirmisher',
  golett: 'brute',
  // Misty Forest
  'pumpkaboo-small': 'swarm',
  'pumpkaboo-super': 'brute',
  phantump: 'skirmisher',
  spinarak: 'ranged',
  foongus: 'controller',
  hoothoot: 'skirmisher',
  shroomish: 'brute',
  drifloon: 'ranged',
  impidimp: 'skirmisher',
  // Flooded Caves
  krabby: 'brute',
  zubat: 'swarm',
  remoraid: 'ranged',
  tentacool: 'brute',
  shellos: 'ranged',
  corphish: 'ranged',
  chinchou: 'controller',
  wooper: 'brute',
  clauncher: 'ranged',
  // Toxic Swamp
  venipede: 'swarm',
  stunky: 'swarm',
  ekans: 'skirmisher',
  skrelp: 'ranged',
  salandit: 'skirmisher',
  koffing: 'controller',
  grimer: 'controller',
  croagunk: 'brute',
  // The Sima's own roster
  litleo: 'ranged',
  houndour: 'controller',
  slugma: 'ranged',
  // Evolved forms (data/evolutions.ts): their line's role, except the swarm's evolutions, which fight alone.
  mightyena: 'skirmisher',
  haunter: 'ranged',
  gengar: 'ranged',
  dusclops: 'ranged',
  bisharp: 'skirmisher',
  breloom: 'brute',
  drifblim: 'ranged',
  morgrem: 'skirmisher',
  noctowl: 'skirmisher',
  ariados: 'ranged',
  golbat: 'skirmisher',
  kingler: 'brute',
  octillery: 'ranged',
  crawdaunt: 'ranged',
  arbok: 'skirmisher',
  skuntank: 'brute',
  weezing: 'controller',
  muk: 'controller',
  toxicroak: 'brute',
  houndoom: 'controller',
};

/**
 * Threat of a species when its role's cost does not tell it: an evolution
 * costs its role's plus one, so a deep room buys fewer, tougher bodies (it
 * replaces basics in the budget instead of joining them), and as the
 * highest threat of its room it is the one crowned when its group gets a
 * leader (core/leaders.ts). Kept at most 5 so the Sima's small budgets can
 * still afford one on the floors it joins.
 */
export const SPECIES_THREAT: Readonly<Partial<Record<SpeciesId, number>>> = {
  mightyena: 3,
  haunter: 4,
  gengar: 4,
  dusclops: 4,
  bisharp: 3,
  breloom: 4,
  drifblim: 4,
  morgrem: 3,
  noctowl: 3,
  ariados: 4,
  golbat: 3,
  kingler: 4,
  octillery: 4,
  crawdaunt: 4,
  arbok: 3,
  skuntank: 4,
  weezing: 5,
  muk: 5,
  toxicroak: 4,
  houndoom: 5,
};

/** The role of a species (a species without one counts as a skirmisher: cheap, never blocks a room). */
export const roleOf = (species: SpeciesId): EnemyRole => SPECIES_ROLE[species] ?? 'skirmisher';

/** Threat cost of one enemy of a species. */
export const threatOf = (species: SpeciesId): number => SPECIES_THREAT[species] ?? ROLE_COST[roleOf(species)];

/**
 * A dungeon's per-room threat budget (data/dungeon.ts `SpawnTuning.budget`):
 * `base` on floor 1, plus `perDepth` per deeper floor, plus up to `jitter`
 * (a whole number drawn per room). The room buys roles from the pool until
 * nothing affordable fits; it never holds more than `maxEnemies` nor more
 * than the tier's roles (`ROLES_PER_ROOM`). `rest` is the chance by floor
 * (index 0 is floor 1, deeper floors use the last entry) that a room other
 * than the start is left empty: a breather.
 */
export interface EncounterBudget {
  base: number;
  perDepth: number;
  jitter: number;
  maxEnemies: number;
  rest: readonly number[];
  /** A role already in the room weighs this share when the next one is bought (variety makes the combo). */
  repeatWeight: number;
  /** Roles per room (set from the run's tier by core/difficulty.ts `tieredSpawns`; `ROLES_PER_ROOM.easy` when absent). */
  maxRoles?: number;
  /** Groups that follow a leader, by depth (absent: none). */
  leaders?: LeaderChance;
}

/** Roles one room may mix, by tier (research P2: two up to Normal, three from Hard). */
export const ROLES_PER_ROOM: Readonly<Record<Difficulty, number>> = { easy: 2, normal: 2, hard: 3, nightmare: 3 };

/**
 * Experience per defeat, by role, on top of the species' own
 * (data/progression.ts): with about 40 % fewer enemies, each one pays more so
 * a player who kills what is there earns about as much per floor as before.
 * Guardians, mid-bosses and echoes have no role and pay as they always did.
 * Tuned with the leaders' bonus (`LEADER.xp`) against the pre-change average
 * per dungeon (tests/core/encounters.test.ts).
 */
export const ROLE_XP_SCALE: Readonly<Record<EnemyRole, number>> = {
  brute: 1.2,
  skirmisher: 1.45,
  ranged: 1.3,
  swarm: 1.85,
  controller: 1.25,
  support: 1.25,
};

/** Experience scale of a defeated species: its role's, or 1 for guardians and anything without a role. */
export const xpScaleOf = (species: SpeciesId): number => {
  const role = SPECIES_ROLE[species];
  return role ? ROLE_XP_SCALE[role] : 1;
};

// Leaders (docs/gdd.md §3 "Encuentros con sentido"): some groups follow one.

/**
 * What a group does when its leader falls, one readable rule per role:
 * - `stagger`: it reels (hitstun) for a moment: a free opening.
 * - `slow`: it loses heart: its whole clock runs slower for a while.
 * - `unbuff`: it only loses the leader's pace (the controllers keep their ground).
 */
export type BreakRule = 'stagger' | 'slow' | 'unbuff';

export const BREAK_RULE: Readonly<Record<EnemyRole, BreakRule>> = {
  brute: 'stagger',
  skirmisher: 'slow',
  ranged: 'slow',
  swarm: 'stagger',
  controller: 'unbuff',
  support: 'stagger',
};

/** Chance that a group (a room with two or more enemies) follows a leader: `start` from `fromFloor`, + `perFloor`, at most `max`. */
export interface LeaderChance {
  fromFloor: number;
  start: number;
  perFloor: number;
  max: number;
}

export const LEADER = {
  /** A leader spawns with this much more HP. */
  hp: 1.6,
  /** A leader pays this many times its own experience (the bonus for felling it). */
  xp: 2,
  /** Followers keep the leader's pace while it stands: their clock runs this much faster. */
  inspiredPace: 1.1,
  /**
   * The leader's signature move, the rally cry (Grito de mando): awake and
   * with a follower left, it winds up for `telegraphMs` (its aura swells),
   * then every follower within `radius` heals `heal` of its max HP and may
   * attack again at once. First cry `firstMs` after waking, then every `everyMs`.
   */
  rally: { firstMs: 2500, everyMs: 7500, telegraphMs: 900, radius: 192, heal: 0.15 },
  /** The break: how long a stagger and a slow last, and how slow. */
  break: { staggerMs: 1500, slowMs: 6000, slowPace: 0.6 },
} as const;

// Mandatory kills (docs/gdd.md §3 "Encuentros con sentido"): sometimes, not always.

/**
 * A floor's gate (at most one, never on floor 1, never on an urgent floor
 * where the clock or the hazard already pushes):
 * - `seal`: Sello de la escalera, the stairs stay sealed until the floor's
 *   marked enemy (a leader or an elite, shown on the minimap) falls.
 * - `key`: the stairs room's doorways are locked; an elite carries the key,
 *   which it drops when it falls (walk over it).
 * - `waves`: the Sima's wave room (data/sima.ts) must be cleared first.
 */
export type GateKind = 'seal' | 'key' | 'waves';

export const GATE_KINDS: readonly GateKind[] = ['seal', 'key', 'waves'];

/** A dungeon's gates: the chance by floor (index 0 is floor 1, deeper floors use the last entry) and each kind's weight by floor. */
export interface GateTuning {
  chance: readonly number[];
  kinds: readonly { kind: GateKind; weights: readonly number[] }[];
}

export const GATE = {
  /** A gate enemy (or its dropped key) out of every player's reach this long in a row breaks the gate, without its reward. */
  unreachableMs: 60_000,
  /** The marked enemy pays this many times its experience (on top of a leader's bonus) when its gate opens by its fall. */
  xp: 1.5,
  /** A player this close to the dropped key takes it (px). */
  keyTouch: 28,
} as const;
