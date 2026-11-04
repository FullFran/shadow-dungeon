/**
 * The typed error model (odd/tasks/loading-errors.md). Every failure of the
 * network or of an asset becomes one of a few kinds, so each screen answers it
 * the same way: a message that says what happened, and a next step. Adapters
 * keep their own result vocabularies; this is what they classify with and what
 * the UI reads (`error.<kind>.title` / `.hint` in i18n).
 */
export const ERROR_KINDS = ['offline', 'timeout', 'server', 'auth', 'rate-limited', 'asset', 'unexpected'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export interface AppError {
  kind: ErrorKind;
  /** Trying again can help (the network, a slow answer or a failing server); never a refusal. */
  retryable: boolean;
}

const RETRYABLE: ReadonlySet<ErrorKind> = new Set(['offline', 'timeout', 'server']);

export const isRetryable = (kind: ErrorKind): boolean => RETRYABLE.has(kind);

export const appError = (kind: ErrorKind): AppError => ({ kind, retryable: isRetryable(kind) });

/** i18n prefix of a kind: `<prefix>.title` and `<prefix>.hint`. */
export const errorMessageKey = (kind: ErrorKind): string => `error.${kind}`;

/** A thrown fetch: a timeout or abort, the network being gone (fetch throws a TypeError), or something unforeseen. */
export function fromFetchFailure(error: unknown, online = true): AppError {
  if (!online) return appError('offline');
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'TimeoutError' || name === 'AbortError') return appError('timeout');
  if (error instanceof TypeError) return appError('offline');
  return appError('unexpected');
}

/** A response that is not ok. */
export function fromStatus(status: number): AppError {
  if (status === 401 || status === 403) return appError('auth');
  if (status === 408 || status === 504) return appError('timeout');
  if (status === 429) return appError('rate-limited');
  if (status >= 500) return appError('server');
  return appError('unexpected');
}

/** Whether the browser says it is online (true where it cannot tell: tests, workers). */
export const browserOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

type Listener = (error: AppError, scope: string) => void;
const listeners = new Set<Listener>();

/** Every classified failure (scope: "ranking", "friends", "sprite"...) reaches the listeners: diagnostics, the offline banner, toasts. */
export function subscribeErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function reportError(error: AppError, scope: string): void {
  for (const listener of [...listeners]) {
    try {
      listener(error, scope);
    } catch {
      // A broken listener never hides the failure from the others.
    }
  }
}
