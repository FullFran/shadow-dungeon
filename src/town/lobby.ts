import type { Vec2 } from '../core/vec';
import type { EntranceState } from './overworld';

/**
 * The online lobby is the town: the room walks it together. Pure rules:
 * how often a walker's presence goes out, and who may lead the room into a
 * dungeon (the host; a guest at a dungeon's mouth or the waystone is told
 * so). The scene takes a `TownLobby` from the app, which wraps the net
 * session (src/net/session.ts).
 */
export const PRESENCE_MS = 100;

/** True when this walker's presence is due again (~10 Hz). */
export const presenceDue = (lastSentMs: number | null, nowMs: number): boolean => lastSentMs === null || nowMs - lastSentMs >= PRESENCE_MS;

export type EntranceAction = 'enter' | 'locked' | 'missing' | 'host-only';

/** What a dungeon's mouth does for this walker: in a room only the host may take the group in. */
export function entranceAction(state: EntranceState, lobby: { isHost: boolean } | null): EntranceAction {
  if (state !== 'open') return state;
  return lobby && !lobby.isHost ? 'host-only' : 'enter';
}

/** The waystone's quick travel starts a run too: the host's alone in a room. */
export const canTravel = (lobby: { isHost: boolean } | null): boolean => !lobby || lobby.isHost;

export interface TownLobbyPlayer {
  name: string;
  host: boolean;
  self: boolean;
}

export interface TownLobbyWalker {
  id: string;
  name: string;
  /** A SPRITE_KEYS name (unknown ones draw as Mimikyu). */
  species: string;
  map: string;
  pos: Vec2;
  facing: Vec2;
  moving: boolean;
}

export interface TownLobby {
  isHost: boolean;
  /** This player's nickname, drawn dimmer over its own head. */
  selfName: string;
  /** The room code for the corner window (dots while hidden). */
  code(): string;
  players(): readonly TownLobbyPlayer[];
  /** The other players' walkers (interpolated). */
  walkers(): readonly TownLobbyWalker[];
  sendPresence(presence: { map: string; pos: Vec2; facing: Vec2; moving: boolean }): void;
  /** Esc: the room's menu rows (copy the code, hide or show it, leave); `close` closes the menu. */
  menu(close: () => void): { label: string; onConfirm: () => void }[];
}
