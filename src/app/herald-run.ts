import { captureAward, emptyCapture, trackCapture, type CaptureTracker } from '../core/cards';
import { heraldCard, heraldOf } from '../core/herald/brain';
import type { EnemyState, GameEvent, WorldState } from '../core/state';
import type { CardOutcome } from '../data/cards';
import type { Bilingual, HeraldDef } from '../data/herald';
import { getLanguage } from '../i18n';

/**
 * The game screen's side of a herald fight (core/herald): its texts in the
 * player's language, the card banner, and this player's capture judge (each
 * peer judges its own player from the card on screen, core/cards.ts).
 */

/** A generated text in the current language. */
export const local = (text: Bilingual): string => text[getLanguage()];

/** The herald on this floor, alive or not, and its def. */
export function heraldHere(world: WorldState): { enemy: EnemyState; def: HeraldDef } | null {
  const enemy = world.enemies.find((e) => e.herald);
  const def = enemy ? heraldOf(world, enemy) : null;
  return enemy && def ? { enemy, def } : null;
}

/** The name of the card a herald is playing (the HUD banner), or null for any other boss or stance. */
export function heraldCardName(world: WorldState, enemyId: string, stance: string | null): string | null {
  const enemy = world.enemies.find((e) => e.id === enemyId);
  if (!enemy?.herald) return null;
  const def = heraldOf(world, enemy);
  const card = def ? heraldCard(def, stance) : null;
  return card ? local(card.name) : null;
}

/** The name card on entering a herald floor: its name, its epithet, its epigraph. */
export const heraldIntro = (def: HeraldDef): { name: string; subtitle: string; lore: string } => ({ name: def.name, subtitle: local(def.epithet), lore: local(def.epigraph) });

/** What the capture judge said about a card that just gave way. */
export interface CaptureNews {
  outcome: CardOutcome;
  coins: number;
}

/**
 * One step of this player's capture judge: the card on screen (a living
 * herald's stance while it plays a card), whether the player was hurt in
 * the step's events, on `nowMs` (simulated time). Returns the outcome of
 * the card that just ended, if one did.
 */
export function watchCapture(tracker: CaptureTracker, world: WorldState, events: readonly GameEvent[], nowMs: number): { tracker: CaptureTracker; news: CaptureNews | null } {
  const here = heraldHere(world);
  const card = here && here.enemy.alive ? heraldCard(here.def, here.enemy.boss?.stance) : null;
  const hurt = events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');
  const judged = trackCapture(tracker, { card: card?.id ?? null, nowMs, hurt, timerMs: card?.timerMs ?? 0 });
  return { tracker: judged.tracker, news: judged.award ? { outcome: judged.award.outcome, coins: captureAward(judged.award.outcome) } : null };
}

export const newCaptureJudge = emptyCapture;
