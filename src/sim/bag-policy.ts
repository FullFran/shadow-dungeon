import { CONSUMABLE_EFFECTS, type ConsumableId } from '../data/consumables';
import type { Bag } from '../core/consumable-stock';
import type { WorldState } from '../core/state';
import { distance } from '../core/vec';

/**
 * The balance bots' use of a bag (docs/research/items-and-prep.md §4, `RunOptions.bag` in src/sim/runner.ts): plain
 * rules, so a report can compare runs with and without one. A tonic under 40 % HP, the salt when poisoned, a spore
 * bomb with two enemies close, the lantern under 30 % HP with enemy shots flying, the dust and the feather as soon
 * as a boss is up; the sprout works by itself; the lamp and the cord are never used. Null: nothing now.
 */
export function botBagChoice(state: WorldState, bag: Bag): ConsumableId | null {
  const has = (id: ConsumableId) => bag.some((slot) => slot?.id === id && slot.count > 0);
  const p = state.player;
  if (p.hp <= 0) return null;
  if (has('dew-tonic') && p.hp < p.maxHp * 0.4 && !p.consumables?.tonicMs) return 'dew-tonic';
  if (has('clear-salt') && p.poison) return 'clear-salt';
  if (has('hush-lantern') && p.hp < p.maxHp * 0.3 && state.projectiles.some((s) => s.owner === 'enemy')) return 'hush-lantern';
  const close = state.enemies.filter((e) => e.alive && distance(e.pos, p.pos) <= CONSUMABLE_EFFECTS.sporeRadius).length;
  if (has('spore-bomb') && close >= 2) return 'spore-bomb';
  const boss = state.enemies.some((e) => e.alive && e.boss !== undefined);
  if (boss && has('ember-dust') && !p.consumables?.dustMs) return 'ember-dust';
  if (boss && has('wind-feather') && !p.consumables?.featherMs) return 'wind-feather';
  return null;
}
