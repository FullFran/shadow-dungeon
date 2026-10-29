import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { buildReport, clearDraft, deviceSummary, emptyDraft, loadDraft, REPORT_CATEGORIES, REPORT_DRAFT_KEY, REPORT_LIMITS, reportErrorKey, saveDraft } from '../../src/app/report-screen';
import { catalog, LANGUAGES } from '../../src/i18n';

const UA = {
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
};

describe('report device summary', () => {
  it('names only the browser family, the OS family and touch, never versions or models', () => {
    expect(deviceSummary({ userAgent: UA.firefoxLinux, maxTouchPoints: 0 })).toBe('Firefox / Linux / no touch');
    expect(deviceSummary({ userAgent: UA.chromeAndroid, maxTouchPoints: 5 })).toBe('Chrome / Android / touch');
    expect(deviceSummary({ userAgent: UA.safariIphone, maxTouchPoints: 5 })).toBe('Safari / iOS / touch');
    expect(deviceSummary({ userAgent: UA.edgeWindows, maxTouchPoints: 0 })).toBe('Edge / Windows / no touch');
    // iPadOS asks for the desktop site: a touch "Mac" is an iPad.
    expect(deviceSummary({ userAgent: UA.ipadDesktop, maxTouchPoints: 5 })).toBe('Safari / iOS / touch');
    expect(deviceSummary({ userAgent: 'curl/8', maxTouchPoints: undefined })).toBe('Other / Other / no touch');
    for (const ua of Object.values(UA)) expect(deviceSummary({ userAgent: ua, maxTouchPoints: 0 })).not.toMatch(/\d/);
  });
});

describe('report building', () => {
  it('trims the fields and adds the version and device only when technical info is attached', () => {
    const draft = { ...emptyDraft(), category: 'online' as const, description: '  Lost the room  ', steps: ' 1. join ' };
    expect(buildReport(draft, { version: '1.4.0', device: 'Chrome / Android / touch' })).toEqual({
      ok: true,
      report: { category: 'online', description: 'Lost the room', steps: '1. join', expected: '', observed: '', version: '1.4.0', device: 'Chrome / Android / touch' },
    });
    const bare = buildReport({ ...draft, attachTech: false }, { version: '1.4.0', device: 'x' });
    expect(bare.ok && bare.report.version === '' && bare.report.device === '').toBe(true);
  });

  it('requires a description and keeps every field within the server limits', () => {
    expect(buildReport({ ...emptyDraft(), description: '   ' }, { version: 'v', device: 'd' })).toEqual({ ok: false, field: 'description' });
    expect(buildReport({ ...emptyDraft(), description: 'x'.repeat(REPORT_LIMITS.description + 1) }, { version: 'v', device: 'd' })).toEqual({ ok: false, field: 'description' });
    expect(buildReport({ ...emptyDraft(), description: 'x', observed: 'o'.repeat(REPORT_LIMITS.observed + 1) }, { version: 'v', device: 'd' })).toEqual({ ok: false, field: 'observed' });
    const long = buildReport({ ...emptyDraft(), description: 'x' }, { version: 'v'.repeat(80), device: 'd'.repeat(300) });
    expect(long.ok && long.report.version.length <= REPORT_LIMITS.version && long.report.device.length <= REPORT_LIMITS.device).toBe(true);
  });

  it('offers exactly the server categories', () => {
    expect([...REPORT_CATEGORIES]).toEqual(['bug', 'online', 'performance', 'interface', 'progress', 'suggestion', 'other']);
  });
});

describe('report draft', () => {
  it('keeps the draft in storage and restores it, and clears it after sending', () => {
    const store = memoryStore();
    expect(loadDraft(store)).toEqual(emptyDraft());
    const draft = { ...emptyDraft(), category: 'performance' as const, description: 'Slow on floor 9', attachTech: false };
    saveDraft(store, draft);
    expect(store.get(REPORT_DRAFT_KEY)).toBeTruthy();
    expect(loadDraft(store)).toEqual(draft);
    clearDraft(store);
    expect(loadDraft(store)).toEqual(emptyDraft());
  });

  it('ignores a broken or foreign draft', () => {
    const store = memoryStore();
    store.set(REPORT_DRAFT_KEY, '{oops');
    expect(loadDraft(store)).toEqual(emptyDraft());
    store.set(REPORT_DRAFT_KEY, JSON.stringify({ category: 'cheats', description: 42, attachTech: 'yes', extra: 1 }));
    expect(loadDraft(store)).toEqual(emptyDraft());
  });

  it('uses the agreed storage key', () => {
    expect(REPORT_DRAFT_KEY).toBe('mazmorra-sombria.reportDraft');
  });
});

describe('report screen text', () => {
  for (const language of LANGUAGES) {
    it(`"${language}" has every report string`, () => {
      const tr = catalog(language);
      const keys = [
        'report.title',
        'report.intro',
        'report.category',
        'report.description',
        'report.steps',
        'report.expected',
        'report.observed',
        'report.attachTech',
        'report.attachTech.about',
        'report.send',
        'report.sending',
        'report.sent.title',
        'report.sent.body',
        'report.on',
        'report.off',
        ...REPORT_CATEGORIES.map((c) => `report.category.${c}`),
        ...(['rate-limited', 'unavailable', 'invalid', 'description', 'too-long'] as const).map((e) => reportErrorKey(e)),
      ];
      for (const key of keys) {
        expect(tr[key], key).toBeTruthy();
        expect(tr[key]!.includes('—'), key).toBe(false);
      }
    });
  }

  it('Spanish uses no voseo', () => {
    const es = Object.entries(catalog('es')).filter(([k]) => k.startsWith('report.'));
    for (const [key, text] of es) expect(text, key).not.toMatch(/\b(podés|tenés|querés|escribí|contá|sabés)\b/);
  });
});

describe('report entry points', () => {
  const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
  it('opens from the title options and the town settings', () => {
    expect(main).toContain("reportScreen(root, () => optionsScreen(root, 'report'))");
    expect(main.slice(main.indexOf('function townSettings('), main.indexOf('function townSettings(') + 1500)).toContain("t('title.report')");
  });
  it('takes the API base from VITE_API_URL', () => {
    expect(main).toMatch(/sendReport\(apiBaseUrl\(import\.meta\.env\.VITE_API_URL\)/);
  });
});
