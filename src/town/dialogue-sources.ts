import { pleaKeys, replyKey, PLEA_ANSWERS, SIMA_PLEA } from '../data/sima-plea';
import { TOWN_TOUR, tourKeys } from '../data/town-tour';
import { SPRITE_KEYS } from '../data/sprites';
import { WORLD } from '../data/world';
import type { NpcSpecies } from '../data/town';

/**
 * Every place the game speaks through the dialogue box (src/ui/dialogue-box.ts), as data: who speaks, in which i18n
 * keys, and with which Pokémon portrait. The town scene opens its dialogues from the same tables; this list exists so a
 * test can render every one of them in both languages (tests/town/dialogue-model.test.ts) and a new speaker cannot be
 * forgotten. The notice board's lines are composed at run time from the records, so only its heading is listed.
 */
export interface DialogueSource {
  id: string;
  speakerKey: string;
  lineKeys: string[];
  /** Sprite key of the speaker's sheet, for the portrait; none for signs and statues. */
  portrait?: string;
}

const portraitOf = (species: NpcSpecies): string => SPRITE_KEYS[species];

export function dialogueSources(): DialogueSource[] {
  const out: DialogueSource[] = [];
  for (const map of Object.values(WORLD)) {
    for (const npc of map.npcs) {
      const speakerKey = `town.name.${npc.role}`;
      out.push({ id: `npc:${npc.id}`, speakerKey, lineKeys: [...npc.lines], portrait: portraitOf(npc.species) });
      const resident = npc.resident;
      if (!resident) continue;
      // A resident recognises you once a chapter of its Senda is closed (src/town/residents.ts), and a disguised one shows as another.
      const shown = resident.disguise;
      out.push({ id: `npc:${npc.id}:after`, speakerKey: shown?.nameKey ?? speakerKey, lineKeys: [...resident.after], portrait: portraitOf(shown?.species ?? npc.species) });
      if (resident.revealed) out.push({ id: `npc:${npc.id}:revealed`, speakerKey, lineKeys: [...resident.revealed], portrait: portraitOf(npc.species) });
    }
    for (const point of map.lore) out.push({ id: `lore:${point.id}`, speakerKey: point.nameKey, lineKeys: point.lines.map((line) => line.key) });
  }
  for (const actor of SIMA_PLEA) out.push({ id: `plea:${actor.id}`, speakerKey: actor.nameKey, lineKeys: pleaKeys(actor), portrait: portraitOf(actor.species) });
  const oracle = SIMA_PLEA.find((actor) => actor.id === 'oracle');
  if (oracle) for (const answer of PLEA_ANSWERS) out.push({ id: `plea-reply:${answer}`, speakerKey: oracle.nameKey, lineKeys: [replyKey(answer)], portrait: portraitOf(oracle.species) });
  out.push({ id: `tour:${TOWN_TOUR.npcId}`, speakerKey: TOWN_TOUR.nameKey, lineKeys: TOWN_TOUR.stops.flatMap((stop) => tourKeys(stop)), portrait: portraitOf(TOWN_TOUR.species) });
  out.push(
    { id: 'fixed:shrine', speakerKey: 'world.lore.shrine.name', lineKeys: ['world.lore.shrine.1'] },
    { id: 'fixed:beacon', speakerKey: 'town.name.beacon', lineKeys: ['town.beacon.1'] },
    { id: 'fixed:beacon-room', speakerKey: 'town.name.beacon', lineKeys: ['town.beacon.room'] },
    { id: 'fixed:board', speakerKey: 'town.name.board', lineKeys: ['endless.board.title'] },
    { id: 'fixed:lobby-host', speakerKey: 'lobby.room', lineKeys: ['lobby.hostOnly'] },
  );
  return out;
}
