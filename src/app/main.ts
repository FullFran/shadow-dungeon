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
import { openTown, type TownOptions } from '../town/scene';
import type { TownLobby } from '../town/lobby';
import { displayName, sanitizeNickname } from '../net/nickname';
import { clearedDungeons, readRecords, saveRun } from '../town/records';
import { dungeonById, guardianOf, type DungeonId } from '../data/dungeons';
import { needsDungeonSelect, unlockedDungeons } from '../core/dungeon-select';
import { dungeonSelectScreen } from './dungeon-select';
import { GUARDIAN_CINEMATICS, type CinematicPhase } from '../data/guardian-cinematics';
import { drawGuardianScene } from '../adapters/guardian-scenes';
import { cinematicMode, cinematicPanels, hasSeen, markSeen } from './guardian-cinematic';
import type { SpeciesId } from '../data/species';
import { earnCoins, loadSave } from './save';
import { shopWindow } from './shop';
import { coinLines } from './coin-lines';
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
/**
 * The online room this tab is in, kept across its runs: the room walks the
 * town between runs (`townLobby`), and the session outlives each run.
 */
let room: { session: NetSession; code: string; asHost: boolean; seed: number } | null = null;

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

/** Development server only: `?dungeon=<id>` runs that dungeon without the select (to look at it without unlocking it). */
function devDungeon(): DungeonId {
  const id = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('dungeon') : null;
  return dungeonById(id).id;
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
  /** The host's dungeon id as received (validated when the run starts). */
  dungeon?: string;
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
  if (room && room.session !== current) room.session.leave();
  current = null;
  room = null;
}

async function connectLocal(root: HTMLElement, seed: number, floor: number, dungeon: DungeonId): Promise<NetJoin> {
  const params = new URLSearchParams(window.location.search);
  const session = sessionOver(root, new BroadcastChannelTransport());
  current = session;
  const joined = await autoJoin({
    session,
    scheduler: realScheduler(),
    searchMs: HOST_SEARCH_MS,
    seed,
    floor,
    dungeon,
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
    // Stopping the game leaves its session, unless it is the room's (back to the town together).
    running.stop();
    running = null;
    if (current !== room?.session) current = null;
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
      // Appended last so the indices above stay put.
      { label: t('title.shop'), onConfirm: () => shopScreen(root) },
      // Only when installable, and after every fixed entry so indices stay stable.
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
function newAdventure(root: HTMLElement, dungeon?: DungeonId): void {
  const next = nextAdventureScreen({ prologueSeen: hasSeenPrologue(store), starterChosen: settings.starterChosen });
  if (next === 'prologue') prologue(root, () => newAdventure(root, dungeon));
  else if (next === 'quiz') quiz(root, () => newAdventure(root, dungeon), () => titleScreen(root, 0));
  else loadout(root, 'species', dungeon);
}

/** Dungeons whose guardian fell on this device (they open the next ones). */
const cleared = (): Set<string> => clearedDungeons(readRecords(store));

/** After the loadout: the dungeon select when more than one dungeon is open, otherwise straight in. */
function chooseDungeon(root: HTMLElement, back: () => void): void {
  if (!needsDungeonSelect(cleared())) {
    void play(root);
    return;
  }
  show(root, dungeonSelectScreen({ records: readRecords(store), cleared: cleared(), onChoose: (dungeon) => void play(root, undefined, dungeon), onBack: back }));
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

/**
 * A guardian cinematic over the running game (solo): in full the first time
 * in this browser, then the short name card (`cinematicMode`). It is the
 * prologue player with the guardian's panels and scenes, skippable the same
 * way; it removes itself when it ends.
 */
function guardianCinematic(root: HTMLElement, request: { species: SpeciesId; phase: CinematicPhase }, onDone: () => void): (() => void) | null {
  const cinematic = GUARDIAN_CINEMATICS[request.species];
  if (!cinematic) return null;
  const mode = cinematicMode({ seen: hasSeen(store, request.species, request.phase), shared: false });
  const panels = cinematicPanels(request.species, request.phase, mode);
  if (panels.length === 0) return null;
  const screen = prologueScreen({
    sheets: () => sheets,
    panels,
    draw: (ctx, panel, time, camera, alpha) => drawGuardianScene(ctx, cinematic, panel, time, camera, alpha),
    label: t(`species.${request.species}`),
    onDone: () => {
      if (mode === 'full') markSeen(store, request.species, request.phase);
      screen.remove();
      onDone();
    },
  });
  // Over the game canvas and its overlays.
  screen.style.zIndex = '6';
  root.append(screen);
  return () => screen.remove();
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
function loadout(root: HTMLElement, stage: 'species' | 'moves' = 'species', dungeon?: DungeonId): void {
  show(root, [
    ...loadoutScreen({
      stage,
      species: settings.species,
      loadout: settings.loadout,
      sheets: sheetsReady(),
      onSpecies: (species) => {
        update(withSpecies(settings, species));
        loadout(root, 'moves', dungeon);
      },
      onChange: (next) => update({ loadout: next }),
      onStart: () => (dungeon ? void play(root, undefined, dungeon) : chooseDungeon(root, () => loadout(root, 'moves'))),
      onBack: () => (stage === 'moves' ? loadout(root, 'species', dungeon) : titleScreen(root, 0)),
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
  const nickname = nicknameRow();
  const refresh = () => list.setItems([...settingItems(access, refresh), nickname, { label: t('quiz.retake'), onConfirm: retake }, { label: t('menu.back'), onConfirm: back }]);
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
function townScreen(root: HTMLElement, at?: TownPlace): void {
  waitScreen(root, t('app.loading'));
  const showTown = (nodes: Node[]) => {
    show(root, nodes, false);
    audio.setMusic('title');
  };
  const dungeons = unlockedDungeons(cleared()).map((d) => ({ id: d.id, label: t(d.lore.nameKey) }));
  void openTown({ sheets: sheetsReady(), species: settings.species, dungeons, show: showTown, onDepart: (id) => newAdventure(root, dungeonById(id).id), onQuit: () => titleScreen(root, 5), openShop: townShop, ...at });
}

/** Poochyena's shop over the town (centred, the town waits behind it). */
function townShop(parent: HTMLElement, onClose: () => void): () => void {
  const shop = shopWindow({ store, play: (sound) => audio.play(sound), onBack: onClose });
  const overlay = h('div', { className: 'town-shop' }, [shop.element]);
  parent.append(overlay);
  return () => {
    shop.dispose();
    overlay.remove();
  };
}

/** The upgrade shop from the title menu (its last entry). */
function shopScreen(root: HTMLElement): void {
  const shop = shopWindow({ store, play: (sound) => audio.play(sound), onBack: () => titleScreen(root, 6) });
  show(root, [shop.element]);
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
      nicknameRow(),
      { label: t('menu.back'), onConfirm: back },
    ],
  });
  show(root, [mdWindow({ title: t('lobby.online'), className: 'online' }, [list.element, error])]);
}

/** A settings row with a text field for the nickname (Settings and the online screen); saved sanitised on change. */
function nicknameRow(): ListItem {
  const input = h('input', { type: 'text', className: 'code-input nickname-input', placeholder: t('nickname.placeholder'), value: settings.nickname });
  // The room-code field's look, without its capitals: a nickname keeps its case.
  Object.assign(input.style, { textTransform: 'none', letterSpacing: 'normal' });
  input.maxLength = 32;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'done';
  input.setAttribute('aria-label', t('settings.nickname'));
  const save = () => {
    const clean = sanitizeNickname(input.value);
    input.value = clean;
    if (clean !== settings.nickname) update({ nickname: clean });
  };
  input.addEventListener('change', save);
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
  return { label: t('settings.nickname'), value: input, className: 'join-row nickname-row', onConfirm: () => input.focus() };
}

/** A player's name in a room: its nickname, else "Jugador-XYZ" from its peer id. */
const nameOf = (entry: { name?: string; peer: string }): string => displayName(entry.name, t('nickname.default'), entry.peer);

/**
 * The room-code lobby is the town: the room is created or joined (Trystero,
 * loaded only now; the development preview passes a tab-local transport),
 * then everyone walks the town together (`townLobby`). The host leads the
 * group into a dungeon; guests start with the host's seed.
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
  room = { session, code, asHost, seed: runSeed() };
  // Load the sprites while connecting, so the town and the run do not wait for them.
  void sheetsReady();
  session.onFull(() => {
    if (current === session) messageScreen(root, t('lobby.full'));
  });
  session.onStart((start) => {
    if (current === session) void play(root, { session, role: 'guest', localId: start.localId, seed: start.seed, floor: start.floor, ...(start.dungeon !== undefined ? { dungeon: start.dungeon } : {}), online: true });
  });
  // The host brought the room back to the town after a run: follow it there (unless already walking it).
  session.onLobby(() => {
    if (current === session && !root.querySelector('canvas.town')) townLobby(root);
  });
  const name = sanitizeNickname(settings.nickname) || nameOf({ peer: session.peerId() });
  if (asHost) session.host(room.seed, 1, settings.species, { lobby: true, name });
  else session.join(settings.species, settings.loadout, name);
  townLobby(root);
}

/**
 * The single way into the room's town (after creating or joining it, and
 * after every shared run): the town with the other players walking it, the
 * room window in a corner, Esc for the room menu (copy or hide the code,
 * leave). The host leads the group by walking into a dungeon or with the
 * waystone; that begins the run for everyone.
 */
function townLobby(root: HTMLElement): void {
  const r = room;
  if (!r || current !== r.session) {
    titleScreen(root);
    return;
  }
  const { session } = r;
  const showTown = (nodes: Node[]) => {
    show(root, nodes, false);
    audio.setMusic('title');
  };
  const leave = () => titleScreen(root, 1);
  const lobby: TownLobby = {
    isHost: r.asHost,
    selfName: sanitizeNickname(settings.nickname) || nameOf({ peer: session.peerId() }),
    code: () => (hideCode ? '•'.repeat(r.code.length) : r.code),
    players: () => session.roster().map((e) => ({ name: nameOf(e), host: e.id === 'p1', self: e.peer === session.peerId() })),
    walkers: () => session.townWalkers().map((w) => ({ id: w.id, name: nameOf(w), species: w.species, map: w.map, pos: w.pos, facing: w.facing, moving: w.moving })),
    sendPresence: (presence) => session.sendPresence(presence),
    menu: (close) => [
      { label: t('lobby.copy'), onConfirm: () => void navigator.clipboard?.writeText(r.code).then(close, close) },
      {
        label: t(hideCode ? 'lobby.show' : 'lobby.hide'),
        onConfirm: () => {
          hideCode = !hideCode;
          close();
        },
      },
      { label: t('lobby.leave'), onConfirm: leave },
    ],
  };
  const depart = (id: string) => {
    if (!session.canLead()) return;
    const dungeon = dungeonById(id).id;
    session.begin(dungeon);
    void play(root, { session, role: 'host', localId: 'p1', seed: r.seed, floor: 1, dungeon, online: true });
  };
  const dungeons = unlockedDungeons(cleared()).map((d) => ({ id: d.id, label: t(d.lore.nameKey) }));
  void openTown({ sheets: sheetsReady(), species: settings.species, dungeons, show: showTown, onDepart: depart, onQuit: leave, openShop: townShop, lobby });
}

/** After a shared run: the host reopens the room's lobby with a new seed (guests follow), a guest goes ahead to wait in the town. */
function backToRoom(root: HTMLElement): void {
  if (!room || current !== room.session) return titleScreen(root);
  if (room.asHost) {
    room.seed = runSeed();
    room.session.reopenLobby(room.seed);
  }
  townLobby(root);
}

/** The end screen: result, floor reached, seed, level and items, the Pokémonedas earned and the new balance, then retry or back. */
function resultScreen(root: HTMLElement, result: GameResult, summary: RunSummary, online: boolean, balance: number): void {
  const back = () => titleScreen(root);
  const items: ListItem[] = [{ label: t('screen.menu'), onConfirm: back }];
  if (!online) items.unshift({ label: t('screen.retry'), onConfirm: () => void play(root, undefined, summary.dungeon) });
  // A room run: the room goes back to the town together for another one.
  const party = online && room && current === room.session ? room.session.roster().map(nameOf) : null;
  if (party) items.unshift({ label: t('lobby.backToTown'), onConfirm: () => backToRoom(root) });
  const held = heldItems(summary.items as ItemId[]);
  show(root, [
    mdWindow({ className: `result ${result}` }, [
      h('h1', { textContent: t(`screen.${result}.title`) }),
      // Victory names the dungeon's guardian, defeat the player's Pokémon.
      h('p', { textContent: t(`screen.${result}.text`).replace('{name}', t(`species.${result === 'victory' ? (guardianOf(dungeonById(summary.dungeon)) ?? 'aegislash') : settings.species}`)) }),
      // Run summary and Pokémonedas side by side on wide screens (stacked when narrow).
      h('div', { className: 'result-columns' }, [
        h('div', {}, [
          h('h3', { className: 'dim', textContent: t('screen.summary') }),
          statLine(t('screen.floorReached'), String(summary.floor)),
          statLine(t('screen.level'), String(summary.level)),
          statLine(t('screen.seed'), String(summary.seed)),
          statLine(t('screen.items'), held.length === 0 ? t('screen.noItems') : held.map((i) => `${i.name}${i.count > 1 ? ` ×${i.count}` : ''}`).join(', ')),
          ...(party ? [statLine(t('screen.party'), party.join(', '))] : []),
        ]),
        h('div', { className: 'coin-lines' }, [
          h('h3', { className: 'dim', textContent: t('screen.coins') }),
          ...coinLines(summary.coins, balance, (key) => t(key)).map((line) => statLine(line.label, line.value)),
        ]),
      ]),
      cursorList({ items, onBack: back, className: 'result-actions' }).element,
    ]),
  ], true, result);
}

/** Starts a run: solo, a `?net=local` tab session, or the shared run of a lobby (`join`). */
async function play(root: HTMLElement, join?: NetJoin, dungeon: DungeonId = devDungeon()): Promise<void> {
  if (!sheets) {
    waitScreen(root, t('app.loading'));
    await sheetsReady();
  }
  // The HUD draws text in the pixel font on the canvas: it must be ready first.
  await document.fonts?.load(`${FONT.hudPx}px "${FONT.family}"`).catch(() => undefined);
  let shared: Pick<GameOptions, 'net' | 'seed' | 'startFloor' | 'dungeon'> = { seed: runSeed(), startFloor: devStartFloor(), dungeon };
  if (!join && netMode()) {
    waitScreen(root, t('net.connecting'));
    join = await connectLocal(root, shared.seed!, shared.startFloor ?? 1, dungeon);
  }
  if (join) {
    if (join.online && current !== join.session) return;
    current = join.session;
    // A guest plays the host's dungeon (an unknown id plays the first one).
    shared = { seed: join.seed, startFloor: join.floor, dungeon: dungeonById(join.dungeon).id, net: { session: join.session, role: join.role, localId: join.localId, keepSession: join.online } };
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
    upgrades: loadSave(store).upgrades,
    ...shared,
    audio,
    onToggleMute: () => update({ muted: !settings.muted }),
    touch: { autoAim: () => settings.autoAim, haptics: () => settings.haptics },
    openMenu: (actions, held) => openPauseMenu(root, { get: () => settings, update, setLanguage: applyLanguage }, actions, held),
    onQuit: () => titleScreen(root),
    playCinematic: (request, onDone) => guardianCinematic(root, request, onDone),
    onEnd: (result, summary) => {
      // Solo and hosted runs count for the notice board; a guest's run is the host's.
      if (shared.net?.role !== 'guest') saveRun(store, { dungeon: summary.dungeon, floor: summary.floor, level: summary.level, species: settings.species, victory: result === 'victory' });
      // Every peer earns its own Pokémonedas, guests too.
      const save = earnCoins(store, summary.coins.total);
      resultScreen(root, result, summary, online, save.coins);
    },
  });
}

/** Where the town opens: a map of the overworld and a tile on it (the hub's spawn when absent). */
type TownPlace = Pick<TownOptions, 'at' | 'tile'>;

/** Development server only: the `map` and `tile` query of `?screen=town`. */
function devTownPlace(): TownPlace {
  const params = new URLSearchParams(window.location.search);
  const [x, y] = (params.get('tile') ?? '').split(',').map(Number);
  const at = (params.get('map') ?? undefined) as TownOptions['at'];
  return { ...(at ? { at } : {}), ...(Number.isFinite(x) && Number.isFinite(y) && params.get('tile') ? { tile: { x: x!, y: y! } } : {}) };
}

/**
 * Development server only: `?screen=` opens one screen straight away, for
 * screenshots (loadout, settings, credits, online, lobby, victory, defeat,
 * prologue with `&at=ms` to start part way in).
 */
function devScreen(root: HTMLElement): boolean {
  if (!import.meta.env.DEV) return false;
  const screen = new URLSearchParams(window.location.search).get('screen');
  const coins = { floors: 36, enemies: 41, escapes: 12, guardian: 50, time: 18, subtotal: 157, share: 1, multiplier: 1, total: 157 };
  const summary: RunSummary = { dungeon: devDungeon(), floor: 4, seed: runSeed(), level: 6, items: ['leftovers', 'scope-lens', 'leftovers', 'focus-sash'], coins };
  const screens: Record<string, () => void> = {
    loadout: () => loadout(root),
    dungeons: () => chooseDungeon(root, () => titleScreen(root)),
    // `&species=decidueye&phase=post`: a guardian cinematic over the title (as the first time unless already seen).
    guardian: () =>
      void sheetsReady().then(() => {
        const params = new URLSearchParams(window.location.search);
        titleScreen(root);
        guardianCinematic(root, { species: (params.get('species') ?? 'aegislash') as SpeciesId, phase: params.get('phase') === 'post' ? 'post' : 'pre' }, () => titleScreen(root));
      }),
    quiz: () => quiz(root, () => loadout(root), () => titleScreen(root)),
    settings: () => settingsScreen(root),
    credits: () => creditsScreen(root),
    // `&map=mirador&tile=12,9`: one overworld map, optionally at a tile.
    town: () => townScreen(root, devTownPlace()),
    shop: () => shopScreen(root),
    online: () => onlineScreen(root),
    // `&guest=1`: join the preview room instead of creating it (two windows walk the town together).
    lobby: () => void openLobby(root, 'K7M2Q', new URLSearchParams(window.location.search).get('guest') !== '1', () => new BroadcastChannelTransport()),
    victory: () => resultScreen(root, 'victory', summary, false, loadSave(store).coins),
    defeat: () =>
      resultScreen(root, 'defeat', { ...summary, floor: 2, level: 3, items: [], coins: { ...coins, escapes: 0, guardian: 0, time: 6, subtotal: 83, share: 0.75, total: 62 } }, false, loadSave(store).coins),
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
