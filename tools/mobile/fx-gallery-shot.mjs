// Screenshots of the effect gallery (tools/fx-gallery.html) frozen at given moments, once every look has baked.
//
//   node tools/mobile/fx-gallery-shot.mjs [--out=dir] [--at=0.15,0.4] [--only=fury-swipes,slash] [--scale=2]
import { mkdirSync } from 'node:fs';
import { startFirefox, startVite, wait } from './bidi.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const out = flag('out', 'reports/fx');
const moments = flag('at', '0.15,0.4').split(',');
const only = flag('only', '');
mkdirSync(out, { recursive: true });

const vite = await startVite(4418);
const { page, stop } = await startFirefox(9348);
try {
  await page.viewport(1820, 2100, 1);
  for (const at of moments) {
    await page.nav(`${vite.url}tools/fx-gallery.html?scale=${flag('scale', '1')}&at=${at}${only ? `&only=${only}` : ''}`);
    let last = '';
    for (let i = 0; i < 90; i++) {
      await wait(1000);
      const stats = await page.evaluate(`document.getElementById('stats').textContent`);
      if (stats === last && i > 5) break;
      last = stats;
    }
    console.log(at, last);
    await page.screenshot(`${out}/gallery-${at}.png`);
  }
} finally {
  await stop();
  vite.stop?.();
}
