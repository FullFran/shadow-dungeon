import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The phone stylesheet must never reach a desktop (owner, 2026-11-06: "solo en visión móvil"): every rule in
 * src/styles/mobile.css sits inside a media query whose every branch asks for a finger (coarse pointer, no hover).
 * tests/e2e/desktop-identical.spec.ts checks the rendered result.
 */
const css = readFileSync(new URL('../../src/styles/mobile.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The top-level blocks: their preludes (the text before each top-level `{`). */
function topLevelPreludes(source: string): string[] {
  const preludes: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') {
      if (depth === 0) preludes.push(source.slice(start, i).trim());
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) start = i + 1;
    }
  }
  expect(depth).toBe(0);
  return preludes;
}

describe('src/styles/mobile.css', () => {
  const preludes = topLevelPreludes(css);

  it('has rules', () => {
    expect(preludes.length).toBeGreaterThan(0);
  });

  it('puts every rule inside a phone-only media query', () => {
    for (const prelude of preludes) {
      expect(prelude.startsWith('@media'), prelude).toBe(true);
      for (const branch of prelude.replace(/^@media/, '').split(',')) {
        expect(branch, prelude).toContain('(hover: none)');
        expect(branch, prelude).toContain('(pointer: coarse)');
      }
    }
  });
});
