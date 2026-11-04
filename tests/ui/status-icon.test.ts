import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The error card and the fatal screen draw the broken-rune icon, not the hub padlock (owner, 2026-11-04). */
describe('error card icon', () => {
  const source = readFileSync(`${new URL('../../', import.meta.url).pathname}src/ui/status.ts`, 'utf8');

  it('uses the error icon in the card and in the fatal screen, and never the padlock', () => {
    expect(source.match(/pixelIconSvg\('error'/g)).toHaveLength(2);
    expect(source).not.toContain("pixelIconSvg('lock'");
  });
});
