import { typeEffectiveness } from '../core/damage';
import { CRYPT, guardianOf } from '../data/dungeons';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import { SPECIES, type SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';
import { t } from '../i18n';

/**
 * What a move card in the loadout tells beyond power and description: its
 * stamina cost, its hit shape and how its type fares against the Crypt's
 * enemies (`typeEffectiveness` of the move type on each species).
 */
export type MoveShapeId = 'ring' | 'arc-short' | 'arc-wide' | 'dash' | 'projectile-fast' | 'projectile-slow' | 'boomerang' | 'self' | 'cone' | 'wave';

/** Arcs shorter than this read as short (a jab in front), longer as wide. */
const SHORT_ARC = 38;
/** Arcs reaching this far read as a cone (the area moves). */
const CONE = 56;
/** Projectiles slower than this (px/s) read as slow. */
const SLOW_PROJECTILE = 150;

export function moveShape(move: MoveDef): { shape: MoveShapeId; hits?: number } {
  const hits = move.multiHit && move.multiHit > 1 ? { hits: move.multiHit } : {};
  const box = move.hitbox;
  if (box.kind === 'arc') return { shape: box.arcDegrees >= 360 ? 'ring' : box.range < SHORT_ARC ? 'arc-short' : box.range >= CONE ? 'cone' : 'arc-wide', ...hits };
  if (box.kind === 'dash') return { shape: 'dash', ...hits };
  if (box.kind === 'self') return { shape: 'self' };
  if (box.boomerang) return { shape: 'boomerang', ...hits };
  if (box.wave) return { shape: 'wave', ...hits };
  return { shape: box.speed < SLOW_PROJECTILE ? 'projectile-slow' : 'projectile-fast', ...hits };
}

/**
 * Enemies a move card weighs against: the Crypt's floor-1 enemies (what a new
 * player meets first), then its guardian. The deeper species and the mid-boss
 * stay out so the card line stays short.
 */
export function cryptRoster(): SpeciesId[] {
  const out: SpeciesId[] = CRYPT.spawns.pool.filter((entry) => (entry.weights[0] ?? 0) > 0).map((entry) => entry.species);
  const guardian = guardianOf(CRYPT);
  if (guardian && !out.includes(guardian)) out.push(guardian);
  return out;
}

/** Roster species a move type hits super effectively (`strong`) or not very effectively, immunities included (`weak`). */
export function matchup(type: PokemonType, roster: readonly SpeciesId[] = cryptRoster()): { strong: SpeciesId[]; weak: SpeciesId[] } {
  const strong: SpeciesId[] = [];
  const weak: SpeciesId[] = [];
  for (const id of roster) {
    const effectiveness = typeEffectiveness(type, SPECIES[id].types);
    if (effectiveness > 1) strong.push(id);
    else if (effectiveness < 1) weak.push(id);
  }
  return { strong, weak };
}

/** Two card lines: "Stamina 30 · 360° ring · ×5 (· Cooldown 7 s)" and "Effective against … · Not very effective against …". */
export function moveInfoLines(id: MoveId): [string, string] {
  const move = MOVES[id];
  const { shape, hits } = moveShape(move);
  const cost = move.staminaCost > 0 ? t('loadout.stamina').replace('{cost}', String(move.staminaCost)) : t('loadout.noCost');
  // Boost and area moves also show their cooldown.
  const cooldown = move.cooldownMs ? [t('loadout.cooldown').replace('{s}', String(Math.round(move.cooldownMs / 100) / 10))] : [];
  const stats = [cost, t(`loadout.shape.${shape}`), ...(hits ? [`×${hits}`] : []), ...cooldown].join(' · ');
  // A boost has no target: the matchup line says what it is for instead.
  if (move.hitbox.kind === 'self') return [stats, t('loadout.selfTarget')];
  const names = (ids: SpeciesId[]) => ids.map((s) => t(`species.${s}`)).join(', ');
  const { strong, weak } = matchup(move.type);
  const hint = [
    ...(strong.length > 0 ? [t('loadout.strong').replace('{list}', names(strong))] : []),
    ...(weak.length > 0 ? [t('loadout.weak').replace('{list}', names(weak))] : []),
  ];
  return [stats, hint.length > 0 ? hint.join(' · ') : t('loadout.neutral')];
}
