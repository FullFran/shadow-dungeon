import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { hasSeenSimaScene, markSimaSceneSeen, simaPanels, simaText } from '../../src/app/sima-cinematic';
import { clockPaused } from '../../src/core/endless';
import { SIMA_BANDS } from '../../src/data/sima';
import { SIMA_SCENE_IDS, SIMA_SCENES, simaSceneKeys } from '../../src/data/sima-scenes';
import { catalog, LANGUAGES, setLanguage, t } from '../../src/i18n';

/**
 * The Sima's cinematics (docs/sima-redesign.md §5): every line in both
 * languages and in the house style, every stratum past the first with its
 * threshold, the flags per device apart from the save, and the floor in the
 * return's line.
 */
describe('the Sima\'s cinematics', () => {
  it('every line and every shared-run card exists in every language, in the house style', () => {
    for (const language of LANGUAGES) {
      const strings = catalog(language);
      for (const key of simaSceneKeys()) {
        expect(strings[key], `${language} ${key}`).toBeTruthy();
        expect(strings[key], key).not.toContain('—');
      }
    }
  });

  it('a threshold for every stratum after the first; the mouth, the breaking point and the return', () => {
    for (const band of SIMA_BANDS.slice(1)) expect(SIMA_SCENE_IDS).toContain(`stratum-${band.id}`);
    for (const id of ['mouth', 'own-shadow', 'first-name', 'someone', 'someone-known', 'lost', 'return', 'return-short'] as const) expect(SIMA_SCENES[id].length).toBeGreaterThan(0);
  });

  it('the breaking point wakes the player with Phantump, who names the Sima Walkers', () => {
    setLanguage('es');
    const lines = SIMA_SCENES.lost.map((_, i) => t(`sima.scene.lost.${i + 1}`)).join(' ');
    expect(lines).toContain('Phantump');
    expect(lines).toContain(t('lore.reborn.name'));
    expect(SIMA_SCENES.lost.some((b) => b.stage === 'phantump')).toBe(true);
    expect(SIMA_SCENES.lost.some((b) => b.stage === 'wake')).toBe(true);
  });

  it('its panels: one line each, lasting as long as the line needs, the floor filled in', () => {
    setLanguage('es');
    const text = simaText(t, 23);
    const panels = simaPanels('return', { species: 'cubone', floor: 23 }, text);
    expect(panels.map((p) => p.scene)).toEqual(SIMA_SCENES.return.map((b) => b.stage));
    expect(text(panels[1]!.lines[0]!)).toContain('Planta 23');
    for (const p of panels) expect(p.durationMs).toBeGreaterThanOrEqual(4500);
    // The short return borrows the full one's first two lines.
    expect(simaPanels('return-short', { species: 'cubone' }, text).map((p) => p.lines[0])).toEqual(['sima.scene.return.1', 'sima.scene.return.2']);
  });

  it('each plays once per device: its own storage key, never the save', () => {
    const store = memoryStore();
    expect(hasSeenSimaScene(store, 'mouth')).toBe(false);
    markSimaSceneSeen(store, 'mouth');
    markSimaSceneSeen(store, 'mouth');
    expect(hasSeenSimaScene(store, 'mouth')).toBe(true);
    expect(hasSeenSimaScene(store, 'lost')).toBe(false);
    expect(JSON.parse(store.get('mazmorra-sombria.simaScenes')!)).toEqual(['mouth']);
    store.set('mazmorra-sombria.simaScenes', 'not json');
    expect(hasSeenSimaScene(store, 'mouth')).toBe(false);
  });

  it('a cinematic stops the clock alone, never in a shared run', () => {
    expect(clockPaused({ shared: false, menuOpen: false, pickOpen: false, cinematic: true })).toBe(true);
    expect(clockPaused({ shared: true, menuOpen: false, pickOpen: false, cinematic: true })).toBe(false);
  });
});
