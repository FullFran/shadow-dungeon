import type { Difficulty, EliteTrait } from '../data/difficulty';
import type { BreakRule, GateKind } from '../data/encounters';
import type { AegislashCard, ArcherCard, DanmakuCard, EclipseCard, SteerDef, ThiefCard, TreantCard } from '../data/enemies';
import type { CardId, CardOutcome, HeraldCardId, SpellCardId } from '../data/cards';
import type { UpgradeLevels } from '../data/upgrades';
import type { QueenCard, UltraCard } from '../data/swamp-enemies';
import type { ItemId } from '../data/items';
import type { DotKind, MoveBonus, MoveId, ZoneDef } from '../data/moves';
import type { PassiveId, SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';
import type { CollapseState } from './collapse';
import type { FogState } from './fog';
import type { FloodState } from './flood';
import type { GasState } from './gas';
import type { PoisonState, ToxicPool } from './toxic';
import type { EnemyScale } from './endless';
import type { SimaEventState, SimaPactState } from './sima-events';
import type { GateOutcome, GateState } from './gates';
import type { ReviveState } from './revive';
import type { FogWall } from './fog-wall';
import type { TileRect } from './dungeon';
import type { FlowField } from './flow';
import type { TileGrid } from './tiles';
import type { Vec2 } from './vec';

/** One tick of player intent, produced by the input adapter. */
export interface PlayerInput {
  /** Raw WASD vector; components in [-1, 1], not necessarily normalized. */
  move: Vec2;
  /** Cursor position in world coordinates. */
  aim: Vec2;
  /**
   * The aim is a live pointer (a mouse cursor the player moved), not a
   * stand-in point (touch aims ahead along the facing). A roll with no
   * direction held then goes at it when nothing is locked. Absent = false.
   */
  aimPointer?: boolean;
  /** Edge: roll pressed this tick. */
  roll: boolean;
  /** Level: whether each move slot's button is held, aligned with the loadout. Edges are derived in the core. */
  slots: readonly boolean[];
  /**
   * Level, aligned with `slots`: the slot's mouse button (LMB fast, RMB heavy) is held.
   * Without a lock, a mouse-triggered move aims at the cursor and a key-triggered one (Q/E)
   * along the facing; with both held the mouse wins.
   */
  slotMouse: readonly boolean[];
  /** Level: lock-on input (Shift or middle mouse) held. With `toggle` each press edge locks or releases; with `hold` the level is the lock. */
  lock: boolean;
  /** Level: fast-slot mouse button (left click) held. Its press edge drives click-to-lock; Q does not set it. */
  click: boolean;
  /** Wheel deltaY accumulated since the last tick, DOM convention: negative = wheel up. */
  wheel: number;
  /** Visible world rectangle (camera view); lock-on only considers enemies inside it. */
  view: Rect;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A solid block of a fixed room; `cover` ones also stop every projectile (the Aegislash arena's pillars). */
export interface Obstacle extends Rect {
  cover?: boolean;
}

/**
 * How the lock input works (docs/gdd.md §4 "Apuntar y fijar"):
 * `toggle` each press of Shift / middle mouse locks or releases; `hold` locked
 * only while held; `clickOnly` Shift / middle do nothing and a left click locks
 * an enemy or, on the ground, releases; `off` never locks.
 */
export type LockType = 'toggle' | 'hold' | 'clickOnly' | 'off';

export const LOCK_TYPES: readonly LockType[] = ['toggle', 'hold', 'clickOnly', 'off'];

export interface LockState {
  /** Setting: how the lock input works. */
  lockType: LockType;
  /** Setting: a left click on an enemy locks onto it (acquire or switch). Implied by `clickOnly`, ignored by `off`. */
  clickToLock: boolean;
  targetId: string | null;
  /** Wheel delta accumulated towards the switch threshold (touchpad-friendly). */
  wheelAccum: number;
  /** Lock key state on the previous tick, to detect press edges. */
  keyHeld: boolean;
  /** Left click state on the previous tick, to detect press edges. */
  clickHeld: boolean;
}

export interface RollState {
  elapsedMs: number;
  /** Unit direction committed when the roll started. */
  dir: Vec2;
  /**
   * A neutral roll (no direction held at its start): where it started. While
   * present (the first `TUNING.roll.redirectMs`), a direction pressed
   * redirects the whole roll from here; then it is dropped.
   */
  from?: Vec2;
}

export interface DamageBuff {
  multiplier: number;
  remainingMs: number;
}

export type ActionPhase = 'charging' | 'windup' | 'active' | 'recovery';

/** A move in progress. */
export interface ActionState {
  slotIndex: number;
  moveId: MoveId;
  phase: ActionPhase;
  /** Time spent in the current phase. */
  phaseMs: number;
  /** Time spent charging (heavy moves). */
  chargeMs: number;
  chargeLevel: number;
  /** Unit aim direction, committed when the wind-up starts. */
  aimDir: Vec2;
  /** Fixed by the press that started the move: without a lock, aim at the cursor (mouse) or along the facing (key). */
  mouseAim: boolean;
  /** Entities already hit by this use of the move (one hit per target per swing). */
  hitIds: readonly string[];
  /** World tick the move started on: names the swing in hit claims (one claim per enemy per swing). */
  startTick?: number;
  /** Multi-hit moves: part of the active window being played (each part may hit a target again). */
  hitWindow?: number;
  /** Some target was struck by this use (melee moves; feeds `lastMoveMissed`). */
  landed?: boolean;
  /** Passive damage multiplier taken when the move started (Flash Fire on a heavy move). */
  boost?: number;
}

export interface PlayerState {
  species: SpeciesId;
  /** Wears its line's shiny skin (core/shiny.ts): cosmetic only, never read by the simulation. */
  shiny?: boolean;
  types: readonly PokemonType[];
  pos: Vec2;
  /** Unit vector of the last movement direction; a roll with no direction, no lock and no live cursor goes this way. */
  facing: Vec2;
  hp: number;
  maxHp: number;
  stamina: number;
  /** Time left before stamina starts regenerating. */
  staminaRegenDelayMs: number;
  roll: RollState | null;
  /** Granted by a perfect dodge; consumed by the next damaging player hit. */
  nextHitBuff: DamageBuff | null;
  /** Equipped moves aligned with the slot layout (null = empty slot). */
  loadout: readonly (MoveId | null)[];
  /** Slot buttons held on the previous tick, to detect press/release edges. */
  slotsHeld: readonly boolean[];
  action: ActionState | null;
  /** Disguise passive: true once the free hit of this room has been used. */
  disguiseBroken: boolean;
  /** Illusion passive: true once the disguise of this room is gone (Zorua hit something or was hurt). */
  illusionBroken: boolean;
  /** Flash Fire passive: a Fire hit was absorbed and the next heavy move is powered up. */
  flashFire: boolean;
  /** Flash Fire: own Fire hits landed towards the next stoke (`TUNING.passives.flashFireKindle`); absent = 0. */
  kindling?: number;
  /** The last finished melee move struck nothing (Stomping Tantrum). */
  lastMoveMissed: boolean;
  /** In-run level (progression.ts), 1 at the run start. */
  level: number;
  /** Total experience gained this run. */
  xp: number;
  /** Held items, one entry per stack, in pick order (items.ts). */
  items: readonly ItemId[];
  /** Per-floor item triggers used so far (Sitrus Berry, Focus Sash); reset on every floor. */
  itemUses: Readonly<Partial<Record<ItemId, number>>>;
  /** Permanent upgrade levels bought at the shop (upgrades.ts), fixed for the run; absent = none. */
  upgrades?: UpgradeLevels;
  /** Harder tiers' roll (data/difficulty.ts `TierDef.roll`): when the i-frames end and the stamina cost share; absent = the tuning's. */
  rollTier?: { iframesEndMs: number; staminaCost: number };
  /** A held item Sableye took (stolen.ts): out of `items` until it comes back. */
  stolen?: StolenItem;
  /** Poisoned by a Toxic Swamp pool (toxic.ts); absent = not poisoned. */
  poison?: PoisonState;
  /** Boost and area moves on cooldown: ms left per move (core/boosts.ts); absent = none running. */
  cooldowns?: Readonly<Partial<Record<MoveId, number>>>;
  /** The boost move's buff running now (core/boosts.ts); absent = none. */
  buff?: ActiveBuff;
  /** Mejoras bought at the move tutor (core/tutor.ts): rank per original move, fixed for the run; absent = none. */
  moveRanks?: Readonly<Partial<Record<MoveId, number>>>;
  /** An evolved gacha form's damage multiplier (core/evolution.ts `stageBonus`), fixed for the run; absent = 1. */
  stageDamage?: number;
  /**
   * Super-armor from a ranked move (core/rank-effects.ts): damage taken scaled by `damageTaken` while `remainingMs` runs, then
   * `restMs` before another can start (at most half the time under it); absent = none.
   */
  ward?: { damageTaken: number; remainingMs: number; restMs: number };
  /** Drain (core/afflictions.ts): HP drained from its per-second budget, refilling over time; absent = the budget is full. */
  drained?: number;
  /** Shell Bell (items.ts): HP its heal has drawn from its per-second budget, refilling over time; absent = the budget is full. */
  shellBell?: number;
}

/** A running boost buff: its move (whose `MoveDef.buff` says what it does), time left and, for `power`, hits left. */
export interface ActiveBuff {
  moveId: MoveId;
  remainingMs: number;
  hitsLeft?: number;
}

export interface StolenItem {
  item: ItemId;
  /** The thief: hitting it gives the item back. */
  enemyId: string;
  /** Back by itself once this runs out. */
  remainingMs: number;
}

export interface EnemyState {
  id: string;
  species: SpeciesId;
  types: readonly PokemonType[];
  pos: Vec2;
  facing: Vec2;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  /** A burn or poison left by a tutor move (core/afflictions.ts); absent = none. */
  dot?: EnemyDot;
  /** A rank effect's mark, bursting later (core/rank-effects.ts); absent = none. */
  mark?: EnemyMark;
  /** A rank effect's weakening: the enemy's hits deal less (core/rank-effects.ts); absent = none. */
  weakened?: EnemyWeaken;
  /** While > 0 the enemy is staggered and cannot act. */
  hitstunMs: number;
  /** Knockback displacement still to be applied. */
  knockback: Vec2;
  /** Behaviour state machine (enemies.ts). */
  ai: AiState;
  /** Boss-only state (boss.ts). */
  boss?: BossState;
  /** Room of a sleeping floor enemy: the player entering it wakes the enemy. */
  wakeRoom?: Rect;
  /** Fell by its own hand (Koffing's blast): no experience, no Pokémonedas. */
  spent?: boolean;
  /** An elite (drawn tinted) and its one extra trait (data/difficulty.ts `ELITE_TRAIT_DEFS`: the tiers' and the Sima's); drawn from the floor seed on every peer, and sent with the host snapshot. */
  elite?: EliteTrait;
  /** Armored elite: the next hit is shrugged off (then it is gone). */
  armor?: true;
  /** Deep Sima elite: its attacks ignore roll i-frames (positional, docs/gdd.md §9). */
  pierceRoll?: true;
  /**
   * Co-op boss aggro (core/aggro.ts; host only, absent solo): who it is
   * looking at, for how long (enemy time), whether it has attacked them yet,
   * and the damage `by` another player dealt it meanwhile.
   */
  aggro?: { targetId: string; heldMs: number; pressure: number; by?: string; swung?: true };
  /** Host only (core/bounds.ts): how long a wave enemy has been outside its sealed room. */
  strayMs?: number;
  /** Host only (core/bounds.ts): it was just brought back into its room (the renderer draws a poof while > 0). */
  warpMs?: number;
  /**
   * A group's leader (core/leaders.ts, data/encounters.ts `LEADER`): crowned,
   * tougher, pays bonus experience; `rallyMs` until its next rally cry,
   * `rallying` the ms into the cry's wind-up while it calls. Seeded on every peer.
   */
  leader?: { rallyMs: number; rallying?: number };
  /** A follower: the id of the leader it follows while that one stands (it keeps its pace). */
  band?: string;
  /** A follower whose leader fell: its role's break rule and the ms it still lasts. */
  broken?: { rule: BreakRule; ms: number };
  /** A Herald of the Eclipse (core/herald): the seed and depth its whole def is regenerated from on every peer (with the run's tier). */
  herald?: { seed: number; depth: number };
}

/** A herald's spell card in play: `herald<i>`, and `herald<i>x` for its phase-2 version (data/herald.ts, data/cards.ts). */
export type HeraldStance = HeraldCardId;

/** Aegislash's two stances, its unsheathing and phase-2 cards, or the spell card Decidueye or Sableye is playing. */
export type BossStance = 'shield' | 'blade' | 'unsheathe' | AegislashCard | ArcherCard | ThiefCard | TreantCard | DanmakuCard | QueenCard | UltraCard | EclipseCard | 'slam' | SpellCardId | HeraldStance;

export interface BossState {
  stance: BossStance;
  /** Time spent in the current stance (enemy time scale). */
  stanceMs: number;
  /** Damage taken since the current stance began. */
  stanceDamage: number;
  /** Blow of the Blade combo in progress (0-based); Decidueye: shot or fan of the current card. */
  comboIndex: number;
  /** Combos finished in the current Blade stance; Decidueye: cards played so far. */
  combosDone: number;
  /** Aegislash: 2 once "El Rey desenvaina" has started (host only; never goes back). */
  phase?: 2;
  /** Aegislash: phase-2 spell cards played so far (host only). */
  cardsPlayed?: number;
  /** Spell-card fight (core/cards.ts): index of the card in play or being declared (host only). */
  card?: number;
  /** Spell-card fight: time spent in the current card, declaration excluded (host only). */
  cardMs?: number;
  /**
   * Hosted spell-card fight (data/cards.ts `moves`): the card in play while
   * `stance` names the boss's own move (synced: guests read the card from it).
   */
  spell?: SpellCardId;
  /** Hosted card fight: the rest its own engine had set when its "tu turno" began, given back when the turn ends (host only). */
  restMs?: number;
  /** Spell-card fight: the HP the current card's segment ends at; hits never take the boss below it while the card plays (host only). */
  hpFloor?: number;
  /**
   * Spell-card fight: the card floor's hold (core/cards.ts `holdFloor`), `HOLD_HP` above `hpFloor` until the card
   * floor's share of its timer has run; hits never take the boss below it either (host only; absent once it stops holding).
   */
  holdFloor?: number;
  /** The boss sits on its hold: hits are absorbed ("¡Aguanta!"). Synced: guests show the feedback from it. */
  held?: true;
}

/**
 * Enemy behaviour modes. Not every species uses every mode: Poochyena goes
 * idle -> approach -> telegraph -> attack -> recover; Gastly uses reposition
 * instead of approach; Aegislash adds transform (stance change). A dormant
 * enemy never acts (training dummy); an asleep one waits until woken
 * (activation.ts) and then hunts for good.
 */
export type AiMode = 'dormant' | 'asleep' | 'idle' | 'approach' | 'reposition' | 'telegraph' | 'attack' | 'recover' | 'transform';

export interface AiState {
  mode: AiMode;
  /** Time spent in the current mode (enemy time scale). */
  modeMs: number;
  /** Planned length of the current timed mode (telegraph, attack, recover); 0 when open-ended. */
  modeDurationMs: number;
  /** Unit direction of the current attack: tracked during the telegraph, committed when it fires. */
  attackDir: Vec2;
  /** Whether the current attack already met the player (one contact per attack). */
  contact: 'none' | 'hit' | 'dodged';
  /** Time before the next attack may start. */
  cooldownMs: number;
  /** Strafing side while circling or keeping distance. */
  strafeSign: 1 | -1;
  /** Named attack being telegraphed or thrown, for species with several (Koffing's puff or fuse, Croagunk's stance, counter or jab). */
  attack?: string;
  /** Ground point an attack lands on (Slugma's lava blob), fixed when it is thrown. */
  aimPoint?: Vec2;
  /** Cut of a chained lunge in progress (Pawniard: 1 on the second cut); absent = the first. */
  chain?: number;
}

/** An Oran Berry lying on the floor (berries.ts). */
export interface Berry {
  /** `f<floor>b<room>`: unique within a run. */
  id: string;
  pos: Vec2;
}

export interface ProjectileState {
  id: string;
  owner: 'player' | 'enemy';
  type: PokemonType;
  attackerTypes: readonly PokemonType[];
  power: number;
  /** Charge (and other) damage multiplier fixed at spawn. */
  damageMultiplier: number;
  pos: Vec2;
  /** Pixels per second. */
  vel: Vec2;
  radius: number;
  remainingMs: number;
  hitstunMs: number;
  knockback: number;
  /** Entities already hit or passed through (a dodged projectile keeps flying). */
  hitIds: readonly string[];
  /** Bonus damage condition of the move that fired it (Hex). */
  bonus?: MoveBonus;
  /** Boomerang: turns back when `remainingMs` drops to this, and goes through what it hits. */
  returnAtMs?: number;
  /** Goes through enemies instead of being spent on the first hit (boomerangs). */
  pierce?: boolean;
  /** A line wave (Flamethrower): goes through what it hits, once each, and never turns back like a boomerang. */
  wave?: boolean;
  /** Player projectiles: the move that fired it (its hits and its look). */
  moveId?: MoveId;
  /** Enemy shots that bend towards the nearest player (Duskull's will-o-wisp): steering left. */
  steer?: SteerDef;
  /** A positional enemy shot (a sweeping wall, data `pierceRoll`): rolling through it does not help. */
  pierceRoll?: boolean;
  /** A lingering zone (Fire Spin): what it hit may be hit again every this many ms; `lingerMs` counts down to the next. */
  linger?: number;
  lingerMs?: number;
  /** Player shots that bend towards the nearest enemy (Swift): degrees per second. */
  homing?: number;
  /** Player shots: the effects of the move that fired it (drain, recoil, damage over time, crit bonus). */
  effects?: HitEffects;
  /** Rank effects (core/rank-effects.ts): a zone left by a move (drawn on the ground; its hits are minor), armed after `armMs`. */
  zone?: true;
  armMs?: number;
  /** A shot that splits on its first hit. */
  split?: { count: number; share: number };
  /** A boomerang thrown out again when caught: `left` more throws along `dir`, each at `share` power, of `lifetimeMs`. */
  rethrow?: { left: number; share: number; lifetimeMs: number; dir: Vec2 };
  /** A rank effect's spawned shot (a split shard, a boomerang thrown again): not a direct hit (no Shell Bell heal). */
  secondary?: true;
}

/** What a player's hit does beyond its damage (data/moves.ts `MoveDef`). */
export interface HitEffects {
  drain?: number;
  recoil?: number;
  dot?: DotKind;
  critBonus?: number;
  /** The rank effects a hit carries (data/moves.ts `MoveDef`, core/rank-effects.ts). */
  dotChance?: number;
  mark?: { share: number; delayMs: number };
  weaken?: { factor: number; durationMs: number };
  chain?: { share: number; range: number };
  zone?: ZoneDef;
}

/** A mark on an enemy (a rank effect): it bursts for `damage` once `ms` run out. */
export interface EnemyMark {
  damage: number;
  ms: number;
}

/** A weakened enemy (a rank effect): its hits deal `factor` times their damage for `ms` more. */
export interface EnemyWeaken {
  factor: number;
  ms: number;
}

/** A damage over time on an enemy: `damage` per tick, `ticksLeft` more ticks, the next in `nextMs`. */
export interface EnemyDot {
  kind: DotKind;
  damage: number;
  ticksLeft: number;
  nextMs: number;
}

export interface Arena {
  width: number;
  height: number;
  /** Solid blocks for walkers; floaters ignore them, and projectiles too unless the block is `cover`. */
  obstacles?: readonly Obstacle[];
  /** Generated floors: wall tiles block every body (floaters too: always on usable floor) and stop projectiles. */
  tiles?: TileGrid;
  /** Generated floors: stepping here goes down to the next floor. */
  stairs?: Rect;
  /** Generated floors: the rooms, in tiles (the minimap reveals a whole room on entering it). */
  rooms?: readonly TileRect[];
  /** Flooded Caves floors: shallow water per tile, aligned with `tiles` (1 = shallow; water.ts). */
  water?: readonly number[];
}

/** Things that happened during the last step, for renderer juice and audio. Cleared every step. */
export type GameEvent =
  | { type: 'rollStarted' }
  | { type: 'rollDenied' }
  | { type: 'hitDodged' }
  | { type: 'perfectDodge' }
  /** `pierceRoll`: the hit was positional (rolling could not stop it); read by the balance harness only. */
  | { type: 'playerHurt'; damage: number; pierceRoll?: true }
  /** A spell card ended (host): its segment emptied, its timer ran out, or a survival card was survived (core/cards.ts). */
  | { type: 'spellCardEnd'; enemyId: string; card: CardId; outcome: Exclude<CardOutcome, 'start'> }
  /** "Tu turno": a card boss finished a combo and opens for `durationMs` (core/cards.ts `startTurn`): no new threat, its shots fade. */
  | { type: 'bossTurn'; enemyId: string; durationMs: number }
  /** The local player went through a spell card without being hit (every peer for itself): coins and a heal. */
  | { type: 'cardCaptured'; enemyId: string; card: CardId; heal: number }
  | { type: 'disguiseBroken' }
  /** A starter passive acted: Illusion broke, Flash Fire absorbed a Fire hit, Battle Armor took a frontal hit. */
  /** `kindled`: Flash Fire was stoked by the player's own Fire hits rather than an absorbed attack. */
  | { type: 'passiveTriggered'; passive: PassiveId; kindled?: boolean }
  | { type: 'moveStarted'; moveId: MoveId; slotIndex: number }
  | { type: 'moveDenied'; moveId: MoveId }
  /** A boost move took hold on the local player (its aura and sound). */
  | { type: 'buffStarted'; moveId: MoveId }
  | { type: 'moveReleased'; moveId: MoveId; chargeLevel: number }
  /** `moveId`: the local player's move that landed it; `finisher`: the last part of a multi-hit move. */
  | { type: 'enemyHit'; enemyId: string; damage: number; effectiveness: number; pos: Vec2; moveId?: MoveId; finisher?: boolean; dot?: DotKind; minor?: true; burst?: true }
  | { type: 'enemyDefeated'; enemyId: string }
  /** A leader winds up its rally cry (`windup`) or calls it (`cry`) (core/leaders.ts). */
  | { type: 'leaderRally'; enemyId: string; phase: 'windup' | 'cry' }
  /** The floor's gate opened (its enemy fell, a key gate's key taken with it; its wave room cleared) or broke (out of reach too long): core/gates.ts. */
  | { type: 'gateOpened'; kind: GateKind; outcome: GateOutcome }
  /** A leader fell and its followers broke. */
  | { type: 'leaderFell'; enemyId: string; followers: number }
  /** Sableye took a held item of the local player, or it came back (stolen.ts). */
  | { type: 'itemStolen'; item: ItemId; enemyId: string }
  | { type: 'itemReturned'; item: ItemId }
  /** A held item acted (Sitrus Berry heal, Focus Sash save, Rocky Helmet recoil on `enemyId`). */
  | { type: 'itemTriggered'; item: ItemId; enemyId?: string }
  /** The local player ate an Oran Berry (solo and host at once; a guest when the host grants its claim). */
  | { type: 'berryEaten'; berryId: string; heal: number }
  /** A guest walked over a berry: the host decides who gets it (berries.ts). */
  | { type: 'berryClaim'; berryId: string }
  /** The local player reached `level` (progression.ts). */
  | { type: 'levelUp'; level: number }
  /** The floor hurt the player: collapsed ground, or the closed fog's chill (not an attack: no dodge, no Disguise). */
  | { type: 'collapseHurt'; damage: number }
  /** The local player waded into a toxic pool and is poisoned (toxic.ts). */
  | { type: 'poisoned' }
  /** `pierceRoll`: a positional attack is winding up (its own warning sound: walk out of it). */
  | { type: 'enemyTelegraph'; enemyId: string; attack: string; durationMs: number; pierceRoll?: true }
  | { type: 'enemyAttack'; enemyId: string; attack: string }
  | { type: 'hitBlocked'; enemyId: string; pos: Vec2 }
  /** A hit met a spell card's floor (core/cards.ts `holdFloor`): the boss holds ("¡Aguanta!"). */
  | { type: 'cardHold'; enemyId: string; pos: Vec2 }
  | { type: 'bossStance'; enemyId: string; stance: BossStance }
  /** Co-op: a boss turned to another player (core/aggro.ts). */
  | { type: 'bossAggro'; enemyId: string; targetId: string }
  /** Co-op: the local player got up, helped by `by` (core/revive.ts). */
  | { type: 'revived'; by: string }
  /** Co-op: the helper was hurt or stepped away; the revive count starts again. */
  | { type: 'reviveInterrupted' }
  /** A herald blinked from one anchor to the next (teleporting movement), for its flash. */
  | { type: 'heraldBlink'; enemyId: string; from: Vec2; to: Vec2 }
  | { type: 'lockAcquired'; targetId: string }
  | { type: 'lockSwitched'; targetId: string }
  | { type: 'lockReleased'; reason: 'key' | 'click' | 'range' | 'offscreen' | 'noTarget' }
  /** A guest's own player hit an enemy: the host applies the claim (sync.ts). */
  | { type: 'hitClaim'; claim: HitClaim };

/**
 * Who runs what in a shared run (docs/gdd.md §12): the `host` runs enemy AI,
 * the boss, spawns and floor changes and applies hit claims; a `guest` gets
 * enemies from host snapshots and runs only its own player. Solo is a host
 * with no peers.
 */
export type PeerRole = 'host' | 'guest';

/** Another peer's player, as its own peer reported it (never simulated here). */
export interface RemotePlayer {
  id: string;
  player: PlayerState;
  /** That player's own projectiles in flight, drawn only (they never hit anything on this peer). */
  projectiles: readonly RemoteProjectile[];
  /** Co-op: fainted and being revived, ms an ally has stood by (as that player's peer reported it). */
  revive?: number;
}

/** Enough of another player's projectile to draw it. */
export interface RemoteProjectile {
  id: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
}

/**
 * A guest's hit on an enemy, resolved on the guest (damage, type
 * effectiveness, stagger and knockback already computed) and applied by the
 * host, trusted in the spike. `id` names the swing or projectile and the
 * enemy, so a resent or duplicated claim lands once.
 */
export interface HitClaim {
  id: string;
  playerId: string;
  enemyId: string;
  damage: number;
  effectiveness: number;
  /** Stagger (hitstun) already scaled by the enemy's poise. */
  hitstunMs: number;
  /** Knockback displacement, already scaled by the enemy's poise. */
  knockback: Vec2;
  /** Stopped by a guard: chip damage only, no stagger. */
  blocked: boolean;
  /**
   * What the host resolves on its enemy with the claim, once (it ticks them;
   * odd/tasks/move-progression.md F2): the burn or poison that took on the
   * guest's roll, and a rank effect's mark and weakening.
   */
  dot?: DotKind;
  mark?: { share: number; delayMs: number };
  weaken?: { factor: number; durationMs: number };
  /** A zone's tick or a chained jump: a small number on the host too. */
  minor?: true;
}

export interface WorldState {
  tick: number;
  /** Difficulty tier chosen by the host (data/difficulty.ts); absent means `easy`. */
  difficulty?: Difficulty;
  /** Co-op: players present when this floor was entered (core/party.ts `partySizeOf`); absent = solo. */
  party?: number;
  /** Id of this peer's player (`player`); "p1" solo. */
  localId: string;
  role: PeerRole;
  /** The other peers' players (empty solo). */
  remotes: readonly RemotePlayer[];
  /** Host: ids of the hit claims already applied (bounded), so a claim never lands twice. */
  appliedClaims: readonly string[];
  /** Real (unscaled) simulation time. */
  timeMs: number;
  /** Floor of the run being played (1-based): scales the experience enemies give. */
  depth: number;
  /** Ids of the enemies of this floor whose defeat already gave experience (each pays once). */
  credited: readonly string[];
  rng: number;
  /** Counter for deterministic entity ids. */
  nextId: number;
  arena: Arena;
  player: PlayerState;
  enemies: readonly EnemyState[];
  projectiles: readonly ProjectileState[];
  /** Oran Berries still on this floor (a guest's list follows the host's snapshots). */
  berries: readonly Berry[];
  lock: LockState;
  /** Remaining perfect-dodge slow-mo, in real time. */
  slowMoMs: number;
  /** Generated floors: walking distances to the nearest present player's tile, for walkers out of sight (flow.ts). */
  flow?: FlowField;
  /** Collapse urgent floors: the advancing front (collapse.ts). */
  collapse?: CollapseState;
  /** Fog urgent floors (Niebla): the closing vision (fog.ts). */
  fog?: FogState;
  /** Flood urgent floors (Inundación): the rising water (flood.ts). */
  flood?: FloodState;
  /** Gas urgent floors (Gas tóxico): the spreading cloud (gas.ts). */
  gas?: GasState;
  /** Toxic Swamp floors: the pools that poison on contact (toxic.ts). */
  pools?: readonly ToxicPool[];
  /** Endless dungeon: this floor's enemy HP (at spawn) and damage multipliers (endless.ts); absent = 1. */
  enemyScale?: EnemyScale;
  /** The level a player is expected to have on this floor (core/fairness.ts): the yardstick of the one-hit cap; absent = 1. */
  referenceLevel?: number;
  /** Misty Forest: a spirit light leads to a berry cache on this floor (wisp.ts; every peer places it from the seed). */
  wisp?: { cache: Vec2 };
  /** Sima del Eclipse: the species the Eco del Eclipse of this floor copies (core/eclipse-echo.ts `echoMimic`); presentation only. */
  echoMimic?: SpeciesId;
  /** Sima del Eclipse: this floor's event (sima-events.ts); the host runs it, guests follow its snapshot. */
  simaEvent?: SimaEventState;
  /** Sima del Eclipse: the shrine's pact in force (it outlasts the floor). */
  simaPact?: SimaPactState;
  /** Co-op: the local player's revive on this floor (core/revive.ts); absent solo. */
  revive?: ReviveState;
  /** The spell card the local player is trying to capture (core/cards.ts `updateCapture`, every peer for itself): whether they were hit during it. */
  capture?: { enemyId: string; card: CardId; hit: boolean };
  /** Generated floors: this floor's mandatory kill, if any (core/gates.ts); the host resolves it, guests follow its snapshot. */
  gate?: GateState;
  /** A boss room before the party crossed its fog (core/fog-wall.ts): the antechamber's line and the held-back boss. */
  fogWall?: FogWall;
  /** This floor's bonfire is lit (core/bonfire.ts): healing over time stops while nothing is left to fight. */
  bonfireLit?: boolean;
  events: GameEvent[];
}

/** A hit about to land on the player (from an enemy attack or projectile), damage already computed. */
export interface IncomingHit {
  damage: number;
  /** Type of the attack (Flash Fire absorbs Fire). */
  type?: PokemonType;
  /** Where the attack comes from (Battle Armor only covers the front). */
  from?: Vec2;
  /** A positional attack (data `pierceRoll`): the roll's i-frames do not stop it, and it is never a perfect dodge. */
  pierceRoll?: boolean;
}
