import type { ChallengeLine, DungeonDef } from '../data/dungeons';
import type { SimaBand } from '../data/sima';
import type { WorldMapId } from '../data/world';
import type { PlaceIconId } from './icons/place-icons';
import type { PixelIconId } from './pixel-icons';

/**
 * The location plaque's model (.agents/DESIGN.md §4 "Location plaque"): which picture and which look each
 * place wears, how its text lines are put together, and the timing of its entrance. Pure, so a test can walk
 * every place of the game; src/ui/location-plaque.ts is the DOM that draws it.
 */
export type PlaqueVariant = 'stone' | 'town' | 'boss' | 'sima';

/** Warm town, blood-red boss and shrine, eclipse Sima, plain gilt stone everywhere else. */
export const PLAQUE_VARIANTS: readonly PlaqueVariant[] = ['stone', 'town', 'boss', 'sima'];

export type PlaqueIconId = PlaceIconId | PixelIconId;

export interface PlaceDef {
  id: string;
  /** i18n key of the place's name. */
  nameKey: string;
  icon: PlaqueIconId;
  variant: PlaqueVariant;
}

const TOWN_ICONS: Record<WorldMapId, PlaqueIconId> = { refugio: 'refuge', ruinas: 'crypt', mirador: 'lookout', crater: 'crater', lago: 'lake', cienaga: 'swamp' };

/** A map of the town and the roads out of it: always the warm variant. */
export const townPlace = (map: WorldMapId): PlaceDef => ({ id: `town:${map}`, nameKey: `world.map.${map}`, icon: TOWN_ICONS[map], variant: 'town' });

const LINE_ICONS: Record<ChallengeLine, PlaqueIconId> = { abra: 'dream', piplup: 'frost', shinx: 'storm', axew: 'fangs', mimikyu: 'mask', zorua: 'mirror', litwick: 'flame', cubone: 'bone' };

const DUNGEON_ICONS: Record<string, PlaqueIconId> = {
  'crypt-of-the-sword-king': 'crypt',
  'misty-forest': 'forest',
  'flooded-caves': 'caves',
  'toxic-swamp': 'swamp',
  'eclipse-chasm': 'sima',
  'sunken-way': 'stairs',
};

/** A dungeon, a Senda challenge or road (chapters share their line's picture) or the tutorial. */
export function dungeonPlace(def: DungeonDef): PlaceDef {
  const icon = def.challenge ? LINE_ICONS[def.challenge.line] : (DUNGEON_ICONS[def.id] ?? 'dungeons');
  return { id: `dungeon:${def.id}`, nameKey: def.lore.nameKey, icon, variant: def.endless ? 'sima' : 'stone' };
}

const BAND_ICONS: Record<string, PlaqueIconId> = { crypt: 'crypt', forest: 'forest', caves: 'caves', swamp: 'swamp', abyss: 'sima' };

/** A stratum of the Sima: it lends its picture from the dungeon it borrows, under the eclipse look. */
export const simaBandPlace = (band: SimaBand): PlaceDef => ({ id: `sima:${band.id}`, nameKey: band.nameKey, icon: BAND_ICONS[band.id] ?? 'sima', variant: 'sima' });

/** A boss shrine fight. */
export const shrinePlace = (): PlaceDef => ({ id: 'shrine', nameKey: 'shrine.title', icon: 'shrine', variant: 'boss' });

/** Any boss arena (a guardian, a herald, an echo, a Senda's shadow): its own name replaces `plaque.boss`. */
export const BOSS_PLACE: PlaceDef = { id: 'boss', nameKey: 'plaque.boss', icon: 'boss', variant: 'boss' };

export interface PlaqueText {
  /** The place's name, already translated. */
  name: string;
  /** Floor, difficulty or epithet pieces, already translated; joined with " · ". */
  subtitle?: string | readonly string[];
  /** One quiet line under it: a floor's lore, a warning, the escape time. */
  note?: string | null;
}

/** What the DOM draws. */
export interface Plaque {
  icon: PlaqueIconId;
  variant: PlaqueVariant;
  name: string;
  subtitle: string | null;
  note: string | null;
}

export function plaqueOf(place: PlaceDef, text: PlaqueText): Plaque {
  const pieces = (typeof text.subtitle === 'string' ? [text.subtitle] : [...(text.subtitle ?? [])]).filter((piece) => piece.trim() !== '');
  return { icon: place.icon, variant: place.variant, name: text.name, subtitle: pieces.length > 0 ? pieces.join(' · ') : null, note: text.note?.trim() ? text.note : null };
}

export interface PlaqueTiming {
  motion: 'unfurl' | 'fade';
  /** The plate opens from its centre (scaleX 0 to 1). */
  unfurlMs: number;
  /** Icon and text fade-rise this long. */
  riseMs: number;
  iconDelayMs: number;
  textDelayMs: number;
  /** Everything is in place at this age. */
  inMs: number;
  holdMs: number;
  outMs: number;
  totalMs: number;
}

/** Entrance 260 ms ease-out, then icon and text 160 ms staggered; held 2.2 s; leaves up in 300 ms. Reduced motion: a plain fade. */
export function plaqueTiming(reducedMotion: boolean): PlaqueTiming {
  const holdMs = 2200;
  const outMs = 300;
  if (reducedMotion) return { motion: 'fade', unfurlMs: 0, riseMs: 0, iconDelayMs: 0, textDelayMs: 0, inMs: 200, holdMs, outMs, totalMs: 200 + holdMs + outMs };
  const unfurlMs = 260;
  const riseMs = 160;
  const iconDelayMs = unfurlMs;
  const textDelayMs = unfurlMs + 80;
  const inMs = textDelayMs + riseMs;
  return { motion: 'unfurl', unfurlMs, riseMs, iconDelayMs, textDelayMs, inMs, holdMs, outMs, totalMs: inMs + holdMs + outMs };
}

export type PlaquePhase = 'in' | 'hold' | 'out' | 'gone';

export function plaquePhase(timing: PlaqueTiming, ageMs: number): PlaquePhase {
  if (ageMs < 0 || ageMs >= timing.totalMs) return 'gone';
  if (ageMs < timing.inMs) return 'in';
  return ageMs < timing.inMs + timing.holdMs ? 'hold' : 'out';
}
