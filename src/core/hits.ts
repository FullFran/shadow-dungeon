import { SPECIES } from '../data/species';
import { TUNING } from '../data/tuning';
import { tierOf } from './difficulty';
import { hitCap, speciesMaxHpAt } from './fairness';
import { onLethalHit } from './items';
import { partyDamageScale } from './party';
import { absorbsFire, armorCovers, breakIllusion } from './passives';
import { classifyHit } from './player';
import type { GameEvent, IncomingHit, WorldState } from './state';
import { buffDamageTaken } from './boosts';

const PERFECT = TUNING.perfectDodge;
const PASSIVES = TUNING.passives;

export type LandedOutcome = 'hurt' | 'absorbed' | 'dodged' | 'perfectDodge';

/**
 * Lands a hit on the player, pushing events into `events`. I-frames turn it
 * into a dodge (perfect right after they start: slow-mo + next-hit buff);
 * otherwise Flash Fire absorbs a Fire hit (and a perfect dodge of one), Disguise
 * absorbs the first damaging hit of the room and Battle Armor halves a
 * frontal hit during a heavy wind-up; being hurt breaks Illusion. A lethal
 * hit may be survived with a held item (Focus Sash, items.ts).
 */
export function landHitOnPlayer(
  state: WorldState,
  hit: IncomingHit,
  events: GameEvent[],
): { state: WorldState; outcome: LandedOutcome } {
  const { player } = state;
  // The endless dungeon's deeper floors hit harder (state.enemyScale), and so do harder tiers (victim side: every peer applies its own).
  // A bigger party's boss hits a little harder too (core/party.ts; 1 solo and without a boss).
  const harder = (state.enemyScale?.damage ?? 1) * tierOf(state).damage * partyDamageScale(state);
  if (harder !== 1 && hit.damage > 0) hit = { ...hit, damage: Math.max(1, Math.round(hit.damage * harder)) };
  // A Sima pact's curse may make them hit harder.
  if (state.simaPact && state.simaPact.enemyDamage !== 1 && hit.damage > 0) hit = { ...hit, damage: Math.max(1, Math.round(hit.damage * state.simaPact.enemyDamage)) };
  // A guard buff (Bulk Up, the boost slot) takes the edge off before the cap (never below 1): the cap stays the last word.
  const guard = buffDamageTaken(player);
  if (guard !== 1 && hit.damage > 0) hit = { ...hit, damage: Math.max(1, Math.round(hit.damage * guard)) };
  // The one-hit cap (P5.6), last of all the multipliers: no single hit takes more than a share of the HP a player of the
  // floor's expected level would have (core/fairness.ts). An under-levelled player can still be one-shot; a levelled one never.
  const cap = hitCap(speciesMaxHpAt(player.species, state.referenceLevel ?? 1));
  if (hit.damage > cap) hit = { ...hit, damage: cap };
  const outcome = classifyHit(player, hit);
  if (outcome === 'dodged') {
    events.push({ type: 'hitDodged' });
    return { state, outcome };
  }
  if (outcome === 'perfectDodge') {
    events.push({ type: 'perfectDodge' });
    const fire = absorbsFire(player, hit);
    if (fire) events.push({ type: 'passiveTriggered', passive: 'flash-fire' });
    return {
      outcome,
      state: {
        ...state,
        slowMoMs: PERFECT.slowMoDurationMs,
        player: { ...player, nextHitBuff: { multiplier: PERFECT.damageMultiplier, remainingMs: PERFECT.buffDurationMs }, ...(fire ? { flashFire: true } : {}) },
      },
    };
  }
  if (hit.damage > 0 && absorbsFire(player, hit)) {
    events.push({ type: 'passiveTriggered', passive: 'flash-fire' });
    const hp = Math.min(player.maxHp, player.hp + hit.damage * PASSIVES.flashFireHeal);
    return { outcome: 'absorbed', state: { ...state, player: { ...player, hp, flashFire: true } } };
  }
  if (hit.damage > 0 && SPECIES[player.species].passive === 'disguise' && !player.disguiseBroken) {
    events.push({ type: 'disguiseBroken' });
    return { outcome: 'absorbed', state: { ...state, player: { ...player, disguiseBroken: true } } };
  }
  const armored = armorCovers(player, hit);
  if (armored) events.push({ type: 'passiveTriggered', passive: 'battle-armor' });
  const damage = armored ? Math.round(hit.damage * PASSIVES.battleArmorFactor) : hit.damage;
  // `pierceRoll` names a positional hit for the balance harness (src/sim); nothing in the game reads it.
  events.push({ type: 'playerHurt', damage, ...(hit.pierceRoll ? { pierceRoll: true as const } : {}) });
  const hurt = breakIllusion(player, events);
  const saved = damage >= hurt.hp ? onLethalHit(hurt, events) : null;
  return { outcome: 'hurt', state: { ...state, player: saved ?? { ...hurt, hp: Math.max(0, hurt.hp - damage) } } };
}
