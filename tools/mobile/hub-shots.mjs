// The title hub and each window it opens, at phone and desktop sizes: a screenshot each plus
// whether the page or the window scrolls (owner 2026-11-08: on a phone everything shows without scrolling).
//   node tools/mobile/hub-shots.mjs [--dir=/tmp/hub] [--only=board,shrine] [--sizes=844x390,1440x900]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
// Playwright from the project if present, else the global install (pixels need Chromium, not Lightpanda).
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')); }
const URL = process.env.HUB_URL ?? 'http://localhost:5173/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const dir = flag('dir', '/tmp/hub');
const only = flag('only', '');
const sizes = flag('sizes', '844x390,740x360,1440x900').split(',').map((s) => s.split('x').map(Number));
mkdirSync(dir, { recursive: true });
const HUBS = ['title', 'pokemon', 'tutor', 'evolve', 'gacha', 'shop', 'board', 'challenges', 'achievements', 'gallery', 'friends', 'shrine', 'settings', 'online', 'play'].filter((n) => !only || only.split(',').includes(n));

// Any element whose content is taller than its box and that scrolls (the "hidden scroll" the owner rejects).
const AUDIT = `(() => {
  const doc = document.scrollingElement;
  const scrollers = [];
  for (const el of document.querySelectorAll('#app *')) {
    const s = getComputedStyle(el);
    if (!/(auto|scroll)/.test(s.overflowY + s.overflowX)) continue;
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) scrollers.push((el.className || el.tagName).toString().split(' ')[0] + ' ' + (el.scrollHeight - el.clientHeight));
  }
  const clipped = [];
  for (const el of document.querySelectorAll('#app button, #app [data-hub], #app .md-item')) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1) clipped.push((el.textContent || el.className).trim().slice(0, 20));
  }
  return { page: [doc.scrollWidth - innerWidth, doc.scrollHeight - innerHeight], scrollers: scrollers.slice(0, 8), outside: clipped.slice(0, 8) };
})()`;

const browser = await chromium.launch();
try {
  for (const [w, h] of sizes) {
    const touch = w < 1000;
    for (const hub of HUBS) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
      const page = await context.newPage();
      const settings = { language: 'es', muted: true, touchMode: touch ? 'on' : 'off', starterChosen: true, difficulty: 'easy' };
      await page.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('mazmorra-sombria.prologueSeen', '1'); localStorage.setItem('mazmorra-sombria.settings', s); localStorage.setItem('mazmorra-sombria.lastSeenVersion', '999.0.0'); }, JSON.stringify(settings));
      await page.goto(URL);
      await wait(1800);
      if (hub !== 'title') {
        await page.evaluate(`(() => { const b = document.querySelector('[data-hub="${hub}"]'); b && b.click(); return !!b; })()`);
        await wait(1400);
      }
      const audit = await page.evaluate(AUDIT);
      await page.screenshot({ path: `${dir}/${hub}-${w}x${h}.png` });
      await context.close();
      console.log(`${hub.padEnd(12)} ${w}x${h} page ${audit.page.join(',')} scrollers ${JSON.stringify(audit.scrollers)} outside ${JSON.stringify(audit.outside)}`);
    }
  }
} finally {
  await browser.close();
}
