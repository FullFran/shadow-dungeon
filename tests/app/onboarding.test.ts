import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { afterWelcome, bootRoute, clearOnboarding, FRESH_ONBOARDING, readOnboarding, writeOnboarding, type OnboardingState } from '../../src/app/onboarding';
import { GUEST_CONS, GUEST_PROS } from '../../src/app/account-drawer-model';
import { PROFILE_KEYS } from '../../src/app/profile';
import { QUIZ_LENGTH } from '../../src/data/quiz';
import { catalog, LANGUAGES } from '../../src/i18n';

const KEY = 'mazmorra-sombria.onboarding';
const base = { starterChosen: false, hasProgress: false, signedIn: false, prologueSeen: false, state: FRESH_ONBOARDING };
const at = (patch: Partial<OnboardingState>): OnboardingState => ({ ...FRESH_ONBOARDING, ...patch });

describe('bootRoute', () => {
  it('sends a profile with no walker to the welcome gate, never to the hub', () => {
    expect(bootRoute(base)).toBe('welcome');
  });

  it('sends a profile with a walker straight to the hub, whatever the stored step says', () => {
    expect(bootRoute({ ...base, starterChosen: true })).toBe('hub');
    expect(bootRoute({ ...base, starterChosen: true, state: at({ step: 'quiz', seed: 4 }) })).toBe('hub');
  });

  it('sends a cloud walker (progress arrived with the account) to the hub after sign-in', () => {
    expect(bootRoute({ ...base, signedIn: true, hasProgress: true })).toBe('hub');
  });

  it('skips the welcome once signed in with no cloud walker: the onboarding goes on', () => {
    expect(bootRoute({ ...base, signedIn: true })).toBe('prologue');
    expect(bootRoute({ ...base, signedIn: true, prologueSeen: true })).toBe('quiz');
  });

  it('the guest path: welcome, then prologue, then quiz, then reveal as the stored step moves', () => {
    expect(bootRoute({ ...base, state: at({ step: 'prologue' }) })).toBe('prologue');
    expect(bootRoute({ ...base, state: at({ step: 'prologue' }), prologueSeen: true })).toBe('quiz');
    expect(bootRoute({ ...base, state: at({ step: 'quiz', seed: 9, picks: [0, 1] }) })).toBe('quiz');
    expect(bootRoute({ ...base, prologueSeen: true, state: at({ step: 'reveal', seed: 9, picks: [0, 1, 2, 0, 1, 2] }) })).toBe('reveal');
  });

  it('a reveal without answers or a hand-picked walker falls back to the quiz; a hand-picked walker stays', () => {
    expect(bootRoute({ ...base, state: at({ step: 'reveal', seed: 3, picks: [1] }) })).toBe('quiz');
    expect(bootRoute({ ...base, state: at({ step: 'reveal', seed: 3, picks: [], starter: 'zorua' }) })).toBe('reveal');
  });

  it('a quiz with every answer given is already the reveal', () => {
    expect(bootRoute({ ...base, state: at({ step: 'quiz', seed: 3, picks: Array(QUIZ_LENGTH).fill(0) }) })).toBe('reveal');
  });
});

describe('afterWelcome', () => {
  it('goes to the prologue the first time and straight to the quiz when it was seen', () => {
    expect(afterWelcome(false)).toBe('prologue');
    expect(afterWelcome(true)).toBe('quiz');
  });
});

describe('onboarding persistence', () => {
  it('a fresh device starts at the welcome gate', () => {
    expect(readOnboarding(memoryStore())).toEqual(FRESH_ONBOARDING);
  });

  it('keeps the step, seed, answers and hand-picked walker across a reload (a new read of the same store)', () => {
    const store = memoryStore();
    const state = at({ step: 'quiz', seed: 123456, picks: [2, 0, 1], starter: null });
    writeOnboarding(store, state);
    expect(readOnboarding(store)).toEqual(state);
    writeOnboarding(store, at({ step: 'reveal', seed: 5, picks: [], starter: 'litwick' }));
    expect(readOnboarding(store).starter).toBe('litwick');
  });

  it('sanitizes garbage: bad JSON, unknown step, wild answers, unknown walker', () => {
    const store = memoryStore();
    store.set(KEY, '{nope');
    expect(readOnboarding(store)).toEqual(FRESH_ONBOARDING);
    store.set(KEY, JSON.stringify({ step: 'dance', seed: 'x', picks: [0, 7, -1, 1.5, 2, 'a'], starter: 'mew' }));
    expect(readOnboarding(store)).toEqual({ step: 'welcome', seed: 0, picks: [0, 2], starter: null });
    store.set(KEY, JSON.stringify({ step: 'quiz', seed: 8, picks: Array(40).fill(1) }));
    expect(readOnboarding(store).picks).toHaveLength(QUIZ_LENGTH);
  });

  it('clearing forgets everything and never touches other keys', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.settings', 'keep');
    writeOnboarding(store, at({ step: 'reveal', seed: 1, picks: [0] }));
    clearOnboarding(store);
    expect(readOnboarding(store)).toEqual(FRESH_ONBOARDING);
    expect(store.get('mazmorra-sombria.settings')).toBe('keep');
  });

  it('is a device key outside the synced profile keys', () => {
    expect((PROFILE_KEYS as readonly string[]).includes(KEY)).toBe(false);
  });
});

describe('welcome gate strings', () => {
  const keys = ['onb.welcome.lore', 'onb.welcome.account.title', 'onb.welcome.account.cta', 'onb.welcome.guest.cta', 'onb.welcome.device', 'onb.welcome.hint', 'onb.welcome.choices', 'onb.quiz.progress', 'onb.quiz.hint', 'onb.quiz.hint.touch', 'onb.reveal.kicker', 'onb.reveal.chosen', 'onb.reveal.start', 'onb.reveal.retake', 'onb.reveal.hint', ...GUEST_PROS, ...GUEST_CONS, 'account.drawer.guest.title', 'account.drawer.guest.pros', 'account.drawer.guest.cons'];
  for (const language of LANGUAGES) {
    it(`"${language}" has every welcome and reveal string, reusing the drawer's facts`, () => {
      expect(keys.filter((key) => !(key in catalog(language)))).toEqual([]);
    });
  }
  it('shows at most three facts per side', () => {
    expect(GUEST_PROS.length).toBeLessThanOrEqual(3);
    expect(GUEST_CONS.length).toBeLessThanOrEqual(3);
  });
});
