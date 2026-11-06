import type { Page } from '@playwright/test';

/** A player with a walker already chosen: the boot goes to the hub, not to the first-run flow (src/app/onboarding.ts bootRoute). */
export async function returningPlayer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'mazmorra-sombria.settings';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ starterChosen: true }));
  });
}

/** Waits until the boot splash is gone and the screen shows at least one control. */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !document.querySelector('.boot') && [...document.querySelectorAll('button, [role=button], a[href]')].some((e) => e.getBoundingClientRect().width > 0),
    undefined,
    { timeout: 60_000 },
  );
  // Windows rise and fade in (about 400 ms): measure them at rest.
  await page.waitForTimeout(900);
}

export interface Problem {
  what: string;
  why: string;
}

/**
 * Every control and heading the player can see must be reachable on this viewport: inside the screen once the player scrolls
 * whatever scrolls (never hidden in a box that cannot scroll), on top where it is tapped, and not under the fan notice.
 */
export function unreachable(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const problems: { what: string; why: string }[] = [];
    const notices = [...document.querySelectorAll<HTMLElement>('.notice')].filter((n) => getComputedStyle(n).display !== 'none' && n.getBoundingClientRect().height > 0);
    const shown = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (el.closest('.notice, [aria-hidden="true"], .touch-controls, .is-leaving')) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.height > vh) return false;
      // Inside a folded section (an accordion closed to zero height): hidden on purpose until the player opens it.
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (/hidden|clip/.test(getComputedStyle(a).overflowY) && a.getBoundingClientRect().height < 2) return false;
      }
      return true;
    };
    const resetScroll = () => {
      for (const e of document.querySelectorAll<HTMLElement>('*')) if (e.scrollTop || e.scrollLeft) { e.scrollTop = 0; e.scrollLeft = 0; }
      document.scrollingElement!.scrollTop = 0;
    };
    const check = (el: HTMLElement, control: boolean) => {
      if (!shown(el)) return;
      const what = `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || el.className || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
      resetScroll();
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // scrollIntoView also moves boxes the player cannot scroll (overflow: hidden): content only reached that way is lost.
      for (let a = el.parentElement; a; a = a.parentElement) {
        const pageBox = a === document.scrollingElement || a === document.body;
        const o = getComputedStyle(pageBox ? document.body : a);
        const html = getComputedStyle(document.documentElement);
        const lockedY = /hidden|clip/.test(o.overflowY) || (pageBox && /hidden|clip/.test(html.overflowY));
        const lockedX = /hidden|clip/.test(o.overflowX) || (pageBox && /hidden|clip/.test(html.overflowX));
        if ((a.scrollTop && lockedY) || (a.scrollLeft && lockedX)) {
          problems.push({ what, why: `cut off inside a box that does not scroll (${a.id ? '#' + a.id : a.className || a.tagName})` });
          return;
        }
      }
      const r = el.getBoundingClientRect();
      if (r.top < -1 || r.left < -1 || r.bottom > vh + 1 || r.right > vw + 1) {
        problems.push({ what, why: `outside the screen at ${[r.left, r.top, r.width, r.height].map(Math.round).join(',')}` });
        return;
      }
      for (const n of notices) {
        if (n.contains(el)) continue;
        const k = n.getBoundingClientRect();
        if (Math.min(r.right, k.right) - Math.max(r.left, k.left) > 4 && Math.min(r.bottom, k.bottom) - Math.max(r.top, k.top) > 4) {
          problems.push({ what, why: 'under the fan notice' });
          return;
        }
      }
      if (control) {
        // Tappable where some of it shows on top: the centre or a point near each corner (overlapping map pins share edges).
        const points = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([fx, fy]) => [r.left + r.width * fx!, r.top + r.height * fy!] as const);
        const onTop = points.some(([x, y]) => {
          const hit = document.elementFromPoint(x, y);
          return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        });
        if (!onTop) {
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          problems.push({ what, why: `covered by ${hit ? hit.tagName.toLowerCase() + '.' + String((hit as HTMLElement).className) : 'nothing'}` });
        }
      }
    };
    // A system notice (news, install, update) is modal: only its own controls can be reached while it shows.
    const root: ParentNode = document.querySelector('.sys-notice-veil') ?? document;
    for (const el of root.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input, select, .md-item')) check(el, true);
    for (const el of root.querySelectorAll<HTMLElement>('h1, h2, h3, .md-window-title')) check(el, false);
    resetScroll();
    return problems;
  });
}

/** Controls smaller than a fingertip (WCAG 2.5.8 asks 24 px; phones want about 44): button-like controls under 40 px. */
export function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, [role="button"], .md-item')]
      .filter((el) => !el.closest('.notice, [aria-hidden="true"], .touch-controls') && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => [el, el.getBoundingClientRect()] as const)
      .filter(([, r]) => r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40))
      .map(([el, r]) => `${(el.innerText || el.getAttribute('aria-label') || el.className).trim().replace(/\s+/g, ' ').slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
}

/**
 * Drags a finger up over the middle of the tallest scrollable box; returns how far the page moved in total, nested boxes
 * included (a finger latches onto the innermost box that can scroll). -1: nothing on the screen overflows.
 */
export async function swipeScroll(page: Page): Promise<number> {
  const box = await page.evaluate(() => {
    // Under a modal system notice only the notice itself can take the finger.
    const root: ParentNode = document.querySelector('.sys-notice-veil') ?? document;
    const boxes = [...root.querySelectorAll<HTMLElement>('*')].filter((e) => {
      const o = getComputedStyle(e).overflowY;
      return /auto|scroll/.test(o) && e.scrollHeight > e.clientHeight + 8 && e.clientHeight > 40 && !e.closest('[aria-hidden="true"]');
    });
    boxes.sort((a, b) => b.clientHeight - a.clientHeight);
    const e = boxes[0];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, window.innerHeight);
    return { x: r.left + r.width / 2, y0: bottom - (bottom - top) * 0.2, y1: top + (bottom - top) * 0.2 };
  });
  if (!box) return -1;
  const total = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].reduce((sum, e) => sum + e.scrollTop, 0));
  const before = await total();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y0 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y: box.y0 + ((box.y1 - box.y0) * i) / 10 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  return (await total()) - before;
}
