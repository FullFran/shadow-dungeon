import { describe, expect, it } from 'vitest';
import { RARITY_COLORS } from '../../src/adapters/hud';
import { cssVariables, FONT, PALETTE, RARITY } from '../../src/ui/tokens';

describe('design tokens', () => {
  it('exposes every palette colour as a CSS custom property', () => {
    const vars = cssVariables();
    for (const [name, value] of Object.entries(PALETTE)) {
      const cssName = `--md-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      expect(vars[cssName], cssName).toBe(value);
    }
    expect(vars['--md-rarity-rare']).toBe(RARITY.rare);
    expect(vars['--md-font']).toContain(FONT.family);
  });

  it('the canvas HUD uses the same rarity colours as the DOM cards', () => {
    expect(RARITY_COLORS).toBe(RARITY);
  });

  it('colours are opaque hex values', () => {
    for (const value of [...Object.values(PALETTE), ...Object.values(RARITY)]) expect(value).toMatch(/^#[0-9a-f]{6}$/);
  });
});
