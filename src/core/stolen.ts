import type { GameEvent, PlayerState, WorldState } from './state';

/**
 * Sableye's theft (docs/gdd.md §3, Cripta): a slash of its Glint card that
 * hurts the player takes the last held item it picked. The item is only
 * borrowed: it comes back as soon as the player lands a hit on the thief, when
 * the thief falls or is gone, on leaving the room, or after `stealMs` at the
 * latest. One item at a time; with nothing held there is nothing to take.
 * Victim-side like every enemy contact: each peer only robs and returns its
 * own player, so nothing about it goes over the network.
 */

/** Takes the player's last held item for `enemyId`, unless it holds none or already lost one. */
export function stealItem(player: PlayerState, enemyId: string, ms: number, events: GameEvent[]): PlayerState {
  if (player.stolen || player.items.length === 0) return player;
  const item = player.items[player.items.length - 1]!;
  events.push({ type: 'itemStolen', item, enemyId });
  return { ...player, items: player.items.slice(0, -1), stolen: { item, enemyId, remainingMs: ms } };
}

/** Gives the stolen item back (at the end of the held list, as if picked again). */
export function returnStolen(player: PlayerState, events?: GameEvent[]): PlayerState {
  if (!player.stolen) return player;
  const { stolen, ...rest } = player;
  events?.push({ type: 'itemReturned', item: stolen.item });
  return { ...rest, items: [...player.items, stolen.item] };
}

/**
 * After a step: the item comes back when this step's events show a hit of the
 * local player on the thief, when the thief is down or gone, or once its time
 * runs out; otherwise the time ticks.
 */
export function settleStolen(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const stolen = state.player.stolen;
  if (!stolen) return state;
  const thief = state.enemies.find((e) => e.id === stolen.enemyId);
  const struck = events.some((e) => e.type === 'enemyHit' && e.enemyId === stolen.enemyId);
  const remainingMs = stolen.remainingMs - dtMs;
  if (struck || !thief || !thief.alive || remainingMs <= 0) return { ...state, player: returnStolen(state.player, events) };
  return { ...state, player: { ...state.player, stolen: { ...stolen, remainingMs } } };
}
