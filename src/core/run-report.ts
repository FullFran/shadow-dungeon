import type { Difficulty } from '../data/difficulty';
import type { DungeonId } from '../data/dungeons';
import type { SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';
import type { EnemyState, WorldState } from './state';

/**
 * What achievements and missions read from a finished run
 * (odd/tasks/achievements-missions.md), pure. Every peer builds its own from
 * its own run summary: nothing goes over the network.
 */
export type KillsByType = Readonly<Partial<Record<PokemonType, number>>>;

export interface RunReport {
  dungeon: DungeonId;
  outcome: 'victory' | 'defeat' | 'eclipse';
  /** The floor the run ended on (the last one on a victory). */
  floor: number;
  difficulty: Difficulty;
  /** The species this peer played. */
  species: SpeciesId;
  /** Played in a party of two or more. */
  coop: boolean;
  /** Enemies this peer saw fall, per type (an enemy of two types counts for both). */
  kills: KillsByType;
  /** The guardian's floor was cleared with no hit taken on it. */
  guardianNoHit: boolean;
}

/** After a step: the types of the enemies credited since `before` (the same rule that pays experience and Pokémonedas). */
export function tallyKills(kills: KillsByType, before: Pick<WorldState, 'credited'>, after: { credited: readonly string[]; enemies: readonly Pick<EnemyState, 'id' | 'types'>[] }): KillsByType {
  const fresh = after.credited.filter((id) => !before.credited.includes(id));
  if (fresh.length === 0) return kills;
  const next: Partial<Record<PokemonType, number>> = { ...kills };
  for (const id of fresh) for (const type of after.enemies.find((e) => e.id === id)?.types ?? []) next[type] = (next[type] ?? 0) + 1;
  return next;
}

/** The run summary's part a report needs (app/game.ts `RunSummary`); older fields absent read as none. */
export interface ReportSource {
  dungeon: DungeonId;
  floor: number;
  difficulty: Difficulty;
  kills?: KillsByType;
  guardianNoHit?: boolean;
  coop?: boolean;
}

export const runReport = (summary: ReportSource, outcome: RunReport['outcome'], species: SpeciesId): RunReport => ({
  dungeon: summary.dungeon,
  outcome,
  floor: summary.floor,
  difficulty: summary.difficulty,
  species,
  coop: summary.coop === true,
  kills: summary.kills ?? {},
  guardianNoHit: summary.guardianNoHit === true,
});
