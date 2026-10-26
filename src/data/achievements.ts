import { DIFFICULTIES, type Difficulty } from './difficulty';
import { CHALLENGES, DUNGEONS, guardianOf, type DungeonDef, type DungeonId } from './dungeons';
import { PLAYER_AWAKENINGS, PLAYER_EVOLUTIONS } from './player-evolutions';
import { SIMA_BANDS } from './sima';
import { PLAYABLE_SPECIES, type SpeciesId } from './species';

/**
 * Achievements (logros, odd/tasks/achievements-missions.md), as data
 * generated from the content lists: a new dungeon, challenge, species,
 * evolution, awakening or Sima stratum gets its achievements with no edit here. The
 * rules are evaluated by core/achievements.ts from run-end reports and the
 * save; a few pay a small Pokémonedas reward, none gives power. Names come
 * from i18n templates (`achievement.<family>.title`) filled with the
 * content's own names. Provisional rewards.
 */
export type AchievementRule =
  /** Win `dungeon` on `tier` or above. */
  | { kind: 'clear'; dungeon: DungeonId; tier: Difficulty }
  /** Win `dungeon` taking no hit on its guardian's floor. */
  | { kind: 'flawless'; dungeon: DungeonId }
  /** Reach `floor` of the endless `dungeon`, any outcome. */
  | { kind: 'depth'; dungeon: DungeonId; floor: number }
  /** Win any dungeon as `species`. */
  | { kind: 'species'; species: SpeciesId }
  /** Own `species` (an evolved form) or a later form of its line. */
  | { kind: 'evolve'; species: SpeciesId }
  /** Awaken `species` (one that never evolves) to its `step`-th awakening or further. */
  | { kind: 'awaken'; species: SpeciesId; step: number }
  /** Own any gacha species. */
  | { kind: 'firstPull' }
  /** Own every gacha line. */
  | { kind: 'collectAll' }
  /** Win any dungeon in a party of two or more. */
  | { kind: 'coop' }
  /** Earn `coins` Pokémonedas in total (spending never lowers it). */
  | { kind: 'earned'; coins: number }
  /** Hidden: fall on the very first floor. */
  | { kind: 'stumble' };

export type AchievementFamily = 'clear' | 'flawless' | 'depth' | 'species' | 'evolve' | 'gacha' | 'coop' | 'coins' | 'secret';

/** The families in the order the achievements window lists them. */
export const ACHIEVEMENT_FAMILIES: readonly AchievementFamily[] = ['clear', 'flawless', 'depth', 'species', 'evolve', 'gacha', 'coop', 'coins', 'secret'];

export interface AchievementDef {
  id: string;
  family: AchievementFamily;
  rule: AchievementRule;
  /** Pokémonedas paid once on unlock (0: none). */
  reward: number;
  /** Shown as "???" until unlocked. */
  hidden?: true;
}

export const ACHIEVEMENT_REWARDS = {
  clear: { easy: 0, normal: 20, hard: 40, nightmare: 80 } as Readonly<Record<Difficulty, number>>,
  flawless: 50,
  depth: 30,
  species: 0,
  evolve: 20,
  firstPull: 0,
  collectAll: 50,
  coop: 30,
  stumble: 10,
} as const;

/** Lifetime Pokémonedas milestones. */
export const EARNED_MILESTONES: readonly number[] = [1000, 5000, 20000, 100000];

/** Every dungeon a run can win: the main ones with a last floor and every challenge (the endless one has none). */
export const clearableDungeons = (): DungeonDef[] => [...DUNGEONS, ...CHALLENGES].filter((d) => !d.endless);

function generate(): AchievementDef[] {
  const clearable = clearableDungeons();
  return [
    ...clearable.flatMap((d) => DIFFICULTIES.map((tier): AchievementDef => ({ id: `clear-${d.id}-${tier}`, family: 'clear', rule: { kind: 'clear', dungeon: d.id, tier }, reward: ACHIEVEMENT_REWARDS.clear[tier] }))),
    ...clearable.filter((d) => guardianOf(d) !== null).map((d): AchievementDef => ({ id: `flawless-${d.id}`, family: 'flawless', rule: { kind: 'flawless', dungeon: d.id }, reward: ACHIEVEMENT_REWARDS.flawless })),
    ...DUNGEONS.filter((d) => d.endless).flatMap((d) =>
      SIMA_BANDS.slice(1).map((band): AchievementDef => ({ id: `depth-${d.id}-${band.fromFloor}`, family: 'depth', rule: { kind: 'depth', dungeon: d.id, floor: band.fromFloor }, reward: ACHIEVEMENT_REWARDS.depth })),
    ),
    ...PLAYABLE_SPECIES.map((species): AchievementDef => ({ id: `species-${species}`, family: 'species', rule: { kind: 'species', species }, reward: ACHIEVEMENT_REWARDS.species })),
    ...PLAYER_EVOLUTIONS.map((e): AchievementDef => ({ id: `evolve-${e.to}`, family: 'evolve', rule: { kind: 'evolve', species: e.to }, reward: ACHIEVEMENT_REWARDS.evolve })),
    ...(Object.entries(PLAYER_AWAKENINGS) as [SpeciesId, readonly unknown[]][]).flatMap(([species, steps]) =>
      steps.map((_, i): AchievementDef => ({ id: `awaken-${species}-${i + 1}`, family: 'evolve', rule: { kind: 'awaken', species, step: i + 1 }, reward: ACHIEVEMENT_REWARDS.evolve })),
    ),
    { id: 'gacha-first-pull', family: 'gacha', rule: { kind: 'firstPull' }, reward: ACHIEVEMENT_REWARDS.firstPull },
    { id: 'gacha-collect-all', family: 'gacha', rule: { kind: 'collectAll' }, reward: ACHIEVEMENT_REWARDS.collectAll },
    { id: 'coop-clear', family: 'coop', rule: { kind: 'coop' }, reward: ACHIEVEMENT_REWARDS.coop },
    ...EARNED_MILESTONES.map((coins): AchievementDef => ({ id: `earned-${coins}`, family: 'coins', rule: { kind: 'earned', coins }, reward: 0 })),
    { id: 'secret-stumble', family: 'secret', rule: { kind: 'stumble' }, reward: ACHIEVEMENT_REWARDS.stumble, hidden: true },
  ];
}

export const ACHIEVEMENTS: readonly AchievementDef[] = generate();

const BY_ID = new Map(ACHIEVEMENTS.map((d) => [d.id, d]));

export const achievementById = (id: string): AchievementDef | null => BY_ID.get(id) ?? null;
