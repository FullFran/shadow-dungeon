import { describe, expect, it } from 'vitest';
import { backTarget, errorKey, focusMove, GUEST_CONS, GUEST_PROS, modeView, outcomeOf, type DrawerMode } from '../../src/app/account-drawer-model';
import { catalog, LANGUAGES } from '../../src/i18n';

const MODES: DrawerMode[] = ['sign-in', 'sign-up', 'verify', 'forgot', 'reset'];

describe('drawer modes', () => {
  it('each mode names its fields and one call to action', () => {
    expect(modeView('sign-in').fields).toEqual(['email', 'password']);
    expect(modeView('sign-up').fields).toEqual(['email', 'password']);
    expect(modeView('verify').fields).toEqual(['code']);
    expect(modeView('forgot').fields).toEqual(['email']);
    expect(modeView('reset').fields).toEqual(['code', 'password']);
    expect(modeView('sign-in').cta).toBe('account.drawer.cta.signIn');
  });

  it('every title, why-line and call to action exists in every language', () => {
    for (const language of LANGUAGES) {
      const keys = MODES.flatMap((mode) => {
        const v = modeView(mode);
        return [v.title, v.why, v.cta];
      });
      expect(keys.filter((k) => !k || !(k in catalog(language))), language).toEqual([]);
    }
  });
});

describe('what a result does to the drawer', () => {
  it('sign-in: done signs in; a code step asks for the code; an error stays with its message', () => {
    expect(outcomeOf('sign-in', { ok: true, step: 'done' }, 'sign-in')).toEqual({ mode: 'signed-in', error: null, notice: null });
    expect(outcomeOf('sign-in', { ok: true, step: 'code' }, 'sign-in')).toEqual({ mode: 'verify', error: null, notice: 'account.drawer.codeSent' });
    expect(outcomeOf('sign-in', { ok: false, error: 'wrong-credentials' }, 'sign-in')).toEqual({ mode: 'sign-in', error: 'account.error.wrong-credentials', notice: null });
  });

  it('sign-up goes to the code step ("Te hemos enviado un código") and an email already taken stays on sign-up', () => {
    expect(outcomeOf('sign-up', { ok: true, step: 'code' }, 'sign-up')).toEqual({ mode: 'verify', error: null, notice: 'account.drawer.codeSent' });
    expect(outcomeOf('sign-up', { ok: false, error: 'email-taken' }, 'sign-up').mode).toBe('sign-up');
  });

  it('a wrong code stays on the code step', () => {
    expect(outcomeOf('verify', { ok: false, error: 'code-wrong' }, 'verify')).toEqual({ mode: 'verify', error: 'account.error.code-wrong', notice: null });
    expect(outcomeOf('verify', { ok: true, step: 'done' }, 'verify').mode).toBe('signed-in');
  });

  it('forgot: Clerk asks for a code and a new password; the mailed-link fallback returns to sign-in with a notice', () => {
    expect(outcomeOf('forgot', { ok: true, step: 'code' }, 'forgot')).toEqual({ mode: 'reset', error: null, notice: 'account.drawer.codeSent' });
    expect(outcomeOf('forgot', { ok: true, step: 'sent' }, 'forgot')).toEqual({ mode: 'sign-in', error: null, notice: 'account.resetSent' });
    expect(outcomeOf('reset', { ok: true, step: 'done' }, 'reset').mode).toBe('signed-in');
  });

  it('every flow error has a message in every language', () => {
    const errors = ['wrong-credentials', 'password-short', 'password-pwned', 'email-taken', 'code-wrong', 'code-expired', 'invalid-email', 'rate-limited', 'network', 'unknown', 'offline', 'unauthorized', 'rejected', 'server', 'too-short'] as const;
    for (const language of LANGUAGES) expect(errors.filter((e) => !(errorKey(e) in catalog(language))), language).toEqual([]);
  });

  it('"back" from the code step returns to where it came from; elsewhere to sign-in', () => {
    expect(backTarget('verify', 'sign-up')).toBe('sign-up');
    expect(backTarget('verify', 'sign-in')).toBe('sign-in');
    expect(backTarget('reset', 'sign-in')).toBe('forgot');
    expect(backTarget('forgot', 'sign-in')).toBe('sign-in');
    expect(backTarget('sign-up', 'sign-in')).toBe('sign-in');
  });
});

describe('the guest choice is honest and short', () => {
  it('lists at most three pros of an account and three trade-offs of guest, all translated', () => {
    expect(GUEST_PROS.length).toBeGreaterThan(0);
    expect(GUEST_PROS.length).toBeLessThanOrEqual(3);
    expect(GUEST_CONS.length).toBeGreaterThan(0);
    expect(GUEST_CONS.length).toBeLessThanOrEqual(3);
    for (const language of LANGUAGES) expect([...GUEST_PROS, ...GUEST_CONS].filter((k) => !(k in catalog(language))), language).toEqual([]);
  });
});

describe('keyboard focus inside the drawer', () => {
  it('arrows and Tab move through the controls and wrap (a trap)', () => {
    expect(focusMove(5, 0, 'ArrowDown')).toBe(1);
    expect(focusMove(5, 4, 'ArrowDown')).toBe(0);
    expect(focusMove(5, 0, 'ArrowUp')).toBe(4);
    expect(focusMove(5, 4, 'Tab')).toBe(0);
    expect(focusMove(5, 0, 'ShiftTab')).toBe(4);
  });

  it('left and right stay put (they move the caret in a field)', () => {
    expect(focusMove(5, 2, 'ArrowLeft')).toBe(2);
    expect(focusMove(5, 2, 'ArrowRight')).toBe(2);
  });

  it('with nothing focused yet the first control takes it; with no controls nothing moves', () => {
    expect(focusMove(5, -1, 'ArrowDown')).toBe(0);
    expect(focusMove(5, -1, 'ShiftTab')).toBe(4);
    expect(focusMove(0, -1, 'Tab')).toBe(-1);
  });
});
