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
 * One framework for every card boss: the hand-authored guardians run their
 * cards through core/cards.ts `updateCardFight`; the Heralds of the Eclipse
 * (data/herald.ts, generated per seed) run their own proven-fair layers
 * (core/herald/brain.ts) on the same rules: HP segments from `hpShare`
 * (`segmentFloorShare`; a herald's cards take equal shares), a timer per
 * card, a declaration between cards (invulnerable, shots cleared, its
 * outcome in `ai.attack`), the same `bossStance`/`spellCardEnd`/
 * `cardCaptured` events, and one capture rule and reward (`CAPTURE`, judged
 * by core/cards.ts `updateCapture` on every peer for its own player).
 */

/** One move of a card: a danmaku pattern (data/enemies.ts `DanmakuPattern`) with its telegraph and opening, plus optional extra bullet layers fired on the same timeline. */
export interface CardStepDef extends DanmakuCardDef {
  /** Extra bullet patterns (rings, spirals, walls...) fired together with `pattern` from the attack's start: the tiers' "layers" knob. */
  layers?: readonly DanmakuPattern[];
}

/** A spell card's id (`sc-` + a name): it is the boss's stance while the card plays. */
export type SpellCardId = `sc-${string}`;

/** A herald's card as its stance: `herald<i>`, and `herald<i>x` for its phase-2 version (data/herald.ts); the names come from the generated def. */
export type HeraldCardId = `herald${number}` | `herald${number}x`;

/** Any spell card a boss can play (the `spellCardEnd`/`cardCaptured` events carry it). */
export type CardId = SpellCardId | HeraldCardId;

/** Whether a stance names a herald's card. */
export const isHeraldCard = (stance: string | null | undefined): stance is HeraldCardId => stance !== null && stance !== undefined && /^herald\d+x?$/.test(stance);

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
  /** The card's moves, played in order and looped until the card ends (empty for a hosted card). */
  steps: readonly CardStepDef[];
  /**
   * A hosted card (data/hosted-cards.ts): the boss's own moves, by the names
   * its engine already knows (Sableye's `glint`, Dhelmise's `kelp`...),
   * played by that engine in this order and looped. The patterns stay the
   * boss's own; the card adds the segment, timer, declaration and capture.
   */
  moves?: readonly string[];
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
  /** Species the boss summons during its cards (Salazzle's court): they leave with the card when it ends, so a declaration holds no threat. */
  dismiss?: readonly string[];
}

/**
 * What a capture gives the player who made it (on their own peer):
 * Pokémonedas and a share of their max HP back. One reward for every card
 * boss, guardians and heralds alike (the heralds' branch paid 6 coins and no
 * heal; aligned on integration: one rule, one table).
 */
export const CAPTURE = { coins: 8, healShare: 0.12 } as const;

/**
 * Sima echoes of card guardians (user decision 2026-10-26 C; core/cards.ts
 * `echoCards`): the first stratum (floors 5 and 15) plays the phase-1 cards
 * only, from `phase2FromFloor` the phase-2 cards join, and from
 * `fullFromFloor` (or on a guardian's second encounter) the survival card
 * and the last spell too. An echo holds only the HP of the cards it plays
 * (so every segment is the guardian's own) at `hpScale` of the guardian's
 * HP whatever the depth (depth makes its hits harder, not its bar longer:
 * src/sim/prove.ts found deep echoes past the reference player's reach), and
 * its timers run `timerScale` as long, so the fight fits the Sima clock.
 * Easy keeps the echo's duel (no cards).
 */
export const ECHO_CARDS = { phase2FromFloor: 25, fullFromFloor: 35, timerScale: 0.8, hpScale: 0.6 } as const;

/** Where card `index` of a fight with these HP shares ends, as a share of max HP (shares are normalised; the last ends at 0). */
export function segmentFloorShare(shares: readonly number[], index: number): number {
  const total = shares.reduce((sum, s) => sum + s, 0);
  if (total <= 0) return 0;
  const used = shares.slice(0, index + 1).reduce((sum, s) => sum + s, 0);
  return Math.max(0, 1 - used / total);
}

/** The shares of `count` equal segments (a herald's cards). */
export const equalShares = (count: number): number[] => Array.from({ length: Math.max(0, count) }, () => 1 / Math.max(1, count));

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

/** Every herald card shares this info: no guard, no survival; its name is the generated def's (app/herald-run.ts `heraldCardName`). */
const HERALD_CARD: CardInfo = { nameKey: 'boss.stance.herald' };

/** The card a stance names, if it is a registered spell card or a herald's card. */
export const cardInfo = (stance: string | null | undefined): CardInfo | undefined => (stance ? (registry.get(stance) ?? (isHeraldCard(stance) ? HERALD_CARD : undefined)) : undefined);
