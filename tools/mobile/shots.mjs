// Every screen at phone sizes, silent headless Firefox on the dev server, touch on:
// a screenshot per screen and viewport plus an audit line (page overflow, tap
// targets under 44 px, controls outside the viewport).
//   node tools/mobile/shots.mjs <label> [--only=run] [--dir=/tmp/mobile]
import { mkdirSync } from 'node:fs';
import { seedSettings, startFirefox, startVite, wait } from './bidi.mjs';

const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith('--')) ?? 'shot';
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const only = flag('only', '');
const dir = flag('dir', '/tmp/mobile');
mkdirSync(dir, { recursive: true });

const VIEWPORTS = [
  [844, 390],
  [390, 844],
];

/** [name, query, settle ms, after(page) step] */
const SCREENS = [
  ['title', '', 1500],
  ['settings', 'screen=settings', 1200],
  ['loadout', 'screen=loadout', 1500],
  ['dungeons', 'screen=dungeons', 1200],
  ['endless', 'screen=endless', 1200],
  ['town', 'screen=town', 3500],
  ['tutor', 'screen=tutor', 1500],
  ['evolve', 'screen=evolve&coins=2000', 1500],
  ['challenges', 'screen=challenges', 1500],
  ['shop', 'screen=shop', 1500],
  ['shrine', 'screen=shrine', 1500],
  ['online', 'screen=online', 1200],
  ['lobby', 'screen=lobby', 2500],
  ['item-pick', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500],
  ['run', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500, 'pick'],
  ['run-boss', 'screen=run&dungeon=misty-forest&floor=8&card=2&seed=7', 3500, 'pick'],
  ['menu', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500, 'menu'],
  ['victory', 'screen=victory', 1200],
  ['defeat', 'screen=defeat', 1200],
  ['eclipse', 'screen=eclipse', 1200],
  ['credits', 'screen=credits', 1200],
].filter(([name]) => !only || only.split(',').includes(name));

const AUDIT = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const doc = document.scrollingElement;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const small = [], outside = [];
  for (const el of document.querySelectorAll('button, .md-item, input, select, [role=button]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 24);
    if (r.height < 43.5 || r.width < 43.5) small.push(name + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) outside.push(name);
  }
  return { scroll: [doc.scrollWidth - vw, doc.scrollHeight - vh], small: small.slice(0, 12), outside: outside.slice(0, 12) };
})()`;

const vite = await startVite(4419);
const { page, stop } = await startFirefox(9349);
try {
  for (const [w, h] of VIEWPORTS) {
    for (const [name, query, settle, step] of SCREENS) {
      await page.viewport(w, h, 3);
      await seedSettings(page, vite.url, { difficulty: 'easy' });
      await page.nav(`${vite.url}${query ? `?${query}` : ''}`);
      await wait(settle);
      if (step === 'pick' || step === 'menu') {
        await page.evaluate(`(window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true })), 1)`);
        await wait(700);
      }
      if (step === 'menu') {
        const at = await page.evaluate(`(() => { const b = document.querySelector('.touch-pause'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
        if (at) await page.touch([[at[0], at[1], 60]]);
        await wait(700);
      }
      const audit = await page.evaluate(AUDIT);
      await page.screenshot(`${dir}/${label}-${name}-${w}x${h}.png`);
      console.log(`${name.padEnd(10)} ${w}x${h} scroll ${audit.scroll.join(',')}  small ${JSON.stringify(audit.small)}  outside ${JSON.stringify(audit.outside)}`);
    }
  }
} finally {
  await stop();
  vite.stop();
}
