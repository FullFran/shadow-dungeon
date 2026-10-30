// Headless Firefox over WebDriver BiDi for the phone checks (tools/mobile/*.mjs).
// Silent by construction: a fresh profile whose user.js mutes all media, and the
// game's stored settings say `muted: true` before the game first loads.
// Only the processes started here are killed (their PIDs), never by name.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Everything started here, killed on any exit (a crash included). */
const started = new Set();
process.on('exit', () => {
  for (const child of started) killGroup(child);
});
process.on('unhandledRejection', (err) => {
  console.error('unhandled:', err?.message ?? err);
  process.exit(1);
});

/** Starts the Vite dev server on `port` (the dev-only `?screen=`/`?perf=` hooks need it). */
export async function startVite(port) {
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  started.add(child);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite did not start')), 30000);
    child.stdout.on('data', (d) => {
      if (String(d).includes('Local:')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`vite exited ${code}`)));
  });
  return { url: `http://127.0.0.1:${port}/`, stop: () => killGroup(child) };
}

function killGroup(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}

/** Starts headless Firefox with a throwaway silent profile and opens a BiDi session. */
/** `prefs`: extra about:config entries, e.g. { 'media.peerconnection.ice.relay_only': true }. */
export async function startFirefox(port, prefs = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'mz-ff-'));
  writeFileSync(
    join(profile, 'user.js'),
    [
      'user_pref("media.volume_scale", "0.0");',
      'user_pref("media.autoplay.default", 5);',
      'user_pref("privacy.reduceTimerPrecision", false);',
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
      'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
      ...Object.entries(prefs).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${JSON.stringify(v)});`),
    ].join('\n'),
  );
  const child = spawn('firefox', ['--headless', '--no-remote', '--profile', profile, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore', detached: true });
  started.add(child);
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    await wait(500);
    ws = await new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
      socket.onopen = () => resolve(socket);
      socket.onerror = () => resolve(undefined);
    });
  }
  if (!ws) throw new Error('firefox BiDi did not open');
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.type === 'error' ? reject(new Error(`${msg.error}: ${msg.message}`)) : resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send('session.new', { capabilities: {} });
  const { context } = await send('browsingContext.create', { type: 'tab' });
  const page = {
    send,
    context,
    async viewport(width, height, devicePixelRatio = 3) {
      await send('browsingContext.setViewport', { context, viewport: { width, height }, devicePixelRatio });
    },
    nav: (url) => send('browsingContext.navigate', { context, url, wait: 'complete' }),
    /** Evaluates an expression (may return a promise); the value comes back through JSON. */
    async evaluate(expression) {
      const r = await send('script.evaluate', { target: { context }, expression: `(async () => JSON.stringify(await (${expression})))()`, awaitPromise: true });
      if (r.type === 'exception') throw new Error(`page: ${r.exceptionDetails?.text}`);
      return r.result.type === 'string' ? JSON.parse(r.result.value) : undefined;
    },
    async screenshot(path) {
      const { data } = await send('browsingContext.captureScreenshot', { context });
      writeFileSync(path, Buffer.from(data, 'base64'));
    },
    /** Touch fingers in parallel: each [x, y, holdMs, dx, dy, delayMs] (a drag of dx, dy while held; starting delayMs late). */
    touch(fingers) {
      return send('input.performActions', {
        context,
        actions: fingers.map(([x, y, hold = 60, dx = 0, dy = 0, delay = 0], i) => ({
          type: 'pointer',
          id: `finger${i}`,
          parameters: { pointerType: 'touch' },
          actions: [
            ...(delay ? [{ type: 'pause', duration: delay }] : []),
            { type: 'pointerMove', x: Math.round(x), y: Math.round(y) },
            { type: 'pointerDown', button: 0 },
            ...(dx || dy ? [{ type: 'pointerMove', x: Math.round(x + dx), y: Math.round(y + dy), duration: 150 }] : []),
            { type: 'pause', duration: hold },
            { type: 'pointerUp', button: 0 },
          ],
        })),
      });
    },
  };
  const stop = async () => {
    try {
      await send('session.end', {});
    } catch {
      /* closing anyway */
    }
    ws.close();
    killGroup(child);
    await wait(300);
    rmSync(profile, { recursive: true, force: true });
  };
  return { page, stop };
}

/** Stored settings before the game first loads: silent, Spanish, touch on, plus `extra`. */
export async function seedSettings(page, base, extra = {}) {
  await page.nav(base);
  const settings = { language: 'es', muted: true, touchMode: 'on', starterChosen: true, ...extra };
  await page.evaluate(`(localStorage.clear(), localStorage.setItem('mazmorra-sombria.prologueSeen', '1'), localStorage.setItem('mazmorra-sombria.settings', ${JSON.stringify(JSON.stringify(settings))}), localStorage.setItem('mazmorra-sombria.cinematicsSeen', JSON.stringify(['aegislash','decidueye','dhelmise','nihilego'].flatMap((s) => [s + ':pre', s + ':post']))), localStorage.setItem('mazmorra-sombria.prologueSeen', '1'), localStorage.setItem('mazmorra-sombria.simaScenes', JSON.stringify(['plea'])), localStorage.setItem('mazmorra-sombria.lastSeenVersion', '999.0.0'), 1)`);
}

export { wait };
