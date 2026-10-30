import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(__dirname, '../..', path), 'utf8');

/** Ticket SD-8AAYCK; `tools/mobile/menu-fit.mjs` measures the same in a real browser. */
describe('room for the floating "Atrás" button on touch', () => {
  it('is kept once, for every menu, by the page', () => {
    const rule = read('index.html').match(/html\.touch #app:not\(:has\(([^)]*)\)\) \{ padding-top: calc\(max\(8px, env\(safe-area-inset-top\)\) \+ (\d+)px\); \}/);
    expect(rule).not.toBeNull();
    // The button's top (8) and height (44), and the window title's overhang.
    expect(Number(rule![2])).toBeGreaterThanOrEqual(44 + 20);
    // Only the screens where the button is hidden go without it.
    expect(rule![1].split(',').map((s) => s.trim())).toEqual(['.title-logo', '.prologue', 'canvas.game', '.overlay', '.result']);
  });
  it('no screen keeps its own margin for it any more', () => {
    for (const file of ['src/app/gamepad-help.ts', 'src/app/tickets-screen.ts', 'src/app/report-screen.ts']) expect(read(file), file).not.toMatch(/html\.touch \.[a-z-]*window \{ margin-top/);
  });
  it('the title logo fits a narrow phone', () => {
    expect(read('index.html')).toContain('.title-logo h1 { margin: 0; font-size: min(var(--md-title), 13vw);');
  });
});
