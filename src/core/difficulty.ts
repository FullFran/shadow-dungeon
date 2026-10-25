import type { SpawnTuning } from '../data/dungeon';
import { DEFAULT_DIFFICULTY, ELITE_TRAIT_DEFS, ELITE_TRAITS, scaledTelegraphMs, TELEGRAPH_FLOOR, TIERS, type Difficulty, type EliteRule, type EliteTrait, type TierDef } from '../data/difficulty';
import { ENEMY_BEHAVIOUR } from '../data/enemies';
import type { SpeciesId } from '../data/species';
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
  return drawElite(floorSeed, index, tierEliteRule(d))?.trait ?? null;
}

/** The elites of a regular dungeon's floor at tier `d`: the tier's chance, the tier's traits, no HP bonus beyond the trait's. */
export const tierEliteRule = (d: Difficulty): EliteRule => ({ chance: TIERS[d].eliteChance, traits: ELITE_TRAITS, hpScale: 1, pierceRollChance: 0 });

/** The traits of `traits` an enemy of `species` may draw (volley only for casters). */
export function fittingTraits(traits: readonly EliteTrait[], species?: SpeciesId): readonly EliteTrait[] {
  const kind = species ? ENEMY_BEHAVIOUR[species]?.kind : undefined;
  return traits.filter((t) => {
    const only = ELITE_TRAIT_DEFS[t].onlyKind;
    return !only || only === kind;
  });
}

/**
 * The one elite draw of the game (tiers and the Sima alike): whether spawn
 * `index` of the floor generated from `floorSeed` is an elite under `rule`,
 * its trait (one that fits its species) and whether it strikes positionally.
 * A pure draw from the seed (no world RNG), so every peer of a shared run
 * makes the same elites.
 */
export function drawElite(floorSeed: number, index: number, rule: EliteRule, species?: SpeciesId): { trait: EliteTrait; pierceRoll: boolean } | null {
  if (rule.chance <= 0) return null;
  const roll = nextRandom(deriveSeed(floorSeed, ELITE_SALT + index));
  if (roll.value >= rule.chance) return null;
  const fits = fittingTraits(rule.traits, species);
  if (fits.length === 0) return null;
  const pick = nextRandom(roll.state);
  const trait = fits[Math.min(fits.length - 1, Math.floor(pick.value * fits.length))]!;
  const pierceRoll = rule.pierceRollChance > 0 && nextRandom(pick.state).value < rule.pierceRollChance;
  return { trait, pierceRoll };
}

/** Max HP share of an elite trait (1 for none). */
export const eliteHp = (trait: EliteTrait | undefined): number => (trait ? ELITE_TRAIT_DEFS[trait].hp : 1);

/** How much faster an elite's AI clock runs now: a swift one always, an enraged one once hurt below its threshold; 1 otherwise. */
export function eliteTimeScale(enemy: Pick<EnemyState, 'elite' | 'hp' | 'maxHp'>): number {
  if (!enemy.elite) return 1;
  const def = ELITE_TRAIT_DEFS[enemy.elite];
  if (def.pace) return def.pace;
  if (def.enrage && enemy.hp < enemy.maxHp * def.enrage.below) return def.enrage.pace;
  return 1;
}

/**
 * The one place a wind-up's real length is decided (P5): `baseMs` scaled by
 * the tier (`scaledTelegraphMs`), then sped up by `pace` (how much faster
 * than real time the enemy's clock runs: elite pace, enrage, a Sima pact's
 * curse; under 1 in slow-mo), and only then floored at `TELEGRAPH_FLOOR.minMs`
 * (`choiceMinMs` for a positional, `pierceRoll` one). The floor only undoes
 * what the modifiers cut: an authored base already under it stays as is.
 */
export function effectiveTelegraphMs(baseMs: number, d: Difficulty, pace = 1, positional = false): number {
  const paced = scaledTelegraphMs(baseMs, d) / pace;
  const floor = Math.min(baseMs, positional ? TELEGRAPH_FLOOR.choiceMinMs : TELEGRAPH_FLOOR.minMs);
  return Math.max(floor, paced);
}

/** What else runs an enemy's clock in `tickAiAt`: `pace` (the factor `ms` already carries over real time) and whether the wind-up is positional. */
export interface AiClock {
  pace?: number;
  positional?: boolean;
}

/**
 * One step of an enemy's AI clocks at tier `d`: a telegraph runs through its
 * planned length so that it lasts `effectiveTelegraphMs` in real time (never
 * below the floor, whatever sped the clock up), and cooldowns run out faster
 * with the tier's aggression (and a frenzied elite's). `ms` is the enemy's
 * step (real ms × `clock.pace`). Easy at pace 1 is the plain clock.
 */
export function tickAiAt(ai: AiState, ms: number, d: Difficulty, elite?: EnemyState['elite'], clock: AiClock = {}): AiState {
  const tier = TIERS[d];
  const pace = clock.pace ?? 1;
  const cooldownShare = tier.cooldown * (elite ? ELITE_TRAIT_DEFS[elite].cooldown : 1);
  let telegraphRate = 1;
  if (ai.mode === 'telegraph' && ai.modeDurationMs > 0) {
    const base = ai.modeDurationMs;
    const scaled = scaledTelegraphMs(base, d);
    const real = effectiveTelegraphMs(base, d, pace, clock.positional);
    // The floor binds: slow the clock so the wind-up lasts `real` real ms. Otherwise the tier's own rate (exactly 1 on easy).
    if (real > scaled / pace) telegraphRate = base / (real * pace);
    else if (tier.telegraph !== 1) telegraphRate = base / scaled;
  }
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
