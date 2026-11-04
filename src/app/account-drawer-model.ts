import type { FlowError, FlowResult } from './auth-flow';

/**
 * The account drawer's logic without the page (app/account-drawer.ts draws it):
 * which form each mode shows, what a result does to the mode, the guest
 * pros and trade-offs, and the focus trap's arithmetic.
 */
export type DrawerMode = 'sign-in' | 'sign-up' | 'verify' | 'forgot' | 'reset';
export type FlowAction = DrawerMode;
export type FieldKind = 'email' | 'password' | 'code';

export interface ModeView {
  /** i18n keys. */
  title: string;
  why: string;
  cta: string;
  fields: readonly FieldKind[];
}

const VIEWS: Record<DrawerMode, { key: string; fields: readonly FieldKind[] }> = {
  'sign-in': { key: 'signIn', fields: ['email', 'password'] },
  'sign-up': { key: 'signUp', fields: ['email', 'password'] },
  verify: { key: 'verify', fields: ['code'] },
  forgot: { key: 'forgot', fields: ['email'] },
  reset: { key: 'reset', fields: ['code', 'password'] },
};

export function modeView(mode: DrawerMode): ModeView {
  const { key, fields } = VIEWS[mode];
  return { title: `account.drawer.title.${key}`, why: `account.drawer.why.${key}`, cta: `account.drawer.cta.${key}`, fields };
}

/** What having an account gives (Miller: three). Guest is a first-class choice, so these are facts, not pressure. */
export const GUEST_PROS = ['account.drawer.pro.cloud', 'account.drawer.pro.friends', 'account.drawer.pro.backup'] as const;
/** What playing as a guest costs, said plainly. */
export const GUEST_CONS = ['account.drawer.con.local', 'account.drawer.con.social', 'account.drawer.con.loss'] as const;

export const errorKey = (error: FlowError): string => `account.error.${error}`;

export interface Outcome {
  mode: DrawerMode | 'signed-in';
  /** i18n key of the inline error line, or null. */
  error: string | null;
  /** i18n key of a one-time line, or null. */
  notice: string | null;
}

/** What the drawer does with the result of `action`, which ran in `mode`. */
export function outcomeOf(action: FlowAction, result: FlowResult, mode: DrawerMode): Outcome {
  if (!result.ok) return { mode, error: errorKey(result.error), notice: null };
  if (result.step === 'done') return { mode: 'signed-in', error: null, notice: null };
  if (result.step === 'sent') return { mode: 'sign-in', error: null, notice: 'account.resetSent' };
  // An emailed code is needed: after a reset request it comes with a new password.
  return { mode: action === 'forgot' ? 'reset' : 'verify', error: null, notice: 'account.drawer.codeSent' };
}

/** Where "Atrás" in a form goes; `origin` is the form the code step came from. */
export function backTarget(mode: DrawerMode, origin: DrawerMode): DrawerMode {
  if (mode === 'verify') return origin === 'sign-up' ? 'sign-up' : 'sign-in';
  if (mode === 'reset') return 'forgot';
  return 'sign-in';
}

export type FocusKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Tab' | 'ShiftTab';

/** The control focused after `key`, wrapping at both ends (the drawer is a trap); left and right leave the caret alone. */
export function focusMove(count: number, index: number, key: FocusKey): number {
  if (count <= 0) return -1;
  if (key === 'ArrowLeft' || key === 'ArrowRight') return index;
  const forward = key === 'ArrowDown' || key === 'Tab';
  if (index < 0) return forward ? 0 : count - 1;
  return (index + (forward ? 1 : -1) + count) % count;
}
