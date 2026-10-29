import { describe, expect, it } from 'vitest';
import { setLanguage, t } from '../../src/i18n';
import { versionNotice } from '../../src/town/lobby';

/** Issue #7: a version refusal names both builds and says how to update; an older peer that sent no label gets the old wording. */
describe('version refusal notice', () => {
  it('the guest reads both versions and how to update (reload; an installed app: close and reopen)', () => {
    setLanguage('es');
    const text = versionNotice('guest', 'v0.9.1 · abc1234', 'v0.9.0 · e60dcb9');
    expect(text).toContain('v0.9.1 · abc1234');
    expect(text).toContain('v0.9.0 · e60dcb9');
    expect(text).toMatch(/recarga la página/);
    expect(text).toMatch(/ciérrala y vuelve a abrirla/);
    setLanguage('en');
    expect(versionNotice('guest', 'v1', 'v2')).toMatch(/close it and open it again/);
  });

  it('the host toast names the guest version', () => {
    setLanguage('en');
    const text = versionNotice('host', 'v0.9.1 · abc1234', 'v0.8.0 · 0ld0ld0');
    expect(text).toContain('v0.8.0 · 0ld0ld0');
    expect(text).toContain('v0.9.1 · abc1234');
  });

  it('falls back to the old messages when the other side sent no label', () => {
    setLanguage('es');
    expect(versionNotice('guest', 'v0.9.1 · abc1234')).toBe(t('net.version'));
    expect(versionNotice('host', 'v0.9.1 · abc1234')).toBe(t('net.versionRefused'));
  });
});
