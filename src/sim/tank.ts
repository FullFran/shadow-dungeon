import type { Difficulty } from '../data/difficulty';
import type { ItemId } from '../data/items';
import type { MoveId } from '../data/moves';
import { SPECIES, type SpeciesId } from '../data/species';
import type { StarterId } from '../data/learnsets';
import { FULL_BUILD, MAX_RANK } from '../data/tutor';
import { expectedLevel, speciesMaxHpAt } from '../core/fairness';
import { atCard } from '../core/cards';
import { addItem } from '../core/items';
import { moveIframes, wardActive } from '../core/rank-effects';
import { loadRoom } from '../core/rooms';
import type { PlayerInput, WorldState } from '../core/state';
import { step } from '../core/step';
import { FIXED_DT_MS } from '../core/timestep';
import { distance, normalize, sub, vec } from '../core/vec';
import { createWorld } from '../core/world';
import { bossFloor, CARD_BOSSES, fightIn, type BossCase } from './prove';

/**
 * The tank bot (odd/tasks/degenerate-builds.md B2): the degenerate-build
 * yardstick. It never rolls and never dodges: it walks into a card boss on
 * the real engine and presses every slot in turn (fast, heavy, boost, area)
 * for the whole fight, at the floor's expected level, with the build under
 * test (species, loadout, Mejora ranks, held items). A fair build loses
 * that fight on Nightmare: face-tanking a boss is what difficulty punishes.
 * A build that survives it (or wins it without ever dodging) is degenerate.
 * Besides the outcome it measures what the build did about it: the HP its
 * items and moves healed, the damage it took, and how much of the fight it
 * spent invulnerable (rank i-frames) or under super-armor.
 */
export interface TankBuild {
  species: SpeciesId;
  loadout?: readonly (MoveId | null)[];
  moveRanks?: Readonly<Partial<Record<MoveId, number>>>;
  items?: readonly ItemId[];
}

export interface TankResult {
  outcome: 'died' | 'won' | 'alive';
  /** Fight time played (to the death, the win, or `maxMs`). */
  ms: number;
  maxHp: number;
  /** HP healed (every source: items, drain, rank heals). */
  healed: number;
  /** Damage the player took. */
  taken: number;
  /** Damage dealt to the boss. */
  dealt: number;
  /** Share of the fight spent in a ranked move's i-frames. */
  iframeShare: number;
  /** Share of the fight under a ranked move's super-armor. */
  wardShare: number;
}

/** The arena with the boss on its first card, the player at the room's start with the build, at the floor's expected level (full HP). */
export function tankWorld(c: BossCase, tier: Difficulty, build: TankBuild, seed = 1): WorldState {
  let s = loadRoom(
    createWorld({
      seed,
      arena: { width: 1, height: 1 },
      playerPos: vec(0, 0),
      difficulty: tier,
      species: build.species,
      ...(build.loadout ? { loadout: build.loadout } : {}),
      ...(build.moveRanks ? { moveRanks: build.moveRanks } : {}),
    }),
    c.room,
  );
  if (c.prepare) s = c.prepare(s);
  const where = c.where ?? bossFloor(c.room);
  const level = expectedLevel(where.dungeon, where.floor, tier);
  const maxHp = speciesMaxHpAt(build.species, level);
  let player = { ...s.player, level, hp: maxHp, maxHp, disguiseBroken: true };
  for (const id of build.items ?? []) player = addItem(player, id);
  return { ...s, referenceLevel: level, player };
}

/**
 * Walk into the boss and use the best slot ready (area, boost, then heavy with
 * stamina to spare, else fast), a fresh press each time nothing is playing;
 * never a roll.
 */
export function tankInput(state: WorldState, species: SpeciesId): PlayerInput {
  const boss = state.enemies.find((e) => e.species === species && e.boss && e.alive) ?? state.enemies.find((e) => e.alive);
  const p = state.player;
  const me = p.pos;
  const close = boss ? distance(boss.pos, me) <= boss.radius + 18 : true;
  const ready = (i: number): boolean => {
    const id = p.loadout[i];
    return !!id && (p.cooldowns?.[id] ?? 0) <= 0;
  };
  const free = p.action === null && !p.slotsHeld.some(Boolean);
  const pick = !free ? -1 : ready(3) ? 3 : ready(2) ? 2 : ready(1) && p.stamina >= 50 ? 1 : 0;
  const slots = [0, 1, 2, 3].map((i) => i === pick);
  return {
    move: boss && !close ? normalize(sub(boss.pos, me)) : vec(0, 0),
    aim: boss ? boss.pos : vec(me.x, me.y - 1),
    roll: false,
    slots,
    slotMouse: slots,
    lock: false,
    click: false,
    wheel: 0,
    view: { x: 0, y: 0, width: state.arena.width, height: state.arena.height },
  };
}

/**
 * Plays the tank bot against `c`'s boss on `tier` for at most `maxMs`. With
 * `card`, the fight is that card held forever: the boss starts on it, its
 * clock never runs out and its HP never drops (each step puts both back), so
 * the only way out is the player's death; `alive` then means the build out-heals
 * the card indefinitely.
 */
export function tankFight(c: BossCase, tier: Difficulty, build: TankBuild, maxMs = 120_000, seed = 1, card?: number): TankResult {
  let s = tankWorld(c, tier, build, seed);
  if (card !== undefined) {
    const fight = fightIn(s, c.species);
    if (fight) s = { ...s, enemies: s.enemies.map((e) => (e.species === c.species && e.boss ? atCard(e, fight, card) : e)) };
  }
  const held = card === undefined ? null : s.enemies.find((e) => e.species === c.species && e.boss);
  const maxHp = s.player.maxHp;
  let healed = 0;
  let taken = 0;
  let dealt = 0;
  let iframeMs = 0;
  let wardMs = 0;
  let ms = 0;
  const bossAlive = (w: WorldState) => w.enemies.some((e) => e.species === c.species && e.boss && e.alive);
  const result = (outcome: TankResult['outcome']): TankResult => ({ outcome, ms, maxHp, healed, taken, dealt, iframeShare: iframeMs / Math.max(1, ms), wardShare: wardMs / Math.max(1, ms) });
  while (ms < maxMs) {
    const before = s.player.hp;
    s = step(s, tankInput(s, c.species), FIXED_DT_MS);
    ms += FIXED_DT_MS;
    let hurt = 0;
    for (const e of s.events) {
      if (e.type === 'playerHurt') hurt += e.damage;
      if (e.type === 'enemyHit') dealt += e.damage;
    }
    taken += hurt;
    // What the step healed: the HP change plus the damage it took (at most the HP there was to lose).
    const gain = s.player.hp - before + Math.min(hurt, before);
    if (gain > 0) healed += gain;
    if (moveIframes(s.player)) iframeMs += FIXED_DT_MS;
    if (wardActive(s.player)) wardMs += FIXED_DT_MS;
    if (s.player.hp <= 0) return result('died');
    if (held) s = { ...s, enemies: s.enemies.map((e) => (e.id === held.id && e.boss ? { ...e, hp: held.hp, alive: true, boss: { ...e.boss, cardMs: Math.min(e.boss.cardMs ?? 0, HELD_CARD_MS) } } : e)) };
    else if (!bossAlive(s)) return result('won');
  }
  return result('alive');
}

/** A held card's clock is put back here (past the declaration, well inside every card's timer). */
const HELD_CARD_MS = 2000;

/** A build the degenerate-build audit plays: a starter, its four moves (fast, heavy, boost, area), all at rank +2. */
export interface AuditBuild {
  id: string;
  species: StarterId;
  loadout: readonly MoveId[];
}

/**
 * The audited builds (odd/tasks/degenerate-builds.md B2): each starter's
 * full-investment build and default kit, plus the combos most likely to be
 * degenerate: i-frame moves in every slot, super-armor on the spammable
 * slots with a guard boost, drain moves, weakening on the fast slot.
 */
export const AUDIT_BUILDS: readonly AuditBuild[] = [
  // Zorua's full build is its kit, so it is played once.
  ...(['mimikyu', 'zorua', 'litwick', 'cubone'] as const).flatMap((s) => {
    const kit = SPECIES[s].defaultLoadout.filter((m): m is MoveId => m !== null);
    const full = { id: `${s}-full`, species: s, loadout: FULL_BUILD[s] };
    return kit.join() === FULL_BUILD[s].join() ? [full] : [full, { id: `${s}-kit`, species: s, loadout: kit }];
  }),
  { id: 'mimikyu-iframes', species: 'mimikyu', loadout: ['shadow-sneak', 'take-down', 'swords-dance', 'phantom-force'] },
  { id: 'mimikyu-drain', species: 'mimikyu', loadout: ['draining-kiss', 'drain-punch', 'bulk-up', 'phantom-force'] },
  { id: 'mimikyu-armor', species: 'mimikyu', loadout: ['shadow-claw', 'wood-hammer', 'curse', 'phantom-force'] },
  { id: 'zorua-iframes', species: 'zorua', loadout: ['sucker-punch', 'foul-play', 'calm-mind', 'hyper-voice'] },
  { id: 'zorua-uturn', species: 'zorua', loadout: ['u-turn', 'night-daze', 'nasty-plot', 'snarl'] },
  { id: 'zorua-weaken', species: 'zorua', loadout: ['knock-off', 'night-daze', 'calm-mind', 'snarl'] },
  { id: 'litwick-armor', species: 'litwick', loadout: ['flame-charge', 'flare-blitz', 'acid-armor', 'fire-spin'] },
  { id: 'cubone-armor', species: 'cubone', loadout: ['headbutt', 'double-edge', 'bulk-up', 'earthquake'] },
  { id: 'cubone-iframes', species: 'cubone', loadout: ['bone-rush', 'dig', 'iron-defense', 'earthquake'] },
];

/** The defensive item set of the audit (every sustain and survival item at its cap). */
export const TANK_ITEMS: readonly ItemId[] = ['leftovers', 'leftovers', 'shell-bell', 'shell-bell', 'sitrus-berry', 'sitrus-berry', 'focus-sash', 'rocky-helmet', 'rocky-helmet', 'rocky-helmet'];

/** How long a held card is played before the build counts as out-healing it. */
export const IMMORTAL_MS = 180_000;

/** A card a bare, unranked default kit loses within this long counts as a fast killer: out-healing it is degenerate, not a margin. */
export const FAST_CARD_MS = 60_000;

export interface AuditResult {
  cards: number;
  /** Cards still standing after `IMMORTAL_MS`. */
  immortal: number;
  /** Immortal cards that kill the starter's bare, unranked default kit within `FAST_CARD_MS`: the build flipped a lethal card. */
  flipped: number;
  medianMs: number;
  /** Shares of all the fight time (every card together) spent in rank i-frames and under super-armor. */
  iframeShare: number;
  wardShare: number;
  /** HP healed per second over all the fight time, as a share of max HP. */
  healPerSecond: number;
  results: { boss: SpeciesId; card: number; result: TankResult }[];
}

const playAll = (tank: TankBuild, tier: Difficulty): AuditResult['results'] => {
  const results: AuditResult['results'] = [];
  for (const c of CARD_BOSSES) {
    const cards = fightIn(tankWorld(c, tier, tank), c.species)?.cards.length ?? 1;
    for (let card = 0; card < cards; card++) results.push({ boss: c.species, card, result: tankFight(c, tier, tank, IMMORTAL_MS, 1, card) });
  }
  return results;
};

const baselines = new Map<string, AuditResult['results']>();
/** The starter's bare, unranked default kit on every card (cached per starter and tier). */
function baselineOf(species: StarterId, tier: Difficulty): AuditResult['results'] {
  const key = `${species}:${tier}`;
  let found = baselines.get(key);
  if (!found) {
    found = playAll({ species, loadout: SPECIES[species].defaultLoadout }, tier);
    baselines.set(key, found);
  }
  return found;
}

/** `build` at rank +2 with `items`, face-tanking every Nightmare card of every card boss (`CARD_BOSSES`), each held. */
export function auditBuild(build: AuditBuild, items: readonly ItemId[] = [], tier: Difficulty = 'nightmare'): AuditResult {
  const tank: TankBuild = { species: build.species, loadout: build.loadout, moveRanks: Object.fromEntries(build.loadout.map((m) => [m, MAX_RANK])), items };
  const results = playAll(tank, tier);
  const base = baselineOf(build.species, tier);
  const times = results.map((r) => r.result.ms).sort((a, b) => a - b);
  const totalMs = results.reduce((t, r) => t + r.result.ms, 0);
  const weighted = (f: (r: TankResult) => number) => results.reduce((t, r) => t + f(r.result) * r.result.ms, 0) / Math.max(1, totalMs);
  const immortal = results.filter((r) => r.result.outcome === 'alive');
  return {
    cards: results.length,
    immortal: immortal.length,
    flipped: immortal.filter((r) => {
      const b = base.find((x) => x.boss === r.boss && x.card === r.card)?.result;
      return b !== undefined && b.outcome === 'died' && b.ms <= FAST_CARD_MS;
    }).length,
    medianMs: times[Math.floor(times.length / 2)] ?? 0,
    iframeShare: weighted((r) => r.iframeShare),
    wardShare: weighted((r) => r.wardShare),
    healPerSecond: results.reduce((t, r) => t + r.result.healed / r.result.maxHp, 0) / Math.max(1, totalMs / 1000),
    results,
  };
}
