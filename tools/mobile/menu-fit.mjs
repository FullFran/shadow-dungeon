// Menu fit on phones (ticket SD-8AAYCK): on each menu, at phone sizes in both
// orientations, the floating "Atrás" button must not cover a window or a
// heading, and nothing may stick out sideways. Silent headless Firefox on the
// dev server, like shots.mjs.
//   node tools/mobile/menu-fit.mjs [--shots=/dir]
// Exits 1 when something does not fit.
import { startFirefox, startVite, wait } from './bidi.mjs';

const shots = process.argv.find((a) => a.startsWith('--shots='))?.split('=')[1];
const SIZES = [[360, 640], [390, 844], [844, 390], [640, 360]];
const SCREENS = [
  ['title', []],
  ['options', ['Opciones']],
  ['controls', ['Opciones', 'Controles del mando']],
  ['report', ['Opciones', 'Reportar un problema']],
  ['account', ['Opciones', 'Cuenta']],
  ['friends', ['Opciones', 'Amigos']],
  ['settings', ['Opciones', 'Ajustes']],
  ['news', ['Opciones', 'Novedades']],
  ['credits', ['Opciones', 'Créditos']],
  ['online', ['Jugar en línea']],
];
const vite = await startVite(4428);
const { page, stop } = await startFirefox(9359);
// A row is confirmed by a click on it; with touch the first tap may only move the cursor, so it waits for the screen to change.
const open = (text) =>
  page.evaluate(`(async () => {
    const find = () => [...document.querySelectorAll('.md-item')].find((x) => x.textContent.trim().includes(${JSON.stringify(text)}));
    for (let i = 0; i < 2 && find(); i++) { find().click(); await new Promise((done) => setTimeout(done, 300)); }
    return true;
  })()`);
const measure = () =>
  page.evaluate(`(() => {
    const problems = [];
    const back = document.querySelector('.touch-back');
    const shown = back && getComputedStyle(back).display !== 'none' ? back.getBoundingClientRect() : null;
    const name = (e) => (e.className || e.tagName).toString().split(' ').slice(0, 2).join('.');
    const hits = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (const e of document.querySelectorAll('#app .md-window, #app .md-window-title, #app .screen-title')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (shown && hits(shown, r)) problems.push('back covers ' + name(e));
    }
    for (const e of document.querySelectorAll('#app .md-window, #app .title-logo, #app .title-logo h1, #app .screen-title')) {
      const r = e.getBoundingClientRect();
      if (!r.width) continue;
      if (r.left < 0 || r.right > innerWidth) problems.push(name(e) + ' sticks out ' + Math.round(Math.max(-r.left, r.right - innerWidth)));
    }
    if (document.documentElement.scrollWidth > innerWidth) problems.push('page scrolls sideways');
    return JSON.stringify([...new Set(problems)]);
  })()`);
let bad = 0;
try {
  for (const [w, h] of SIZES) {
    await page.viewport(w, h, 1);
    await page.nav(vite.url);
    await page.evaluate(`(localStorage.clear(), localStorage.setItem('mazmorra-sombria.settings', JSON.stringify({ language: 'es', muted: true, touchMode: 'on', starterChosen: true })), localStorage.setItem('mazmorra-sombria.prologueSeen', '1'), localStorage.setItem('mazmorra-sombria.lastSeenVersion', '999.0.0'), true)`);
    for (const [name, path] of SCREENS) {
      await page.nav(vite.url);
      await wait(1300);
      for (const step of path) await open(step);
      await wait(200);
      const problems = JSON.parse(await measure());
      if (problems.length) bad++;
      console.log(`${problems.length ? 'FAIL' : 'ok  '} ${w}x${h} ${name} ${problems.join('; ')}`);
      if (problems.length && shots) await page.screenshot(`${shots}/fit-${w}x${h}-${name}.png`);
    }
  }
} finally {
  await stop();
  vite.stop?.();
}
console.log(bad ? `${bad} screens do not fit` : 'every screen fits');
process.exit(bad ? 1 : 0);
