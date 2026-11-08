import { describe, expect, it } from 'vitest';
import type { ClerkAuth, ClerkResult, LinkStatus } from '../../src/adapters/clerk-auth';
import { createAuthFlow, type FlowAccount } from '../../src/app/auth-flow';

const DONE: ClerkResult = { ok: true, step: 'done' };

/** A Clerk stand-in: each method answers from `answers` and every call is logged. */
function fakeClerk(answers: Partial<Record<keyof ClerkAuth, ClerkResult>> = {}, token: string | null = 'jwt-1', status: LinkStatus = { session: true, linked: [] }) {
  const log: string[] = [];
  const answer = (name: keyof ClerkAuth) => async (...args: unknown[]) => {
    log.push(`${name}(${args.join(',')})`);
    return answers[name] ?? DONE;
  };
  const clerk: ClerkAuth = {
    available: true,
    signInWithPassword: answer('signInWithPassword') as ClerkAuth['signInWithPassword'],
    signUp: answer('signUp') as ClerkAuth['signUp'],
    verifyEmailCode: answer('verifyEmailCode') as ClerkAuth['verifyEmailCode'],
    requestPasswordReset: answer('requestPasswordReset') as ClerkAuth['requestPasswordReset'],
    resetPassword: answer('resetPassword') as ClerkAuth['resetPassword'],
    oauth: answer('oauth') as ClerkAuth['oauth'],
    completeRedirect: answer('completeRedirect') as ClerkAuth['completeRedirect'],
    linkStatus: async () => status,
    link: answer('link') as ClerkAuth['link'],
    completeLink: answer('completeLink') as ClerkAuth['completeLink'],
    signOut: async () => void log.push('signOut'),
    deleteUser: async () => void log.push('deleteUser'),
    getSessionToken: async () => token,
  };
  return { clerk, log };
}

function fakeAccount(outcome: { ok: true } | { ok: false; error: 'unauthorized' | 'server' | 'offline' } = { ok: true }) {
  const log: string[] = [];
  const account: FlowAccount = {
    logIn: async (e, p) => (log.push(`logIn(${e},${p})`), outcome),
    register: async (e, p) => (log.push(`register(${e},${p})`), outcome),
    logInClerk: async (t) => (log.push(`logInClerk(${t})`), outcome),
    requestPasswordReset: async (e) => (log.push(`reset(${e})`), { ok: true }),
    logOut: () => void log.push('logOut'),
    deleteAccount: async () => (log.push('deleteAccount'), { ok: true }),
  };
  return { account, log };
}

describe('auth flow with Clerk', () => {
  it('signs in: email trimmed and lower-cased, then the Clerk token is exchanged for the game session', async () => {
    const c = fakeClerk();
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: c.clerk, account: a.account });
    expect(flow.usesClerk).toBe(true);
    expect(await flow.signIn('  Ana@Example.COM ', 'secret123')).toEqual({ ok: true, step: 'done' });
    expect(c.log[0]).toBe('signInWithPassword(ana@example.com,secret123)');
    expect(a.log).toEqual(['logInClerk(jwt-1)']);
  });

  it('refuses a malformed email or an empty password before asking Clerk anything', async () => {
    const c = fakeClerk();
    const flow = createAuthFlow({ clerk: c.clerk, account: fakeAccount().account });
    expect(await flow.signIn('nope', 'secret123')).toEqual({ ok: false, error: 'invalid-email' });
    expect(await flow.signIn('a@b.es', '')).toEqual({ ok: false, error: 'wrong-credentials' });
    expect(await flow.signUp('a@b.es', 'short')).toEqual({ ok: false, error: 'password-short' });
    expect(c.log).toEqual([]);
  });

  it('a Clerk error stops the flow and nothing reaches the game server', async () => {
    const c = fakeClerk({ signInWithPassword: { ok: false, error: 'wrong-credentials' } });
    const a = fakeAccount();
    expect(await createAuthFlow({ clerk: c.clerk, account: a.account }).signIn('a@b.es', 'secret123')).toEqual({ ok: false, error: 'wrong-credentials' });
    expect(a.log).toEqual([]);
  });

  it('sign-up asks for the emailed code, and the exchange happens only after it is verified', async () => {
    const c = fakeClerk({ signUp: { ok: true, step: 'code' } });
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: c.clerk, account: a.account });
    expect(await flow.signUp('a@b.es', 'secret123')).toEqual({ ok: true, step: 'code' });
    expect(a.log).toEqual([]);
    expect(await flow.verify(' 123456 ')).toEqual({ ok: true, step: 'done' });
    expect(c.log).toContain('verifyEmailCode(123456)');
    expect(a.log).toEqual(['logInClerk(jwt-1)']);
  });

  it('an empty code is a wrong code', async () => {
    expect(await createAuthFlow({ clerk: fakeClerk().clerk, account: fakeAccount().account }).verify('  ')).toEqual({ ok: false, error: 'code-wrong' });
  });

  it('password reset: the code step, then the new password signs in', async () => {
    const c = fakeClerk({ requestPasswordReset: { ok: true, step: 'code' } });
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: c.clerk, account: a.account });
    expect(await flow.forgot('A@B.es')).toEqual({ ok: true, step: 'code' });
    expect(await flow.reset('111222', 'brand-new-pw')).toEqual({ ok: true, step: 'done' });
    expect(c.log).toContain('resetPassword(111222,brand-new-pw)');
    expect(a.log).toEqual(['logInClerk(jwt-1)']);
    expect(await flow.reset('111222', 'short')).toEqual({ ok: false, error: 'password-short' });
  });

  it('a game server that refuses the exchange signs Clerk out again and reports the error', async () => {
    const c = fakeClerk();
    const a = fakeAccount({ ok: false, error: 'server' });
    expect(await createAuthFlow({ clerk: c.clerk, account: a.account }).signIn('a@b.es', 'secret123')).toEqual({ ok: false, error: 'server' });
    expect(c.log).toContain('signOut');
  });

  it('a missing Clerk token is unauthorized', async () => {
    const c = fakeClerk({}, null);
    expect(await createAuthFlow({ clerk: c.clerk, account: fakeAccount().account }).signIn('a@b.es', 'secret123')).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('OAuth just starts the redirect', async () => {
    const c = fakeClerk();
    await createAuthFlow({ clerk: c.clerk, account: fakeAccount().account }).oauth('discord');
    expect(c.log).toEqual(['oauth(discord)']);
  });

  it('the SSO return exchanges only on ?sso=1 and is null otherwise', async () => {
    const c = fakeClerk();
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: c.clerk, account: a.account });
    expect(await flow.returnFromSso('')).toBeNull();
    expect(await flow.returnFromSso('?x=1')).toBeNull();
    expect(a.log).toEqual([]);
    expect(await flow.returnFromSso('?sso=1&__clerk_status=active')).toEqual({ ok: true, step: 'done' });
    expect(a.log).toEqual(['logInClerk(jwt-1)']);
  });

  it('logging out ends both sessions; deleting the account removes the Clerk user too', async () => {
    const c = fakeClerk();
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: c.clerk, account: a.account });
    await flow.logOut();
    expect(a.log).toEqual(['logOut']);
    expect(c.log).toEqual(['signOut']);
    expect(await flow.deleteAccount()).toEqual({ ok: true });
    expect(c.log).toEqual(['signOut', 'deleteUser', 'signOut']);
  });
});

describe('auth flow without Clerk (the password fallback)', () => {
  const noClerk = (): ClerkAuth => ({ ...fakeClerk().clerk, available: false });

  it('signs in and up with the game server directly', async () => {
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: noClerk(), account: a.account });
    expect(flow.usesClerk).toBe(false);
    expect(await flow.signIn(' Ana@Example.com', 'secret123')).toEqual({ ok: true, step: 'done' });
    expect(await flow.signUp('ana@example.com', 'secret123')).toEqual({ ok: true, step: 'done' });
    expect(a.log).toEqual(['logIn(ana@example.com,secret123)', 'register(ana@example.com,secret123)']);
  });

  it('forgot sends the reset link and needs no code step', async () => {
    const a = fakeAccount();
    expect(await createAuthFlow({ clerk: noClerk(), account: a.account }).forgot('ana@example.com')).toEqual({ ok: true, step: 'sent' });
    expect(a.log).toEqual(['reset(ana@example.com)']);
  });

  it('game server errors come through unchanged', async () => {
    const a = fakeAccount({ ok: false, error: 'unauthorized' });
    expect(await createAuthFlow({ clerk: noClerk(), account: a.account }).signIn('ana@example.com', 'secret123')).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('the SSO return does nothing', async () => {
    expect(await createAuthFlow({ clerk: noClerk(), account: fakeAccount().account }).returnFromSso('?sso=1')).toBeNull();
  });
});

describe('linking Google or Discord to a signed-in account', () => {
  it('with a Clerk session, links straight away and never touches the game session', async () => {
    const c = fakeClerk();
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: c.clerk, account: a.account });
    expect(await flow.link('google')).toEqual({ ok: true, step: 'done' });
    expect(c.log).toEqual(['link(google)']);
    expect(a.log).toEqual([]);
  });

  it('an account signed in before Clerk is asked for its password, which opens the Clerk session on the same email before linking', async () => {
    const c = fakeClerk({}, 'jwt-1', { session: false, linked: [] });
    const a = fakeAccount();
    const flow = createAuthFlow({ clerk: c.clerk, account: a.account });
    expect(await flow.link('discord')).toEqual({ ok: false, error: 'session-needed' });
    expect(c.log).toEqual([]);
    expect(await flow.link('discord', { email: ' Ana@Example.com', password: 'secret123' })).toEqual({ ok: true, step: 'done' });
    expect(c.log).toEqual(['signInWithPassword(ana@example.com,secret123)', 'link(discord)']);
    expect(a.log).toEqual(['logInClerk(jwt-1)']);
  });

  it('a wrong password or a code step stops before linking', async () => {
    const wrong = fakeClerk({ signInWithPassword: { ok: false, error: 'wrong-credentials' } }, 'jwt-1', { session: false, linked: [] });
    expect(await createAuthFlow({ clerk: wrong.clerk, account: fakeAccount().account }).link('google', { email: 'a@b.es', password: 'x' })).toEqual({ ok: false, error: 'wrong-credentials' });
    expect(wrong.log).not.toContain('link(google)');
    const code = fakeClerk({ signInWithPassword: { ok: true, step: 'code' } }, 'jwt-1', { session: false, linked: [] });
    expect(await createAuthFlow({ clerk: code.clerk, account: fakeAccount().account }).link('google', { email: 'a@b.es', password: 'x' })).toEqual({ ok: true, step: 'code' });
    expect(code.log).not.toContain('link(google)');
  });

  it('a provider already linked is done without leaving the page', async () => {
    const c = fakeClerk({}, 'jwt-1', { session: true, linked: ['google'] });
    expect(await createAuthFlow({ clerk: c.clerk, account: fakeAccount().account }).link('google')).toEqual({ ok: true, step: 'done' });
    expect(c.log).toEqual([]);
  });

  it('finishes the return only for ?linked=google or discord, and passes a provider taken by another account through', async () => {
    const c = fakeClerk({ completeLink: { ok: false, error: 'provider-taken' } });
    const flow = createAuthFlow({ clerk: c.clerk, account: fakeAccount().account });
    expect(await flow.returnFromLink('?sso=1')).toBeNull();
    expect(await flow.returnFromLink('?linked=twitter')).toBeNull();
    expect(await flow.returnFromLink('?linked=discord')).toEqual({ provider: 'discord', result: { ok: false, error: 'provider-taken' } });
  });
});
