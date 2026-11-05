import { describe, expect, it } from 'vitest';
import { joinAttempt, ONLINE_KEYS, onlineModel } from '../../src/app/online-model';
import { catalog, LANGUAGES } from '../../src/i18n';

describe('online window model', () => {
  it('makes Create the one ember action and focuses it when no code came with the link', () => {
    expect(onlineModel('')).toEqual({ primary: 'create', focus: 'create', code: '' });
  });

  it('makes Join the ember action, keeps the code and focuses Join when ?room= prefilled it', () => {
    expect(onlineModel('K7M3A')).toEqual({ primary: 'join', focus: 'join', code: 'K7M3A' });
  });

  it('accepts a code typed in lower case, with spaces or dashes, in canonical form', () => {
    expect(joinAttempt(' k7m-3a ')).toEqual({ ok: true, code: 'K7M3A' });
  });

  it('tells an empty field from an invalid code', () => {
    expect(joinAttempt('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(joinAttempt('K7M')).toEqual({ ok: false, reason: 'invalid' });
    expect(joinAttempt('OOOOO')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('has every new string in every language', () => {
    expect(ONLINE_KEYS.length).toBeGreaterThan(0);
    for (const lang of LANGUAGES) for (const key of ONLINE_KEYS) expect(catalog(lang)[key], `${lang}:${key}`).toBeTruthy();
  });
});
