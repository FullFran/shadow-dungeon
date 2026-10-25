import { heraldCard, heraldOf } from '../core/herald/brain';
import type { EnemyState, WorldState } from '../core/state';
import type { Bilingual, HeraldDef } from '../data/herald';
import { getLanguage } from '../i18n';

/**
 * The game screen's side of a herald fight (core/herald): its texts in the
 * player's language and the card banner. Captures are every card boss's
 * (core/cards.ts `updateCapture`, counted by core/coins.ts).
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
