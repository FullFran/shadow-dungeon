import { ITEM_EFFECTS, ITEM_IDS, ITEM_OFFER, ITEMS, type ItemId, type StatModifiers } from '../data/items';
import { TUNING } from '../data/tuning';
import { levelDamage } from './progression';
import { upgradeBonuses } from './upgrades';
import { deriveSeed, nextRandom } from './rng';
import type { EnemyState, GameEvent, PlayerState, WorldState } from './state';
import { vec } from './vec';

/**
 * Held items (docs/gdd.md §3 "Progresión dentro de la partida"), in one
 * pipeline: `playerStats` folds the level, the permanent upgrades (upgrades.ts) and every stack's stat modifiers
 * (data/items.ts) into the numbers combat reads; the remaining items are
 * hooks called from the places they act on: `onHitDealt` (Shell Bell, after
 * the player's direct hit, within a per-second budget), `onLethalHit` (Focus Sash, when an attack would faint the
 * player), `onTick` (Leftovers regen and the Sitrus Berry's low-HP heal, every
 * step) and `onContact` / `applyRecoil` (Rocky Helmet, when an enemy's melee
 * attack touches the player). Per-floor uses reset on every new floor.
 */
export const itemCount = (player: Pick<PlayerState, 'items'>, id: ItemId): number => player.items.filter((i) => i === id).length;

/** Adds one stack of `id`, unless it is at its cap. */
export function addItem(player: PlayerState, id: ItemId): PlayerState {
  return itemCount(player, id) >= ITEMS[id].maxStacks ? player : { ...player, items: [...player.items, id] };
}

export interface PlayerStats {
  /** Every move's damage (level included). */
  damage: number;
  heavyDamage: number;
  superEffective: number;
  /** Stamina cost of moves and rolls. */
  staminaCost: number;
  /** Scales wind-up, active and recovery time. */
  actionTime: number;
  critChance: number;
  perfectWindowMs: number;
  reach: number;
  /** Stamina regen multiplier (upgrades). */
  staminaRegen: number;
  /** Extra fraction of max HP healed on a new floor (upgrades). */
  floorHeal: number;
  /** Experience multiplier (upgrades). */
  xpGain: number;
}

const MULTIPLIERS = ['damage', 'heavyDamage', 'superEffective', 'staminaCost', 'actionTime', 'reach'] as const;

/** The player's numbers after level, an evolved form's stage, permanent upgrades and held items. */
export function playerStats(player: Pick<PlayerState, 'items' | 'level' | 'upgrades' | 'stageDamage'>): PlayerStats {
  const bonus = upgradeBonuses(player.upgrades);
  const stats: PlayerStats = {
    damage: levelDamage(player.level) * (player.stageDamage ?? 1),
    heavyDamage: 1,
    superEffective: 1,
    staminaCost: 1,
    actionTime: 1,
    critChance: 0,
    perfectWindowMs: TUNING.perfectDodge.windowMs + bonus.perfectWindowMs,
    reach: 1,
    staminaRegen: bonus.staminaRegen,
    floorHeal: bonus.floorHeal,
    xpGain: bonus.xpGain,
  };
  for (const id of player.items) {
    const mods: StatModifiers = ITEMS[id].stats ?? {};
    for (const key of MULTIPLIERS) stats[key] *= mods[key] ?? 1;
    stats.critChance += mods.critChance ?? 0;
    stats.perfectWindowMs += mods.perfectWindowMs ?? 0;
  }
  return stats;
}

/** Salt that keeps item offers independent of the floor generator and the urgent-floor draw. */
const OFFER_SALT = 0x17e4;

/** Small stable hash of a player id ("p2"), so each player gets its own offer. */
function idSalt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

/**
 * The items offered to `playerId` on entering `floor` of the run: up to
 * `ITEM_OFFER.size` different items, each drawn with its rarity weight, never
 * one already at its cap in `owned`. Pure: the same run seed, floor, player
 * and holdings give the same offer.
 */
export function offerItems(runSeed: number, floor: number, playerId: string, owned: readonly ItemId[]): ItemId[] {
  let rng = deriveSeed(deriveSeed(runSeed, OFFER_SALT + floor), idSalt(playerId));
  let pool = ITEM_IDS.filter((id) => owned.filter((o) => o === id).length < ITEMS[id].maxStacks);
  const offer: ItemId[] = [];
  while (offer.length < ITEM_OFFER.size && pool.length > 0) {
    const weights = pool.map((id) => ITEM_OFFER.rarityWeights[ITEMS[id].rarity]);
    const roll = nextRandom(rng);
    rng = roll.state;
    let left = roll.value * weights.reduce((a, b) => a + b, 0);
    let index = 0;
    while (index < pool.length - 1 && left >= weights[index]!) left -= weights[index++]!;
    offer.push(pool[index]!);
    pool = pool.filter((_, i) => i !== index);
  }
  return offer;
}

const usesOf = (player: PlayerState, id: ItemId): number => player.itemUses[id] ?? 0;
const used = (player: PlayerState, id: ItemId): PlayerState => ({ ...player, itemUses: { ...player.itemUses, [id]: usesOf(player, id) + 1 } });
const healed = (player: PlayerState, amount: number): PlayerState => ({ ...player, hp: Math.min(player.maxHp, player.hp + amount) });

/** Critical hit roll (Scope Lens), from the world's seeded RNG; no roll without the item. */
export function rollCrit(state: WorldState, chance: number): { state: WorldState; crit: boolean } {
  if (chance <= 0) return { state, crit: false };
  const roll = nextRandom(state.rng);
  return { state: { ...state, rng: roll.state }, crit: roll.value < chance };
}

/** Shell Bell's budget for `bells` stacks: HP per second it may heal (under the items' shared sustain ceiling, Leftovers first), and the most it holds. */
const bellRate = (player: PlayerState, bells: number): number => {
  const room = ITEM_EFFECTS.sustainPerSecond - ITEM_EFFECTS.leftoversPerSecond * itemCount(player, 'leftovers');
  return Math.max(0, Math.min(ITEM_EFFECTS.shellBellPerSecond * bells, room)) * player.maxHp;
};
const bellBudget = (player: PlayerState, bells: number): number => bellRate(player, bells) * ITEM_EFFECTS.shellBellBurstSeconds;

/**
 * onHitDealt: the player's hit took `damage` HP from an enemy. A direct hit
 * makes Shell Bell heal a share of it, out of its budget (`ITEM_EFFECTS`);
 * a zone tick, a chain jump, a split shard or a rethrow (`direct` false) heals nothing.
 */
export function onHitDealt(player: PlayerState, damage: number, direct: boolean): PlayerState {
  const bells = itemCount(player, 'shell-bell');
  if (bells <= 0 || player.hp <= 0 || !direct || damage <= 0 || player.hp >= player.maxHp) return player;
  const spent = player.shellBell ?? 0;
  const heal = Math.min(damage * ITEM_EFFECTS.shellBellHeal * bells, bellBudget(player, bells) - spent, player.maxHp - player.hp);
  return heal > 0 ? { ...healed(player, heal), shellBell: spent + heal } : player;
}

/** Shell Bell's budget refills at its rate (the field is dropped once full). */
function refillBell(player: PlayerState, dtMs: number): PlayerState {
  if (player.shellBell === undefined) return player;
  const spent = player.shellBell - (bellRate(player, itemCount(player, 'shell-bell')) * dtMs) / 1000;
  const { shellBell: _full, ...rest } = player;
  return spent > 0 ? { ...player, shellBell: spent } : rest;
}

/** onLethalHit: an attack would faint the player; Focus Sash keeps it at 1 HP, once per floor. Null when nothing saves it. */
export function onLethalHit(player: PlayerState, events: GameEvent[]): PlayerState | null {
  const sashes = itemCount(player, 'focus-sash') * ITEM_EFFECTS.focusSashUses;
  if (sashes <= usesOf(player, 'focus-sash') || player.hp <= 0) return null;
  events.push({ type: 'itemTriggered', item: 'focus-sash' });
  return { ...used(player, 'focus-sash'), hp: 1 };
}

/** onContact: an enemy's melee attack touched the player (hurt, or absorbed by Disguise): Rocky Helmet marks the recoil. */
export function onContact(player: PlayerState, enemy: EnemyState, events: GameEvent[]): void {
  if (itemCount(player, 'rocky-helmet') > 0) events.push({ type: 'itemTriggered', item: 'rocky-helmet', enemyId: enemy.id });
}

/**
 * Rocky Helmet recoil marked this step: the host (and solo) damages the
 * enemy; a guest shows it at once and claims it like a hit (sync.ts).
 */
export function applyRecoil(state: WorldState, events: GameEvent[]): WorldState {
  const damage = ITEM_EFFECTS.rockyHelmetDamage * itemCount(state.player, 'rocky-helmet');
  if (damage <= 0) return state;
  let current = state;
  for (const event of events.slice()) {
    if (event.type !== 'itemTriggered' || event.item !== 'rocky-helmet' || !event.enemyId) continue;
    const enemy = current.enemies.find((e) => e.id === event.enemyId);
    if (!enemy || !enemy.alive) continue;
    const hp = Math.max(0, enemy.hp - damage);
    events.push({ type: 'enemyHit', enemyId: enemy.id, damage, effectiveness: 1, pos: enemy.pos });
    if (hp <= 0) events.push({ type: 'enemyDefeated', enemyId: enemy.id });
    if (current.role === 'guest') {
      events.push({
        type: 'hitClaim',
        claim: { id: `${current.localId}:helmet${current.tick}:${enemy.id}`, playerId: current.localId, enemyId: enemy.id, damage, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: false },
      });
    }
    current = { ...current, enemies: current.enemies.map((e) => (e.id === enemy.id ? { ...e, hp, alive: hp > 0 } : e)) };
  }
  return current;
}

/** onTick: Shell Bell's budget, Leftovers regen and the Sitrus Berry's heal under its HP threshold (one per stack per floor). */
export function onTick(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  let player = refillBell(state.player, dtMs);
  if (player.hp <= 0 || player.items.length === 0) return player === state.player ? state : { ...state, player };
  const leftovers = itemCount(player, 'leftovers');
  if (leftovers > 0 && player.hp < player.maxHp) player = healed(player, (ITEM_EFFECTS.leftoversPerSecond * leftovers * player.maxHp * dtMs) / 1000);
  if (player.hp < ITEM_EFFECTS.sitrusThreshold * player.maxHp && usesOf(player, 'sitrus-berry') < itemCount(player, 'sitrus-berry')) {
    events.push({ type: 'itemTriggered', item: 'sitrus-berry' });
    player = healed(used(player, 'sitrus-berry'), ITEM_EFFECTS.sitrusHeal * player.maxHp);
  }
  return player === state.player ? state : { ...state, player };
}
