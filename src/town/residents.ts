import { chaptersCleared, type StoryProgress } from '../core/story';
import type { ChallengeLine } from '../data/dungeons';
import type { NpcSpecies, TownNpc } from '../data/town';
import { WORLD, type WorldMapId } from '../data/world';

/**
 * The Sendas are the residents' wounds (docs/lore/lore.md §4, owner
 * 2026-10-27). A resident says its `lines` until a chapter of its Senda is
 * closed in the save's `story` (the same source the gallery reads), then its
 * `after` lines: it recognises you. A disguised resident (Zorua) keeps its
 * disguise until the whole Senda is done; then it shows as itself and says
 * its `revealed` lines. Pure: the town scene passes the progress in, so no
 * save field or migration is involved.
 */
export const RECOGNISED_AT = 1;
export const REVEALED_AT = 3;

/** What an NPC looks like and says now. */
export interface NpcView {
  species: NpcSpecies;
  /** i18n key of the name on the dialog box. */
  nameKey: string;
  lines: readonly string[];
  rotate?: boolean;
}

export function npcView(npc: TownNpc, story: StoryProgress | undefined): NpcView {
  const own: NpcView = { species: npc.species, nameKey: `town.name.${npc.role}`, lines: npc.lines, ...(npc.rotate ? { rotate: true } : {}) };
  const resident = npc.resident;
  if (!resident) return own;
  const closed = chaptersCleared(story, resident.line);
  if (resident.disguise && closed >= REVEALED_AT) return { ...own, lines: resident.revealed ?? resident.after };
  const lines = closed >= RECOGNISED_AT ? resident.after : npc.lines;
  return resident.disguise ? { ...own, species: resident.disguise.species, nameKey: resident.disguise.nameKey, lines } : { ...own, lines };
}

/** The resident whose wound Senda `line` is, and the map it lives on. */
export function residentOf(line: ChallengeLine): { map: WorldMapId; npc: TownNpc } | null {
  for (const map of Object.values(WORLD)) {
    const npc = map.npcs.find((n) => n.resident?.line === line);
    if (npc) return { map: map.id, npc };
  }
  return null;
}
