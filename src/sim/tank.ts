import type { Difficulty } from '../data/difficulty';
import type { ItemId } from '../data/items';
import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import { expectedLevel, speciesMaxHpAt } from '../core/fairness';
import { atCard } from '../core/cards';
import { addItem } from '../core/items';
import { moveIframes } from '../core/rank-effects';
import { loadRoom } from '../core/rooms';
import type { PlayerInput, WorldState } from '../core/state';
import { step } from '../core/step';
import { FIXED_DT_MS } from '../core/timestep';
import { distance, normalize, sub, vec } from '../core/vec';
import { createWorld } from '../core/world';
import { bossFloor, fightIn, type BossCase } from './prove';

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
    if (s.player.ward) wardMs += FIXED_DT_MS;
    if (s.player.hp <= 0) return result('died');
    if (held) s = { ...s, enemies: s.enemies.map((e) => (e.id === held.id && e.boss ? { ...e, hp: held.hp, alive: true, boss: { ...e.boss, cardMs: Math.min(e.boss.cardMs ?? 0, HELD_CARD_MS) } } : e)) };
    else if (!bossAlive(s)) return result('won');
  }
  return result('alive');
}

/** A held card's clock is put back here (past the declaration, well inside every card's timer). */
const HELD_CARD_MS = 2000;
