import { CONSUMABLE_EFFECTS, CONSUMABLES, type ConsumableId } from '../data/consumables';
import { TURN_FLOOR } from '../data/difficulty';
import { onBossDamaged } from './boss';
import { cardHpFloor } from './cards';
import { bossSpecies } from '../data/boss-lore';
import type { ConsumableEffects, EnemyState, GameEvent, PlayerState, WorldState } from './state';
import { distance, vec } from './vec';

/**
 * Consumables used in a run (odd/tasks/items-bag.md, data/consumables.ts), pure. `useConsumable` is called between
 * steps when the player uses the selected bag slot, like an item pick changes the world; the effects that last
 * (tonic, salt, dust, feather, the armed sprout) live on the player and `settleConsumables` runs them every step.
 * Each peer owns its player, so a co-op guest's tonic or dust works on its own peer like its damage does; a spore
 * bomb's hits go to the host through the hit claims (the Rocky Helmet path), and a guest's lantern marks the host's
 * shots as spent for its own player (the victim-side record): no new message on the wire. A player who never
 * uses one keeps exactly its state (the field stays absent).
 */

/** Where the player stands when it uses one: a boss arena or a shared run (no exit cord in either). */
export interface UseContext {
  bossArena: boolean;
  shared: boolean;
}

export type UseRefusal = 'fainted' | 'passive' | 'nothing' | 'boss-arena' | 'shared';

export interface UseOutcome {
  state: WorldState;
  /** Why nothing happened (the unit stays in the bag); absent when it took effect. */
  refused?: UseRefusal;
  events: GameEvent[];
}

const withEffects = (player: PlayerState, change: Partial<ConsumableEffects>): PlayerState => ({ ...player, consumables: { ...player.consumables, ...change } });

/** Whether `id`'s lasting effect is on the player now. */
export function consumableActive(player: Pick<PlayerState, 'consumables'>, id: ConsumableId): boolean {
  const fx = player.consumables;
  if (!fx) return false;
  if (id === 'dew-tonic') return (fx.tonicMs ?? 0) > 0;
  if (id === 'clear-salt') return (fx.saltMs ?? 0) > 0;
  if (id === 'ember-dust') return (fx.dustMs ?? 0) > 0;
  if (id === 'wind-feather') return (fx.featherMs ?? 0) > 0;
  if (id === 'second-sprout') return fx.sprout === true;
  return false;
}

/** The damage and stamina regen multipliers of the boosts running (core/items.ts `playerStats` folds them in). */
export function consumableStats(player: Pick<PlayerState, 'consumables'>): { damage: number; staminaRegen: number } {
  return {
    damage: consumableActive(player, 'ember-dust') ? CONSUMABLE_EFFECTS.dustDamage : 1,
    staminaRegen: consumableActive(player, 'wind-feather') ? CONSUMABLE_EFFECTS.featherRegen : 1,
  };
}

/** Clear salt keeps poison away while it lasts (core/toxic.ts). */
export const poisonWarded = (player: Pick<PlayerState, 'consumables'>): boolean => consumableActive(player, 'clear-salt');

/** A packed second sprout arms the player at the run's start (and on every floor it is still in the bag). */
export const armSprout = (state: WorldState): WorldState => (state.player.consumables?.sprout ? state : { ...state, player: withEffects(state.player, { sprout: true }) });

/** The sprout is no longer in the bag (spent, or never packed): disarmed. */
export function disarmSprout(state: WorldState): WorldState {
  if (!state.player.consumables?.sprout) return state;
  const { sprout: _gone, ...rest } = state.player.consumables;
  return { ...state, player: dropEmpty({ ...state.player, consumables: rest }) };
}

function dropEmpty(player: PlayerState): PlayerState {
  if (!player.consumables || Object.keys(player.consumables).length > 0) return player;
  const { consumables: _none, ...rest } = player;
  return rest;
}

/** Every species that fights with a boss bar (data/boss-lore.ts), read once. */
let bosses: ReadonlySet<string> | null = null;
/** The ordinary enemies a spore bomb may stun; bosses, heralds and guardians are only scratched. */
const stunnable = (enemy: EnemyState): boolean => {
  bosses ??= new Set(bossSpecies());
  return !bosses.has(enemy.species) && enemy.boss === undefined && enemy.herald === undefined;
};

function sporeBomb(state: WorldState, events: GameEvent[]): WorldState {
  const { sporeRadius, sporeStunMs, sporeBossDamage } = CONSUMABLE_EFFECTS;
  let enemies = state.enemies;
  for (const enemy of state.enemies) {
    if (!enemy.alive || distance(enemy.pos, state.player.pos) > sporeRadius) continue;
    // A spell card's floor holds, as for every hit (core/cards.ts).
    const hp = Math.max(Math.min(cardHpFloor(enemy), enemy.hp), enemy.hp - sporeBossDamage);
    const dealt = enemy.hp - hp;
    const stun = stunnable(enemy) ? sporeStunMs : 0;
    if (dealt > 0) events.push({ type: 'enemyHit', enemyId: enemy.id, damage: dealt, effectiveness: 1, pos: enemy.pos });
    if (hp <= 0) events.push({ type: 'enemyDefeated', enemyId: enemy.id });
    if (state.role === 'guest') {
      events.push({ type: 'hitClaim', claim: { id: `${state.localId}:spore${state.tick}:${enemy.id}`, playerId: state.localId, enemyId: enemy.id, damage: dealt, effectiveness: 1, hitstunMs: stun, knockback: vec(0, 0), blocked: false } });
    }
    const hurt = { ...(enemy.boss && dealt > 0 ? onBossDamaged(enemy, dealt) : enemy), hp, alive: hp > 0, hitstunMs: Math.max(enemy.hitstunMs, stun) };
    enemies = enemies.map((e) => (e.id === enemy.id ? hurt : e));
  }
  return { ...state, enemies };
}

function hushLantern(state: WorldState): WorldState {
  const projectiles = state.projectiles.map((p) => (p.owner === 'enemy' && p.remainingMs > TURN_FLOOR.fadeMs ? { ...p, remainingMs: TURN_FLOOR.fadeMs } : p));
  // A guest's copy of the host's shots follows the host's snapshots: marked spent, they can no longer hit this player.
  const spent = state.role === 'guest' ? [...new Set([...(state.spentShots ?? []), ...state.projectiles.filter((p) => p.owner === 'enemy').map((p) => p.id)])] : state.spentShots;
  // Clearing the screen is not capturing the card: the one under way is forfeit.
  const capture = state.capture ? { ...state.capture, hit: true } : undefined;
  return { ...state, projectiles, ...(spent ? { spentShots: spent } : {}), ...(capture ? { capture } : {}) };
}

/** The player uses one unit of `id`: its effect, or why it was refused (the app spends the unit only when it worked). */
export function useConsumable(state: WorldState, id: ConsumableId, context: UseContext): UseOutcome {
  const events: GameEvent[] = [];
  const refuse = (refused: UseRefusal): UseOutcome => ({ state, refused, events });
  const player = state.player;
  if (player.hp <= 0) return refuse('fainted');
  if (CONSUMABLES[id].passive) return refuse('passive');
  let next = state;
  switch (id) {
    case 'dew-tonic':
      if (player.hp >= player.maxHp) return refuse('nothing');
      next = { ...state, player: withEffects(player, { tonicMs: CONSUMABLE_EFFECTS.tonicMs, tonicHp: player.maxHp * CONSUMABLE_EFFECTS.tonicHeal }) };
      break;
    case 'clear-salt': {
      const { poison: _cured, ...rest } = player;
      next = { ...state, player: withEffects(rest, { saltMs: CONSUMABLE_EFFECTS.saltMs }) };
      break;
    }
    case 'ember-dust':
      next = { ...state, player: withEffects(player, { dustMs: CONSUMABLE_EFFECTS.dustMs }) };
      break;
    case 'wind-feather':
      next = { ...state, player: withEffects(player, { featherMs: CONSUMABLE_EFFECTS.featherMs }) };
      break;
    case 'spore-bomb':
      next = sporeBomb(state, events);
      break;
    case 'hush-lantern':
      next = hushLantern(state);
      break;
    case 'exit-cord':
      // Leaving alone would break a shared run for the others.
      if (context.shared) return refuse('shared');
      if (context.bossArena) return refuse('boss-arena');
      break;
    // The lamp only lights the minimap (the app's), nothing in the world.
    case 'fog-lamp':
      break;
    default:
      return refuse('passive');
  }
  events.push({ type: 'consumableUsed', item: id });
  return { state: next, events };
}

/**
 * Every step, after the hits of the step landed: the tonic heals (a step that hurt the player drops it), the timers
 * run down, and an armed sprout stands a player who just fainted back up. `before` is the player as the step began.
 */
export function settleConsumables(before: PlayerState, state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const fx = state.player.consumables;
  if (!fx) return state;
  let player = state.player;
  if (fx.sprout && player.hp <= 0 && before.hp > 0) {
    events.push({ type: 'consumableUsed', item: 'second-sprout' });
    const { sprout: _spent, ...rest } = fx;
    return { ...state, player: dropEmpty({ ...player, hp: Math.max(1, Math.round(player.maxHp * CONSUMABLE_EFFECTS.sproutHp)), consumables: rest }) };
  }
  const next: ConsumableEffects = {};
  if (fx.sprout) next.sprout = true;
  if (fx.tonicMs && fx.tonicHp && player.hp > 0 && player.hp >= before.hp) {
    const share = Math.min(dtMs, fx.tonicMs) / fx.tonicMs;
    const heal = fx.tonicHp * share;
    player = { ...player, hp: Math.min(player.maxHp, player.hp + heal) };
    if (fx.tonicMs - dtMs > 0 && player.hp < player.maxHp) {
      next.tonicMs = fx.tonicMs - dtMs;
      next.tonicHp = fx.tonicHp - heal;
    }
  }
  for (const key of ['saltMs', 'dustMs', 'featherMs'] as const) {
    const left = (fx[key] ?? 0) - dtMs;
    if (left > 0) next[key] = left;
  }
  return { ...state, player: dropEmpty({ ...player, consumables: next }) };
}
