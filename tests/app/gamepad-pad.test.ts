import { describe, expect, it } from 'vitest';
import { GAMEPAD_HELP } from '../../src/app/gamepad-help';
import { PAD_STYLES, PAD_VIEW, padCallouts, padGlyph } from '../../src/app/gamepad-pad';
import { catalog, LANGUAGES } from '../../src/i18n';

const contexts = ['combat', 'menus'] as const;

describe('the pad diagram', () => {
  it.each(contexts)('draws a callout for every button of every action in %s', (context) => {
    const callouts = padCallouts(context);
    for (const row of GAMEPAD_HELP[context]) {
      for (const button of row.buttons) expect(callouts.some((c) => c.action === row.action && c.button === button), `${row.action}/${button}`).toBe(true);
    }
    expect(callouts).toHaveLength(GAMEPAD_HELP[context].reduce((n, r) => n + r.buttons.length, 0));
  });

  it.each(contexts)('gives every callout of %s a glyph for both layouts and a short label in every language', (context) => {
    for (const c of padCallouts(context)) {
      for (const style of PAD_STYLES) expect(padGlyph(c.button, style).width, `${c.button} ${style}`).toBeGreaterThan(0);
      for (const language of LANGUAGES) {
        expect(catalog(language)[`controls.short.${c.action}`], `${language} ${c.action}`).toBeTruthy();
        expect(catalog(language)[`controls.short.${c.action}`]).not.toContain('—');
      }
    }
  });

  it.each(contexts)('keeps the labels of %s inside the view and apart from each other', (context) => {
    const seen = new Map<string, number[]>();
    for (const c of padCallouts(context)) {
      expect(c.label.y).toBeGreaterThan(0);
      expect(c.label.y).toBeLessThan(PAD_VIEW.height);
      const ys = seen.get(c.label.side) ?? [];
      for (const y of ys) expect(Math.abs(y - c.label.y), `${context} ${c.button}`).toBeGreaterThanOrEqual(30);
      ys.push(c.label.y);
      seen.set(c.label.side, ys);
    }
  });

  it('names the controls window chrome in every language, without em dashes', () => {
    for (const language of LANGUAGES) {
      for (const key of ['controls.legend', 'controls.styleLabel', 'controls.contextLabel', 'controls.padLabel']) {
        expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
        expect(catalog(language)[key], key).not.toContain('—');
      }
    }
  });

  it('draws the face buttons as coloured letters for Xbox and as drawn shapes for PlayStation', () => {
    expect(padGlyph('a', 'xbox').kind).toBe('letter');
    expect(padGlyph('a', 'playstation').kind).toBe('shape');
    expect(padGlyph('a', 'playstation').shape).toBe('cross');
    expect(padGlyph('b', 'playstation').shape).toBe('circle');
    expect(padGlyph('x', 'playstation').shape).toBe('square');
    expect(padGlyph('y', 'playstation').shape).toBe('triangle');
    expect(padGlyph('lb', 'playstation').text).toBe('L1');
  });
});
