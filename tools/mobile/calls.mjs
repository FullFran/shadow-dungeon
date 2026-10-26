// Canvas call census per frame (which 2D calls a scene makes, and their CPU ms),
// headless Firefox at 844x390 DPR 3, silent. Finds render hotspots for bench.mjs.
//   node tools/mobile/calls.mjs
import { seedSettings, startFirefox, startVite, wait } from './bidi.mjs';

const SCENES = [
  ['boss-card', 'screen=run&dungeon=misty-forest&floor=8&card=2&seed=7', { difficulty: 'nightmare' }],
  ['floor', 'screen=run&dungeon=crypt-of-the-sword-king&floor=3&seed=7', {}],
  ['town', 'screen=town', {}],
];

const CENSUS = `new Promise((res) => {
  const P = CanvasRenderingContext2D.prototype; const counts = {}; const time = {};
  const names = ['drawImage','fill','stroke','fillRect','fillText','strokeText','createRadialGradient','createLinearGradient','arc','ellipse','save','restore','measureText','putImageData','getImageData'];
  const orig = {};
  for (const n of names) { orig[n] = P[n]; P[n] = function (...a) { counts[n] = (counts[n] || 0) + 1; const t = performance.now(); const v = orig[n].apply(this, a); time[n] = (time[n] || 0) + performance.now() - t; return v; }; }
  const watch = (prop, active) => { const d = Object.getOwnPropertyDescriptor(P, prop); let n = 0; Object.defineProperty(P, prop, { configurable: true, get() { return d.get.call(this); }, set(v) { if (active(v)) n++; d.set.call(this, v); } }); return { restore: () => Object.defineProperty(P, prop, d), count: () => n }; };
  const filter = watch('filter', (v) => v !== 'none');
  const blur = watch('shadowBlur', (v) => v > 0);
  let frames = 0;
  const tick = () => {
    frames++;
    if (frames < 120) return requestAnimationFrame(tick);
    for (const n of names) P[n] = orig[n];
    filter.restore(); blur.restore();
    const per = {};
    for (const n in counts) per[n] = [Math.round(counts[n] / frames), +(time[n] / frames).toFixed(2)];
    res({ per, filters: +(filter.count() / frames).toFixed(1), shadowBlur: +(blur.count() / frames).toFixed(1) });
  };
  requestAnimationFrame(tick);
})`;

const vite = await startVite(4418);
const { page, stop } = await startFirefox(9348);
try {
  for (const [name, query, settings] of SCENES) {
    await page.viewport(844, 390, 3);
    await seedSettings(page, vite.url, settings);
    await page.nav(`${vite.url}?perf=1&${query}`);
    await wait(3000);
    await page.evaluate(`(window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true })), 1)`);
    await wait(800);
    console.log(name, JSON.stringify(await page.evaluate(CENSUS)));
  }
} finally {
  await stop();
  vite.stop();
}
