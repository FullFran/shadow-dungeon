import { describe, expect, it, vi } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { catalog, LANGUAGES, setLanguage } from '../../src/i18n';
import { CHANGELOG } from '../../src/data/changelog';
import { installNotice, newsNotice, updateNotice } from '../../src/pwa/notices';
import { LAST_SEEN_VERSION_KEY } from '../../src/app/patch-notes';

/** The three system notices keep the old transitions; only the presentation changed (owner, 2026-11-04). */
describe('install notice', () => {
  it('has no notice where the game cannot be installed', () => {
    expect(installNotice('none', memoryStore(), () => {})).toBeNull();
    expect(installNotice('manual', memoryStore(), () => {})).toBeNull();
  });

  it('primary installs and closes; "Ahora no" closes and writes nothing; "No volver a mostrar" stores the flag', () => {
    const store = memoryStore();
    const install = vi.fn();
    const notice = installNotice('prompt', store, install)!;
    expect(notice.kind).toBe('install');
    expect(notice.secondary!.run()).toBe('close');
    expect(store.get('mazmorra-sombria.installBanner')).toBeNull();
    expect(install).not.toHaveBeenCalled();
    expect(notice.tertiary!.run()).toBe('close');
    expect(store.get('mazmorra-sombria.installBanner')).toBe('never');
    expect(notice.primary.run()).toBe('close');
    expect(install).toHaveBeenCalledTimes(1);
  });

  it('on iOS the primary only acknowledges (no install call) and there is no secondary', () => {
    const install = vi.fn();
    const notice = installNotice('ios', memoryStore(), install)!;
    expect(notice.secondary).toBeUndefined();
    expect(notice.primary.run()).toBe('close');
    expect(install).not.toHaveBeenCalled();
  });

  it('shows at most three body lines', () => {
    expect(installNotice('prompt', memoryStore(), () => {})!.lines.length).toBeLessThanOrEqual(3);
  });
});

describe('update notice', () => {
  it('primary applies the update and stays open (the page reloads; it is never closed into a half state)', () => {
    const apply = vi.fn();
    const notice = updateNotice(apply, () => {});
    expect(notice.kind).toBe('update');
    expect(notice.primary.run()).toBe('stay');
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('"Más tarde" only snoozes; it does not apply', () => {
    const apply = vi.fn();
    const snooze = vi.fn();
    const notice = updateNotice(apply, snooze);
    expect(notice.secondary!.run()).toBe('close');
    expect(snooze).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    expect(notice.tertiary).toBeUndefined();
  });
});

describe('news notice', () => {
  const release = CHANGELOG[0]!;
  it('primary opens the news screen; "Más tarde" closes without opening it; the seen flag is not touched here', () => {
    const store = memoryStore();
    const open = vi.fn();
    const notice = newsNotice(release, open);
    expect(notice.kind).toBe('news');
    expect(notice.secondary!.run()).toBe('close');
    expect(open).not.toHaveBeenCalled();
    expect(notice.primary.run()).toBe('close');
    expect(open).toHaveBeenCalledTimes(1);
    expect(store.get(LAST_SEEN_VERSION_KEY)).toBeNull();
    expect(notice.tertiary).toBeUndefined();
  });

  it('lists up to three changes of the release', () => {
    const lines = newsNotice(release, () => {}).lines;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
  });
});

describe('copy', () => {
  it('every notice label and line resolves in es and en', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      const all = [installNotice('prompt', memoryStore(), () => {})!, updateNotice(() => {}, () => {}), newsNotice(CHANGELOG[0]!, () => {})];
      for (const n of all) {
        for (const text of [n.title, n.primary.label, n.secondary?.label, n.tertiary?.label, ...n.lines.map((l) => l.text)]) {
          expect(text === undefined || (text.length > 0 && !/^(pwa|notice)\./.test(text))).toBe(true);
        }
      }
    }
    setLanguage('es');
    for (const key of ['notice.later', 'notice.update.now', 'notice.update.line1', 'notice.update.line2', 'notice.news.title', 'notice.news.view', 'notice.news.fallback']) {
      for (const language of LANGUAGES) expect(catalog(language)[key]).toBeTruthy();
    }
  });
});
