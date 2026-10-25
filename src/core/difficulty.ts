import type { SpawnTuning } from '../data/dungeon';
import { DEFAULT_DIFFICULTY, ELITE_TRAIT_DEFS, ELITE_TRAITS, scaledTelegraphMs, TIERS, type Difficulty, type EliteTrait, type TierDef } from '../data/difficulty';
import { TUNING } from '../data/tuning';
import { deriveSeed, nextRandom } from './rng';
import type { AiState, EnemyState, WorldState } from './state';

/** The run's difficulty tier; worlds created before tiers existed are `easy`. */
export const worldDifficulty = (state: Pick<WorldState, 'difficulty'>): Difficulty => state.difficulty ?? DEFAULT_DIFFICULTY;

export const tierOf = (state: Pick<WorldState, 'difficulty'>): TierDef => TIERS[worldDifficulty(state)];

/** A dungeon's enemy table with the tier's extra enemies per room (the cap rises with them). */
export function tieredSpawns(tuning: SpawnTuning, d: Difficulty): SpawnTuning {
  const extra = TIERS[d].extraPerRoom;
  return extra === 0 ? tuning : { ...tuning, base: tuning.base + extra, maxPerRoom: tuning.maxPerRoom + extra };
}

/** Salt that keeps the elite draw independent of the floor generator. */
const ELITE_SALT = 0xe117e;

/**
 * Whether spawn `index` of the floor generated from `floorSeed` is an elite,
 * and its trait: a pure draw from the seed (no world RNG), so every peer of a
 * shared run makes the same elites without sending anything.
 */
export function eliteFor(floorSeed: number, index: number, d: Difficulty): EliteTrait | null {
  const chance = TIERS[d].eliteChance;
  if (chance <= 0) return null;
  const roll = nextRandom(deriveSeed(floorSeed, ELITE_SALT + index));
  if (roll.value >= chance) return null;
  return ELITE_TRAITS[Math.floor(nextRandom(roll.state).value * ELITE_TRAITS.length)]!;
}

/** Max HP share of an elite trait (1 for none). */
export const eliteHp = (trait: EliteTrait | undefined): number => (trait ? ELITE_TRAIT_DEFS[trait].hp : 1);

/**
 * One step of an enemy's AI clocks at tier `d`: a telegraph runs through its
 * planned length faster (so it lasts `scaledTelegraphMs`, never below the
 * floor), and cooldowns run out faster with the tier's aggression (and a
 * frenzied elite's). Easy is the plain clock.
 */
export function tickAiAt(ai: AiState, ms: number, d: Difficulty, elite?: EnemyState['elite']): AiState {
  const tier = TIERS[d];
  const cooldownShare = tier.cooldown * (elite ? ELITE_TRAIT_DEFS[elite].cooldown : 1);
  const telegraphRate = ai.mode === 'telegraph' && ai.modeDurationMs > 0 && tier.telegraph !== 1 ? ai.modeDurationMs / scaledTelegraphMs(ai.modeDurationMs, d) : 1;
  return {
    ...ai,
    modeMs: ai.modeMs + (telegraphRate === 1 ? ms : ms * telegraphRate),
    cooldownMs: Math.max(0, ai.cooldownMs - (cooldownShare === 1 ? ms : ms / cooldownShare)),
  };
}

/** A player's roll at tier `d` (`PlayerState.rollTier`), or null when it is the tuning's own (easy, normal). */
export function rollTierOf(d: Difficulty): { iframesEndMs: number; staminaCost: number } | null {
  const { iframes, stamina } = TIERS[d].roll;
  if (iframes === 1 && stamina === 1) return null;
  const { iframesStartMs, iframesEndMs } = TUNING.roll;
  return { iframesEndMs: iframesStartMs + (iframesEndMs - iframesStartMs) * iframes, staminaCost: stamina };
}

/** Solo "Restart floor" uses left on this floor after `used`; null = unlimited (easy and normal). */
export function restartsLeft(d: Difficulty, used: number): number | null {
  const per = TIERS[d].restartsPerFloor;
  return per === null ? null : Math.max(0, per - used);
}

/** A set-piece encounter's chance (or weight) `base` at tier `d`: scaled by the tier, capped at 1 when it is a probability. */
export function encounterChance(base: number, d: Difficulty, probability = true): number {
  const scaled = base * TIERS[d].encounters.frequency;
  return probability ? Math.min(1, scaled) : scaled;
}

/** Waves of a wave room planned with `base` waves, at tier `d`. */
export const encounterWaves = (base: number, d: Difficulty): number => base + TIERS[d].encounters.extraWaves;
