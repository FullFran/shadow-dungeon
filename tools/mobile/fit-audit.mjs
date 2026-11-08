// Every screen of the game on every phone shape (owner 2026-11-08: "que no haya scroll en ningún menú móvil ... en cualquier
// móvil, sistema operativo, navegador"). Playwright Chromium (pixels) against the dev server, touch on, `?unlock=all`.
// Per screen and size: page scroll, inner scrollers, controls outside the viewport, clamped text.
//   node tools/mobile/fit-audit.mjs [--only=a,b] [--sizes=844x390,...] [--shots=/dir] [--json=/file]
// Exits 1 when anything does not fit.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright'));
}
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const BASE = process.env.FIT_URL ?? 'http://localhost:5173/';
const shots = flag('shots', '');
const jsonOut = flag('json', '');
const only = flag('only', '');
if (shots) mkdirSync(shots, { recursive: true });

/**
 * Landscape phone shapes in CSS px, real devices first, then the same phones with the browser's bars showing
 * (Safari and Chrome keep ~40-60 px of toolbar in landscape until the page goes fullscreen).
 */
const PHONES = [
  [932, 430], // iPhone 15/16 Pro Max
  [922, 412], // Pixel 9 Pro Fold (owner's report)
  [915, 412], // Pixel 7 / Galaxy S Ultra
  [896, 414], // iPhone 11 / XR
  [844, 390], // iPhone 12-15
  [812, 375], // iPhone X / 13 mini
  [780, 360], // small Android
  [740, 360], // Galaxy S8/S9
  [667, 375], // iPhone SE 2/3, 8
  [640, 360], // budget Android
  [568, 320], // iPhone SE 1
  [844, 340], // iPhone 14 in Safari with its bars
  [667, 320], // iPhone SE in Safari with its bars
  [1024, 600], // small touch tablet
];
const sizes = flag('sizes', '') ? flag('sizes', '').split(',').map((s) => s.split('x').map(Number)) : PHONES;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (sel) => async (page) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await wait(900);
};
/** Picks the current species in the picker (a tap reads the card, the second picks it) and lands on the moves loadout. */
const pickSpecies = async (page) => {
  for (let i = 0; i < 2 && (await page.$('.sp-card')); i++) {
    await page.tap('.sp-card.is-current, .sp-card').catch(() => {});
    await wait(700);
  }
  if (await page.$('.sp-card')) await page.keyboard.press('Enter');
  await wait(1200);
};
const key = (k) => async (page) => {
  await page.keyboard.press(k);
  await wait(700);
};
const hub = (id) => click(`[data-hub="${id}"]`);

/** [name, query, settle ms, ...steps] */
const SCREENS = [
  ['title', '', 1500],
  ['group-partner', '', 1500, hub('group-partner')],
  ['group-world', '', 1500, hub('group-world')],
  ['group-more', '', 1500, hub('group-more')],
  ...['pokemon', 'tutor', 'evolve', 'gacha', 'shop', 'board', 'challenges', 'achievements', 'gallery', 'friends', 'shrine', 'settings', 'online', 'account', 'controls', 'news', 'credits', 'report', 'prologue', 'play'].map((id) => [`hub-${id}`, '', 1500, hub(id)]),
  ['shrine-swear', '', 1500, hub('shrine'), click('.oa-grid .hl-card'), click('.oa-sheet .hl-cta')],
  ['shrine-moves', '', 1500, hub('shrine'), click('.oa-grid .hl-card'), click('.oa-sheet .hl-cta'), pickSpecies],
  ['loadout-moves', 'screen=loadout', 1800, pickSpecies],
  ['loadout', 'screen=loadout', 1800],
  ['dungeons', 'screen=dungeons', 1500],
  ['dungeons-pick', 'screen=dungeons', 1500, key('Enter')],
  ['quiz', 'screen=quiz', 1800],
  ['settings', 'screen=settings', 1500],
  ['settings-tabs', 'screen=settings', 1500, key('ArrowRight'), key('ArrowRight')],
  ['credits', 'screen=credits', 1500],
  ['news', 'screen=news', 1500],
  ['account', 'screen=account', 1500],
  ['online', 'screen=online', 1500],
  ['lobby', 'screen=lobby', 2500],
  ['town', 'screen=town', 3500],
  ['town-menu', 'screen=town', 3500, key('Escape')],
  ['shop', 'screen=shop', 1500],
  ['gacha', 'screen=gacha', 2000],
  ['evolve', 'screen=evolve', 1500],
  ['achievements', 'screen=achievements', 1500],
  ['board', 'screen=board', 1500],
  ['challenges', 'screen=challenges', 1500],
  ['tutor', 'screen=tutor', 1800],
  ['shrine', 'screen=shrine', 1500],
  ['item-pick', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500],
  ['run', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500, key('Digit1')],
  ['pause', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500, key('Digit1'), click('.touch-pause')],
  ['victory', 'screen=victory', 1500],
  ['defeat', 'screen=defeat', 1500],
  ['runend', 'screen=runend', 1500],
  ['shrineresult', 'screen=shrineresult', 1500],
  ['eclipse', 'screen=eclipse', 1500],
  ['endless', 'screen=endless', 1800],
].filter(([name]) => !only || only.split(',').includes(name));

const AUDIT = () => {
  const doc = document.scrollingElement;
  const vw = innerWidth;
  const vh = innerHeight;
  const label = (el) => ((el.className && el.className.baseVal === undefined ? el.className : el.tagName) || el.tagName).toString().split(' ')[0];
  const shown = (el) => {
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const scrollers = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (!/(auto|scroll)/.test(s.overflowY + s.overflowX)) continue;
    if (!shown(el)) continue;
    const dy = el.scrollHeight - el.clientHeight;
    const dx = el.scrollWidth - el.clientWidth;
    if (dy > 2 || dx > 2) scrollers.push(`${label(el)} ${Math.max(dy, dx)}`);
  }
  const outside = [];
  for (const el of document.querySelectorAll('button, [role=button], input, .md-item, a[href]')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // A control on a pager's hidden page does not count; one cut by any box that clips it does.
    if (el.closest('.pg-off, [hidden]')) continue;
    let clippedBy = '';
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (r.bottom > pr.bottom + 1 || r.right > pr.right + 1 || r.top < pr.top - 1 || r.left < pr.left - 1) clippedBy = label(p);
      break;
    }
    if (clippedBy) {
      outside.push(`${(el.getAttribute('aria-label') || el.textContent || label(el)).trim().slice(0, 18)} (in ${clippedBy})`);
      continue;
    }
    if (r.bottom > vh + 1 || r.right > vw + 1 || r.top < -1 || r.left < -1) outside.push((el.getAttribute('aria-label') || el.textContent || label(el)).trim().slice(0, 22));
  }
  const cut = [];
  // Any text cut short: an ellipsis, a line clamp, or a clipped box on an element that holds its own text.
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    const s = getComputedStyle(el);
    const clamps = s.textOverflow === 'ellipsis' || /\d/.test(s.webkitLineClamp || '');
    if (!clamps) continue;
    if (!el.textContent.trim()) continue;
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) cut.push(el.textContent.trim().slice(0, 22));
  }
  // Text that spills out of the control holding it (a title taller than its card).
  for (const el of document.querySelectorAll('button, [role=button]')) {
    if (!shown(el) || el.closest('.pg-off, [hidden]')) continue;
    const r = el.getBoundingClientRect();
    for (const t of el.querySelectorAll('span, p, strong, b, small')) {
      if (!t.childNodes.length || ![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const q = t.getBoundingClientRect();
      if (q.height && (q.bottom > r.bottom + 2 || q.top < r.top - 2 || q.right > r.right + 2)) { cut.push(t.textContent.trim().slice(0, 22) + ' (spills)'); break; }
    }
  }
  // Two controls drawn over each other (a row that ran out of room).
  const overlap = [];
  // Only controls the player can reach: not under a window or veil drawn over them (hit-test a point inside each).
  const reachable = (e) => {
    const r = e.getBoundingClientRect();
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.bottom - 4]];
    return pts.some(([x, y]) => { const top = document.elementFromPoint(x, y); return top && (top === e || e.contains(top) || top.contains(e)); });
  };
  const ctrls = [...document.querySelectorAll('button, [role=button], input, .md-item')].filter((e) => shown(e) && !e.closest('[hidden], .pg-off') && reachable(e));
  for (let i = 0; i < ctrls.length; i++) {
    for (let j = i + 1; j < ctrls.length; j++) {
      const a = ctrls[i];
      const b = ctrls[j];
      if (a.contains(b) || b.contains(a)) continue;
      const r = a.getBoundingClientRect();
      const q = b.getBoundingClientRect();
      const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left);
      const oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ox > 3 && oy > 3 && getComputedStyle(a).position !== 'fixed' && getComputedStyle(b).position !== 'fixed') overlap.push(`${(a.textContent || label(a)).trim().slice(0, 12)} x ${(b.textContent || label(b)).trim().slice(0, 12)}`);
    }
  }
  // #app clips on phones instead of scrolling: content taller than it counts as page overflow.
  const app = document.getElementById('app');
  const appOver = app ? Math.max(app.scrollHeight - app.clientHeight, app.scrollWidth - app.clientWidth) : 0;
  return { page: Math.max(doc.scrollWidth - vw, doc.scrollHeight - vh, appOver), scrollers: [...new Set(scrollers)].slice(0, 6), outside: [...new Set(outside)].slice(0, 6), cut: [...new Set(cut)].slice(0, 6), overlap: [...new Set(overlap)].slice(0, 4) };
};

const browser = await chromium.launch();
const results = [];
let bad = 0;
try {
  for (const [w, h] of sizes) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const settings = JSON.stringify({ language: 'es', muted: true, touchMode: 'on', starterChosen: true, difficulty: 'easy' });
    await context.addInitScript((s) => {
      if (sessionStorage.getItem('fit-seeded')) return;
      sessionStorage.setItem('fit-seeded', '1');
      localStorage.clear();
      localStorage.setItem('mazmorra-sombria.prologueSeen', '1');
      localStorage.setItem('mazmorra-sombria.settings', s);
      localStorage.setItem('mazmorra-sombria.lastSeenVersion', '999.0.0');
      localStorage.setItem('mazmorra-sombria.cinematicsSeen', JSON.stringify(['aegislash', 'decidueye', 'dhelmise', 'nihilego'].flatMap((x) => [x + ':pre', x + ':post'])));
      localStorage.setItem('mazmorra-sombria.simaScenes', JSON.stringify(['plea']));
    }, settings);
    for (const [name, query, settle, ...steps] of SCREENS) {
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}?unlock=all${query ? `&${query}` : ''}`);
        await wait(settle);
        for (const step of steps) await step(page);
        const audit = await page.evaluate(AUDIT);
        const fails = audit.page > 1 || audit.scrollers.length || audit.outside.length || audit.cut.length || audit.overlap.length;
        if (fails) bad += 1;
        results.push({ name, size: `${w}x${h}`, ...audit });
        if (fails) console.log(`${name.padEnd(16)} ${w}x${h} page ${audit.page} scrollers ${JSON.stringify(audit.scrollers)} outside ${JSON.stringify(audit.outside)} cut ${JSON.stringify(audit.cut)} overlap ${JSON.stringify(audit.overlap)}`);
        if (shots && (fails || process.env.FIT_ALL_SHOTS)) await page.screenshot({ path: `${shots}/${name}-${w}x${h}.png` });
      } catch (e) {
        console.log(`${name.padEnd(16)} ${w}x${h} ERROR ${String(e).slice(0, 120)}`);
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1));
console.log(`${results.length} checks, ${bad} failing`);
process.exit(bad ? 1 : 0);
