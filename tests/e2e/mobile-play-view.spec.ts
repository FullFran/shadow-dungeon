import { expect, test } from '@playwright/test';
import { returningPlayer } from './reach';

/**
 * The town and the dungeons on a phone. Held upright they keep the small landscape screen (owner, 2026-11-06: "si tienen el
 * móvil en vertical debería quedarse la pantalla chiquita horizontal como estaba antes", "el pueblo me refiero y las
 * mazmorras"): the landscape view scaled to the width and centred. Sideways the view still fills the screen.
 */
const SCENES: Record<string, string> = { town: '?screen=town', dungeon: '?screen=run' };

for (const [name, path] of Object.entries(SCENES)) {
  test(`${name}: landscape view, letterboxed when the phone is upright`, async ({ page }) => {
    await returningPlayer(page);
    await page.goto(path);
    const canvas = page.locator('canvas.game');
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(800);
    const { vw, vh, box, backing } = await canvas.evaluate((c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect();
      return { vw: window.innerWidth, vh: window.innerHeight, box: { x: r.left, y: r.top, width: r.width, height: r.height }, backing: { width: c.width, height: c.height } };
    });
    // Never stretched: the on-screen box has the backing store's aspect.
    expect(box.width / box.height).toBeCloseTo(backing.width / backing.height, 2);
    // Wider than tall either way round.
    expect(box.width).toBeGreaterThan(box.height);
    if (vh > vw) {
      // Upright: the whole width, a band centred in the height.
      expect(box.width).toBeCloseTo(vw, 0);
      expect(box.height).toBeLessThan(vh * 0.6);
      expect(Math.abs(box.y + box.height / 2 - vh / 2)).toBeLessThan(2);
    } else {
      // Sideways: the view covers the screen (full-bleed, as on desktop).
      expect(box.width).toBeGreaterThanOrEqual(vw - 1);
      expect(box.height).toBeGreaterThanOrEqual(vh - 1);
    }
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/${test.info().project.name}-play-${name}.png` });
  });
}
