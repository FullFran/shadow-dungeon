import { describe, expect, it } from 'vitest';
import { clerkErrorKey, createClerkAuth, type ClerkLike } from '../../src/adapters/clerk-auth';

const apiError = (code: string) => ({ clerkError: true, errors: [{ code, message: code, longMessage: code }] });

describe('clerkErrorKey', () => {
  const table: [unknown, string][] = [
    [apiError('form_password_incorrect'), 'wrong-credentials'],
    [apiError('form_identifier_not_found'), 'wrong-credentials'],
    [apiError('form_password_pwned'), 'password-pwned'],
    [apiError('form_password_length_too_short'), 'password-short'],
    [apiError('form_password_not_strong_enough'), 'password-short'],
    [apiError('form_identifier_exists'), 'email-taken'],
    [apiError('form_code_incorrect'), 'code-wrong'],
    [apiError('verification_failed'), 'code-wrong'],
    [apiError('verification_expired'), 'code-expired'],
    [apiError('form_param_format_invalid'), 'invalid-email'],
    [apiError('too_many_requests'), 'rate-limited'],
    [{ code: 'network_error', message: 'x' }, 'network'],
    [new TypeError('Failed to fetch'), 'network'],
    [apiError('something_new'), 'unknown'],
    [null, 'unknown'],
    [{ errors: [] }, 'unknown'],
  ];
  for (const [input, key] of table) it(`maps ${JSON.stringify(input) ?? String(input)} to ${key}`, () => expect(clerkErrorKey(input)).toBe(key));
});

interface Call {
  name: string;
  args: unknown;
}

interface Script {
  signIn?: Record<string, unknown>;
  signUp?: Record<string, unknown>;
  session?: boolean;
  failOn?: { name: string; error: unknown };
}

/** A Clerk stand-in that records calls and answers each resource from a script. */
function fakeClerk(script: Script = {}) {
  const calls: Call[] = [];
  const rec = (name: string, answer: unknown) => async (args?: unknown) => {
    calls.push({ name, args });
    if (script.failOn?.name === name) throw script.failOn.error;
    return answer;
  };
  const signIn = {
    create: rec('signIn.create', script.signIn?.create ?? { status: 'complete', createdSessionId: 'sess_1' }),
    prepareSecondFactor: rec('signIn.prepareSecondFactor', {}),
    attemptSecondFactor: rec('signIn.attemptSecondFactor', script.signIn?.attemptSecondFactor ?? { status: 'complete', createdSessionId: 'sess_2' }),
    attemptFirstFactor: rec('signIn.attemptFirstFactor', script.signIn?.attemptFirstFactor ?? { status: 'needs_new_password' }),
    resetPassword: rec('signIn.resetPassword', script.signIn?.resetPassword ?? { status: 'complete', createdSessionId: 'sess_3' }),
    authenticateWithRedirect: rec('signIn.authenticateWithRedirect', undefined),
  };
  const signUp = {
    create: rec('signUp.create', script.signUp?.create ?? { status: 'missing_requirements', unverifiedFields: ['email_address'] }),
    prepareEmailAddressVerification: rec('signUp.prepareEmailAddressVerification', {}),
    attemptEmailAddressVerification: rec('signUp.attemptEmailAddressVerification', script.signUp?.attempt ?? { status: 'complete', createdSessionId: 'sess_4' }),
  };
  const clerk = {
    session: script.session ? { getToken: async () => 'old-token' } : null,
    client: { signIn, signUp },
    setActive: rec('setActive', undefined),
    signOut: rec('signOut', undefined),
    handleRedirectCallback: rec('handleRedirectCallback', undefined),
    user: { delete: rec('user.delete', undefined) },
  };
  return { calls, clerk: clerk as unknown as ClerkLike, names: () => calls.map((c) => c.name) };
}

const auth = (fake: { clerk: ClerkLike }) => createClerkAuth({ load: async () => fake.clerk, origin: 'https://game.test' });

describe('clerk auth adapter', () => {
  it('signs in with a password and activates the created session', async () => {
    const fake = fakeClerk();
    const result = await auth(fake).signInWithPassword('ana@example.com', 'secret123');
    expect(result).toEqual({ ok: true, step: 'done' });
    expect(fake.calls[0]).toEqual({ name: 'signIn.create', args: { identifier: 'ana@example.com', password: 'secret123' } });
    expect(fake.calls.at(-1)).toEqual({ name: 'setActive', args: { session: 'sess_1' } });
  });

  it('drops a leftover Clerk session before a new sign-in', async () => {
    const fake = fakeClerk({ session: true });
    await auth(fake).signInWithPassword('ana@example.com', 'secret123');
    expect(fake.names().slice(0, 2)).toEqual(['signOut', 'signIn.create']);
  });

  it('asks for the emailed code when the sign-in needs a second step, then finishes with it', async () => {
    const fake = fakeClerk({ signIn: { create: { status: 'needs_client_trust', supportedSecondFactors: [{ strategy: 'email_code' }] } } });
    const flow = auth(fake);
    expect(await flow.signInWithPassword('ana@example.com', 'secret123')).toEqual({ ok: true, step: 'code' });
    expect(fake.names()).toContain('signIn.prepareSecondFactor');
    expect(await flow.verifyEmailCode('123456')).toEqual({ ok: true, step: 'done' });
    expect(fake.calls.find((c) => c.name === 'signIn.attemptSecondFactor')?.args).toEqual({ strategy: 'email_code', code: '123456' });
    expect(fake.calls.at(-1)).toEqual({ name: 'setActive', args: { session: 'sess_2' } });
  });

  it('maps a wrong password to wrong-credentials', async () => {
    const fake = fakeClerk({ failOn: { name: 'signIn.create', error: apiError('form_password_incorrect') } });
    expect(await auth(fake).signInWithPassword('ana@example.com', 'nope')).toEqual({ ok: false, error: 'wrong-credentials' });
  });

  it('signs up, sends the email code and verifies it', async () => {
    const fake = fakeClerk();
    const flow = auth(fake);
    expect(await flow.signUp('ana@example.com', 'secret123')).toEqual({ ok: true, step: 'code' });
    expect(fake.calls[0]).toEqual({ name: 'signUp.create', args: { emailAddress: 'ana@example.com', password: 'secret123' } });
    expect(fake.calls.find((c) => c.name === 'signUp.prepareEmailAddressVerification')?.args).toEqual({ strategy: 'email_code' });
    expect(await flow.verifyEmailCode('654321')).toEqual({ ok: true, step: 'done' });
    expect(fake.calls.find((c) => c.name === 'signUp.attemptEmailAddressVerification')?.args).toEqual({ code: '654321' });
    expect(fake.calls.at(-1)).toEqual({ name: 'setActive', args: { session: 'sess_4' } });
  });

  it('maps a taken email on sign-up', async () => {
    const fake = fakeClerk({ failOn: { name: 'signUp.create', error: apiError('form_identifier_exists') } });
    expect(await auth(fake).signUp('ana@example.com', 'secret123')).toEqual({ ok: false, error: 'email-taken' });
  });

  it('verifying a code with nothing pending is a wrong code, not a crash', async () => {
    expect(await auth(fakeClerk()).verifyEmailCode('111111')).toEqual({ ok: false, error: 'code-wrong' });
  });

  it('resets a password with the emailed code and a new password', async () => {
    const fake = fakeClerk();
    const flow = auth(fake);
    expect(await flow.requestPasswordReset('ana@example.com')).toEqual({ ok: true, step: 'code' });
    expect(fake.calls[0]).toEqual({ name: 'signIn.create', args: { strategy: 'reset_password_email_code', identifier: 'ana@example.com' } });
    expect(await flow.resetPassword('999999', 'brand-new-pw')).toEqual({ ok: true, step: 'done' });
    expect(fake.calls.find((c) => c.name === 'signIn.attemptFirstFactor')?.args).toEqual({ strategy: 'reset_password_email_code', code: '999999' });
    expect(fake.calls.find((c) => c.name === 'signIn.resetPassword')?.args).toMatchObject({ password: 'brand-new-pw' });
    expect(fake.calls.at(-1)).toEqual({ name: 'setActive', args: { session: 'sess_3' } });
  });

  it('starts OAuth with a redirect that returns to /?sso=1', async () => {
    const fake = fakeClerk();
    await auth(fake).oauth('google');
    await auth(fake).oauth('discord');
    const redirects = fake.calls.filter((c) => c.name === 'signIn.authenticateWithRedirect').map((c) => c.args);
    expect(redirects).toEqual([
      { strategy: 'oauth_google', redirectUrl: 'https://game.test/?sso=1', redirectUrlComplete: 'https://game.test/?sso=1' },
      { strategy: 'oauth_discord', redirectUrl: 'https://game.test/?sso=1', redirectUrlComplete: 'https://game.test/?sso=1' },
    ]);
  });

  it('completes the redirect callback without navigating and reports an active session', async () => {
    const fake = fakeClerk({ session: true });
    const result = await auth(fake).completeRedirect();
    expect(result).toEqual({ ok: true, step: 'done' });
    expect(fake.calls.find((c) => c.name === 'handleRedirectCallback')).toBeDefined();
  });

  it('a redirect callback with no session is an error', async () => {
    expect(await auth(fakeClerk()).completeRedirect()).toMatchObject({ ok: false });
  });

  it('hands out the session token, or null with none', async () => {
    expect(await auth(fakeClerk({ session: true })).getSessionToken()).toBe('old-token');
    expect(await auth(fakeClerk()).getSessionToken()).toBeNull();
  });

  it('a Clerk that cannot load is a network error, never a throw', async () => {
    const flow = createClerkAuth({ load: async () => Promise.reject(new TypeError('Failed to fetch')), origin: 'https://game.test' });
    expect(await flow.signInWithPassword('a@b.es', 'secret123')).toEqual({ ok: false, error: 'network' });
  });
});
