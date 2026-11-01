// Plays a test arena and screenshots right after pressing each move slot, to look at effects in the real game.
//
//   node tools/mobile/fx-play-shot.mjs [--out=dir] [--query='screen=run&spawn=koffing,zubat&seed=3'] [--bursts=4]
import { mkdirSync, writeFileSync } from 'node:fs';
import { seedSettings, startFirefox, startVite, wait } from './bidi.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const out = flag('out', 'reports/fx');
const query = flag('query', 'screen=run&spawn=koffing,zubat,slugma&seed=3');
const bursts = Number(flag('bursts', '4'));
mkdirSync(out, { recursive: true });

const key = (code, type) => `window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', key: '${code}', bubbles: true }))`;
const SLOTS = ['KeyQ', 'KeyE', 'KeyR', 'KeyF'];

const vite = await startVite(4419);
const { page, stop } = await startFirefox(9349);
try {
  await page.viewport(1024, 640, 1);
  await seedSettings(page, vite.url, { difficulty: 'easy' });
  await page.nav(`${vite.url}?${query}`);
  await wait(6000);
  await page.evaluate(`(${key('Digit1', 'keydown')}, 1)`);
  await wait(500);
  for (let b = 0; b < bursts; b++) {
    const code = SLOTS[b % SLOTS.length];
    // Browser screenshots are slower than a swing: the page copies its own canvas at exact moments instead.
    await page.evaluate(`(() => {
      globalThis.__shots = [];
      const canvas = document.querySelector('canvas.game') ?? document.querySelector('canvas');
      ${key(code, 'keydown')};
      setTimeout(() => { ${key(code, 'keyup')}; }, 70);
      for (const ms of [140, 240, 340]) setTimeout(() => globalThis.__shots.push(canvas.toDataURL('image/png')), ms);
      return 1;
    })()`);
    await wait(700);
    const shots = await page.evaluate(`globalThis.__shots`);
    shots.forEach((url, s) => writeFileSync(`${out}/play-${b}-${s}.png`, Buffer.from(url.split(',')[1], 'base64')));
    await wait(1500);
  }
  console.log('shots in', out);
} finally {
  await stop();
  vite.stop?.();
}
