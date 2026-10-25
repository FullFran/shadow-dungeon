import { M0_SLOT_LAYOUT } from '../data/slots';
import type { MoveId } from '../data/moves';
import { loadSheets, type SheetStore } from '../adapters/assets';
import { createAudio } from '../adapters/audio';
import { browserStore } from '../adapters/storage';
import { detectLanguage, setLanguage, t, type Language } from '../i18n';
import { BroadcastChannelTransport } from '../net/broadcast';
import { LagTransport, parseLagParams } from '../net/lag';
import { createSession, type NetSession } from '../net/session';
import { realScheduler, type Transport } from '../net/transport';
import { startGame, type GameOptions, type GameResult, type RunningGame, type RunSummary } from './game';
import { openPauseMenu } from './menu';
import { defaultSettings, loadSettings, saveSettings, slotOptions, type Settings } from './settings';
import { CONTROL_KEYS, el, languageRow, lockRow, soundRow } from './settings-panel';

/**
 * Page flow: pre-run menu (loadout, language, lock type, sound) -> generated
 * floors 1-3 -> boss floor -> defeat or victory screen (floor reached and run
 * seed); Esc during a run opens the pause menu (quick settings, restart floor,
 * quit). Each run gets a random seed unless the page URL fixes one (`?seed=123`). Settings persist through the
 * storage port and apply at once, also mid-run; the fan-project notice is always
 * on screen. Audio starts on the first user gesture (browsers block autoplay).
 */
const store = browserStore();
let settings: Settings = loadSettings(store, defaultSettings(detectLanguage(navigator.language)));
const audio = createAudio(settings);
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
let sheets: SheetStore | null = null;
let running: RunningGame | null = null;

/** Run seed from `?seed=` (any integer), else a fresh random one per run. */
function runSeed(): number {
  const fixed = Number.parseInt(new URLSearchParams(window.location.search).get('seed') ?? '', 10);
  return Number.isFinite(fixed) ? fixed | 0 : (Math.random() * 2 ** 31) | 0;
}

/** Development server only: `?floor=N` starts the run on floor N (to look at a floor without playing down to it). */
function devStartFloor(): number | undefined {
  if (!import.meta.env.DEV) return undefined;
  const floor = Number.parseInt(new URLSearchParams(window.location.search).get('floor') ?? '', 10);
  return Number.isFinite(floor) ? floor : undefined;
}

/**
 * `?net=local`: a shared run between tabs of this browser (netcode spike,
 * docs/gdd.md §12). `?host=1` makes this tab the host; otherwise it looks for
 * one and, if nobody answers in a moment, becomes it. `?lag=ms&jitter=ms&loss=0..1`
 * simulates a bad network on what this tab sends; `?delay=ms` tunes the render delay.
 */
interface NetJoin {
  session: NetSession;
  role: 'host' | 'guest';
  localId: string;
  seed: number;
  floor: number;
}

const HOST_SEARCH_MS = 700;

function connectLocal(seed: number, floor: number): Promise<NetJoin> {
  const params = new URLSearchParams(window.location.search);
  const scheduler = realScheduler();
  const lag = parseLagParams(window.location.search);
  const base = new BroadcastChannelTransport();
  const transport: Transport<string> = lag ? new LagTransport(base, { ...lag, scheduler, random: Math.random }) : base;
  const delay = Number.parseFloat(params.get('delay') ?? '');
  const session = createSession({ transport, scheduler, ...(Number.isFinite(delay) ? { renderDelayMs: Math.max(0, delay) } : {}) });
  const species = 'mimikyu';
  const asHost = (): NetJoin => {
    session.host(seed, floor, species);
    return { session, role: 'host', localId: 'p1', seed, floor };
  };
  if (params.get('host') === '1') return Promise.resolve(asHost());
  return new Promise((resolve) => {
    let done = false;
    session.onStart((start) => {
      if (done) return;
      done = true;
      resolve({ session, role: 'guest', localId: start.localId, seed: start.seed, floor: start.floor });
    });
    session.join(species, settings.loadout);
    window.setTimeout(() => {
      if (done) return;
      done = true;
      resolve(asHost());
    }, HOST_SEARCH_MS);
  });
}

const netMode = (): boolean => new URLSearchParams(window.location.search).get('net') === 'local';

function applyLanguage(language: Language): void {
  setLanguage(language);
  document.documentElement.lang = language;
  document.title = t('app.title');
}

function update(changes: Partial<Settings>): void {
  settings = { ...settings, ...changes };
  saveSettings(store, settings);
  audio.setVolumes(settings);
  running?.setLock({ lockType: settings.lockType, clickToLock: settings.clickToLock });
}

function notice(): HTMLElement {
  return el('footer', { className: 'notice' }, [el('p', { textContent: t('notice.fanProject') }), el('p', { textContent: t('notice.sprites') })]);
}

function show(root: HTMLElement, ...children: Node[]): void {
  running?.stop();
  running = null;
  root.replaceChildren(...children, notice());
}

function menu(root: HTMLElement): void {
  applyLanguage(settings.language);

  const languages = languageRow(settings, (language) => {
    update({ language });
    menu(root);
  });

  const slots = M0_SLOT_LAYOUT.map((kind, index) => {
    const select = el(
      'select',
      {},
      slotOptions(kind).map((moveId) => el('option', { value: moveId, textContent: t(`move.${moveId}`) })),
    );
    select.value = settings.loadout[index] ?? '';
    select.addEventListener('change', () => {
      const loadout = [...settings.loadout];
      loadout[index] = select.value as MoveId;
      update({ loadout });
    });
    return el('label', {}, [`${t(`slot.${kind}`)} `, select]);
  });

  const start = el('button', { type: 'button', className: 'primary', textContent: t('menu.start') });
  start.addEventListener('click', () => play(root));

  const controls = CONTROL_KEYS.map((key) => el('li', { textContent: t(`menu.controls.${key}`) }));

  show(
    root,
    el('div', { className: 'panel' }, [
      el('h1', { textContent: t('app.title') }),
      el('p', { className: 'subtitle', textContent: t('menu.subtitle') }),
      languages,
      el('h2', { textContent: t('menu.loadout') }),
      el('div', { className: 'row' }, slots),
      el('h2', { textContent: t('menu.lockOn') }),
      lockRow(settings, update),
      el('h2', { textContent: t('menu.sound') }),
      soundRow(settings, update),
      el('h2', { textContent: t('menu.controls') }),
      el('ul', {}, controls),
      el('p', { className: 'goal', textContent: t('menu.goal') }),
      start,
    ]),
  );
  start.focus();
}

function resultScreen(root: HTMLElement, result: GameResult, summary: RunSummary): void {
  audio.setMusic(null);
  audio.play(result);
  const retry = el('button', { type: 'button', className: 'primary', textContent: t('screen.retry') });
  retry.addEventListener('click', () => play(root));
  const back = el('button', { type: 'button', textContent: t('screen.menu') });
  back.addEventListener('click', () => menu(root));
  show(
    root,
    el('div', { className: `panel ${result}` }, [
      el('h1', { textContent: t(`screen.${result}.title`) }),
      el('p', { textContent: t(`screen.${result}.text`) }),
      el('p', { className: 'run-summary', textContent: `${t('screen.floorReached')}: ${summary.floor} · ${t('screen.seed')}: ${summary.seed}` }),
      el('div', { className: 'row' }, [retry, back]),
    ]),
  );
  retry.focus();
}

async function play(root: HTMLElement): Promise<void> {
  if (!sheets) {
    show(root, el('p', { textContent: t('app.loading') }));
    sheets = await loadSheets();
  }
  let shared: Pick<GameOptions, 'net' | 'seed' | 'startFloor'> = { seed: runSeed(), startFloor: devStartFloor() };
  if (netMode()) {
    show(root, el('p', { textContent: t('net.connecting') }));
    const join = await connectLocal(shared.seed!, shared.startFloor ?? 1);
    shared = { seed: join.seed, startFloor: join.floor, net: { session: join.session, role: join.role, localId: join.localId } };
  }
  const canvas = el('canvas', { className: 'game' });
  show(root, canvas);
  root.querySelector('.notice')?.classList.add('in-game');
  running = startGame(canvas, sheets, {
    loadout: settings.loadout,
    lockType: settings.lockType,
    clickToLock: settings.clickToLock,
    ...shared,
    audio,
    onToggleMute: () => update({ muted: !settings.muted }),
    openMenu: (actions) => openPauseMenu(root, { get: () => settings, update, setLanguage: applyLanguage }, actions),
    onQuit: () => menu(root),
    onEnd: (result, summary) => resultScreen(root, result, summary),
  });
}

const root = document.getElementById('app');
if (root) {
  // Menu click: any button press on the pages (the game canvas has none).
  root.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) audio.play('click');
  });
  menu(root);
}
