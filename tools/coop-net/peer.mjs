// One co-op peer for real-network tests (issue #5): a headless browser plays
// host or guest of a room over real Trystero and reports what happened as one
// JSON line (`RESULT {...}`). Run two of them on different networks (this
// machine and the VPS, see tools/coop-net/README.md) to measure the real thing.
//   node peer.mjs --role=host|guest [--code=ABCDE] [--browser=chromium|firefox]
//                 [--turn=auto|off|relay] [--base=https://www.fullfran.com/shadow-dungeon/]
//                 [--run=1] [--sample=20] [--shots=/dir] [--n=2] [--expect=2]
// --turn: auto = what the game does; off = the TURN route answers nothing (direct only);
//         relay = the browser may only use relay candidates (proves TURN works).
// --run=1: the host walks to the waystone and leads the room into the first dungeon;
//          both sides then sample the F3 net overlay.
// --refresh=1 (guest): once in, reload the page and join again; reports the time to get back in.
// --watch=N (host): for N seconds after everyone is in, record how many guests the room lists (duplicates, drops).
// --hostLeaves=1 (guest, with --run=1): after sampling, wait for the run to end with the host-left notice.
// --expect: players the room window must list before measuring (host included); --n names a guest.
// The host prints `CODE <code>` as soon as the room exists.
import { chromium, firefox } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || '1']));
const role = args.role ?? 'host';
const base = args.base ?? 'https://www.fullfran.com/shadow-dungeon/';
const turn = args.turn ?? 'auto';
const kind = args.browser ?? 'chromium';
const sampleS = Number(args.sample ?? 20);
const wantRun = args.run === '1';
const name = role === 'host' ? 'Anfitrion' : `Invitado${args.n ?? ''}`;
const t0 = Date.now();
const result = { role, browser: kind, turn, base, events: {}, errors: [] };
const mark = (event) => (result.events[event] = Date.now() - t0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const launch = kind === 'firefox'
  ? firefox.launch({ firefoxUserPrefs: { 'media.peerconnection.ice.relay_only': turn === 'relay', 'media.autoplay.default': 5, 'media.volume_scale': '0.0' } })
  : chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', ...(turn === 'relay' ? ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'] : [])] });
const browser = await launch;
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => result.errors.push(String(e.message).slice(0, 200)));

if (turn === 'off') await page.route('**/api/sd/turn', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"iceServers":[]}' }));
let turnServers = null;
page.on('response', async (res) => {
  if (!res.url().includes('/api/sd/turn')) return;
  try {
    turnServers = (await res.json()).iceServers?.length ?? 0;
  } catch {
    turnServers = -1;
  }
});

// Silent, Spanish, no first-run screens; and every RTCPeerConnection kept for getStats.
await page.addInitScript(({ nickname }) => {
  if (!localStorage.getItem('mazmorra-sombria.settings')) {
    localStorage.setItem('mazmorra-sombria.settings', JSON.stringify({ language: 'es', muted: true, touchMode: 'off', starterChosen: true, nickname }));
    localStorage.setItem('mazmorra-sombria.cinematicsSeen', JSON.stringify(['aegislash', 'decidueye', 'dhelmise', 'nihilego'].flatMap((s) => [s + ':pre', s + ':post'])));
    localStorage.setItem('mazmorra-sombria.prologueSeen', '1');
    localStorage.setItem('mazmorra-sombria.simaScenes', JSON.stringify(['plea']));
    // Past any release, so the once-per-update patch notes never take the title's place.
    localStorage.setItem('mazmorra-sombria.lastSeenVersion', '999.0.0');
  }
  const RTC = window.RTCPeerConnection;
  window.__pcs = [];
  window.__ice = [];
  window.RTCPeerConnection = function (...a) {
    const pc = new RTC(...a);
    window.__pcs.push(pc);
    pc.__servers = (a[0]?.iceServers ?? []).length;
    pc.addEventListener('iceconnectionstatechange', () => window.__ice.push([Math.round(performance.now()), pc.iceConnectionState]));
    return pc;
  };
  window.RTCPeerConnection.prototype = RTC.prototype;
}, { nickname: name });

const click = (text) =>
  page.evaluate((t) => {
    const row = [...document.querySelectorAll('.md-label')].find((n) => n.textContent.includes(t));
    if (!row) return false;
    (row.closest('.md-row') ?? row.parentElement).click();
    return true;
  }, text);
async function until(fn, ms, every = 250) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(every);
  }
}
const roomText = () => page.evaluate(() => document.querySelector('.town-room')?.innerText ?? '');
const shot = async (label) => args.shots && page.screenshot({ path: `${args.shots}/${role}-${label}.png` }).catch(() => {});

/** The connected peer connections' selected candidate pairs: type and protocol on each side, RTT in ms. */
const pairs = () =>
  page.evaluate(async () => {
    const out = [];
    for (const pc of window.__pcs) {
      if (pc.connectionState !== 'connected' && pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') continue;
      const stats = await pc.getStats();
      const byId = new Map();
      stats.forEach((s) => byId.set(s.id, s));
      let pair = null;
      stats.forEach((s) => {
        if (s.type === 'transport' && s.selectedCandidatePairId) pair = byId.get(s.selectedCandidatePairId);
      });
      if (!pair) stats.forEach((s) => s.type === 'candidate-pair' && (s.selected || s.nominated) && s.state === 'succeeded' && (pair = s));
      if (!pair) continue;
      const local = byId.get(pair.localCandidateId) ?? {};
      const remote = byId.get(pair.remoteCandidateId) ?? {};
      out.push({
        local: local.candidateType, remote: remote.candidateType, protocol: local.protocol, relayProtocol: local.relayProtocol,
        rttMs: pair.currentRoundTripTime !== undefined ? Math.round(pair.currentRoundTripTime * 1000) : null,
        bytesSent: pair.bytesSent, bytesReceived: pair.bytesReceived,
      });
    }
    return out;
  });

const pct = (xs, p) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : null);

try {
  await page.goto(role === 'guest' ? `${base}?room=${args.code}` : base, { waitUntil: 'load' });
  if (!(await until(() => click('Jugar en línea'), 20000))) throw new Error('no online entry on the title');
  mark('title');
  if (role === 'host') {
    await click('Crear sala');
    const code = await until(async () => (await roomText()).match(/\b[A-Z0-9]{5}\b/)?.[0], 20000);
    if (!code) throw new Error('no room code');
    result.code = code;
    console.log(`CODE ${code}`);
    mark('roomOpen');
  } else {
    await click('Unirse con código');
    mark('joinClicked');
  }
  // Admitted on both sides: the room window lists the host and at least one guest.
  const together = await until(async () => {
    const t = await roomText();
    return t.includes('Anfitrion') && (t.match(/Invitado/g) ?? []).length >= Number(args.expect ?? 2) - 1 ? t : null;
  }, Number(args.wait ?? 90000));
  result.turnServers = turnServers;
  result.pcCount = await page.evaluate(() => window.__pcs.length);
  result.iceStates = await page.evaluate(() => window.__ice.slice(0, 40));
  if (!together) {
    result.room = await roomText();
    await shot('not-together');
    throw new Error('players never listed together');
  }
  mark('together');
  await shot('together');

  if (role === 'guest' && args.refresh === '1') {
    await wait(3000);
    mark('reload');
    await page.reload({ waitUntil: 'load' });
    if (!(await until(() => click('Jugar en línea'), 20000))) throw new Error('no online entry after reload');
    await click('Unirse con código');
    const back = await until(async () => {
      const t = await roomText();
      return t.includes('Anfitrion') && t.includes('Invitado') ? t : null;
    }, 60000);
    if (!back) throw new Error('not back in after reload');
    mark('backIn');
  }
  if (role === 'host' && args.watch) {
    const seen = [];
    for (let i = 0; i < Number(args.watch) * 2; i++) {
      const n = ((await roomText()).match(/Invitado/g) ?? []).length;
      if (seen.length === 0 || seen[seen.length - 1][1] !== n) seen.push([Date.now() - t0, n]);
      await wait(500);
    }
    result.guestsListed = seen;
  }

  // RTT of the live links, sampled once a second.
  const rtts = [];
  let selected = [];
  for (let i = 0; i < sampleS; i++) {
    selected = await pairs();
    for (const p of selected) if (p.rttMs !== null) rtts.push(p.rttMs);
    await wait(1000);
  }
  result.links = selected;
  result.listed = (await roomText()).match(/Anfitrion|Invitado\d*/g);
  result.rttMs = { n: rtts.length, min: rtts.length ? Math.min(...rtts) : null, p50: pct(rtts, 0.5), p95: pct(rtts, 0.95), max: rtts.length ? Math.max(...rtts) : null };

  if (wantRun) {
    const inRun = () => page.evaluate(() => !document.querySelector('canvas.town') && !!document.querySelector('canvas'));
    if (role === 'host') {
      // Walk east from the square to the waystone, trying to read it after every step.
      let opened = false;
      for (let step = 0; step < 80 && !opened; step++) {
        await page.keyboard.down('ArrowRight');
        await wait(110);
        await page.keyboard.up('ArrowRight');
        await page.keyboard.press('Enter');
        await wait(120);
        opened = await page.evaluate(() => [...document.querySelectorAll('.md-label')].some((n) => /Cripta|Bosque|Sima|Cueva|Ciénaga/.test(n.textContent)));
      }
      if (!opened) {
        await shot('no-waystone');
        throw new Error('waystone window never opened');
      }
      const label = await page.evaluate(() => [...document.querySelectorAll('.md-label')].map((n) => n.textContent).find((t) => /Cripta/.test(t)) ?? null);
      mark('departClick');
      await click(label ?? 'Cripta');
    }
    if (!(await until(inRun, 30000))) {
      await shot('no-run');
      throw new Error('never entered the run');
    }
    mark('runStarted');
    await wait(1500);
    await page.keyboard.press('F3');
    const overlay = [];
    for (let i = 0; i < 10; i++) {
      await wait(2000);
      overlay.push(await page.evaluate(() => document.querySelector('.net-stats')?.innerText ?? ''));
    }
    result.overlay = overlay.filter(Boolean).slice(-3);
    await shot('run');
    if (role === 'guest' && args.hostLeaves === '1') {
      const left = Date.now();
      const notice = await until(() => page.evaluate(() => (/anfitrión se ha ido/i.test(document.body.innerText) ? document.body.innerText.slice(0, 300) : null)), 45000);
      result.hostLeft = notice ? { afterMs: Date.now() - left, text: notice } : null;
      await shot('host-left');
    }
  }
  result.ok = true;
} catch (e) {
  result.ok = false;
  result.error = String(e.message ?? e);
}
console.log(`RESULT ${JSON.stringify(result)}`);
// Stay connected a while, so a peer still sampling does not see this one leave (--linger seconds).
await wait(Number(args.linger ?? 15) * 1000);
await browser.close();
process.exit(result.ok ? 0 : 1);
