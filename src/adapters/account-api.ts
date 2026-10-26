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
