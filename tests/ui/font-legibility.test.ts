import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canvasFont, FONT } from '../../src/ui/tokens';

/**
 * Playtest 2026-10-26: on the results screen the lowercase "e" did not read
 * ("es como que no cierra"). Pixelify Sans' 700 weight fills the "e" counter
 * at any size, the weights between blur its 1-unit strokes, and off-grid
 * sizes split its pixels unevenly. These checks keep text at the real 400
 * weight, forbid synthesized weights, and keep the results screen on the grid.
 */
const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
/** Each CSS rule as `selector { body }`, comments stripped. */
const rules = style
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('}')
  .map((r) => r.trim())
  .filter((r) => r.includes('{'))
  .map((r) => ({ selector: r.slice(0, r.indexOf('{')).trim().replace(/^.*\{\s*/s, ''), body: r.slice(r.indexOf('{') + 1) }));

describe('no heavy Pixelify text', () => {
  it('the browser never synthesizes a weight or a slant', () => {
    const body = rules.find((r) => r.selector === 'body');
    expect(body?.body).toMatch(/font-synthesis:\s*none/);
  });

  it('headings and strong text use the regular weight (the UA default bold is 700)', () => {
    const reset = rules.find((r) => /\bh1\b/.test(r.selector) && /\bstrong\b/.test(r.selector));
    expect(reset?.body).toMatch(/font-weight:\s*400/);
  });

  it('nothing asks for a bold weight except the room code (capitals and digits only)', () => {
    const bold = rules.filter((r) => /font-weight:\s*(bold|bolder|[5-9]00)\b/.test(r.body) && !r.selector.startsWith('@font-face'));
    expect(bold.map((r) => r.selector)).toEqual(['.room-code']);
  });

  it('canvas emphasis does not use the 700 weight', () => {
    expect(canvasFont(22, true)).not.toMatch(/\b(700|bold)\b/);
    expect(canvasFont(FONT.hudPx, true)).toContain(`${FONT.hudPx}px "${FONT.family}"`);
  });
});

describe('results screen sizes on the 11 px grid', () => {
  const sizes = rules.filter((r) => /\.result\b/.test(r.selector)).flatMap((r) => [...r.body.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => ({ selector: r.selector, px: Number(m[1]) })));
  it('every explicit font size on the results screen is a multiple of 5.5 px (11 px, or a half step that is whole at DPR 2)', () => {
    expect(sizes.length).toBeGreaterThan(0);
    for (const { selector, px } of sizes) expect({ selector, px, onGrid: (px * 2) % 11 === 0 }).toEqual({ selector, px, onGrid: true });
  });
});
