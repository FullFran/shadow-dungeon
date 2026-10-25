import type { DanmakuCardDef, DanmakuPattern } from './enemies';

/**
 * Spell cards (docs/gdd.md §9, docs/souls-difficulty-research.md P4): a
 * guardian fights as a sequence of named cards, Touhou style. Every card owns
 * a share of the boss's HP (its segment) and a timer; it ends when its
 * segment is emptied (broken) or when the timer runs out (timed out: the
 * segment is lost, no reward). A survival card owns no HP: the boss cannot be
 * hurt, the card ends when its timer does. A player who goes through a card
 * without being hit captures it (a small reward, each player on their own
 * peer). Between cards the boss declares the next one: a short break in
 * which it neither attacks nor takes damage and every enemy shot is
 * cleared. The engine is core/cards.ts; a boss opts in with a
 * `spellCards: CardFightDef` field in its data (patched in per tier).
 *
 * The minimal API is meant to be unified with the procedural bosses' card
 * framework (same file names): ids, HP shares, timers, capture and the
 * `spellCardEnd`/`cardCaptured` events.
 */

/** One move of a card: a danmaku pattern (data/enemies.ts `DanmakuPattern`) with its telegraph and opening, plus optional extra bullet layers fired on the same timeline. */
export interface CardStepDef extends DanmakuCardDef {
  /** Extra bullet patterns (rings, spirals, walls...) fired together with `pattern` from the attack's start: the tiers' "layers" knob. */
  layers?: readonly DanmakuPattern[];
}

/** A spell card's id (`sc-` + a name): it is the boss's stance while the card plays. */
export type SpellCardId = `sc-${string}`;

export interface SpellCardDef {
  /** Unique id: the boss's `stance` while the card plays (snapshots carry it); i18n `boss.stance.<id>` is its short name. */
  id: SpellCardId;
  /** i18n key of the full card name (the banner). */
  nameKey: string;
  /** Share of the boss's max HP this card owns; 0 for a survival card. A fight's shares sum to 1. */
  hpShare: number;
  /** Time limit; a survival card lasts exactly this long. */
  timerMs: number;
  /** Cannot be damaged: only survived (from Hard on, at most one per boss). */
  survival?: true;
  /** The fight's last word: the desperation card at low HP (nightmare). */
  lastSpell?: true;
  /** Aegislash's Shield cards: hits from the front are blocked while it plays (flank it). */
  guard?: 'front';
  /** The card opens phase 2: its declaration is the fight's longer `phase2BreakMs` (Aegislash: "El Rey desenvaina"). */
  phase2?: true;
  /** Pause between two moves of the card (it drifts meanwhile). */
  restMs: number;
  /** The card's moves, played in order and looped until the card ends. */
  steps: readonly CardStepDef[];
}

export interface CardFightDef {
  cards: readonly SpellCardDef[];
  aggroRange: number;
  /** Declaration between two cards (invulnerable, shots cleared). */
  breakMs: number;
  /** Declaration of a `phase2` card. */
  phase2BreakMs: number;
  /** Enemy shots never go over this at once (the cap only ever widens the gaps). */
  maxShots: number;
  walkSpeed: number;
  /** It drifts to keep this distance from its target between moves. */
  keepDistance: number;
  /** Damage of every card hit (shots and melee), on top of the tier's own (the guardians hit harder on Hard and Nightmare). */
  power: number;
}

/** What a capture gives the player who made it (on their own peer): Pokémonedas and a share of their max HP back. */
export const CAPTURE = { coins: 8, healShare: 0.12 } as const;

/** The outcome a declaration carries in `ai.attack` (how the previous card ended); the first declaration carries `start`. */
export type CardOutcome = 'start' | 'broken' | 'timeout' | 'survived';

/** What every peer needs to know about a card from its id alone (guard, survival, names), whatever the tier. */
export interface CardInfo {
  nameKey: string;
  survival?: true;
  guard?: 'front';
}

const registry = new Map<string, CardInfo>();

/** Registers the cards of a fight (data modules call this for every fight they define). Ids must name the same card on every tier. */
export function registerCards(fight: CardFightDef): CardFightDef {
  for (const card of fight.cards) {
    registry.set(card.id, { nameKey: card.nameKey, ...(card.survival ? { survival: true as const } : {}), ...(card.guard ? { guard: card.guard } : {}) });
  }
  return fight;
}

/** The card a stance names, if it is a registered spell card. */
export const cardInfo = (stance: string | null | undefined): CardInfo | undefined => (stance ? registry.get(stance) : undefined);
