import type { ItemId } from '../data/items';
import type { MusicContext } from '../data/music';
import type { StarterId } from '../data/quiz';
import { PROLOGUE_MUSIC } from '../data/prologue-music';
import { loadSheets, type SheetStore } from '../adapters/assets';
import { createAudio } from '../adapters/audio';
import { browserStore } from '../adapters/storage';
import { detectLanguage, setLanguage, t, type Language } from '../i18n';
import { BroadcastChannelTransport } from '../net/broadcast';
import { autoJoin } from '../net/election';
import { LagTransport, parseLagParams } from '../net/lag';
import { generateRoomCode, normalizeRoomCode, roomCodeFromSearch } from '../net/room-code';
import { createSession, type NetSession } from '../net/session';
import { realScheduler, type Transport } from '../net/transport';
import { cursorList, setUiSound, type ListItem } from '../ui/cursor-list';
import { eclipseBackdrop } from '../ui/eclipse';
import { applyTokens, FONT } from '../ui/tokens';
import { h, mdWindow, statLine } from '../ui/window';
import { creditsWindow } from './credits';
import { startGame, type GameOptions, type GameResult, type RunningGame, type RunSummary } from './game';
import { heldItems } from './item-pick';
import { loadoutScreen } from './loadout';
import { openPauseMenu } from './menu';
import { prologueScreen } from './prologue';
import { hasSeenPrologue, markPrologueSeen } from './prologue-seen';
import { quizScreen } from './quiz-screen';
import { nextAdventureScreen } from './adventure-route';
import { defaultSettings, loadSettings, saveSettings, withSpecies, withStarter, type Settings } from './settings';
import { CONTROL_KEYS, settingItems, type SettingsAccess } from './settings-panel';
import { openTown } from '../town/scene';
import { saveRun } from '../town/records';
import { DUNGEON_LORE } from '../data/dungeon-lore';
import { setTouchMode } from '../adapters/touch-mode';
import { installTouchChrome } from '../ui/touch-chrome';
import { setupPwa } from '../ui/pwa';

/**
 * Page flow: title screen (Play, Play online, Settings, Credits) over the
 * eclipse backdrop -> loadout picker -> generated floors 1-3 -> boss floor ->
 * defeat or victory screen (floor reached, seed, level, items); Esc during a
 * run opens the pause menu (quick settings, restart floor, quit). Every
 * screen is built from the UI kit (src/ui: windows and ▶ cursor lists). Each run gets a random seed unless the page URL fixes one (`?seed=123`). Settings persist through the
 * storage port and apply at once, also mid-run; the fan-project notice is always
 * on screen. Audio starts on the first user gesture (browsers block autoplay).
 * "Play online" opens a room-code lobby over Trystero (loaded only then).
 */
applyTokens(document.documentElement);
const store = browserStore();
let settings: Settings = loadSettings(store, defaultSettings(detectLanguage(navigator.language)));
const audio = createAudio(settings);
// Touch UI (html.touch): Auto turns it on at the first touch; the chrome adds "Atrás" and the rotate hint.
setTouchMode(settings.touchMode);
const touchChrome = installTouchChrome();
// PWA: service worker (builds only), "Instalar juego" on the title and a one-time banner.
const pwa = setupPwa({
  store,
  onOfferChange: () => {
    const app = document.getElementById('app');
    if (app?.querySelector('.title-logo')) titleScreen(app);
  },
});
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
setUiSound(() => audio.play('click'));
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
 * one and, if nobody answers in a moment, the lowest-id searching tab hosts
 * (`autoJoin`). `?lag=ms&jitter=ms&loss=0..1`
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

/** A session over `base`, with `?lag=` simulation and `?delay=` render delay from the page address. */
function sessionOver(root: HTMLElement, base: Transport<string>): NetSession {
  const params = new URLSearchParams(window.location.search);
  const scheduler = realScheduler();
  const lag = parseLagParams(window.location.search);
  const transport: Transport<string> = lag ? new LagTransport(base, { ...lag, scheduler, random: Math.random }) : base;
  const delay = Number.parseFloat(params.get('delay') ?? '');
  const session = createSession({ transport, scheduler, ...(Number.isFinite(delay) ? { renderDelayMs: Math.max(0, delay) } : {}) });
  // The host left: the run (or lobby) ends with a notice and the way back to the menu.
  session.onHostLeft(() => {
    if (current === session) messageScreen(root, t('net.hostLeft'));
  });
  return session;
}

function leaveNet(): void {
  current?.leave();
  current = null;
}

async function connectLocal(root: HTMLElement, seed: number, floor: number): Promise<NetJoin> {
  const params = new URLSearchParams(window.location.search);
  const session = sessionOver(root, new BroadcastChannelTransport());
  current = session;
  const joined = await autoJoin({
    session,
    scheduler: realScheduler(),
    searchMs: HOST_SEARCH_MS,
    seed,
    floor,
    species: settings.species,
    loadout: settings.loadout,
    forceHost: params.get('host') === '1',
  });
  return { session, ...joined, online: false };
}


const netMode = (): boolean => new URLSearchParams(window.location.search).get('net') === 'local';

function applyLanguage(language: Language): void {
  setLanguage(language);
  document.documentElement.lang = language;
  document.title = t('app.title');
  touchChrome.refresh();
}

function update(changes: Partial<Settings>): void {
  settings = { ...settings, ...changes };
  saveSettings(store, settings);
  audio.setVolumes(settings);
  if (changes.touchMode) setTouchMode(settings.touchMode);
  running?.setLock({ lockType: settings.lockType, clickToLock: settings.clickToLock });
}

/** Sprite sheets, loaded once (the loadout portrait and the run share them). */
let sheetsLoading: Promise<SheetStore> | null = null;
function sheetsReady(): Promise<SheetStore> {
  sheetsLoading ??= loadSheets().then((loaded) => (sheets = loaded));
  return sheetsLoading;
}

function notice(): HTMLElement {
  return h('footer', { className: 'notice' }, [h('p', { textContent: t('notice.fanProject') }), h('p', { textContent: t('notice.sprites') })]);
}

/**
 * Replaces the page; menu screens sit over the eclipse backdrop, the run does not.
 * Menu screens (title, settings, credits, online, lobby) keep the title music;
 * the result screen plays its stinger instead, and the run sets its own music.
 */
function show(root: HTMLElement, children: Node[], backdrop = true, music: MusicContext = 'title'): void {
  if (running) {
    // Stopping the game leaves its session.
    running.stop();
    running = null;
    current = null;
  }
  if (backdrop) audio.setMusic(music);
  root.replaceChildren(...(backdrop ? [eclipseBackdrop()] : []), ...children, notice());
}

/** A one-row menu (Back to menu, Back...). */
function single(label: string, action: () => void): HTMLElement {
  return cursorList({ items: [{ label, onConfirm: action }], onBack: action }).element;
}

/** A short message (room full, host left, no connection) and the way back to the menu. */
function messageScreen(root: HTMLElement, text: string): void {
  leaveNet();
  show(root, [mdWindow({ className: 'narrow' }, [h('p', { textContent: text }), single(t('screen.menu'), () => titleScreen(root))])]);
}

/** Loading or connecting: a window with the text only. */
function waitScreen(root: HTMLElement, text: string): void {
  show(root, [mdWindow({ className: 'narrow wait' }, [h('p', { textContent: text })])]);
}

function titleScreen(root: HTMLElement, initial = 0): void {
  leaveNet();
  applyLanguage(settings.language);
  const list = cursorList({
    initial,
    label: t('app.title'),
    items: [
      { label: t('title.play'), onConfirm: () => newAdventure(root) },
      { label: t('lobby.online'), onConfirm: () => onlineScreen(root) },
      { label: t('title.settings'), onConfirm: () => settingsScreen(root) },
      { label: t('title.credits'), onConfirm: () => creditsScreen(root) },
      { label: t('title.prologue'), onConfirm: () => prologue(root, () => titleScreen(root, 4)) },
      { label: t('town.menu'), onConfirm: () => townScreen(root) },
      ...(pwa.offer() !== 'none' ? [{ label: t('pwa.install'), onConfirm: () => pwa.install(root) }] : []),
    ],
  });
  show(root, [
    h('header', { className: 'title-logo' }, [h('h1', { textContent: t('app.title') }), h('p', { className: 'title-alt', textContent: t('title.alt') })]),
    mdWindow({ className: 'title-menu' }, [list.element]),
    h('p', { className: 'hint', textContent: t('title.hint') }),
  ]);
  pwa.banner(root);
}

/**
 * Play: the prologue the first time in this browser, then the quiz while no
 * starter is chosen, then the loadout with the starter preselected (see
 * `nextAdventureScreen`; each step comes back here when it ends).
 */
function newAdventure(root: HTMLElement): void {
  const next = nextAdventureScreen({ prologueSeen: hasSeenPrologue(store), starterChosen: settings.starterChosen });
  if (next === 'prologue') prologue(root, () => newAdventure(root));
  else if (next === 'quiz') quiz(root, () => newAdventure(root), () => titleScreen(root, 0));
  else loadout(root);
}

/** The prologue cinematic (route "prologue"); `onDone` runs when it ends or is skipped, and it counts as seen. */
function prologue(root: HTMLElement, onDone: () => void, startMs?: number): void {
  void sheetsReady();
  const screen = prologueScreen({
    sheets: () => sheets,
    startMs,
    music: { start: (offsetS) => audio.playCue(PROLOGUE_MUSIC, offsetS), stop: () => audio.stopCue() },
    onDone: () => {
      markPrologueSeen(store);
      onDone();
    },
  });
  show(root, [screen], false);
  root.querySelector('.notice')?.classList.add('in-game');
}

/** The personality quiz over a black screen; its starter becomes the `species` setting. */
function quiz(root: HTMLElement, then: () => void, cancel: () => void): void {
  const onDone = (starter: StarterId) => {
    update(withStarter(settings, starter));
    then();
  };
  show(root, quizScreen({ seed: runSeed(), sheets: sheetsReady(), onDone, onCancel: cancel }), false);
}

/** The picker: species first, then its moves (Back from moves returns to the species list). */
function loadout(root: HTMLElement, stage: 'species' | 'moves' = 'species'): void {
  show(root, [
    ...loadoutScreen({
      stage,
      species: settings.species,
      loadout: settings.loadout,
      sheets: sheetsReady(),
      onSpecies: (species) => {
        update(withSpecies(settings, species));
        loadout(root, 'moves');
      },
      onChange: (next) => update({ loadout: next }),
      onStart: () => void play(root),
      onBack: () => (stage === 'moves' ? loadout(root, 'species') : titleScreen(root, 0)),
    }),
  ]);
}

function settingsScreen(root: HTMLElement): void {
  const back = () => titleScreen(root, 2);
  const access: SettingsAccess = {
    get: () => settings,
    update,
    setLanguage: (language) => {
      applyLanguage(language);
      settingsScreen(root);
    },
  };
  const list = cursorList({ items: [], onBack: back, label: t('title.settings') });
  const retake = () => quiz(root, () => titleScreen(root, 0), () => settingsScreen(root));
  const refresh = () => list.setItems([...settingItems(access, refresh), { label: t('quiz.retake'), onConfirm: retake }, { label: t('menu.back'), onConfirm: back }]);
  refresh();
  show(root, [
    h('h1', { className: 'screen-title', textContent: t('title.settings') }),
    h('div', { className: 'screen-row' }, [
      mdWindow({ title: t('title.settings'), className: 'settings' }, [list.element]),
      mdWindow({ title: t('menu.controls'), className: 'controls' }, [h('ul', { className: 'control-list' }, CONTROL_KEYS.map((key) => h('li', { textContent: t(`menu.controls.${key}`) })))]),
    ]),
  ]);
}

/**
 * The hub town (src/town): walk around; its route exit goes on exactly like
 * "Play" (`newAdventure`), Esc goes back to the title. It keeps the title
 * track (Lonely Village) playing, so the step from the title is seamless
 * (`setMusic` with the context already playing does nothing); the planned
 * dry "hub" version in src/data/music.ts is not shipped yet.
 */
function townScreen(root: HTMLElement): void {
  waitScreen(root, t('app.loading'));
  const showTown = (nodes: Node[]) => {
    show(root, nodes, false);
    audio.setMusic('title');
  };
  void openTown({ sheets: sheetsReady(), species: settings.species, show: showTown, onDepart: () => newAdventure(root), onQuit: () => titleScreen(root, 5) });
}

function creditsScreen(root: HTMLElement): void {
  show(root, [creditsWindow(single(t('menu.back'), () => titleScreen(root, 3)))]);
}

/** "Play online": create a room or join one by code (`?room=CODE` prefills it). */
function onlineScreen(root: HTMLElement): void {
  const back = () => titleScreen(root, 1);
  const prefill = roomCodeFromSearch(window.location.search) ?? '';
  const code = h('input', { type: 'text', className: 'code-input', placeholder: t('lobby.codePlaceholder'), value: prefill });
  code.maxLength = 7;
  code.autocomplete = 'off';
  code.spellcheck = false;
  // Soft keyboard: capitals, no autocorrect, a Go key that submits like Enter.
  code.setAttribute('autocapitalize', 'characters');
  code.setAttribute('autocorrect', 'off');
  code.enterKeyHint = 'go';
  code.setAttribute('aria-label', t('lobby.codePlaceholder'));
  const error = h('p', { className: 'lobby-error' });
  const tryJoin = () => {
    const normalized = normalizeRoomCode(code.value);
    if (normalized) void openLobby(root, normalized, false);
    else {
      error.textContent = t('lobby.invalidCode');
      code.focus();
    }
  };
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryJoin();
  });
  const join = () => (normalizeRoomCode(code.value) ? tryJoin() : code.focus());
  const list = cursorList({
    initial: prefill ? 1 : 0,
    onBack: back,
    label: t('lobby.online'),
    items: [
      { label: t('lobby.create'), onConfirm: () => void openLobby(root, generateRoomCode(), true) },
      { label: t('lobby.joinCode'), value: code, className: 'join-row', onConfirm: join },
      { label: t('menu.back'), onConfirm: back },
    ],
  });
  show(root, [mdWindow({ title: t('lobby.online'), className: 'online' }, [list.element, error])]);
}

/**
 * The room-code lobby: the host shows the code (copy, or hide it for
 * streamers) and the players in the room, and presses Start; guests wait for
 * it and start with the host's seed. The transport is Trystero, loaded only
 * now; the development preview passes a tab-local one.
 */
async function openLobby(root: HTMLElement, code: string, asHost: boolean, transport?: () => Transport<string>): Promise<void> {
  leaveNet();
  waitScreen(root, t('lobby.connecting'));
  let session: NetSession;
  try {
    const base = transport ? transport() : (await import('../adapters/trystero')).joinTrysteroRoom(code);
    session = sessionOver(root, base);
  } catch {
    messageScreen(root, t('lobby.error'));
    return;
  }
  current = session;
  // Load the sprites while waiting, so Start does not wait for them.
  void sheetsReady();

  const codeText = h('div', { className: 'room-code' });
  const renderCode = () => (codeText.textContent = hideCode ? '•'.repeat(code.length) : code);
  renderCode();
  let copied = false;

  const players = h('ul', { className: 'roster' });
  const status = h('p', { className: 'dim', textContent: asHost ? t('lobby.hint') : t('lobby.connecting') });
  const self = session.peerId();
  const renderRoster = (roster: ReturnType<NetSession['roster']>) => {
    players.replaceChildren(
      ...roster.map((r) => {
        const tags = [r.id === 'p1' ? t('lobby.host') : null, r.peer === self ? t('lobby.you') : null].filter(Boolean);
        return h('li', {}, [h('span', { className: 'roster-id', textContent: r.id.toUpperCase() }), tags.length > 0 ? h('span', { className: 'dim', textContent: tags.join(' · ') }) : null]);
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
  const leave = () => titleScreen(root, 1);
  const items = (): ListItem[] => [
    ...(asHost
      ? [
          {
            label: t('lobby.start'),
            className: 'start-row',
            onConfirm: () => {
              session.begin();
              void play(root, { session, role: 'host', localId: 'p1', seed, floor: 1, online: true });
            },
          },
        ]
      : []),
    {
      label: t(copied ? 'lobby.copied' : 'lobby.copy'),
      onConfirm: () => {
        navigator.clipboard
          ?.writeText(code)
          .then(() => {
            copied = true;
            list.setItems(items());
          })
          .catch(() => {});
      },
    },
    {
      label: t(hideCode ? 'lobby.show' : 'lobby.hide'),
      onConfirm: () => {
        hideCode = !hideCode;
        renderCode();
        list.setItems(items());
      },
    },
    { label: t('lobby.leave'), onConfirm: leave },
  ];
  const list = cursorList({ items: items(), onBack: leave, label: t('lobby.room') });

  show(root, [
    h('h1', { className: 'screen-title', textContent: t('lobby.online') }),
    h('div', { className: 'screen-row' }, [
      mdWindow({ title: t('lobby.room'), className: 'lobby' }, [codeText, status, list.element]),
      mdWindow({ title: t('lobby.players'), className: 'players' }, [players]),
    ]),
  ]);
  if (asHost) session.host(seed, 1, settings.species, { lobby: true });
  else session.join(settings.species, settings.loadout);
  renderRoster(session.roster());
}

/** The end screen: result, floor reached, seed, level and items, then retry or back. */
function resultScreen(root: HTMLElement, result: GameResult, summary: RunSummary, online: boolean): void {
  const back = () => titleScreen(root);
  const items: ListItem[] = [{ label: t('screen.menu'), onConfirm: back }];
  if (!online) items.unshift({ label: t('screen.retry'), onConfirm: () => void play(root) });
  const held = heldItems(summary.items as ItemId[]);
  show(root, [
    mdWindow({ className: `result ${result}` }, [
      h('h1', { textContent: t(`screen.${result}.title`) }),
      h('p', { textContent: t(`screen.${result}.text`) }),
      h('h3', { className: 'dim', textContent: t('screen.summary') }),
      statLine(t('screen.floorReached'), String(summary.floor)),
      statLine(t('screen.level'), String(summary.level)),
      statLine(t('screen.seed'), String(summary.seed)),
      statLine(t('screen.items'), held.length === 0 ? t('screen.noItems') : held.map((i) => `${i.name}${i.count > 1 ? ` ×${i.count}` : ''}`).join(', ')),
      cursorList({ items, onBack: back, className: 'result-actions' }).element,
    ]),
  ], true, result);
}

/** Starts a run: solo, a `?net=local` tab session, or the shared run of a lobby (`join`). */
async function play(root: HTMLElement, join?: NetJoin): Promise<void> {
  if (!sheets) {
    waitScreen(root, t('app.loading'));
    await sheetsReady();
  }
  // The HUD draws text in the pixel font on the canvas: it must be ready first.
  await document.fonts?.load(`${FONT.hudPx}px "${FONT.family}"`).catch(() => undefined);
  let shared: Pick<GameOptions, 'net' | 'seed' | 'startFloor'> = { seed: runSeed(), startFloor: devStartFloor() };
  if (!join && netMode()) {
    waitScreen(root, t('net.connecting'));
    join = await connectLocal(root, shared.seed!, shared.startFloor ?? 1);
  }
  if (join) {
    if (join.online && current !== join.session) return;
    current = join.session;
    shared = { seed: join.seed, startFloor: join.floor, net: { session: join.session, role: join.role, localId: join.localId } };
  }
  const online = join?.online ?? false;
  const canvas = h('canvas', { className: 'game' });
  show(root, [canvas], false);
  root.querySelector('.notice')?.classList.add('in-game');
  running = startGame(canvas, sheets!, {
    species: settings.species,
    loadout: settings.loadout,
    lockType: settings.lockType,
    clickToLock: settings.clickToLock,
    ...shared,
    audio,
    onToggleMute: () => update({ muted: !settings.muted }),
    touch: { autoAim: () => settings.autoAim, haptics: () => settings.haptics },
    openMenu: (actions, held) => openPauseMenu(root, { get: () => settings, update, setLanguage: applyLanguage }, actions, held),
    onQuit: () => titleScreen(root),
    onEnd: (result, summary) => {
      // Solo and hosted runs count for the notice board; a guest's run is the host's.
      if (shared.net?.role !== 'guest') saveRun(store, { dungeon: DUNGEON_LORE[0]!.id, floor: summary.floor, level: summary.level, species: settings.species, victory: result === 'victory' });
      resultScreen(root, result, summary, online);
    },
  });
}

/**
 * Development server only: `?screen=` opens one screen straight away, for
 * screenshots (loadout, settings, credits, online, lobby, victory, defeat,
 * prologue with `&at=ms` to start part way in).
 */
function devScreen(root: HTMLElement): boolean {
  if (!import.meta.env.DEV) return false;
  const screen = new URLSearchParams(window.location.search).get('screen');
  const summary: RunSummary = { floor: 4, seed: runSeed(), level: 6, items: ['leftovers', 'scope-lens', 'leftovers', 'focus-sash'] };
  const screens: Record<string, () => void> = {
    loadout: () => loadout(root),
    quiz: () => quiz(root, () => loadout(root), () => titleScreen(root)),
    settings: () => settingsScreen(root),
    credits: () => creditsScreen(root),
    town: () => townScreen(root),
    online: () => onlineScreen(root),
    lobby: () => void openLobby(root, 'K7M2Q', true, () => new BroadcastChannelTransport()),
    victory: () => resultScreen(root, 'victory', summary, false),
    defeat: () => resultScreen(root, 'defeat', { ...summary, floor: 2, level: 3, items: [] }, false),
    // Waits for the sprites so a screenshot shows the silhouettes.
    prologue: () => void sheetsReady().then(() => prologue(root, () => titleScreen(root), Number(new URLSearchParams(window.location.search).get('at')) || 0)),
  };
  const open = screen ? screens[screen] : undefined;
  if (!open) return false;
  applyLanguage(settings.language);
  open();
  return true;
}

const root = document.getElementById('app');
if (root) {
  // Menu click: any button press on the pages (the game canvas has none).
  root.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) audio.play('click');
  });
  if (!devScreen(root)) titleScreen(root);
}
