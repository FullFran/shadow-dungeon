import type { PortraitEmotion } from './portraits';
import { SPECIES, type SpeciesId } from './species';
import { lookKey, SPRITE_KEYS, SPRITES, type BaseSpriteKey } from './sprites';

/**
 * Who says a dialogue line, and with which face (issue #47, odd/tasks/pmd-portraits.md S4-S6, S9). Pure: the views
 * (dialogue box, cinematic player, in-dungeon story box) turn the result into a Mystery Dungeon portrait.
 *
 * The Sendas' writers name the speaker in the line itself: `Drowzee: «…»` (en `Drowzee: "…"`) is Drowzee, also after a
 * lead-in (`Bisharp se aparta: «…»`, by its first word); an unnamed quote, or a lead-in that names no species, is the
 * line's own Pokémon (`self`); a line with no quote is narration (no portrait). The same rule reads
 * both languages, and tests/data/dialogue-speakers.test.ts checks they agree for every line.
 */

/** The moment a line is said in, which decides the face (S6: the right emotion when the moment has one, Normal otherwise). */
export type DialogueMoment = 'line' | 'arrive' | 'mid' | 'lowHp' | 'bond' | 'bossPre' | 'bossPost';

export type Speaker = { kind: 'self' } | { kind: 'species'; sprite: string };

export interface SpokenLine {
  speaker: Speaker;
  emotion: PortraitEmotion;
}

/** Dialogue sources (src/town/dialogue-sources.ts) with no speaker: signs and statues, the shrine, the beacon, the board, the lobby. */
export const SPEAKERLESS_SOURCES: readonly string[] = ['lore:', 'fixed:'];

/** Who never shows a portrait: the narrated cinematics (the prologue and the Sima: narration and the Voice) and Tu Sombra, an ink mass with no face. */
export const NARRATED: { cinematics: readonly string[]; guardians: readonly string[] } = { cinematics: ['prologue', 'sima'], guardians: ['shadow-self'] };

const OPEN = '«"“';
const CLOSE = '»"”';

/** A name as a lookup key: letters only, lower case ("Mr. Mime" and "mr-mime" are both "mrmime"). */
const norm = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, '');

/** Species name to its base sheet ("dddd/ffff"), the first form by key (Aegislash's Shield Forme). */
const BY_NAME: ReadonlyMap<string, string> = (() => {
  const out = new Map<string, string>();
  for (const key of Object.keys(SPRITES.sprites).sort()) {
    if (key.split('/').length !== 2) continue;
    const name = norm(SPRITES.sprites[key]!.species);
    if (!out.has(name)) out.set(name, key);
  }
  return out;
})();

/** The sheet of the species a speaker's name calls (a longer lead-in, "Bisharp se aparta", by its first word), or null. */
export function speakerSprite(name: string): string | null {
  return BY_NAME.get(norm(name)) ?? BY_NAME.get(norm(name.split(/\s+/)[0] ?? '')) ?? null;
}

/** The first quote of a line and the name that introduces it (`Name: «…»`), or null when nobody speaks in it. */
export function parseSpeech(text: string): { name: string | null; quote: string; whole: boolean } | null {
  const trimmed = text.trim();
  const open = [...trimmed].findIndex((c) => OPEN.includes(c));
  if (open < 0) return null;
  const chars = [...trimmed];
  const closeAt = chars.findIndex((c, i) => i > open && CLOSE.includes(c));
  const end = closeAt < 0 ? chars.length : closeAt;
  const quote = chars.slice(open + 1, end).join('').trim();
  const lead = chars.slice(0, open).join('');
  // The name is the last clause before the colon: after the previous sentence's end, if any.
  const named = /(?:^|[.!?…]\s+)([^.!?…:]+):\s*$/u.exec(lead);
  const name = named ? named[1]!.trim() : null;
  const whole = closeAt >= chars.length - 1 && (named ? named.index === 0 : lead.trim() === '');
  return { name, quote, whole };
}

/** The face a moment calls for; `self` is the player's own Pokémon (a boss feels the fight differently). */
export function momentEmotion(moment: DialogueMoment, self: boolean): PortraitEmotion {
  switch (moment) {
    case 'lowHp':
      return 'Pain';
    case 'mid':
      return 'Worried';
    case 'bond':
      return 'Happy';
    case 'bossPre':
      return self ? 'Worried' : 'Determined';
    case 'bossPost':
      return self ? 'Normal' : 'Pain';
    default:
      return 'Normal';
  }
}

/**
 * Who says a line and with which face; null for narration. A lead-in that names no species ("Desde dentro del trapo:
 * «…»", "Luego, muy rápido: «…»") introduces the line's own Pokémon, like an unnamed quote.
 */
export function spokenLine(text: string, moment: DialogueMoment): SpokenLine | null {
  const speech = parseSpeech(text);
  if (!speech) return null;
  const sprite = speech.name ? speakerSprite(speech.name) : null;
  const speaker: Speaker = sprite ? { kind: 'species', sprite } : { kind: 'self' };
  return { speaker, emotion: momentEmotion(moment, speaker.kind === 'self') };
}

/** A guardian's cinematic panels that it speaks, and its face in each: its warning, its challenge, its fall, what it saw below. */
const GUARDIAN_PANELS: Readonly<Record<string, PortraitEmotion>> = { door: 'Normal', gaze: 'Determined', fall: 'Pain', below: 'Worried' };

/** The guardian's portrait on a panel of its cinematic, or null (its name card, or a guardian with no face). */
export function guardianLine(species: SpeciesId, panelId: string): { sprite: string; emotion: PortraitEmotion } | null {
  if (NARRATED.guardians.includes(species)) return null;
  const emotion = GUARDIAN_PANELS[panelId];
  const sprite = speakerSprite(species);
  return emotion && sprite ? { sprite, emotion } : null;
}

/** The player's Pokémon as it looks (the run's species, its shiny skin, its female look). */
export interface PlayerLook {
  species: SpeciesId;
  shiny?: boolean;
  female?: boolean;
}

/** The sprite key whose portrait a speaker shows: the player's own look for itself (also when named), the base look of anyone else. */
export function speakerLook(speaker: Speaker, me: PlayerLook): string {
  const mine = SPRITE_KEYS[SPECIES[me.species].sprite] as BaseSpriteKey;
  if (speaker.kind === 'self' || speaker.sprite === mine) return lookKey(mine, me.shiny ?? false, me.female ?? false);
  return speaker.sprite;
}

/**
 * The face beside a line said in a run (S5): `text` null is the inner voice (always the player); otherwise the line's
 * speaker, the player as it looks when the line names it, and the moment's emotion as that speaker feels it.
 */
export function lineFace(text: string | null, moment: DialogueMoment, me: PlayerLook): { sprite: string; emotion: PortraitEmotion } | null {
  const speaker = text === null ? ({ kind: 'self' } as const) : spokenLine(text, moment)?.speaker;
  if (!speaker) return null;
  const sprite = speakerLook(speaker, me);
  const self = sprite === speakerLook({ kind: 'self' }, me);
  return { sprite, emotion: momentEmotion(moment, self) };
}
