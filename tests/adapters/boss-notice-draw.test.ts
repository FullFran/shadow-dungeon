import { afterEach, describe, expect, it } from 'vitest';
import { drawBossNotice } from '../../src/adapters/intro-card';
import { bossPhaseStance, bossSpecies } from '../../src/data/boss-lore';
import { LANGUAGES, setLanguage } from '../../src/i18n';
import { bossNotice, NOTICE_LIFE_MS, NOTICE_MS } from '../../src/ui/boss-notice';
import '../../src/data/guardian-tricks';

/** A recording canvas: text is 0.6 of its font size wide per character; remembers every line drawn. */
function recorder() {
  const drawn: { text: string; size: number; width: number; y: number }[] = [];
  const state = { font: '10px sans-serif', globalAlpha: 1 };
  const sizeOf = () => Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 10);
  const ctx = new Proxy(state, {
    get: (target, name: string) => {
      if (name in target) return target[name as keyof typeof target];
      if (name === 'measureText') return (text: string) => ({ width: text.length * sizeOf() * 0.6 });
      if (name === 'fillText') return (text: string, _x: number, y: number) => drawn.push({ text, size: sizeOf(), width: text.length * sizeOf() * 0.6, y });
      return () => undefined;
    },
    set: (target, name: string, value) => {
      (target as Record<string, unknown>)[name] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, drawn };
}

describe('drawing the boss notice', () => {
  afterEach(() => setLanguage('es'));

  it('every boss moment fits the small phone view (568x320) in both languages, large and inside the screen', () => {
    for (const lang of LANGUAGES) {
      setLanguage(lang);
      for (const [width, height] of [[284, 160], [568, 320], [1024, 576]] as const) {
        for (const species of bossSpecies()) {
          const moments = [{ kind: 'finale' as const, species }, ...(bossPhaseStance(species) ? [{ kind: 'phase' as const, species, stance: bossPhaseStance(species)! }] : [])];
          for (const moment of moments) {
            const { ctx, drawn } = recorder();
            drawBossNotice(ctx, bossNotice(moment, { showTip: true, shownAtMs: 0 }), NOTICE_MS.enter + 500, width, height);
            const label = `${lang} ${species} ${moment.kind} ${width}`;
            expect(drawn.length, label).toBeGreaterThanOrEqual(2);
            for (const line of drawn) {
              expect(line.width, `${label} "${line.text}"`).toBeLessThanOrEqual(width);
              expect(line.y, label).toBeLessThanOrEqual(height);
              expect(line.y, label).toBeGreaterThan(0);
            }
            // The heading is the biggest text on screen and never tiny.
            expect(Math.max(...drawn.map((l) => l.size)), label).toBeGreaterThanOrEqual(width >= 568 ? 20 : 12);
          }
        }
      }
    }
  });

  it('draws nothing once the notice is over', () => {
    const { ctx, drawn } = recorder();
    drawBossNotice(ctx, bossNotice({ kind: 'finale', species: bossSpecies()[0]! }, { showTip: false, shownAtMs: 0 }), NOTICE_LIFE_MS + 1, 568, 320);
    expect(drawn).toHaveLength(0);
  });
});
