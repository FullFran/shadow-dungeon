import { expect, test } from '@playwright/test';
import { returningPlayer, settle, smallTargets, swipeScroll, unreachable } from './reach';

/**
 * Every menu on a phone (portrait 320-412 px wide, landscape 844x390): each button and heading can be reached and tapped,
 * nothing hides in a box that does not scroll, a box that overflows scrolls under a finger, and button-like controls are
 * fingertip-sized. Screens open through the dev server's `?screen=` links (src/app/main.ts devScreen).
 */
const SCREENS: Record<string, string> = {
  hub: '',
  settings: '?screen=settings',
  credits: '?screen=credits',
  loadout: '?screen=loadout',
  dungeons: '?screen=dungeons',
  news: '?screen=news',
  'town menu': '?screen=town&window=menu',
  shop: '?screen=shop',
  gacha: '?screen=gacha',
  evolve: '?screen=evolve',
  achievements: '?screen=achievements',
  board: '?screen=board',
  challenges: '?screen=challenges',
  tutor: '?screen=tutor',
  shrine: '?screen=shrine',
  online: '?screen=online',
  account: '?screen=account',
  lobby: '?screen=lobby',
  victory: '?screen=victory',
  defeat: '?screen=defeat',
  'run end': '?screen=runend',
  'shrine result': '?screen=shrineresult',
  endless: '?screen=endless',
  quiz: '?screen=quiz',
};

async function expectUsable(page: import('@playwright/test').Page, name: string): Promise<void> {
  // E2E_SHOTS=<dir>: keep a capture of every screen (before/after evidence).
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/${test.info().project.name}-${name.replace(/\W+/g, '-')}.png` });
  expect.soft(await unreachable(page), 'controls and headings out of reach').toEqual([]);
  expect.soft(await smallTargets(page), 'controls smaller than a fingertip').toEqual([]);
  expect.soft(await swipeScroll(page), 'an overflowing box that does not scroll by touch').not.toBe(0);
  // A system notice (news, install) sat over the screen: put it off and check the screen under it too.
  const later = page.locator('.sys-notice-veil button:not(.sys-notice-primary)').first();
  if (await later.isVisible().catch(() => false)) {
    await later.click();
    await page.waitForTimeout(900);
    await expectUsable(page, `${name}-under-notice`);
  }
}

test('welcome (first run)', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  await expectUsable(page, 'welcome');
});

for (const [name, path] of Object.entries(SCREENS)) {
  test(name, async ({ page }) => {
    await returningPlayer(page);
    await page.goto(path);
    await settle(page);
    await expectUsable(page, name);
  });
}
