import { expect, test, type Page } from '@playwright/test';
import { returningPlayer, settle } from './reach';

/**
 * The game with only a controller (issue #32, odd/tasks/gamepad.md): a mocked Gamepad API (`standard` mapping) stands in
 * for the pad, and nothing else touches the page once a screen is up. Every screen answers B; A presses the focused
 * button; text fields say they need a keyboard and never trap the pad; losing the pad mid-run opens the run's menu.
 */
const PAD = { a: 0, b: 1, back: 8, start: 9, up: 12, down: 13 } as const;

async function plugPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'mock standard pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons };
    let plugged = true;
    navigator.getGamepads = () => [plugged ? (pad as unknown as Gamepad) : null, null, null, null];
    (window as unknown as { __pad: unknown }).__pad = {
      set(button: number, on: boolean) {
        buttons[button]!.pressed = on;
        buttons[button]!.value = on ? 1 : 0;
      },
      stick(x: number, y: number) {
        pad.axes[0] = x;
        pad.axes[1] = y;
      },
      unplug() {
        plugged = false;
        pad.connected = false;
        window.dispatchEvent(new Event('gamepaddisconnected'));
      },
    };
  });
}

type PadHandle = { set(button: number, on: boolean): void; stick(x: number, y: number): void; unplug(): void };

async function press(page: Page, button: number): Promise<void> {
  await page.evaluate((b) => (window as unknown as { __pad: PadHandle }).__pad.set(b, true), button);
  await page.waitForTimeout(120);
  await page.evaluate((b) => (window as unknown as { __pad: PadHandle }).__pad.set(b, false), button);
  await page.waitForTimeout(350);
}

const focused = (page: Page) => page.evaluate(() => `${document.activeElement?.tagName}:${(document.activeElement as HTMLInputElement | null)?.placeholder || document.activeElement?.textContent?.trim().slice(0, 24) || ''}`);
const screenText = (page: Page) => page.evaluate(() => (document.getElementById('app')?.innerText ?? '').replace(/\s+/g, ' '));
/** Which screen is up: the page's first two levels of elements (text that animates on its own does not count). */
const screenShape = (page: Page) =>
  page.evaluate(() => [...document.body.querySelectorAll(':scope > *, :scope > * > *')].map((e) => `${e.tagName}.${typeof e.className === 'string' ? e.className : ''}`).join(' '));

async function open(page: Page, path: string): Promise<void> {
  await returningPlayer(page);
  await plugPad(page);
  await page.goto(path);
  await settle(page);
}

const SCREENS = ['?screen=settings', '?screen=credits', '?screen=loadout', '?screen=dungeons', '?screen=news', '?screen=town&window=menu', '?screen=shop', '?screen=gacha',
  '?screen=evolve', '?screen=achievements', '?screen=board', '?screen=challenges', '?screen=tutor', '?screen=shrine', '?screen=online', '?screen=account',
  '?screen=victory', '?screen=defeat', '?screen=runend', '?screen=shrineresult', '?screen=endless', '?screen=quiz'];

for (const path of SCREENS) {
  test(`${path}: B leaves with only the pad`, async ({ page }) => {
    await open(page, path);
    // Some screens build in steps (the run's end opens its window after the last frames): wait until it holds still.
    let before = await screenShape(page);
    for (let held = 0; held < 5; ) {
      await page.waitForTimeout(400);
      const now = await screenShape(page);
      held = now === before ? held + 1 : 0;
      before = now;
    }
    // A window that just opened may ignore a press for a moment (no accidental skips), so B gets a few tries.
    for (let i = 0; i < 3 && (await screenShape(page)) === before; i++) {
      await press(page, PAD.b);
      await page.waitForTimeout(600);
    }
    expect(await screenShape(page)).not.toBe(before);
  });
}

test('a cinematic: A turns to the next line', async ({ page }) => {
  // Auto off (src/app/prologue.ts), so only a press turns the page.
  await page.addInitScript(() => localStorage.setItem('mazmorra-sombria.cinematicAuto', '0'));
  await open(page, '?screen=prologue');
  const line = () => page.locator('.prologue').innerText();
  // Let the line finish typing.
  let before = await line();
  for (let held = 0; held < 3; ) {
    await page.waitForTimeout(500);
    const now = await line();
    held = now === before ? held + 1 : 0;
    before = now;
  }
  await press(page, PAD.a);
  await expect.poll(line).not.toBe(before);
});

test('A presses the focused button: the hub notice, the Pokémon picker, the town menu', async ({ page }) => {
  await open(page, '/');
  const notice = page.locator('.sys-notice-veil');
  if (await notice.isVisible().catch(() => false)) {
    await press(page, PAD.a);
    await expect(notice).toBeHidden();
  }
  await page.goto('?screen=loadout');
  await settle(page);
  expect(await focused(page)).toMatch(/^BUTTON:/);
  const picker = await screenText(page);
  await press(page, PAD.a);
  await expect.poll(() => screenText(page)).not.toBe(picker);
  await page.goto('?screen=town&window=menu');
  await settle(page);
  await expect(page.locator('.tm-primary')).toBeFocused();
  await press(page, PAD.a);
  await expect(page.locator('.tm-primary')).toHaveCount(0);
});

test('a text field says it needs a keyboard, and the D-pad leaves it both ways', async ({ page }) => {
  await open(page, '?screen=settings');
  await press(page, PAD.down);
  await expect(page.locator('.st-input')).toBeFocused();
  await expect(page.locator('.pad-field-note')).toBeVisible();
  await press(page, PAD.down);
  await expect(page.locator('.st-input')).not.toBeFocused();
  await expect(page.locator('.pad-field-note')).toBeHidden();
  await press(page, PAD.up);
  await expect(page.locator('.st-input')).toBeFocused();
});

test('the report form is walked field by field with the D-pad, through its dropdowns', async ({ page }) => {
  await open(page, '/');
  // Opening the form is not what this checks: the hub's own pad paths are covered above.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Reportar/ }).first().click();
  await page.waitForTimeout(900);
  const fields: string[] = [];
  for (let i = 0; i < 6; i++) {
    await press(page, PAD.down);
    fields.push(await focused(page));
  }
  expect(fields.filter((f) => f.startsWith('TEXTAREA')).length, fields.join(' > ')).toBeGreaterThanOrEqual(2);
  expect(new Set(fields).size, fields.join(' > ')).toBeGreaterThanOrEqual(4);
});

test('a run: Start opens the menu, and losing the pad while it plays opens it too', async ({ page }) => {
  await open(page, '?screen=run');
  await expect(page.locator('canvas.game')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await press(page, PAD.start);
  await expect(page.locator('.overlay.pause')).toBeVisible();
  await press(page, PAD.start);
  await expect(page.locator('.overlay.pause')).toHaveCount(0);
  // The pad plays (the stick moves the player), then it goes.
  await page.evaluate(() => (window as unknown as { __pad: PadHandle }).__pad.stick(1, 0));
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as unknown as { __pad: PadHandle }).__pad.unplug());
  await expect(page.locator('.overlay.pause')).toBeVisible();
});
