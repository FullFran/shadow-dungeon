import { type Friend, type FriendsApi, type FriendsError, type FriendsOverview, type FriendsResult, type FriendState } from '../adapters/friends-api';
import { normalizeRoomCode } from '../net/room-code';

/**
 * "Amigos": your code, add by code, requests, your friends and whether they
 * are in a room to join. The server decides who sees what
 * (adapters/friends-api.ts). A guest gets a line and the way to the account,
 * and no request is made. All a player typed is shown as text, never as markup.
 */

const STATE_ORDER: Record<FriendState, number> = { room: 0, online: 1, offline: 2 };

/** Rooms first, then online, then offline, each by name. */
export function sortFriends(friends: readonly Friend[]): Friend[] {
  return [...friends].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.nickname.localeCompare(b.nickname));
}

/** The room to join for this friend: only a friend in a room, only a valid code, and not the room this player is already in. */
export function joinableRoom(friend: Friend, myRoom: string | null): string | null {
  if (friend.state !== 'room' || friend.room === null) return null;
  const code = normalizeRoomCode(friend.room);
  return code && code !== myRoom ? code : null;
}

/** What the window shows: signed out it asks the server nothing. */
export function loadFriends(api: Pick<FriendsApi, 'overview'>, token: string | null): Promise<FriendsResult<FriendsOverview>> {
  return token ? api.overview(token) : Promise.resolve({ ok: false, error: 'denied' });
}

export interface FriendCard {
  id: string;
  name: string;
  initial: string;
  state: FriendState;
  stateKey: string;
  joinRoom: string | null;
  inMyRoom: boolean;
}
export interface FriendsView {
  code: string;
  onlineCount: number;
  requests: { id: string; name: string; initial: string }[];
  friends: FriendCard[];
  waiting: { id: string; code: string }[];
}
/** The letter on a friend's avatar tile: the first of the name, upper-cased; "?" for no name. */
export const initialOf = (name: string): string => {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : '?';
};

/** Signed out the window is the account card and asks the server nothing. */
export const gateFor = (token: string | null): 'account' | 'list' => (token ? 'list' : 'account');

/** Everything the signed-in window draws, ready to put on cards (the server's data, sorted and with the join rule applied). */
export function friendsView(overview: FriendsOverview, myRoom: string | null): FriendsView {
  const friends = sortFriends(overview.friends).map((friend): FriendCard => {
    const inMyRoom = friend.state === 'room' && friend.room === myRoom;
    return {
      id: friend.id,
      name: friend.nickname,
      initial: initialOf(friend.nickname),
      state: friend.state,
      stateKey: inMyRoom ? 'friends.state.same' : `friends.state.${friend.state}`,
      joinRoom: joinableRoom(friend, myRoom),
      inMyRoom,
    };
  });
  return {
    code: overview.code,
    onlineCount: overview.friends.filter((f) => f.state !== 'offline').length,
    requests: overview.incoming.map((r) => ({ id: r.id, name: r.nickname, initial: initialOf(r.nickname) })),
    friends,
    waiting: overview.outgoing.map((s) => ({ id: s.id, code: s.code })),
  };
}

export const HEARTBEAT_MS = 60_000;

export interface HeartbeatDeps {
  /** Who is signed in (`who` is the account, the token may be refreshed), or null as a guest. */
  session(): { who: string; token: string } | null;
  /** The room this player is in, or null. */
  room(): string | null;
  visible(): boolean;
  send(token: string, room: string | null): void;
  start(tick: () => void, ms: number): unknown;
  stop(timer: unknown): void;
}

export interface Heartbeat {
  /** Call when the account, the room or the tab's visibility may have changed; repeats do nothing. */
  sync(): void;
  /** One beat now, signed in (the window was just opened: an account's first beat that counts, so friends see it online at once). */
  now(): void;
}

/**
 * Tells the server this account is here, so its friends see it online, and
 * which room it is in. It only runs signed in, with the tab visible; in a room
 * it also runs hidden, since a host waiting while on a chat is still there. A
 * closed tab simply stops, and the server forgets it after a few minutes.
 */
export function friendsHeartbeat(deps: HeartbeatDeps): Heartbeat {
  let timer: unknown = null;
  let sent: { who: string; token: string; room: string | null } | null = null;

  const disarm = () => {
    if (timer !== null) deps.stop(timer);
    timer = null;
  };
  const beat = () => {
    const session = deps.session();
    if (!session) return;
    sent = { ...session, room: deps.room() };
    deps.send(session.token, sent.room);
  };
  const arm = () => {
    disarm();
    timer = deps.start(beat, HEARTBEAT_MS);
  };

  return {
    now: beat,
    sync() {
      const session = deps.session();
      // Whoever published a room takes it back, with its own token, when it goes.
      if (sent && sent.who !== session?.who) {
        if (sent.room !== null) deps.send(sent.token, null);
        sent = null;
      }
      if (!session) return disarm();
      const room = deps.room();
      const changedRoom = sent !== null && sent.room !== room;
      if (!deps.visible() && room === null) {
        disarm();
        if (changedRoom) beat();
        return;
      }
      if (timer === null || sent === null || changedRoom) {
        beat();
        arm();
      }
    },
  };
}

