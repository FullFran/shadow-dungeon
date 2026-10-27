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

/** Every overworld map visited on this device (the travel window lists them all). */
const ALL_MAPS = { 'mazmorra-sombria.visitedMaps': JSON.stringify(['refugio', 'ruinas', 'mirador', 'crater', 'lago', 'cienaga']) };

/** [name, query, settle ms, step, local storage]: step 'pick' takes the first item card of a run, 'menu' then opens the pause menu, 'options' opens the title's Opciones; the storage entries are set before the page opens. */
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
  ['travel', 'screen=town&window=travel', 3000, undefined, ALL_MAPS],
  ['town-menu', 'screen=town&window=menu', 3000],
  ['town-account', 'screen=town&window=account', 3000],
  ['town-gallery', 'screen=town&window=gallery', 3000],
  ['options', '', 1500, 'options'],
  ['item-pick', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500],
  ['pause', 'screen=run&dungeon=crypt-of-the-sword-king&floor=2&seed=7', 3500, 'menu'],
  ['victory', 'screen=victory', 1200],
  ['defeat', 'screen=defeat', 1200],
  ['eclipse', 'screen=eclipse', 1200],
].filter(([name]) => !only || only.split(',').includes(name));

// Boxes in content coordinates: a keyboard move may scroll the page, or the
// overlay a window over the town sits in (too tall for a landscape phone, the
// overlay scrolls, index.html): neither is a resize.
const MEASURE = `(() => {
  const scrolled = (el) => { let x = scrollX, y = scrollY; for (let a = el.parentElement; a && a !== document.scrollingElement; a = a.parentElement) { x += a.scrollLeft; y += a.scrollTop; } return [x, y]; };
  const box = (el) => { const r = el.getBoundingClientRect(); const [x, y] = scrolled(el); return [r.left + x, r.top + y, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
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
    for (const [name, query, settle, step, storage] of SCREENS) {
      await page.viewport(w, h, 1);
      await seedSettings(page, vite.url, { difficulty: 'easy', touchMode: touch ? 'on' : 'off' });
      if (storage) await page.evaluate(`(${JSON.stringify(Object.entries(storage))}.forEach(([k, v]) => localStorage.setItem(k, v)), 1)`);
      await page.nav(`${vite.url}${query ? `?${query}` : ''}`);
      await wait(settle);
      if (step === 'menu') {
        await page.evaluate(key('Digit1'));
        await wait(700);
        await page.evaluate(key('Escape'));
        await wait(700);
      }
      if (step === 'options') {
        // The title's third entry, "Opciones".
        for (const code of ['ArrowDown', 'ArrowDown', 'Enter']) {
          await page.evaluate(key(code));
          await wait(150);
        }
        await wait(600);
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
