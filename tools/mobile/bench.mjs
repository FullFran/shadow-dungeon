// Mobile frame-time benchmark: headless Firefox (silent) on the dev server at
// phone viewports, the dev perf probe (src/adapters/perf-probe.ts, `?perf=1`)
// recording per-frame simulation and render ms in heavy scenes.
//
//   node tools/mobile/bench.mjs [--seconds=6] [--out=reports/perf/latest.json] [--only=boss-card]
//
// Firefox cannot throttle the CPU: the numbers are this machine's; read them
// against a phone budget of ~4-6x slower (16.7 ms frame -> ~3-4 ms here).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedSettings, startFirefox, startVite, wait } from './bidi.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const seconds = Number(flag('seconds', '6'));
const out = flag('out', 'reports/perf/latest.json');
const only = flag('only', '');
const shotDir = flag('shots', '');

const VIEWPORTS = [
  { name: 'landscape', width: 844, height: 390 },
  { name: 'portrait', width: 390, height: 844 },
];

/** Heavy scenes: a Nightmare spell card full of bullets, a crowded arena (co-op sized), a generated floor, the town. */
const SCENES = [
  { name: 'boss-card', query: 'screen=run&dungeon=misty-forest&floor=8&card=2&seed=7', settings: { difficulty: 'nightmare' } },
  { name: 'crowd-12', query: 'screen=run&spawn=koffing,zubat,duskull,houndour,slugma,remoraid,koffing,zubat,duskull,houndour,slugma,remoraid&seed=7', settings: { difficulty: 'easy' } },
  { name: 'floor', query: 'screen=run&dungeon=crypt-of-the-sword-king&floor=3&seed=7', settings: { difficulty: 'hard' } },
  { name: 'town', query: 'screen=town', settings: {} },
].filter((s) => !only || s.name === only);

const vite = await startVite(4417);
const { page, stop } = await startFirefox(9347);
const results = [];
try {
  for (const viewport of VIEWPORTS) {
    for (const scene of SCENES) {
      await page.viewport(viewport.width, viewport.height, 3);
      await seedSettings(page, vite.url, scene.settings);
      await page.nav(`${vite.url}?perf=1&${scene.query}`);
      // Sprites, the floor card and any short cutscene; a floor's item pick is taken (key 1): then measure.
      await wait(3000);
      await page.evaluate(`(window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true })), 1)`);
      await wait(800);
      await page.evaluate(`(globalThis.__mzPerf && globalThis.__mzPerf.reset(), 1)`);
      await wait(seconds * 1000);
      const report = await page.evaluate(`globalThis.__mzPerf ? globalThis.__mzPerf.report() : null`);
      const canvas = await page.evaluate(`(() => { const c = document.querySelector('canvas.game'); return c ? [c.width, c.height] : null; })()`);
      if (shotDir) await page.screenshot(`${shotDir}/bench-${scene.name}-${viewport.width}x${viewport.height}.png`);
      results.push({ scene: scene.name, viewport: `${viewport.width}x${viewport.height}`, dpr: 3, canvas, report });
      const r = report ?? {};
      const fmt = (c) => (c ? `${c.p50.toFixed(2)}/${c.p95.toFixed(2)}` : '-');
      console.log(
        `${scene.name.padEnd(10)} ${viewport.name.padEnd(9)} canvas ${canvas ? canvas.join('x') : '-'}  frame p50/p95 ${fmt(r.frame)}  sim ${fmt(r.sim)}  render ${fmt(r.render)}  bullets max ${r.bullets?.max ?? '-'} enemies max ${r.enemies?.max ?? '-'}`,
      );
    }
  }
} finally {
  await stop();
  vite.stop();
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ at: new Date().toISOString(), seconds, results }, null, 2)}\n`);
console.log(`→ ${out}`);
