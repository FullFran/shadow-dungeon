import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDiagnostics, diagnosticsText } from '../../src/app/diagnostics';
import { catalog, LANGUAGES } from '../../src/i18n';

/** Issue #6: the room menu copies the technical report; the bug report and the copy share one snapshot. */
const MAIN = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');

describe('technical report wiring', () => {
  it('the room menu has a row that copies the snapshot, pretty-printed, with a toast', () => {
    const menu = MAIN.slice(MAIN.indexOf('menu: (close) => ['), MAIN.indexOf("{ label: t('lobby.leave')"));
    expect(menu).toMatch(/t\('lobby\.copyReport'\)/);
    expect(MAIN).toMatch(/function copyReport[\s\S]*?diagnosticsText\(await collectDiagnostics\(\)\)[\s\S]*?clipboard[\s\S]*?lobby\.reportCopied[\s\S]*?lobby\.reportCopyFailed/);
  });

  it('the bug report takes the same snapshot', () => {
    expect(MAIN).toMatch(/function reportOptions[\s\S]*?diagnostics: collectDiagnostics/);
  });

  it('the copy is the snapshot as indented JSON', () => {
    const snap = buildDiagnostics({ build: 'dev', protocol: 5, lang: 'en', touch: true, screen: 'room town', errors: [], transitions: [] });
    const text = diagnosticsText(snap);
    expect(text).toContain('\n  "build": "dev"');
    expect(JSON.parse(text)).toEqual(snap);
  });

  for (const language of LANGUAGES) {
    it(`"${language}" names the copy row and its toasts`, () => {
      const tr = catalog(language);
      for (const key of ['lobby.copyReport', 'lobby.reportCopied', 'lobby.reportCopyFailed', 'stats.admitted', 'stats.pending', 'stats.direct', 'stats.relay']) expect(tr[key], key).toBeTruthy();
    });
  }
});
