import type { SaveData } from '../app/save';

/**
 * Account API port (docs/gdd.md, Cuentas): the few calls the client makes to
 * the Shadow Dungeon backend (PocketBase, `server/README.md`). Every call
 * answers a result instead of throwing, so a missing network is just one
 * more outcome and play never waits on it.
 */
export interface AuthSession {
  token: string;
  userId: string;
  email: string;
}

/** One cloud save record: `rev` is the server's revision (optimistic concurrency). */
export interface RemoteSave {
  id: string;
  rev: number;
  data: unknown;
}

export type ApiError =
  /** No answer (offline, DNS, CORS, timeout). */
  | { kind: 'offline' }
  /** The token is missing, expired or revoked, or the credentials are wrong. */
  | { kind: 'unauthorized' }
  /** The server refused the request as invalid (400), e.g. a taken email or a short password. */
  | { kind: 'rejected' }
  /** Too many requests from this address (429). */
  | { kind: 'rate-limited' }
  /** Any other server failure (5xx). */
  | { kind: 'server' }
  /** The save changed on the server (409): `current` is the stored one. */
  | { kind: 'conflict'; current: RemoteSave };

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export interface AccountApi {
  signUp(email: string, password: string): Promise<ApiResult<void>>;
  logIn(email: string, password: string): Promise<ApiResult<AuthSession>>;
  refresh(token: string): Promise<ApiResult<AuthSession>>;
  getSave(token: string, userId: string): Promise<ApiResult<RemoteSave | null>>;
  createSave(token: string, userId: string, data: SaveData): Promise<ApiResult<RemoteSave>>;
  updateSave(token: string, saveId: string, data: SaveData, rev: number): Promise<ApiResult<RemoteSave>>;
  deleteAccount(token: string, userId: string): Promise<ApiResult<void>>;
}

export const DEFAULT_API_URL = 'https://sd-api.fullfran.com';
const TIMEOUT_MS = 15_000;
/** PocketBase record ids are short lowercase letters and digits; anything else never reaches a filter or a path. */
const RECORD_ID = /^[a-z0-9]{1,32}$/;

/** The API base URL (`VITE_API_URL` at build time), without a trailing slash. */
export function apiBaseUrl(configured: unknown): string {
  return typeof configured === 'string' && configured.trim() ? configured.trim().replace(/\/+$/, '') : DEFAULT_API_URL;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function remoteSave(raw: unknown): RemoteSave | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !Number.isSafeInteger(raw.rev)) return null;
  return { id: raw.id, rev: raw.rev as number, data: raw.data };
}

function authSession(raw: unknown): AuthSession | null {
  if (!isObject(raw) || typeof raw.token !== 'string' || !raw.token || !isObject(raw.record)) return null;
  const { id, email } = raw.record;
  return typeof id === 'string' && typeof email === 'string' ? { token: raw.token, userId: id, email } : null;
}

const fail = <T>(kind: Exclude<ApiError['kind'], 'conflict'>): ApiResult<T> => ({ ok: false, error: { kind } as ApiError });

/**
 * The account API over plain fetch. The token goes only to `base` and only
 * in the `Authorization` header, as PocketBase expects it (no "Bearer").
 */
export function httpAccountApi(base: string, fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init)): AccountApi {
  async function call<T>(method: string, path: string, options: { token?: string; body?: unknown }, read: (body: unknown) => T | null): Promise<ApiResult<T>> {
    let response: Response;
    try {
      const headers: Record<string, string> = {};
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      if (options.token) headers.Authorization = options.token;
      const init: RequestInit = { method, headers };
      if (options.body !== undefined) init.body = JSON.stringify(options.body);
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') init.signal = AbortSignal.timeout(TIMEOUT_MS);
      response = await fetchFn(`${base}${path}`, init);
    } catch {
      return fail('offline');
    }
    let body: unknown = null;
    try {
      body = response.status === 204 ? null : await response.json();
    } catch {
      body = null;
    }
    if (response.ok) {
      const value = read(body);
      return value === null ? fail('server') : { ok: true, value };
    }
    switch (response.status) {
      case 400:
      case 404:
        return fail('rejected');
      case 401:
      case 403:
        return fail('unauthorized');
      case 409: {
        const current = isObject(body) && isObject(body.data) ? remoteSave(body.data.current) : null;
        return current ? { ok: false, error: { kind: 'conflict', current } } : fail('server');
      }
      case 429:
        return fail('rate-limited');
      default:
        return fail('server');
    }
  }

  const done = async (pending: Promise<ApiResult<true>>): Promise<ApiResult<void>> => {
    const result = await pending;
    return result.ok ? { ok: true, value: undefined } : result;
  };
  const saveBody = (data: SaveData) => ({ data, version: data.version });

  return {
    signUp: (email, password) => done(call('POST', '/api/collections/users/records', { body: { email, password, passwordConfirm: password } }, () => true)),
    async logIn(email, password) {
      const result = await call('POST', '/api/collections/users/auth-with-password', { body: { identity: email, password } }, authSession);
      // PocketBase answers wrong credentials with 400.
      return !result.ok && result.error.kind === 'rejected' ? fail('unauthorized') : result;
    },
    refresh: (token) => call('POST', '/api/collections/users/auth-refresh', { token }, authSession),
    async getSave(token, userId) {
      if (!RECORD_ID.test(userId)) return fail('rejected');
      const query = new URLSearchParams({ filter: `(user='${userId}')`, perPage: '1' });
      const result = await call('GET', `/api/collections/saves/records?${query}`, { token }, (body) => {
        if (!isObject(body) || !Array.isArray(body.items)) return null;
        return body.items.length === 0 ? ('none' as const) : remoteSave(body.items[0]);
      });
      if (!result.ok) return result;
      return { ok: true, value: result.value === 'none' ? null : result.value };
    },
    createSave: (token, userId, data) => call('POST', '/api/collections/saves/records', { token, body: { user: userId, ...saveBody(data), rev: 0 } }, remoteSave),
    async updateSave(token, saveId, data, rev) {
      if (!RECORD_ID.test(saveId)) return fail('rejected');
      return call('PATCH', `/api/collections/saves/records/${saveId}`, { token, body: { ...saveBody(data), rev } }, remoteSave);
    },
    async deleteAccount(token, userId) {
      if (!RECORD_ID.test(userId)) return fail('rejected');
      return done(call('DELETE', `/api/collections/users/records/${userId}`, { token }, () => true));
    },
  };
}
