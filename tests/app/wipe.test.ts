import { describe, expect, it } from 'vitest';
import { defeatTellsGuests, faintedHintKey, wipeAction, type OpenChoice, type PeerKind } from '../../src/app/wipe';
import { t, setLanguage } from '../../src/i18n';

/** Issue #50: a fainted co-op player must never be left stuck. */
describe('after a full wipe (#50)', () => {
  it('a host or solo player with a stale choice open gets it replaced by the bonfire question', () => {
    for (const kind of ['solo', 'host'] as const) {
      expect(wipeAction(kind, false, 'other')).toBe('replace');
      expect(wipeAction(kind, false, null)).toBe('ask');
      expect(wipeAction(kind, false, 'bonfire')).toBe('none');
      expect(wipeAction(kind, true, null)).toBe('none');
    }
  });

  it('a guest never asks: it waits for the host', () => {
    for (const open of ['bonfire', 'other', null] as OpenChoice[]) expect(wipeAction('guest', false, open)).toBe('none');
  });

  it('a host defeated with no bonfire to go back to tells the guests; nobody else sends it', () => {
    expect(defeatTellsGuests('host', 'defeat')).toBe(true);
    for (const kind of ['solo', 'guest'] as PeerKind[]) expect(defeatTellsGuests(kind, 'defeat')).toBe(false);
    expect(defeatTellsGuests('host', 'victory')).toBe(false);
  });

  it('a fainted player reads whether a teammate can still revive them, in both languages', () => {
    for (const lang of ['es', 'en'] as const) {
      setLanguage(lang);
      for (const available of [true, false]) {
        const key = faintedHintKey(available);
        expect(t(key), `${lang} ${key}`).not.toBe(key);
      }
    }
    expect(faintedHintKey(true)).not.toBe(faintedHintKey(false));
  });
});
