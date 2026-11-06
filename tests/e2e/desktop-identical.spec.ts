import { expect, test } from '@playwright/test';
import { returningPlayer, settle } from './reach';

/**
 * Desktop stays exactly as designed (owner, 2026-11-06: "que no cambie el diseño de Álvaro, solo en visión móvil"): with a
 * mouse at 1440x900 the phone stylesheet (src/styles/mobile.css) changes nothing on any screen. The check switches that
 * stylesheet off and on and compares every element's box and its layout styles; the touch UI stays off.
 */
const SCREENS = ['', '?screen=settings', '?screen=credits', '?screen=loadout', '?screen=dungeons', '?screen=town&window=menu', '?screen=shop', '?screen=gacha',
  '?screen=evolve', '?screen=achievements', '?screen=board', '?screen=challenges', '?screen=tutor', '?screen=shrine', '?screen=online', '?screen=account',
  '?screen=victory', '?screen=defeat', '?screen=shrineresult', '?screen=quiz', '?screen=town', '?screen=run'];

const PROPS = ['display', 'position', 'top', 'left', 'width', 'height', 'margin', 'padding', 'overflow-x', 'overflow-y', 'flex', 'flex-wrap', 'flex-direction',
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'min-width', 'min-height', 'max-width', 'max-height', 'font-size', 'line-height',
  'justify-content', 'align-items', 'transform', 'white-space', 'text-overflow', 'visibility', 'opacity', 'z-index', 'order', 'gap'];

test('welcome (first run) is untouched by the phone stylesheet', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  await expectUntouched(page);
});

for (const path of SCREENS) {
  test(`${path || 'hub'} is untouched by the phone stylesheet`, async ({ page }) => {
    await returningPlayer(page);
    await page.goto(path);
    await settle(page);
    await expectUntouched(page);
  });
}

async function expectUntouched(page: import('@playwright/test').Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.classList.contains('touch')), 'touch UI on a desktop').toBe(false);
  const diff = await page.evaluate((props) => {
    const sheet = [...document.styleSheets].find((s) => (s.ownerNode as HTMLElement | null)?.getAttribute?.('data-vite-dev-id')?.endsWith('/mobile.css'));
    if (!sheet) return ['phone stylesheet not loaded'];
    const snap = () =>
      [...document.querySelectorAll<HTMLElement>('body *')].map((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return `${[r.x, r.y, r.width, r.height].map((n) => n.toFixed(1)).join(',')}|${props.map((p) => cs.getPropertyValue(p)).join('|')}`;
      });
    // Animations would move boxes between the two snapshots: freeze them.
    document.getAnimations().forEach((a) => a.pause());
    const on = snap();
    sheet.disabled = true;
    const off = snap();
    sheet.disabled = false;
    const els = [...document.querySelectorAll<HTMLElement>('body *')];
    return on.flatMap((s, i) => (s === off[i] ? [] : [`${els[i]!.tagName.toLowerCase()}.${String(els[i]!.className)}: ${off[i]} -> ${s}`])).slice(0, 10);
  }, PROPS);
  expect(diff).toEqual([]);
}
