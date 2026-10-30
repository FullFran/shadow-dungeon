import { sanitizeNickname } from '../net/nickname';
import { normalizeRoomCode, ROOM_CODE_ALPHABET } from '../net/room-code';

/**
 * The friends' calls to the game API (`/api/sd/friends`, server/README.md
 * "Friends"). The server decides who sees what; this only asks, and reads each
 * answer strictly: what it cannot read is dropped or fails, and a room code the
 * server should not have sent is no room. The token goes only to `base`, in
 * the `Authorization` header, as PocketBase expects it.
 */

export const FRIEND_CODE_LENGTH = 8;

export type FriendState = 'offline' | 'online' | 'room';

export interface Friend {
  /** The opaque id of the friendship, never an account's. */
  id: string;
  /** Sanitised; '' when the friend has no public nickname. */
  nickname: string;
  state: FriendState;
  /** A valid room code when `state` is 'room', else null. */
  room: string | null;
}

export interface FriendRequest {
  id: string;
  nickname: string;
}

export interface SentRequest {
  id: string;
  /** The code that was typed; a request not accepted tells nothing else. */
  code: string;
}

export interface FriendsOverview {
  code: string;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: SentRequest[];
}

export type FriendsError = 'denied' | 'refused' | 'self' | 'limit' | 'rate-limited' | 'unavailable';
export type FriendsResult<T> = { ok: true; value: T } | { ok: false; error: FriendsError };
export type SendStatus = 'pending' | 'friends';

export interface FriendsApi {
  overview(token: string): Promise<FriendsResult<FriendsOverview>>;
  send(token: string, code: string): Promise<FriendsResult<SendStatus>>;
  accept(token: string, id: string): Promise<FriendsResult<'friends'>>;
  /** Declines a request, cancels one's own, or removes a friend. */
  remove(token: string, id: string): Promise<FriendsResult<true>>;
  presence(token: string, room: string | null): Promise<FriendsResult<true>>;
}

const TIMEOUT_MS = 15_000;
const ID = /^[a-z0-9]{15}$/;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A typed friend code in canonical form (upper case, no spaces or dashes), or null if it is not a valid code. */
export function normalizeFriendCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== FRIEND_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

function friend(raw: unknown): Friend | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ID.test(raw.id)) return null;
  const base = { id: raw.id, nickname: sanitizeNickname(raw.nickname) };
  if (raw.state === 'offline' || raw.state === 'online') return { ...base, state: raw.state, room: null };
  if (raw.state !== 'room') return null;
  const room = typeof raw.room === 'string' ? normalizeRoomCode(raw.room) : null;
  return room ? { ...base, state: 'room', room } : { ...base, state: 'online', room: null };
}

function incoming(raw: unknown): FriendRequest | null {
  return isObject(raw) && typeof raw.id === 'string' && ID.test(raw.id) ? { id: raw.id, nickname: sanitizeNickname(raw.nickname) } : null;
}

function outgoing(raw: unknown): SentRequest | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ID.test(raw.id) || typeof raw.code !== 'string') return null;
  const code = normalizeFriendCode(raw.code);
  return code ? { id: raw.id, code } : null;
}

function overview(raw: unknown): FriendsOverview | null {
  if (!isObject(raw) || typeof raw.code !== 'string' || !Array.isArray(raw.friends) || !Array.isArray(raw.incoming) || !Array.isArray(raw.outgoing)) return null;
  const code = normalizeFriendCode(raw.code);
  if (!code) return null;
  return { code, friends: raw.friends.flatMap((x) => friend(x) ?? []), incoming: raw.incoming.flatMap((x) => incoming(x) ?? []), outgoing: raw.outgoing.flatMap((x) => outgoing(x) ?? []) };
}

export function httpFriendsApi(base: string, fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init)): FriendsApi {
  async function refusal(response: Response): Promise<FriendsError> {
    if (response.status === 401 || response.status === 403) return 'denied';
    if (response.status === 404) return 'refused';
    if (response.status === 409) return 'limit';
    if (response.status === 429) return 'rate-limited';
    if (response.status === 400) {
      const body: unknown = await response.json().catch(() => null);
      if (isObject(body) && body.error === 'self') return 'self';
    }
    return 'unavailable';
  }

  async function call<T>(token: string, method: string, path: string, body: unknown, read: (body: unknown) => T | null): Promise<FriendsResult<T>> {
    try {
      const headers: Record<string, string> = { Authorization: token };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetchFn(`${base}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return { ok: false, error: await refusal(response) };
      const value = read(response.status === 204 ? null : await response.json());
      return value === null ? { ok: false, error: 'unavailable' } : { ok: true, value };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }

  const done = (): true => true;
  const sendStatus = (body: unknown): SendStatus | null => (isObject(body) && (body.status === 'pending' || body.status === 'friends') ? body.status : null);
  const accepted = (body: unknown): 'friends' | null => (sendStatus(body) === 'friends' ? 'friends' : null);

  return {
    overview: (token) => call(token, 'GET', '/api/sd/friends', undefined, overview),
    send: (token, code) => call(token, 'POST', '/api/sd/friends/requests', { code }, sendStatus),
    // An id only ever comes from the server; anything else never reaches a path.
    accept: (token, id) => (ID.test(id) ? call(token, 'POST', `/api/sd/friends/requests/${id}/accept`, undefined, accepted) : Promise.resolve({ ok: false, error: 'refused' })),
    remove: (token, id) => (ID.test(id) ? call(token, 'DELETE', `/api/sd/friends/${id}`, undefined, done) : Promise.resolve({ ok: false, error: 'refused' })),
    presence: (token, room) => (room === null || normalizeRoomCode(room) === room ? call(token, 'POST', '/api/sd/friends/presence', { room }, done) : Promise.resolve({ ok: false, error: 'unavailable' })),
  };
}
