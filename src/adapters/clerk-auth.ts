/**
 * The Clerk identity adapter (odd/tasks/account-drawer-and-menus.md): a thin
 * layer over `@clerk/clerk-js`, loaded lazily and only when a publishable key
 * is configured. Clerk proves who the player is; the game then exchanges the
 * Clerk session token for its own account session (adapters/account-api.ts
 * `clerkSession`). Every call answers a result instead of throwing, and a
 * Clerk error becomes one of a few i18n-ready keys (`account.error.<key>`).
 */
export type ClerkErrorKey = 'wrong-credentials' | 'password-short' | 'password-pwned' | 'email-taken' | 'code-wrong' | 'code-expired' | 'invalid-email' | 'rate-limited' | 'network' | 'unknown';
/** `code`: Clerk emailed a code the player must type before the session exists. */
export type ClerkStep = 'done' | 'code';
export type ClerkResult = { ok: true; step: ClerkStep } | { ok: false; error: ClerkErrorKey };
export type OAuthProvider = 'google' | 'discord';

export interface ClerkAuth {
  /** False when the build has no publishable key: the password flow stays. */
  readonly available: boolean;
  signInWithPassword(email: string, password: string): Promise<ClerkResult>;
  signUp(email: string, password: string): Promise<ClerkResult>;
  /** The code of whichever step is pending (sign-up, or a sign-in on a new device). */
  verifyEmailCode(code: string): Promise<ClerkResult>;
  requestPasswordReset(email: string): Promise<ClerkResult>;
  resetPassword(code: string, password: string): Promise<ClerkResult>;
  /** Leaves the page for the provider; resolves only on failure. */
  oauth(provider: OAuthProvider): Promise<ClerkResult>;
  /** Finishes the OAuth return (`?sso=1`). */
  completeRedirect(): Promise<ClerkResult>;
  signOut(): Promise<void>;
  /** Best effort: removes the Clerk user (the game account is deleted separately). */
  deleteUser(): Promise<void>;
  getSessionToken(): Promise<string | null>;
}

type Dict = Record<string, unknown>;
const isDict = (value: unknown): value is Dict => typeof value === 'object' && value !== null;

const CODES: Record<string, ClerkErrorKey> = {
  form_password_incorrect: 'wrong-credentials',
  form_identifier_not_found: 'wrong-credentials',
  strategy_for_user_invalid: 'wrong-credentials',
  form_password_pwned: 'password-pwned',
  form_password_length_too_short: 'password-short',
  form_password_not_strong_enough: 'password-short',
  form_password_validation_failed: 'password-short',
  form_identifier_exists: 'email-taken',
  form_code_incorrect: 'code-wrong',
  verification_failed: 'code-wrong',
  verification_expired: 'code-expired',
  form_param_format_invalid: 'invalid-email',
  form_param_nil: 'invalid-email',
  too_many_requests: 'rate-limited',
  network_error: 'network',
};

/** Maps a thrown Clerk error (API response error, runtime error or a fetch failure) to a key. */
export function clerkErrorKey(error: unknown): ClerkErrorKey {
  if (error instanceof TypeError) return 'network';
  if (!isDict(error)) return 'unknown';
  if (typeof error.code === 'string' && CODES[error.code]) return CODES[error.code]!;
  const first = Array.isArray(error.errors) ? error.errors[0] : undefined;
  if (isDict(first) && typeof first.code === 'string') return CODES[first.code] ?? 'unknown';
  return 'unknown';
}

/** The slice of a Clerk instance the adapter uses (so tests can stand in for it). */
export interface ClerkLike {
  session?: { getToken(): Promise<string | null> } | null;
  client?: { signIn: Dict; signUp: Dict };
  setActive(params: { session: string | null }): Promise<unknown>;
  signOut(): Promise<unknown>;
  handleRedirectCallback(params: Dict, navigate?: (to: string) => Promise<unknown>): Promise<unknown>;
  user?: { delete(): Promise<unknown> } | null;
}

type Call = (args?: Dict) => Promise<Dict>;
const call = (resource: Dict, name: string): Call => {
  const fn = resource[name];
  if (typeof fn !== 'function') throw new Error(`clerk: ${name} missing`);
  return (args) => (fn as (a?: Dict) => Promise<Dict>).call(resource, args);
};

type Pending = 'sign-up' | 'sign-in' | 'reset' | null;

export function createClerkAuth(options: { load(): Promise<ClerkLike>; origin: string }): ClerkAuth {
  let pending: Pending = null;
  const callback = `${options.origin}/?sso=1`;

  /** Runs `task` with a loaded Clerk; any failure becomes an error result. */
  async function guarded(task: (clerk: ClerkLike, signIn: Dict, signUp: Dict) => Promise<ClerkResult>): Promise<ClerkResult> {
    try {
      const clerk = await options.load();
      return await task(clerk, (clerk.client?.signIn ?? {}) as Dict, (clerk.client?.signUp ?? {}) as Dict);
    } catch (error) {
      return { ok: false, error: clerkErrorKey(error) };
    }
  }

  /** A fresh attempt starts without an old Clerk session in the way. */
  const fresh = async (clerk: ClerkLike): Promise<void> => {
    if (clerk.session) await clerk.signOut();
  };

  /** Activates the session of a completed attempt. */
  async function finish(clerk: ClerkLike, attempt: Dict): Promise<ClerkResult> {
    if (attempt.status !== 'complete' || typeof attempt.createdSessionId !== 'string') return { ok: false, error: 'unknown' };
    await clerk.setActive({ session: attempt.createdSessionId });
    pending = null;
    return { ok: true, step: 'done' };
  }

  return {
    available: true,
    signInWithPassword: (email, password) =>
      guarded(async (clerk, signIn) => {
        pending = null;
        await fresh(clerk);
        const attempt = await call(signIn, 'create')({ identifier: email, password });
        if (attempt.status === 'complete') return finish(clerk, attempt);
        // A new device: Clerk wants the code it emails (client trust / second factor).
        if (attempt.status === 'needs_client_trust' || attempt.status === 'needs_second_factor') {
          await call(signIn, 'prepareSecondFactor')({ strategy: 'email_code' });
          pending = 'sign-in';
          return { ok: true, step: 'code' };
        }
        return { ok: false, error: 'unknown' };
      }),
    signUp: (email, password) =>
      guarded(async (clerk, _signIn, signUp) => {
        pending = null;
        await fresh(clerk);
        const attempt = await call(signUp, 'create')({ emailAddress: email, password });
        if (attempt.status === 'complete') return finish(clerk, attempt);
        await call(signUp, 'prepareEmailAddressVerification')({ strategy: 'email_code' });
        pending = 'sign-up';
        return { ok: true, step: 'code' };
      }),
    verifyEmailCode: (code) =>
      guarded(async (clerk, signIn, signUp) => {
        if (pending === 'sign-up') return finish(clerk, await call(signUp, 'attemptEmailAddressVerification')({ code }));
        if (pending === 'sign-in') return finish(clerk, await call(signIn, 'attemptSecondFactor')({ strategy: 'email_code', code }));
        return { ok: false, error: 'code-wrong' };
      }),
    requestPasswordReset: (email) =>
      guarded(async (clerk, signIn) => {
        pending = null;
        await fresh(clerk);
        await call(signIn, 'create')({ strategy: 'reset_password_email_code', identifier: email });
        pending = 'reset';
        return { ok: true, step: 'code' };
      }),
    resetPassword: (code, password) =>
      guarded(async (clerk, signIn) => {
        if (pending !== 'reset') return { ok: false, error: 'code-wrong' };
        await call(signIn, 'attemptFirstFactor')({ strategy: 'reset_password_email_code', code });
        return finish(clerk, await call(signIn, 'resetPassword')({ password, signOutOfOtherSessions: false }));
      }),
    oauth: (provider) =>
      guarded(async (clerk, signIn) => {
        await fresh(clerk);
        await call(signIn, 'authenticateWithRedirect')({ strategy: `oauth_${provider}`, redirectUrl: callback, redirectUrlComplete: callback });
        return { ok: true, step: 'done' };
      }),
    completeRedirect: () =>
      guarded(async (clerk) => {
        // No navigation: the page stays where it is; the caller strips `?sso=1`.
        await clerk.handleRedirectCallback({ signInFallbackRedirectUrl: callback, signUpFallbackRedirectUrl: callback, signInForceRedirectUrl: callback, signUpForceRedirectUrl: callback }, async () => undefined);
        return clerk.session ? { ok: true, step: 'done' } : { ok: false, error: 'unknown' };
      }),
    async signOut() {
      try {
        const clerk = await options.load();
        if (clerk.session) await clerk.signOut();
      } catch {
        // The game session is what matters; Clerk's is dropped on the next attempt.
      }
    },
    async deleteUser() {
      try {
        const clerk = await options.load();
        await clerk.user?.delete();
      } catch {
        // Best effort.
      }
    },
    async getSessionToken() {
      try {
        const clerk = await options.load();
        return (await clerk.session?.getToken()) ?? null;
      } catch {
        return null;
      }
    },
  };
}

/** Clerk is not configured: every call says so and nothing is loaded. */
export const noClerk: ClerkAuth = (() => {
  const off = async (): Promise<ClerkResult> => ({ ok: false, error: 'unknown' });
  return { available: false, signInWithPassword: off, signUp: off, verifyEmailCode: off, requestPasswordReset: off, resetPassword: off, oauth: off, completeRedirect: off, signOut: async () => {}, deleteUser: async () => {}, getSessionToken: async () => null };
})();

/** The real thing: `@clerk/clerk-js` is imported on the first call only. */
export function browserClerk(publishableKey: string, origin: string): ClerkAuth {
  let loading: Promise<ClerkLike> | null = null;
  const load = (): Promise<ClerkLike> => {
    loading ??= import('@clerk/clerk-js').then(async ({ Clerk }) => {
      const clerk = new Clerk(publishableKey);
      await clerk.load();
      return clerk as unknown as ClerkLike;
    });
    // A failed load may be retried on the next attempt.
    loading.catch(() => {
      loading = null;
    });
    return loading;
  };
  return createClerkAuth({ load, origin });
}

/** Clerk when `VITE_CLERK_PUBLISHABLE_KEY` is set, else the no-op (the password flow). */
/**
 * Where the game lives, without the trailing slash: the page's directory, so a build served under a path
 * (https://www.fullfran.com/shadow-dungeon/, or its /gacha route one segment deeper) gets the OAuth return
 * there and not on the site's root.
 */
export function appBaseUrl(href: string): string {
  return new URL('./', href).href.replace(/\/$/, '');
}

export function clerkFromEnv(key: unknown, origin: string): ClerkAuth {
  return typeof key === 'string' && key.trim() ? browserClerk(key.trim(), origin) : noClerk;
}
