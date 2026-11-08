import { OAUTH_PROVIDERS, type ClerkAuth, type ClerkErrorKey, type ClerkResult, type LinkStatus, type OAuthProvider } from '../adapters/clerk-auth';
import { MIN_PASSWORD, type Account, type AccountError, type AuthOutcome } from './account';

/**
 * Sign-in, sign-up, reset and sign-out as the account drawer drives them
 * (odd/tasks/account-drawer-and-menus.md). With Clerk configured, Clerk proves
 * the identity and the Clerk session token is exchanged for the game session
 * (`Account.logInClerk`), so cloud sync, profiles and friends are untouched;
 * without it the old password endpoints answer. The drawer never talks to
 * Clerk or the account directly, and every call answers a result.
 */
export type FlowError = AccountError | ClerkErrorKey;
/** `code`: an emailed code is needed next. `sent`: a reset link was mailed (no Clerk). */
export type FlowResult = { ok: true; step: 'done' | 'code' | 'sent' } | { ok: false; error: FlowError };

export interface AuthFlow {
  /** True when Clerk drives the flow (Google, Discord and the code steps exist). */
  readonly usesClerk: boolean;
  signIn(email: string, password: string): Promise<FlowResult>;
  signUp(email: string, password: string): Promise<FlowResult>;
  verify(code: string): Promise<FlowResult>;
  forgot(email: string): Promise<FlowResult>;
  reset(code: string, password: string): Promise<FlowResult>;
  oauth(provider: OAuthProvider): Promise<FlowResult>;
  /** On load: finishes an OAuth return when the query says `sso=1`; null when this load is not one. */
  returnFromSso(search: string): Promise<FlowResult | null>;
  /** Which providers this account has linked, and whether Clerk has a session here; null without Clerk. */
  linkStatus(): Promise<LinkStatus | null>;
  /**
   * Adds Google or Discord to the signed-in account (it leaves the page for the provider). An account signed in
   * before Clerk has no Clerk session: its password (`confirm`) opens one first, on the same email, so the provider
   * lands on this account and never on a new one. `session-needed` asks the drawer for that password; a `code`
   * step asks for the emailed code (`verify`), then `link` again.
   */
  link(provider: OAuthProvider, confirm?: { email: string; password: string }): Promise<FlowResult>;
  /** On load: finishes the return from `link` (`?linked=<provider>`); null when this load is not one. */
  returnFromLink(search: string): Promise<{ provider: OAuthProvider; result: FlowResult } | null>;
  logOut(): Promise<void>;
  deleteAccount(): Promise<{ ok: true } | { ok: false; error: FlowError }>;
}

export type FlowAccount = Pick<Account, 'logIn' | 'register' | 'logInClerk' | 'requestPasswordReset' | 'logOut' | 'deleteAccount'>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Postel: what the player typed, trimmed and lower-cased; null when it cannot be an email. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

const fail = (error: FlowError): FlowResult => ({ ok: false, error });
const DONE: FlowResult = { ok: true, step: 'done' };
const fromOutcome = (outcome: AuthOutcome): FlowResult => (outcome.ok ? DONE : fail(outcome.error));

export function createAuthFlow(deps: { clerk: ClerkAuth; account: FlowAccount }): AuthFlow {
  const { clerk, account } = deps;

  /** Clerk is signed in: trade its token for the game session; if the game refuses, Clerk is left clean. */
  async function exchange(): Promise<FlowResult> {
    const token = await clerk.getSessionToken();
    if (!token) return fail('unauthorized');
    const outcome = await account.logInClerk(token);
    if (!outcome.ok) await clerk.signOut();
    return fromOutcome(outcome);
  }
  const afterClerk = async (result: ClerkResult): Promise<FlowResult> => {
    if (!result.ok) return fail(result.error);
    return result.step === 'code' ? { ok: true, step: 'code' } : exchange();
  };

  async function signIn(rawEmail: string, password: string): Promise<FlowResult> {
    const email = normalizeEmail(rawEmail);
    if (!email) return fail('invalid-email');
    if (!password) return fail('wrong-credentials');
    return clerk.available ? afterClerk(await clerk.signInWithPassword(email, password)) : fromOutcome(await account.logIn(email, password));
  }

  return {
    usesClerk: clerk.available,
    signIn,
    async signUp(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      if (!email) return fail('invalid-email');
      if (password.length < MIN_PASSWORD) return fail('password-short');
      return clerk.available ? afterClerk(await clerk.signUp(email, password)) : fromOutcome(await account.register(email, password));
    },
    async verify(rawCode) {
      const code = rawCode.trim();
      if (!code) return fail('code-wrong');
      return afterClerk(await clerk.verifyEmailCode(code));
    },
    async forgot(rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (!email) return fail('invalid-email');
      if (clerk.available) return afterClerk(await clerk.requestPasswordReset(email));
      const sent = await account.requestPasswordReset(email);
      return sent.ok ? { ok: true, step: 'sent' } : fail(sent.error);
    },
    async reset(rawCode, password) {
      const code = rawCode.trim();
      if (!code) return fail('code-wrong');
      if (password.length < MIN_PASSWORD) return fail('password-short');
      return afterClerk(await clerk.resetPassword(code, password));
    },
    async oauth(provider) {
      if (!clerk.available) return fail('unknown');
      const result = await clerk.oauth(provider);
      return result.ok ? DONE : fail(result.error);
    },
    async returnFromSso(search) {
      if (!clerk.available || new URLSearchParams(search).get('sso') !== '1') return null;
      return afterClerk(await clerk.completeRedirect());
    },
    async linkStatus() {
      return clerk.available ? clerk.linkStatus() : null;
    },
    async link(provider, confirm) {
      if (!clerk.available) return fail('unknown');
      const status = await clerk.linkStatus();
      if (status.linked.includes(provider)) return DONE;
      if (!status.session) {
        if (!confirm) return fail('session-needed');
        const signed = await signIn(confirm.email, confirm.password);
        if (!signed.ok || signed.step !== 'done') return signed;
      }
      const result = await clerk.link(provider);
      return result.ok ? DONE : fail(result.error);
    },
    async returnFromLink(search) {
      const provider = OAUTH_PROVIDERS.find((p) => p === new URLSearchParams(search).get('linked'));
      if (!clerk.available || !provider) return null;
      const result = await clerk.completeLink(provider);
      return { provider, result: result.ok ? DONE : fail(result.error) };
    },
    async logOut() {
      account.logOut();
      await clerk.signOut();
    },
    async deleteAccount() {
      const result = await account.deleteAccount();
      if (!result.ok) return result;
      await clerk.deleteUser();
      await clerk.signOut();
      return { ok: true };
    },
  };
}
