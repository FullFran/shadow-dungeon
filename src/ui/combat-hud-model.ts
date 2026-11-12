import { inputLabel, primaryOf } from '../adapters/bindings';
import type { LastDevice } from '../adapters/last-device';
import { GAMEPAD_HELP, buttonName, type PadStyle } from '../app/gamepad-help-data';
import { bossBar, type BossBar } from '../core/boss';
import { cooldownLeft } from '../core/boosts';
import { playerStats } from '../core/items';
import type { EnemyState, PlayerState, WorldState } from '../core/state';
import { TILE } from '../core/tiles';
import { distance } from '../core/vec';
import { bossEpithetKey } from '../data/boss-lore';
import { cardInfo } from '../data/cards';
import { cardClockView, type CardClockView } from './card-clock';
import { AEGISLASH } from '../data/enemies';
import { MOVES, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import type { SpeciesId } from '../data/species';
import { MAX_RANK, moveTier } from '../data/tutor';
import { TUNING } from '../data/tuning';
import type { PokemonType } from '../data/types';
import { t } from '../i18n';

/**
 * The pure models behind the combat HUD (.agents/DESIGN.md §4 "Combat HUD"): the boss bar (fill, delayed chip trail,
 * phase notches, card pips, status icons, card clock), its entrance and defeat, and the move slots per input device.
 * `adapters/combat-hud.ts` only draws what these say.
 */

/** Fraction of a bar to fill, clamped to [0, 1]. */
export const fillOf = (value: number, max: number): number => (max <= 0 ? 0 : Math.min(1, Math.max(0, value / max)));

/** Recent damage stays lit for `holdMs`, then drains over `drainMs`: the whole trail is gone inside 600 ms (Doherty). */
export const CHIP = { holdMs: 250, drainMs: 350 } as const;

export interface ChipTrail {
  /** Feeds the live value (0..1) at `nowMs`; returns the trail's value (never below the live one, 0..1). */
  update(value: number, nowMs: number): number;
}

export function createChipTrail(initial = 1): ChipTrail {
  let chip = initial;
  let from = initial;
  let target = initial;
  let holdUntil = 0;
  let draining = false;
  const at = (now: number): number => {
    if (!draining) return chip;
    if (now < holdUntil) return from;
    const k = (now - holdUntil) / CHIP.drainMs;
    if (k >= 1) {
      draining = false;
      chip = target;
      return chip;
    }
    return from + (target - from) * k;
  };
  return {
    update(value, now) {
      const shown = at(now);
      if (value >= shown) {
        chip = value;
        from = value;
        target = value;
        draining = false;
        return value;
      }
      if (!draining || value < target) {
        // A fresh hit: the trail waits a beat from where it is.
        from = shown;
        holdUntil = now + CHIP.holdMs;
        draining = true;
      }
      target = value;
      return at(now);
    },
  };
}

export type BossStatus = 'stun' | 'poison' | 'burn' | 'mark' | 'weak' | 'guard' | 'held';

export interface BossNotch {
  /** Where the segment ends, 0..1 of the bar. */
  at: number;
  /** The boss is already past it. */
  passed: boolean;
  /** The next one to reach. */
  live: boolean;
}

export interface BossBarModel {
  name: string;
  epithet: string;
  /** The stance or card in play, as a short tag ("Forma Escudo"); null when there is none worth naming. */
  tag: string | null;
  fill: number;
  chip: number;
  notches: BossNotch[];
  /** One pip per spell card: done, the one in play, still to come; null for a boss with no cards. */
  pips: ('done' | 'live' | 'todo')[] | null;
  type: PokemonType | null;
  statuses: BossStatus[];
  /** The shield stance or a guarded card: the bar turns steel blue. */
  guarded: boolean;
  /** The card's clock (ui/card-clock.ts): whole seconds left (rounded up), the share still to run, the last-five warning and the capture seal. */
  clock: CardClockView | null;
}

export interface BossBarInput {
  bar: BossBar;
  enemy: Pick<EnemyState, 'types' | 'hitstunMs'> & Partial<Pick<EnemyState, 'dot' | 'mark' | 'weakened' | 'boss' | 'ai'>> | undefined;
  /** The chip trail's current value (0..1). */
  chip: number;
  /** A name the Sima gives the boss (app/sima-lore.ts) or a herald's own; defaults to the species'. */
  name?: string;
  /** A herald's bar text; replaces the tag. */
  tag?: string | null;
  /** The local player's capture watch (WorldState `capture`): lights the clock's seal. */
  capture?: WorldState['capture'];
}

export function bossBarModel({ bar, enemy, chip, name, tag, capture }: BossBarInput): BossBarModel {
  const stance = bar.stance;
  const info = cardInfo(stance);
  const guarded = stance === 'shield' || info?.guard === 'front';
  const notches: BossNotch[] = [];
  let pips: BossBarModel['pips'] = null;
  if (bar.segments && bar.segments.length > 0) {
    const next = bar.segments.find((at) => at < bar.hp - 0.5);
    for (const at of bar.segments) notches.push({ at: fillOf(at, bar.maxHp), passed: at >= bar.hp - 0.5, live: at === next });
    const done = bar.segments.filter((at) => at >= bar.hp - 0.5).length;
    pips = Array.from({ length: bar.segments.length + 1 }, (_, i) => (i < done ? 'done' : i === done ? 'live' : 'todo'));
  } else if (bar.species === 'aegislash') {
    // The unsheathing: its second phase starts when the bar crosses this notch.
    const at = AEGISLASH.phase2.threshold;
    notches.push({ at, passed: fillOf(bar.hp, bar.maxHp) <= at, live: fillOf(bar.hp, bar.maxHp) > at });
  }
  const statuses: BossStatus[] = [];
  if (enemy) {
    if (enemy.hitstunMs > 0) statuses.push('stun');
    if (enemy.dot) statuses.push(enemy.dot.kind === 'burn' ? 'burn' : 'poison');
    if (enemy.mark) statuses.push('mark');
    if (enemy.weakened) statuses.push('weak');
  }
  if (guarded) statuses.push('guard');
  if (enemy?.boss?.held) statuses.push('held');
  return {
    name: name ?? t(`species.${bar.species}`),
    epithet: t(bossEpithetKey(bar.species)),
    tag: tag !== undefined ? tag : stance && t(`boss.stance.${stance}`) !== `boss.stance.${stance}` && !info ? t(`boss.stance.${stance}`) : null,
    fill: fillOf(bar.hp, bar.maxHp),
    chip,
    notches,
    pips,
    type: enemy?.types[0] ?? null,
    statuses,
    guarded,
    clock: bar.cardLeftMs === undefined ? null : cardClockView({ leftMs: bar.cardLeftMs, totalMs: bar.cardTimerMs ?? bar.cardLeftMs }, { capture, enemyId: bar.enemyId }),
  };
}

/** The entrance (name fades in, then the bar fills) and the defeat banner, with their timings. */
export const BOSS_STAGE = { nameMs: 420, fillDelayMs: 150, fillMs: 900, defeatMs: 3400, defeatInMs: 300, defeatOutMs: 700 } as const;

export interface BossStageInput {
  /** The boss on the bar now (null: none). */
  id: string | null;
  species: SpeciesId | string | null;
  alive: boolean;
  /** The same floor as the last frame (a new floor never raises the banner). */
  sameFloor: boolean;
  /** The boss the stage was showing is dead (not merely gone). */
  lastDied?: boolean;
}

export interface BossStageState {
  /** Name and frame opacity while the boss appears (0..1). */
  enter: number;
  /** Share of its real HP the bar has filled to (0..1). */
  fill: number;
  defeat: { species: string; alpha: number; ageMs: number } | null;
}

export interface BossStage {
  update(input: BossStageInput, nowMs: number): BossStageState;
}

export function createBossStage(): BossStage {
  let shown: { id: string; species: string; since: number } | null = null;
  let felled: { species: string; since: number } | null = null;
  return {
    update(input, now) {
      if (input.id !== (shown?.id ?? null)) {
        if (shown && input.lastDied === true && input.sameFloor) felled = { species: shown.species, since: now };
        shown = input.id ? { id: input.id, species: String(input.species ?? ''), since: now } : null;
      }
      const age = shown ? now - shown.since : 0;
      const enter = shown ? Math.min(1, Math.max(0, age / BOSS_STAGE.nameMs)) : 0;
      const fill = shown ? Math.min(1, Math.max(0, (age - BOSS_STAGE.fillDelayMs) / BOSS_STAGE.fillMs)) : 0;
      let defeat: BossStageState['defeat'] = null;
      if (felled) {
        const ageMs = now - felled.since;
        if (ageMs >= BOSS_STAGE.defeatMs) felled = null;
        else {
          const alpha = Math.min(1, ageMs / BOSS_STAGE.defeatInMs, (BOSS_STAGE.defeatMs - ageMs) / BOSS_STAGE.defeatOutMs);
          defeat = { species: felled.species, alpha: Math.max(0, alpha), ageMs };
        }
      }
      return { enter, fill, defeat };
    },
  };
}

export type SlotState = 'empty' | 'ready' | 'busy' | 'cooling' | 'poor';

export interface MoveSlotModel {
  index: number;
  kind: SlotKind;
  moveId: MoveId | null;
  state: SlotState;
  name: string;
  type: PokemonType | null;
  /** The key or pad button of the device in use; null on touch (its buttons carry the moves). */
  key: { kind: 'key' | 'pad'; label: string } | null;
  cooldown: { seconds: number; fill: number } | null;
  rank: { filled: number; max: number; tier: 'basic' | 'advanced' | 'master' } | null;
  /** A boost whose buff is running. */
  glowing: boolean;
  /** Heavy charge in progress: 0..1 and the level reached. */
  charge: { fill: number; level: number } | null;
}

/** The keycap of a slot: its first bound input (issue #62), a dash when it has none. */
const slotKeyLabel = (kind: SlotKind): string => {
  const input = primaryOf(kind);
  return input ? inputLabel(input, undefined, true) : '—';
};

const padRow = (kind: SlotKind): string => GAMEPAD_HELP.combat.find((r) => r.action === kind)?.buttons[0] ?? '';

export function moveSlotModel(player: PlayerState, index: number, device: LastDevice, padStyle: PadStyle): MoveSlotModel {
  const kind = PLAYER_SLOT_LAYOUT[index] ?? 'fast';
  const moveId = (player.loadout[index] ?? null) as MoveId | null;
  const key: MoveSlotModel['key'] = device === 'touch' ? null : device === 'gamepad' ? { kind: 'pad', label: buttonName(padRow(kind), padStyle) } : { kind: 'key', label: slotKeyLabel(kind) };
  if (!moveId) return { index, kind, moveId: null, state: 'empty', name: t('hud.slot.empty'), type: null, key, cooldown: null, rank: null, glowing: false, charge: null };
  const move = MOVES[moveId];
  const left = cooldownLeft(player, moveId);
  const total = move.cooldownMs ?? 0;
  const cooling = left > 0 && total > 0;
  const affordable = player.stamina >= move.staminaCost * playerStats(player).staminaCost;
  const busy = player.action?.slotIndex === index;
  const rankValue = Math.min(MAX_RANK, Math.max(0, Math.floor(player.moveRanks?.[moveId] ?? 0)));
  const action = player.action;
  const charging = busy && action?.phase === 'charging' && move.charge;
  const maxHold = move.charge?.at(-1)?.holdMs ?? 1;
  return {
    index,
    kind,
    moveId,
    state: busy ? 'busy' : cooling ? 'cooling' : affordable ? 'ready' : 'poor',
    name: t(`move.${moveId}`),
    type: move.type,
    key,
    cooldown: cooling ? { seconds: Math.ceil(left / 1000), fill: fillOf(left, total) } : null,
    rank: rankValue > 0 ? { filled: rankValue, max: MAX_RANK, tier: moveTier(moveId) } : null,
    glowing: player.buff?.moveId === moveId,
    charge: charging && action ? { fill: fillOf(action.chargeMs, maxHold), level: action.chargeLevel } : null,
  };
}

/** The stamina bar's full value (a TUNING constant), for the status panel. */
export const STAMINA_MAX = TUNING.stamina.max;

// -- Combat-aware opacity (owner 2026-11-04, minimalist pass) -----------------------------------------------------

/** An enemy this close (world px) counts as a fight. */
export const NEAR_ENEMY_PX = 6 * TILE;

export type FightKind = 'calm' | 'near' | 'boss';

/** Is the player in a fight? A boss bar, an enemy close, or the player acting (a move or a roll). Presentation only. */
export function fightKind(state: Pick<WorldState, 'player' | 'enemies'> & Partial<WorldState>): FightKind {
  if (bossBar(state as WorldState) !== null) return 'boss';
  const { player } = state;
  if (player.action || player.roll) return 'near';
  return state.enemies.some((e) => e.alive && !e.spent && distance(e.pos, player.pos) <= NEAR_ENEMY_PX) ? 'near' : 'calm';
}

/** The peripheral elements dim in 200 ms, stay dim 1.5 s after the last fight beat and come back over 500 ms. */
export const COMBAT_FADE = { inMs: 200, holdMs: 1500, outMs: 500 } as const;

export interface CombatFade {
  /** 0 calm .. 1 in a fight. */
  update(inCombat: boolean, nowMs: number): number;
}

export function createCombatFade(): CombatFade {
  let value = 0;
  let lastFight = Number.NEGATIVE_INFINITY;
  let lastNow: number | null = null;
  return {
    update(inCombat, now) {
      const dt = lastNow === null ? 0 : Math.max(0, now - lastNow);
      lastNow = now;
      if (inCombat) {
        lastFight = now;
        value = Math.min(1, value + dt / COMBAT_FADE.inMs);
        if (dt === 0) value = Math.max(value, 0.001);
      } else if (now - lastFight >= COMBAT_FADE.holdMs) {
        value = Math.max(0, value - dt / COMBAT_FADE.outMs);
      }
      return value;
    },
  };
}

/** How long the passive's state label shows after it changes. */
export const PASSIVE_NOTE_MS = 2000;

export interface PassiveNote {
  /** True for `PASSIVE_NOTE_MS` after `text` changed; never on the first frame. */
  update(text: string, nowMs: number): boolean;
}

export function createPassiveNote(): PassiveNote {
  let last: string | null = null;
  let since = Number.NEGATIVE_INFINITY;
  return {
    update(text, now) {
      if (last !== null && text !== last) since = now;
      last = text;
      return now - since < PASSIVE_NOTE_MS;
    },
  };
}
