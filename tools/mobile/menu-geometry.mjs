// Menu geometry: on every reachable menu, at desktop and phone sizes, walks the
// ▶ cursor through every row with the keyboard and checks that no window (nor
// the list itself) changes size or moves while the highlighted row changes.
// A description that resizes its window moves the rows under the pointer or the
// finger, so a tap lands on the wrong row (the owner's report, 2026-10-26).
// Silent headless Firefox on the dev server, like shots.mjs.
//   node tools/mobile/menu-geometry.mjs [--only=shop,tutor] [--shots=/dir] [--label=after]
// Exits 1 when any menu moves.
import { mkdirSync } from 'node:fs';
import { seedSettings, startFirefox, startVite, wait } from './bidi.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const only = flag('only', '');
const shots = flag('shots', '');
const label = flag('label', 'menu');
if (shots) mkdirSync(shots, { recursive: true });

/** [width, height, touch] */
const VIEWPORTS = [
  [1280, 800, false],
  [844, 390, true],
  [390, 844, true],
];

/** [name, query, settle ms, step]: step 'pick' takes the first item card of a run, 'menu' then opens the pause menu. */
const SCREENS = [
  ['title', '', 1500],
  ['settings', 'screen=settings', 1200],
  ['loadout', 'screen=loadout', 1500],
  ['dungeons', 'screen=dungeons', 1200],
  ['tutor', 'screen=tutor', 1500],
  ['evolve', 'screen=evolve&coins=2000', 1500],
  ['challenges', 'screen=challenges', 1500],
  ['shop', 'screen=shop', 1500],
  ['gacha', 'screen=gacha&coins=2000', 1500],
  ['board', 'screen=board&coins=2000', 1500],
  ['achievements', 'screen=achievements', 1500],
  ['shrine', 'screen=shrine', 1500],
  ['shrine-reflections', 'screen=shrine&view=reflections', 1500],
  ['shrine-gauntlets', 'screen=shrine&view=gauntlets', 1500],
  ['online', 'screen=online', 1200],
  ['account', 'screen=account', 1500],
  ['item-pick', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500],
  ['pause', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500, 'menu'],
  ['victory', 'screen=victory', 1200],
  ['defeat', 'screen=defeat', 1200],
  ['eclipse', 'screen=eclipse', 1200],
].filter(([name]) => !only || only.split(',').includes(name));

// Boxes in page coordinates (a keyboard move may scroll the page: that is not a resize).
const MEASURE = `(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
  const lists = [...document.querySelectorAll('.md-list[role=menu]')].filter((l) => !l.closest('.md-desc-ghost') && l.getClientRects().length > 0);
  const list = lists.at(-1);
  const out = {};
  document.querySelectorAll('.md-window').forEach((w, i) => { if (!w.closest('.md-desc-ghost')) out['window' + i + (w.className.split(' ')[1] ? '.' + w.className.split(' ')[1] : '')] = box(w); });
  if (list) out.list = box(list);
  const small = [...(list?.querySelectorAll('.md-item') ?? [])].filter((r) => r.getClientRects().length && r.getBoundingClientRect().height < 43.5).length;
  return { overflow: document.scrollingElement.scrollWidth - innerWidth, small, boxes: out, rows: list ? list.querySelectorAll('.md-item').length : 0, horizontal: !!list?.classList.contains('horizontal'), active: list ? [...list.querySelectorAll('.md-item')].findIndex((r) => r.classList.contains('is-active')) : -1 };
})()`;

const key = (code) => `(window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(code)}, code: ${JSON.stringify(code)}, bubbles: true })), 1)`;

const vite = await startVite(4421);
const { page, stop } = await startFirefox(9351);
const failures = [];
try {
  for (const [w, h, touch] of VIEWPORTS) {
    for (const [name, query, settle, step] of SCREENS) {
      await page.viewport(w, h, 1);
      await seedSettings(page, vite.url, { difficulty: 'easy', touchMode: touch ? 'on' : 'off' });
      await page.nav(`${vite.url}${query ? `?${query}` : ''}`);
      await wait(settle);
      if (step === 'menu') {
        await page.evaluate(key('Digit1'));
        await wait(700);
        await page.evaluate(key('Escape'));
        await wait(700);
      }
      const first = await page.evaluate(MEASURE);
      if (!first.rows) {
        console.log(`${name.padEnd(18)} ${w}x${h}  no menu reached`);
        failures.push(`${name} ${w}x${h}: no menu`);
        continue;
      }
      if (shots) await page.screenshot(`${shots}/${label}-${name}-${w}x${h}.png`);
      const moved = new Set();
      let visited = 0;
      for (let i = 0; i < first.rows; i++) {
        await page.evaluate(key(first.horizontal ? 'ArrowRight' : 'ArrowDown'));
        await wait(60);
        const now = await page.evaluate(MEASURE);
        visited++;
        // Half a pixel of slack: a keyboard move may scroll the page by a fraction (scrollIntoView), which is not a resize.
        for (const [id, b] of Object.entries(first.boxes)) if (!now.boxes[id] || b.some((v, k) => Math.abs(v - now.boxes[id][k]) > 0.5)) moved.add(`${id} ${b} -> ${now.boxes[id]} (row ${now.active})`);
        if (now.overflow > 0) moved.add(`page overflows ${now.overflow}px sideways (row ${now.active})`);
        for (const id of Object.keys(now.boxes)) if (!(id in first.boxes)) moved.add(`${id} appeared`);
      }
      if (touch && first.small) moved.add(`${first.small} rows under 44 px`);
      const verdict = moved.size === 0 ? 'stable' : 'MOVED';
      console.log(`${name.padEnd(18)} ${w}x${h}  rows ${String(first.rows).padStart(2)}  moves ${visited}  ${verdict}${moved.size ? '  ' + [...moved].slice(0, 3).join(' | ') : ''}`);
      if (moved.size) failures.push(`${name} ${w}x${h}`);
    }
  }
} finally {
  await stop();
  vite.stop();
}
console.log(failures.length ? `\nFAIL ${failures.length}: ${failures.join(', ')}` : '\nOK: every menu kept its geometry');
process.exit(failures.length ? 1 : 0);
