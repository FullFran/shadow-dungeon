/**
 * Touhou-style spell cards, the shared rules (docs/gdd.md "Heraldos del
 * Eclipse"; docs/souls-difficulty-research.md P4): a boss's HP bar is split
 * into one equal segment per card, each card has a timer, and clearing a
 * card in time without being hit is a capture that pays the player who did
 * it. Any boss can use it (the procedural heralds do; hand-authored bosses
 * can opt in): the maths is core/cards.ts.
 */
export const CARD_RULES = {
  /** Pokémonedas a player earns for each card captured (per player, never shared). */
  captureCoins: 6,
  /** A card that ends this close to its timer counts as timed out (peers judge from their own clock). */
  timeoutGraceMs: 250,
} as const;

/** How a card ended for one player: captured (in time, no hit), cleared (in time, hit), timeout (the timer ran out). */
export type CardOutcome = 'captured' | 'cleared' | 'timeout';
