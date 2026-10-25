import type { SpeciesId } from './species';

/**
 * What each dungeon guardian says (i18n keys): its epithet for the name card,
 * a few words before the fight and its last words after it, with a hint of
 * what lies deeper. Short and mythic; the thing under the earth is never
 * named (docs/gdd.md §3, "Prólogo y trasfondo").
 */
export interface GuardianLore {
  species: SpeciesId;
  titleKey: string;
  preKeys: readonly string[];
  postKeys: readonly string[];
}

const lore = (species: SpeciesId): GuardianLore => ({
  species,
  titleKey: `guardian.${species}.title`,
  preKeys: [`guardian.${species}.pre.1`, `guardian.${species}.pre.2`],
  postKeys: [`guardian.${species}.post.1`, `guardian.${species}.post.2`],
});

export const GUARDIANS: Partial<Record<SpeciesId, GuardianLore>> = {
  aegislash: lore('aegislash'),
  decidueye: lore('decidueye'),
};
