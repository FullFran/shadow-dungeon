// Co-op smoke over the real network: two headless Firefox instances (separate
// profiles) open the same room through real Trystero, one creates it and the
// other joins with its code; each must list both players in the room window.
// Defaults to the production build; pass --base to point elsewhere.
//   node tools/mobile/coop-smoke.mjs [--base=https://www.fullfran.com/shadow-dungeon/] [--wait=30000] [--shots=/dir] [--alone]
// --alone: one guest joins a code nobody created; its room window must say the host is not answering.
// Exits 1 when the players do not see each other in time.
import { mkdirSync } from 'node:fs';
import { seedSettings, startFirefox, wait } from './bidi.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const base = flag('base', 'https://www.fullfran.com/shadow-dungeon/');
const timeout = Number(flag('wait', '30000'));
const shots = flag('shots', '');
const alone = args.includes('--alone');
if (shots) mkdirSync(shots, { recursive: true });

/** Clicks the first menu row whose label contains `text`. */
const click = (text) => `(() => { const row = [...document.querySelectorAll('.md-label')].find((n) => n.textContent.includes(${JSON.stringify(text)})); if (!row) return false; (row.closest('.md-row') ?? row.parentElement).click(); return true; })()`;
/** The room window's player rows (empty when the window is not up). */
const roster = `[...document.querySelectorAll('.town-room .md-label, .town-room li, .town-room .md-list > *')].map((n) => n.textContent.trim()).filter(Boolean)`;
const roomText = `document.querySelector('.town-room')?.innerText ?? ''`;

async function until(page, expression, ms) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await page.evaluate(expression);
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(500);
  }
}

async function player(port, nickname) {
  const ff = await startFirefox(port);
  await ff.page.viewport(1280, 800, 1);
  await seedSettings(ff.page, base, { nickname, touchMode: 'off' });
  await ff.page.nav(base);
  if (!(await until(ff.page, click('Jugar en línea'), 15000))) throw new Error(`${nickname}: no online entry on the title`);
  return ff;
}

if (alone) {
  const guest = await player(9302, 'Invitado');
  let said = null;
  try {
    await guest.page.nav(`${base}?room=ZZ9Q7`);
    if (!(await until(guest.page, click('Jugar en línea'), 15000))) throw new Error('guest: no online entry');
    if (!(await until(guest.page, click('Unirse con código'), 5000))) throw new Error('guest: no join row');
    console.log('right away:', JSON.stringify(await until(guest.page, roomText, 10000)));
    said = await until(guest.page, `((t) => t.includes('no responde') ? t : null)(${roomText})`, timeout);
    console.log(said ? `after the timeout: ${JSON.stringify(said)}` : 'no unreachable notice');
    if (shots) await guest.page.screenshot(`${shots}/alone.png`);
  } finally {
    await guest.stop();
  }
  process.exit(said ? 0 : 1);
}

const host = await player(9301, 'Anfitrion');
const guest = await player(9302, 'Invitado');
let ok = false;
try {
  if (!(await until(host.page, click('Crear sala'), 5000))) throw new Error('host: no create row');
  const code = await until(host.page, `(${roomText}).match(/\\b[A-Z0-9]{5}\\b/)?.[0] ?? null`, 20000);
  if (!code) {
    if (shots) await host.page.screenshot(`${shots}/host-nocode.png`);
    throw new Error(`host: no room code shown; page text: ${JSON.stringify(await host.page.evaluate(`document.body.innerText.slice(0, 400)`))}`);
  }
  console.log('room', code);
  await guest.page.nav(`${base}?room=${code}`);
  if (!(await until(guest.page, click('Jugar en línea'), 15000))) throw new Error('guest: no online entry');
  if (!(await until(guest.page, click('Unirse con código'), 5000))) throw new Error('guest: no join row');
  const started = Date.now();
  const both = `((t) => t.includes('Anfitrion') && t.includes('Invitado'))(${roomText})`;
  const [h, g] = await Promise.all([until(host.page, both, timeout), until(guest.page, both, timeout)]);
  console.log('host room window:', JSON.stringify(await host.page.evaluate(roomText)));
  console.log('guest room window:', JSON.stringify(await guest.page.evaluate(roomText)));
  ok = Boolean(h && g);
  console.log(ok ? `both listed after ${Date.now() - started} ms` : 'players do not see each other');
  if (shots) {
    await host.page.screenshot(`${shots}/host.png`);
    await guest.page.screenshot(`${shots}/guest.png`);
  }
} finally {
  await host.stop();
  await guest.stop();
}
process.exit(ok ? 0 : 1);
