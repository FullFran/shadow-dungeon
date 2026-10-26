import type { NpcSpecies } from './town';

/**
 * The villagers' pleas before the first descent into the Sima del Eclipse
 * (docs/sima-redesign.md, owner 2026-10-26: «que haya cinemática rollo Mundo
 * Misterioso, hablando con la gente, que te cuenten y que te pidan por
 * favor»). On the crater's rim, the people of the Refugio and the Lago Negro
 * come up to the player one by one, each with the name of someone who never
 * came back (the Sendas' own losses among them), and ask, please, to look
 * for them; Phantump speaks last. Texts: `sima.plea.<id>.<n>`; speakers: the
 * NPCs' own name keys. Played once per device, alone, before the mouth.
 */
export interface PleaActor {
  id: string;
  species: NpcSpecies;
  /** The speaker's name on the dialog box (the town's name key of that NPC). */
  nameKey: string;
  /** How many lines it says. */
  lines: number;
}

export const SIMA_PLEA: readonly PleaActor[] = [
  { id: 'storyteller', species: 'gastly', nameKey: 'town.name.storyteller', lines: 5 },
  { id: 'fisher', species: 'cubone', nameKey: 'town.name.fisher', lines: 3 },
  { id: 'keeper', species: 'litwick', nameKey: 'town.name.keeper', lines: 3 },
  { id: 'shop', species: 'poochyena', nameKey: 'town.name.shop', lines: 3 },
  { id: 'gacha', species: 'mimikyu', nameKey: 'town.name.gacha', lines: 2 },
  { id: 'hermit', species: 'croagunk', nameKey: 'town.name.hermit', lines: 3 },
  { id: 'oracle', species: 'phantump', nameKey: 'town.name.oracle', lines: 3 },
];

/** The i18n keys of an actor's lines, in order. */
export const pleaKeys = (actor: PleaActor): string[] => Array.from({ length: actor.lines }, (_, i) => `sima.plea.${actor.id}.${i + 1}`);

/**
 * Where it happens, in tiles of the crater map (data/world.ts `CRATER`): the
 * player stands below the Sima's mouth; each villager comes
 * up the path from the south edge, stops beside the player to speak,
 * then steps aside to its place in the little crowd.
 */
export const PLEA_STAGE = {
  map: 'crater',
  player: { x: 15.4, y: 17.2 },
  enter: { x: 16, y: 25.5 },
  speak: { x: 16.9, y: 17.4 },
  crowd: [
    { x: 13.2, y: 16.6 },
    { x: 18.8, y: 16.4 },
    { x: 12.4, y: 17.8 },
    { x: 19.8, y: 17.6 },
    { x: 13.6, y: 18.6 },
    { x: 18.4, y: 18.6 },
    { x: 11.4, y: 16.4 },
  ],
} as const;
