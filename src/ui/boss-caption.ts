import { BOSS_CUES, cueOf, type BossCue } from '../data/boss-lore';
import { cardInfo, isHeraldCard } from '../data/cards';
import { spellCardKey } from '../data/enemies';
import type { SpeciesId } from '../data/species';
import { t } from '../i18n';

/**
 * The announcement of a boss event (.agents/DESIGN.md §4 "Combat HUD"): the move's name large between ornamental
 * brackets, the sign it belongs to small under it ("Signo Gema" + a seal icon), and one telegraph cue (an icon and a
 * line saying how to read it). Pure: the model that `adapters/combat-hud.ts` draws.
 */
export interface BossCaption {
  /** The move's own name ("Destello del Ladrón"). */
  name: string;
  /** Its sign or school ("Signo Gema"); a generic omen when the text carries none. */
  sign: string;
  cue: BossCue;
}

/** `Signo Gema «Destello del Ladrón»` (or `Gem Sign "Thief's Glint"`) -> sign and name. */
const SPLIT = /^(.*?)\s*[«“"](.+?)[»”"]\s*$/;

const has = (key: string): boolean => t(key) !== key;

/**
 * The caption of event `stance` of `species` (null species: a registered card alone). A herald's cards take the
 * generated name it carries (`heraldName`). Null only for a stance that has no name at all.
 */
export function bossCaption(stance: string, species: SpeciesId | string | null, heraldName?: string): BossCaption | null {
  if (isHeraldCard(stance)) return { name: heraldName ?? t('boss.stance.herald'), sign: t('boss.sign.herald'), cue: cueOf(stance) };
  const key = cardInfo(stance)?.nameKey ?? (species ? spellCardKey(species as SpeciesId, stance) : null);
  const full = key && has(key) ? t(key) : has(`boss.stance.${stance}`) ? t(`boss.stance.${stance}`) : null;
  if (!full) return null;
  const parts = SPLIT.exec(full);
  return parts ? { sign: parts[1]!, name: parts[2]!, cue: cueOf(stance) } : { sign: t('boss.sign.omen'), name: full, cue: cueOf(stance) };
}

export { BOSS_CUES };

/** Entrance 160 ms, hold 1.6 s, exit 240 ms: the floor telegraph is the information, the strip only names it. */
export const CAPTION_MS = { enter: 160, hold: 1600, exit: 240 } as const;
export const CAPTION_LIFE_MS = CAPTION_MS.enter + CAPTION_MS.hold + CAPTION_MS.exit;

/** Opacity at `ageMs` since the caption appeared. */
export function captionAlpha(ageMs: number): number {
  if (ageMs <= 0) return 0;
  if (ageMs < CAPTION_MS.enter) return ageMs / CAPTION_MS.enter;
  if (ageMs < CAPTION_MS.enter + CAPTION_MS.hold) return 1;
  const out = ageMs - CAPTION_MS.enter - CAPTION_MS.hold;
  return out >= CAPTION_MS.exit ? 0 : 1 - out / CAPTION_MS.exit;
}

/** Reduced motion: the same fade, with no slide and no settle (see `captionMotion`). */
export const captionAlphaReduced = captionAlpha;

/** How the caption moves: opacity, a settle from larger (the seal pressed down) and a rule that draws out. None of the last two when `reduced`. */
export function captionMotion(ageMs: number, reduced: boolean): { alpha: number; settle: number; rule: number } {
  const alpha = captionAlpha(ageMs);
  if (reduced) return { alpha, settle: 0, rule: 1 };
  return { alpha, settle: Math.max(0, 1 - ageMs / (CAPTION_MS.enter + 80)), rule: Math.min(1, ageMs / (CAPTION_MS.enter * 1.5)) };
}
