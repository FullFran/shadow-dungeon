import type { ChallengeLine, DungeonDef } from '../data/dungeons';
import type { SimaBand } from '../data/sima';
import type { WorldMapId } from '../data/world';
import type { PlaceIconId } from './icons/place-icons';
import { HUD_BOX, statusRect } from './hud-layout';
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

/** The plaque's type and icon sizes, CSS px (`note` 0: the note line is not shown). */
export interface PlaqueMetrics {
  name: number;
  sub: number;
  note: number;
  icon: number;
  /** The icon frame around the art. */
  frame: number;
}

/**
 * The plaque follows the HUD scale rule (src/ui/hud-layout.ts `hudScaleFor`): the size it always had (22 px name, 32 px
 * icon) at scale 1, 24/36 at 1.5 (1280x720, 1440x900) and 26/40 at 2 (1920x1080 and up), so it stays in proportion with the
 * minimal HUD and is never invasive. A phone held sideways keeps the small plaque.
 */
export function plaqueMetrics(hudScale: number, touch: boolean): PlaqueMetrics {
  if (touch) return { name: 18, sub: 14, note: 0, icon: 32, frame: 40 };
  if (hudScale >= 2) return { name: 26, sub: 18, note: 15, icon: 40, frame: 52 };
  if (hudScale >= 1.5) return { name: 24, sub: 17, note: 14, icon: 36, frame: 48 };
  // Under scale 1.5 the window is small: the quiet note line steps aside so the plaque stays clear of the boss announcement.
  return { name: 22, sub: 16, note: 0, icon: 32, frame: 44 };
}

/** The widest a plaque may be, CSS px: 34 rem, and always clear of the status block and the minimap column. */
export function plaqueMaxWidth(cssWidth: number, cssHeight: number, hudUnit: number, touch: boolean): number {
  const status = statusRect({ height: cssHeight / hudUnit }, touch);
  // A 40 x 28 minimap is the widest column on the right.
  const minimap = HUD_BOX.minimapMargin + 40 * (touch ? HUD_BOX.minimapTilePxTouch : HUD_BOX.minimapTilePx) + 2 * HUD_BOX.minimapFrame;
  const side = Math.max(status.x + status.width, minimap) * hudUnit + 8;
  return Math.max(160, Math.min(touch ? 26 * 16 : 34 * 16, cssWidth - 32, cssWidth - 2 * side));
}

/**
 * The largest box the plaque can take (name, rule, subtitle and note showing), CSS px, so a test can prove it keeps clear of
 * the status block, the minimap and the boss strip. `hudUnit` is CSS px per HUD px.
 */
export function plaqueBox(cssWidth: number, cssHeight: number, hudUnit: number, touch: boolean): { x: number; y: number; width: number; height: number } {
  const m = plaqueMetrics(hudUnit, touch);
  const width = plaqueMaxWidth(cssWidth, cssHeight, hudUnit, touch);
  const text = m.name * 1.1 + 3 + 5 + 3 + m.sub * 1.15 + (m.note > 0 ? 3 + m.note * 1.2 : 0);
  const body = Math.max(m.frame, text) + (touch ? 10 : 16) + 4;
  return { x: (cssWidth - width) / 2, y: touch ? 6 : 12, width, height: body };
}
