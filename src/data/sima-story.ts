import type { ChallengeLine } from './dungeons';
import type { MusicContext } from './music';
import { ROOMS, type RoomId } from './rooms';
import type { SpeciesId } from './species';
import { STORY_BOSSES } from './story/bosses';

/**
 * The Sendas' bosses in the Sima del Eclipse (docs/sima-redesign.md §4): the
 * shadows of those who went down and never came back, and their wounds. The
 * pools are read from the Senda data (`STORY_BOSSES`, plus Mimikyu's wound,
 * which predates the kit), so a new Senda's bosses join the Sima by being in
 * the data. Which boss stands on a floor depends only on the run seed
 * (core/sima-story.ts); what the player sees of it (a name, or «Sombra de
 * alguien») depends on their own memory (app/sima-lore.ts).
 */
export interface SimaStoryBoss {
  species: SpeciesId;
  /** Its own arena from the Senda (the shadow's has its way on at the top; the Sima opens one for a wound too). */
  room: RoomId;
  /** Its sheet: two bosses on one sheet (Bisharp) never come out in the same turn of the bag. */
  sprite: string;
  /** The Senda it belongs to (its name shows once that Senda is closed). */
  line: ChallengeLine;
  wound: boolean;
}

/** The arena that holds `species` (the Senda rooms hold one boss each). */
function roomOf(species: string): RoomId {
  const found = (Object.keys(ROOMS) as RoomId[]).find((id) => ROOMS[id].spawns.length === 1 && ROOMS[id].spawns[0]!.species === species);
  if (!found) throw new Error(`no arena holds ${species}`);
  return found;
}

const lineOf = (species: string): ChallengeLine => species.slice(0, species.indexOf('-')) as ChallengeLine;

const fromStory: readonly SimaStoryBoss[] = STORY_BOSSES.map((b) => ({ species: b.id as SpeciesId, room: roomOf(b.id), sprite: b.sprite, line: lineOf(b.id), wound: b.wound === true }));

/** Mimikyu Sin Disfraz: the first wound, built before the Senda kit (data/wound-cards.ts). */
const MIMIKYU_WOUND: SimaStoryBoss = { species: 'mimikyu-wound', room: roomOf('mimikyu-wound'), sprite: 'mimikyuBusted', line: 'mimikyu', wound: true };

/** Every Senda shadow (the mid-bosses of every road). */
export const SIMA_SHADOWS: readonly SimaStoryBoss[] = fromStory.filter((b) => !b.wound);

/** Every Senda wound (the last boss of every Senda). */
export const SIMA_WOUNDS: readonly SimaStoryBoss[] = [MIMIKYU_WOUND, ...fromStory.filter((b) => b.wound)];

/** The Sima rules of the Sendas' bosses (values provisional, docs/sima-redesign.md §4). */
export interface SimaStoryDef {
  /**
   * Wounds take the guardian echo's place on the wound floors (data/endless.ts
   * `wounds`: 35, 55, 75...), with the echo's time bonus and its way on at
   * the top; the guardians keep the others (45, 65, 85...). Their track:
   */
  wounds: { music: MusicContext };
  /**
   * «Sombra extraviada»: from `fromFloor`, a generated floor (never an echo or
   * herald floor) may instead be a lost shadow's arena behind its fog wall,
   * with a way down in the antechamber (optional: the party may walk past).
   * Felling it pays `bonusMs` and an item pick. Chance per floor: `chance`.
   */
  strays: { fromFloor: number; chance: number; bonusMs: number; music: MusicContext };
  /**
   * HP of a Senda boss in the Sima: `hp` of its Senda fight's on the run's
   * tier, whatever the depth (the depth raises only its damage), so its kill
   * margin is proven on its first Sima floor for every deeper one too
   * (tests/sim/sima-story-prove.test.ts). It plays its whole tier's fight.
   */
  hp: number;
}

export const SIMA_STORY: SimaStoryDef = {
  wounds: { music: 'forest-guardian' },
  strays: { fromFloor: 12, chance: 0.07, bonusMs: 20_000, music: 'guardian' },
  hp: 0.6,
};

/** The Senda boss an arena holds in the Sima, if it is one. */
export const simaStoryBossOf = (room: RoomId): SimaStoryBoss | undefined => SIMA_SHADOWS.find((b) => b.room === room) ?? SIMA_WOUNDS.find((b) => b.room === room);
