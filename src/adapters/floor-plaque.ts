import { DEFAULT_DIFFICULTY, type Difficulty } from '../data/difficulty';
import { t } from '../i18n';
import { BOSS_PLACE, plaqueOf, shrinePlace, type Plaque, type PlaceDef } from '../ui/location-plaque-model';
import { cardLines, type FloorCard } from './card';
import { floorLabel } from './hud';
import type { DungeonIntro } from './intro-card';

/**
 * What the location plaque says on entering a floor, a stratum of the Sima or a boss arena (ui/location-plaque.ts).
 * It replaces the floor card and the dungeon title that used to be drawn over the view; the texts are the same ones
 * (src/adapters/card.ts, the dungeon's lore and subtitle), laid out as name, floor line and a quiet note.
 */
/** A floor whose dungeon is unknown (a card without a place): the generic dungeon picture, plain stone. */
const PLAIN_FLOOR: PlaceDef = { id: 'floor', nameKey: 'app.title', icon: 'dungeons', variant: 'stone' };

const tier =(difficulty: Difficulty): string | null => (difficulty === DEFAULT_DIFFICULTY ? null : t(`difficulty.${difficulty}`));

const join = (pieces: readonly (string | null | undefined)[]): string | null => {
  const kept = pieces.filter((piece): piece is string => !!piece);
  return kept.length > 0 ? kept.join(' · ') : null;
};

/** A floor reached by the stairs: «Cripta del Rey Espada», «Planta 6», its lore (and the collapse warning or escape time first). */
export function cardPlaque(card: FloorCard, difficulty: Difficulty): Plaque {
  const lines = cardLines(card);
  return plaqueOf(card.place ?? PLAIN_FLOOR,{ name: lines.dungeon, subtitle: [lines.floor, tier(difficulty) ?? ''], note: join([lines.warning, lines.bonus, lines.lore]) });
}

/** A place's own title (floor 1 of a dungeon, the first floor of a Sima stratum): its name, the floor, its poetic subtitle and the floor's lore. */
export function introPlaque(intro: DungeonIntro, floor: number, difficulty: Difficulty): Plaque {
  return plaqueOf(intro.place ?? BOSS_PLACE, { name: intro.name, subtitle: [floorLabel(floor), tier(difficulty) ?? '', intro.subtitle], note: intro.lore ?? null });
}

/** A boss arena (a guardian, a herald, an echo, a Senda's shadow, a shrine fight): the blood plaque, its epithet, and the floor it stands on. */
export function bossPlaque(intro: DungeonIntro, floor: number, shrine: boolean): Plaque {
  return plaqueOf(shrine ? shrinePlace() : BOSS_PLACE, { name: intro.name, subtitle: intro.subtitle || t(BOSS_PLACE.nameKey), note: shrine ? null : floorLabel(floor) });
}
