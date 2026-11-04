import type { KeyValueStore } from '../adapters/storage';
import { QUIZ_LENGTH, STARTERS, type StarterId } from '../data/quiz';

/**
 * First-run onboarding (owner, 2026-11-04: "cuando aún no has iniciado partida y no tienes un caminante ... debe
 * primero pedirte elegir si como invitado o iniciar sesión y guiarte primero al onboarding"). A profile with no
 * walker never sees the hub: it goes welcome gate (account or guest) -> prologue -> questionnaire -> reveal ->
 * the first run. This module is the pure route and the persisted step; app/welcome-screen.ts and
 * app/quiz-screen.ts draw it and app/main.ts wires it.
 *
 * The step lives in a device key of its own (like the prologue flag), outside the synced profile keys: it is
 * where this browser got to, not progress, so it never travels with the cloud save. It is sanitized on every read.
 */
export const ONBOARDING_STEPS = ['welcome', 'prologue', 'quiz', 'reveal'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingState {
  step: OnboardingStep;
  /** Seeds the questionnaire's question picks, so a reload shows the same questions. */
  seed: number;
  /** Answer index (0..2) per question given so far. */
  picks: number[];
  /** A walker chosen by hand on the reveal ("Elegir otro"), instead of the one the answers give. */
  starter: StarterId | null;
}

export type BootRoute = 'hub' | OnboardingStep;

export const ONBOARDING_KEY = 'mazmorra-sombria.onboarding';
export const FRESH_ONBOARDING: OnboardingState = { step: 'welcome', seed: 0, picks: [], starter: null };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** What the device stored, repaired: anything unusable becomes the start of the flow. */
export function readOnboarding(store: KeyValueStore): OnboardingState {
  try {
    const raw: unknown = JSON.parse(store.get(ONBOARDING_KEY) ?? 'null');
    if (!isRecord(raw)) return FRESH_ONBOARDING;
    const step = ONBOARDING_STEPS.find((s) => s === raw.step) ?? 'welcome';
    const seed = typeof raw.seed === 'number' && Number.isSafeInteger(raw.seed) && raw.seed >= 0 ? raw.seed : 0;
    const picks = (Array.isArray(raw.picks) ? raw.picks : []).filter((p): p is number => Number.isInteger(p) && (p as number) >= 0 && (p as number) <= 2).slice(0, QUIZ_LENGTH);
    const starter = STARTERS.find((s) => s === raw.starter) ?? null;
    return { step, seed, picks, starter };
  } catch {
    return FRESH_ONBOARDING;
  }
}

export function writeOnboarding(store: KeyValueStore, state: OnboardingState): void {
  store.set(ONBOARDING_KEY, JSON.stringify(state));
}

export function clearOnboarding(store: KeyValueStore): void {
  if (store.remove) store.remove(ONBOARDING_KEY);
  else store.set(ONBOARDING_KEY, '');
}

/** The step after the welcome gate: the prologue the first time, else straight to the questionnaire. */
export const afterWelcome = (prologueSeen: boolean): 'prologue' | 'quiz' => (prologueSeen ? 'quiz' : 'prologue');

export interface BootFacts {
  /** The device has a walker (the `starterChosen` setting). */
  starterChosen: boolean;
  /** The save or records show a game already played (app/adventure-route.ts `hasProgress`): a cloud walker that arrived with the account counts. */
  hasProgress: boolean;
  signedIn: boolean;
  prologueSeen: boolean;
  state: OnboardingState;
}

/**
 * Where a boot (or any return to the title) goes: the hub only for a profile that has a walker; otherwise the
 * onboarding step the device reached. A signed-in account skips the welcome (it already chose), and a stored step
 * is trusted only as far as its data goes (a reveal needs answers or a hand-picked walker; a prologue already
 * seen is behind us).
 */
export function bootRoute(facts: BootFacts): BootRoute {
  if (facts.starterChosen || facts.hasProgress) return 'hub';
  const { state } = facts;
  if (state.step === 'welcome') return facts.signedIn ? afterWelcome(facts.prologueSeen) : 'welcome';
  if (state.step === 'prologue') return facts.prologueSeen ? 'quiz' : 'prologue';
  if (state.step === 'quiz') return state.picks.length >= QUIZ_LENGTH ? 'reveal' : 'quiz';
  return state.starter !== null || state.picks.length >= QUIZ_LENGTH ? 'reveal' : 'quiz';
}
