import { M0_SLOT_LAYOUT } from '../data/slots';
import type { MoveId } from '../data/moves';
import { loadSheets, type SheetStore } from '../adapters/assets';
import { createAudio } from '../adapters/audio';
import { browserStore } from '../adapters/storage';
import { detectLanguage, setLanguage, t, type Language } from '../i18n';
import { BroadcastChannelTransport } from '../net/broadcast';
import { LagTransport, parseLagParams } from '../net/lag';
import { generateRoomCode, normalizeRoomCode, roomCodeFromSearch } from '../net/room-code';
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
 * "Play online" opens a room-code lobby over Trystero (loaded only then).
 */
const store = browserStore();
let settings: Settings = loadSettings(store, defaultSettings(detectLanguage(navigator.language)));
const audio = createAudio(settings);
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
let sheets: SheetStore | null = null;
let running: RunningGame | null = null;
/** The shared run or lobby on screen, if any: its notices (room full, host left) only count while it is. */
let current: NetSession | null = null;
/** Streamer option in the lobby: the room code stays hidden (kept for the page's lifetime). */
let hideCode = false;

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
  /** A room-code run (no "Try again": the room is gone after the run). */
  online: boolean;
}

const HOST_SEARCH_MS = 700;
const SPECIES = 'mimikyu';

/** A session over `base`, with `?lag=` simulation and `?delay=` render delay from the page address. */
function sessionOver(base: Transport<string>): NetSession {
  const params = new URLSearchParams(window.location.search);
  const scheduler = realScheduler();
  const lag = parseLagParams(window.location.search);
  const transport: Transport<string> = lag ? new LagTransport(base, { ...lag, scheduler, random: Math.random }) : base;
  const delay = Number.parseFloat(params.get('delay') ?? '');
  return createSession({ transport, scheduler, ...(Number.isFinite(delay) ? { renderDelayMs: Math.max(0, delay) } : {}) });
}

function leaveNet(): void {
  current?.leave();
  current = null;
}

function connectLocal(seed: number, floor: number): Promise<NetJoin> {
  const params = new URLSearchParams(window.location.search);
  const session = sessionOver(new BroadcastChannelTransport());
  const species = SPECIES;
  const asHost = (): NetJoin => {
    session.host(seed, floor, species);
    return { session, role: 'host', localId: 'p1', seed, floor, online: false };
  };
  if (params.get('host') === '1') return Promise.resolve(asHost());
  return new Promise((resolve) => {
    let done = false;
    session.onStart((start) => {
      if (done) return;
      done = true;
      resolve({ session, role: 'guest', localId: start.localId, seed: start.seed, floor: start.floor, online: false });
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
  if (running) {
    // Stopping the game leaves its session.
    running.stop();
    running = null;
    current = null;
  }
  root.replaceChildren(...children, notice());
}

/** A short message (room full, host left, no connection) and the way back to the menu. */
function messageScreen(root: HTMLElement, text: string): void {
  leaveNet();
  const back = el('button', { type: 'button', className: 'primary', textContent: t('screen.menu') });
  back.addEventListener('click', () => menu(root));
  show(root, el('div', { className: 'panel' }, [el('p', { textContent: text }), back]));
  back.focus();
}

/** "Play online": create a room or join one by code (`?room=CODE` prefills it). */
function onlineRow(root: HTMLElement): HTMLElement[] {
  const create = el('button', { type: 'button', textContent: t('lobby.create') });
  create.addEventListener('click', () => void openLobby(root, generateRoomCode(), true));
  const code = el('input', { type: 'text', className: 'code-input', placeholder: t('lobby.codePlaceholder'), value: roomCodeFromSearch(window.location.search) ?? '' });
  code.maxLength = 7;
  code.autocomplete = 'off';
  code.spellcheck = false;
  code.setAttribute('aria-label', t('lobby.codePlaceholder'));
  const join = el('button', { type: 'button', textContent: t('lobby.join') });
  const error = el('p', { className: 'lobby-error' });
  const tryJoin = () => {
    const normalized = normalizeRoomCode(code.value);
    if (normalized) void openLobby(root, normalized, false);
    else error.textContent = t('lobby.invalidCode');
  };
  join.addEventListener('click', tryJoin);
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryJoin();
  });
  return [el('div', { className: 'row' }, [create, code, join]), error];
}

/**
 * The room-code lobby over Trystero: the host shows the code (copy, or hide
 * it for streamers) and the players in the room, and presses Start; guests
 * wait for it and start with the host's seed.
 */
async function openLobby(root: HTMLElement, code: string, asHost: boolean): Promise<void> {
  leaveNet();
  show(root, el('p', { textContent: t('lobby.connecting') }));
  let session: NetSession;
  try {
    const { joinTrysteroRoom } = await import('../adapters/trystero');
    session = sessionOver(joinTrysteroRoom(code));
  } catch {
    messageScreen(root, t('lobby.error'));
    return;
  }
  current = session;
  // Load the sprites while waiting, so Start does not wait for them.
  if (!sheets) void loadSheets().then((loaded) => (sheets ??= loaded));

  const codeText = el('div', { className: 'room-code' });
  const hide = el('button', { type: 'button' });
  const renderCode = () => {
    codeText.textContent = hideCode ? '•'.repeat(code.length) : code;
    hide.textContent = t(hideCode ? 'lobby.show' : 'lobby.hide');
    hide.setAttribute('aria-pressed', String(hideCode));
  };
  hide.addEventListener('click', () => {
    hideCode = !hideCode;
    renderCode();
  });
  renderCode();
  const copy = el('button', { type: 'button', textContent: t('lobby.copy') });
  copy.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => (copy.textContent = t('lobby.copied')))
      .catch(() => {});
  });

  const list = el('ul', { className: 'roster' });
  const status = el('p', { className: 'subtitle', textContent: asHost ? t('lobby.hint') : t('lobby.connecting') });
  const self = session.peerId();
  const renderRoster = (roster: ReturnType<NetSession['roster']>) => {
    list.replaceChildren(
      ...roster.map((r) => {
        const tags = [r.id === 'p1' ? t('lobby.host') : null, r.peer === self ? t('lobby.you') : null].filter(Boolean);
        return el('li', { textContent: `${r.id.toUpperCase()}${tags.length > 0 ? ` (${tags.join(', ')})` : ''}` });
      }),
    );
    if (!asHost && roster.some((r) => r.peer === self)) status.textContent = t('lobby.waitingHost');
  };
  session.onRoster((roster) => {
    if (current === session) renderRoster(roster);
  });
  session.onFull(() => {
    if (current === session) messageScreen(root, t('lobby.full'));
  });
  session.onStart((start) => {
    if (current === session) void play(root, { session, role: 'guest', localId: start.localId, seed: start.seed, floor: start.floor, online: true });
  });

  const seed = runSeed();
  const leave = el('button', { type: 'button', textContent: t('lobby.leave') });
  leave.addEventListener('click', () => menu(root));
  const actions: HTMLElement[] = [leave];
  if (asHost) {
    const start = el('button', { type: 'button', className: 'primary', textContent: t('lobby.start') });
    start.addEventListener('click', () => {
      session.begin();
      void play(root, { session, role: 'host', localId: 'p1', seed, floor: 1, online: true });
    });
    actions.unshift(start);
  }

  show(
    root,
    el('div', { className: 'panel lobby' }, [
      el('h1', { textContent: t('lobby.online') }),
      el('h2', { textContent: t('lobby.room') }),
      codeText,
      el('div', { className: 'row' }, [copy, hide]),
      status,
      el('h2', { textContent: t('lobby.players') }),
      list,
      el('div', { className: 'row' }, actions),
    ]),
  );
  if (asHost) session.host(seed, 1, SPECIES, { lobby: true });
  else session.join(SPECIES, settings.loadout);
  renderRoster(session.roster());
  actions[0]?.focus();
}

function menu(root: HTMLElement): void {
  leaveNet();
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
      el('h2', { textContent: t('lobby.online') }),
      ...onlineRow(root),
    ]),
  );
  start.focus();
}

function resultScreen(root: HTMLElement, result: GameResult, summary: RunSummary, online: boolean): void {
  audio.setMusic(null);
  audio.play(result);
  const retry = el('button', { type: 'button', className: 'primary', textContent: t('screen.retry') });
  retry.addEventListener('click', () => play(root));
  retry.hidden = online;
  const back = el('button', { type: 'button', className: online ? 'primary' : '', textContent: t('screen.menu') });
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
  (online ? back : retry).focus();
}

/** Starts a run: solo, a `?net=local` tab session, or the shared run of a lobby (`join`). */
async function play(root: HTMLElement, join?: NetJoin): Promise<void> {
  if (!sheets) {
    show(root, el('p', { textContent: t('app.loading') }));
    sheets = await loadSheets();
  }
  let shared: Pick<GameOptions, 'net' | 'seed' | 'startFloor'> = { seed: runSeed(), startFloor: devStartFloor() };
  if (!join && netMode()) {
    show(root, el('p', { textContent: t('net.connecting') }));
    join = await connectLocal(shared.seed!, shared.startFloor ?? 1);
  }
  if (join) {
    if (join.online && current !== join.session) return;
    current = join.session;
    shared = { seed: join.seed, startFloor: join.floor, net: { session: join.session, role: join.role, localId: join.localId } };
  }
  const online = join?.online ?? false;
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
    onEnd: (result, summary) => resultScreen(root, result, summary, online),
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
