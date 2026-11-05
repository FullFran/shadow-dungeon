import { browserOnline, fromFetchFailure, fromStatus, reportError, reportReached, type AppError } from './net-error';

/**
 * One way to call the network (odd/tasks/loading-errors.md): a timeout for
 * every attempt, every failure classified by the error model and reported to
 * its listeners once, and a retry with growing backoff for idempotent GETs
 * only (a POST, PATCH or DELETE may already have done its work: it is never
 * sent twice). The caller gets the response (even a refusal, so it can read
 * the body) or an `AppError`; it never has to catch.
 */
export const DEFAULT_BACKOFF_MS: readonly number[] = [400, 1200];
export const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
export type RequestResult = { ok: true; response: Response } | { ok: false; error: AppError; response?: Response };

export interface RequestOptions {
  timeoutMs?: number;
  /** Waits before each retry of a GET; its length is the number of retries. */
  backoffMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Who is asking ("ranking", "friends"...), for the listeners. */
  scope?: string;
  online?: () => boolean;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;
}

async function attempt(fetchFn: FetchFn, url: string, init: RequestInit, timeoutMs: number, online: () => boolean): Promise<RequestResult> {
  const signal = timeoutSignal(timeoutMs);
  let response: Response;
  try {
    response = await fetchFn(url, signal ? { ...init, signal } : init);
  } catch (error) {
    return { ok: false, error: fromFetchFailure(error, online()) };
  }
  return response.ok ? { ok: true, response } : { ok: false, error: fromStatus(response.status), response };
}

export async function request(fetchFn: FetchFn, url: string, init: RequestInit, options: RequestOptions = {}): Promise<RequestResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, sleep = defaultSleep, scope = 'api', online = browserOnline } = options;
  const idempotent = (init.method ?? 'GET').toUpperCase() === 'GET';
  const backoff = idempotent ? (options.backoffMs ?? backoffInUse) : [];
  let result = await attempt(fetchFn, url, init, timeoutMs, online);
  for (const wait of backoff) {
    if (result.ok || !result.error.retryable) break;
    await sleep(wait);
    result = await attempt(fetchFn, url, init, timeoutMs, online);
  }
  if (result.ok || result.response) reportReached(scope);
  // A plain refusal (400, 404...) is the server answering about the request, not a failure to show.
  if (!result.ok && !(result.response && result.error.kind === 'unexpected')) reportError(result.error, scope);
  return result;
}

let backoffInUse: readonly number[] = DEFAULT_BACKOFF_MS;

/** Tests shorten the waits (the production list is DEFAULT_BACKOFF_MS). */
export function setBackoffForTests(ms: readonly number[]): void {
  backoffInUse = ms;
}
