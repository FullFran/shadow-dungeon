import { figurationMode } from '../adapters/figurations';
import { devHeraldFloor } from '../core/herald/floor';
import { hasMet } from '../town/bestiary';
import { composeHeraldIntro, heraldIntroMode } from '../ui/herald-intro';
import { drawHeraldScene } from '../adapters/herald-scenes';
import type { HeraldDef } from '../data/herald';
import { readBestiary, recordHerald } from '../town/bestiary';
import { beatenBosses, gauntletReward, readShrine, saveTrial, trialBest } from '../town/shrine-records';
import type { GauntletId } from '../data/shrine';
import { requestName, shrineResultScreen, shrineWindow, type ShrineView, type TrialRequest } from './shrine';
import { loadoutBack, loadoutSpecies, loadoutStart, roomTrialOf, shrineFight, trialRequestOf, viewOf, type ShrineStep } from './shrine-route';
import { simaEventLines } from './sima-summary';
import type { ItemId } from '../data/items';
import type { MusicContext } from '../data/music';
import type { StarterId } from '../data/quiz';
import { PROLOGUE_MUSIC } from '../data/prologue-music';
import { loadSheets, type SheetStore } from '../adapters/assets';
import { createAudio } from '../adapters/audio';
import { browserStore } from '../adapters/storage';
import { detectLanguage, getLanguage, setLanguage, t, type Language } from '../i18n';
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
import { accountWindow, setupAccount, type AccountView } from './account-screen';
import { startGame, type GameOptions, type GameResult, type RunningGame, type RunSummary } from './game';
import { heldItems } from './item-pick';
import { loadoutScreen, type ShinySkins } from './loadout';
import { openPauseMenu } from './menu';
import { prologueScreen, type PrologueOptions } from './prologue';
import { readSimaMemory } from './sima-lore';
import { hasSeenSimaScene, markSimaSceneSeen, simaEndScene, simaPanels, simaPleaDue, simaSceneSkipped, simaText, type SimaSceneInfo } from './sima-cinematic';
import { drawSimaScene, type SimaPanel } from '../adapters/sima-scenes';
import type { SimaSceneId } from '../data/sima-scenes';
import { hasSeenPrologue, markPrologueSeen } from './prologue-seen';
import { galleryGroups, galleryUnlocked, groupSeen, type GalleryScene } from './lore-gallery';
import { readGallerySeen } from './gallery-seen';
import { quizScreen } from './quiz-screen';
import { hasProgress, nextAdventureScreen, nextPlayScreen } from './adventure-route';
import { optionsAboutKey, optionsEntries, TITLE_ENTRIES, TITLE_LABEL, type OptionsEntry, type TitleEntry } from './title-menu';
import { menuWindow } from '../ui/menu-window';
import { defaultSettings, loadSettings, saveSettings, touchPrefsOf, withReturningPlayer, withSpecies, withStarter, type Settings } from './settings';
import { CONTROL_KEYS, settingItems, type SettingsAccess } from './settings-panel';
import { openTown, type TownOptions } from '../town/scene';
import { pleaReady } from '../town/plea';
import { globalRankingLines, globalRankingSource } from '../town/global-ranking';
import { apiBaseUrl, httpAccountApi } from '../adapters/account-api';
import { profilePublisher } from './profile-publish';
import type { TownLobby } from '../town/lobby';
import { displayName, isPublicNickname, sanitizeNickname } from '../net/nickname';
import { clearedDungeons, readRecords, saveRun } from '../town/records';
import { dungeonById, ECLIPSE, guardianOf, type DungeonDef, type DungeonId } from '../data/dungeons';
import { needsDungeonSelect, unlockedDungeons } from '../core/dungeon-select';
import { dungeonSelectScreen } from './dungeon-select';
import { GUARDIAN_CINEMATICS, type CinematicPhase } from '../data/guardian-cinematics';
import { drawGuardianScene } from '../adapters/guardian-scenes';
import { cinematicMode, cinematicPanels, hasSeen, markSeen } from './guardian-cinematic';
import type { SpeciesId } from '../data/species';
import type { MoveId } from '../data/moves';
import { parseSpawnList } from '../core/test-floor';
import { earnChallengeReward, earnCoins, loadSave, wearShinyAt, writeSave } from './save';
import { gachaWindow } from './gacha';
import { missionBoardWindow } from './board';
import { achievementsWindow, achievementToast } from './achievements';
import { recordPast, recordRun, recordSave } from './progress';
import { runReport } from '../core/run-report';
import { evolveWindow } from './evolve';
import { challengeMisfits, openChallenges } from '../core/challenge';
import { lineOf } from '../core/evolution';
import { challengesWindow } from './challenges';
import { recordStory, storyPanels, storyRunOf, type StoryPanel, type StoryPhase } from './story';
import { drawStoryScene } from '../adapters/story-scenes';
import type { StoryRun } from '../core/story';
import { shopWindow } from './shop';
import { buildHint, tutorWindow } from './tutor';
import { buildTag, knownLoadout, knownMoves, runRanks } from '../core/tutor';
import { awakenedOf, currentForm, rosterOf } from '../core/collection';
import { hasShiny, wearsShiny } from '../core/shiny';
import { coinLines } from './coin-lines';
import { setTouchMode, setTouchPrefs } from '../adapters/touch-mode';
import { installTouchChrome } from '../ui/touch-chrome';
import { setupPwa } from '../ui/pwa';
import { endActions, materialsEarned, returnPlace, victoryLine, townOf, type ReturnPlace } from './after-run';
import { clockText, ENDLESS_MODES, endlessSeed, modeOfSeed, utcDateKey, type EndlessMode } from '../core/endless';
import { readBoard as readScores, saveScore, scoreLine, tierBoard, type ScoreEntry } from '../town/leaderboard';
import { endlessEntryScreen } from './endless-entry';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../data/difficulty';

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
/** Redraws the open account window in place (the screen or the town's overlay) and the view it shows; declared before the account, whose start may report a change at once. */
let accountRedraw: (() => void) | null = null;
let accountView: AccountView | null = null;
/** One client for the public calls (Sima ranking, public profile); the account keeps its own. */
const publicApi = httpAccountApi(apiBaseUrl(import.meta.env.VITE_API_URL));
/** The account's public profile (nickname + species) for the Sima global ranking; written after each sync, only with a valid nickname. */
const publicProfile = profilePublisher({ api: publicApi, nickname: () => settings.nickname, species: () => settings.species });
// Accounts (src/app/account-screen.ts): the game's store is the device store, observed so a signed-in player's save writes reach the cloud.
const { account, store } = setupAccount({
  store: browserStore(),
  onSynced: (session) => publicProfile.synced(session),
  notify: (text) => {
    const app = document.getElementById('app');
    if (app) toast(app, text);
  },
  // Sync moved (status, a choice, another tab): a signed-in account screen shows it at once; the title redraws for a replaced profile.
  onChange: () => {
    const app = document.getElementById('app');
    if (accountView === 'main' && app?.querySelector('.md-window.account') && !app.querySelector('.md-window.account input') && accountRedraw) accountRedraw();
  },
  onReplaced: () => {
    // The picked species must still be in the (possibly new) roster.
    settings = loadSettings(store, settings, rosterOf(loadSave(store)));
    const app = document.getElementById('app');
    if (app?.querySelector('.title-logo')) titleScreen(app);
  },
});
let settings: Settings = loadSettings(store, defaultSettings(detectLanguage(navigator.language)), rosterOf(loadSave(store)));
/** The Sima global ranking on the town notice board (src/town/global-ranking.ts): only a signed-in player asks the server; its own nickname is the online one (Settings). */
const globalRanking = globalRankingSource({ api: publicApi, signedIn: () => account.state().kind === 'signed-in', now: () => Date.now() });
const globalBoard = (difficulty: Difficulty): string[] =>
  globalRankingLines(globalRanking.state(difficulty), (key) => t(key), t(`difficulty.${difficulty}`), {
    me: account.state().kind === 'signed-in' && isPublicNickname(settings.nickname) ? settings.nickname : null,
    noNickname: account.state().kind === 'signed-in' && !isPublicNickname(settings.nickname),
  });
// Achievements arrived after players had progress: what the save, the records and the Sima leaderboard prove unlocks once, with one summary toast (app/progress.ts).
setLanguage(settings.language);
achievementToast(recordPast(store, Date.now()).unlocked, undefined, true);
const audio = createAudio(settings);
// Touch UI (html.touch): Auto turns it on at the first touch; the chrome adds "Atrás" and the rotate hint.
setTouchMode(settings.touchMode);
setTouchPrefs(touchPrefsOf(settings));
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
// iOS Safari only lets a context start or resume on the end of a touch (or a click), not on its start.
window.addEventListener('touchend', unlockAudio);
window.addEventListener('click', unlockAudio);
// Phones: switching apps or locking the screen suspends the audio (music and loops); it resumes when the page is back.
document.addEventListener('visibilitychange', () => audio.setBackground(document.hidden));
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
let room: { session: NetSession; code: string; asHost: boolean; seed: number; from: OnlineFrom } | null = null;

/** Where the online window was opened from: the title menu, or the Refugio's signal pillar (leaving the room goes back there). */
type OnlineFrom = 'title' | 'town';

/** The Refugio tile in front of the signal pillar (data/world.ts `REFUGIO.beacon`). */
const BEACON_TILE = { at: 'refugio', tile: { x: 16, y: 15 } } as const;

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

/** Development server only: `?clock=ms` starts the endless clock there (to look at the low clock without waiting). */
function devStartClock(): number | undefined {
  if (!import.meta.env.DEV) return undefined;
  const ms = Number.parseInt(new URLSearchParams(window.location.search).get('clock') ?? '', 10);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Development server only: `?spawn=koffing,grimer` starts solo on a test arena with those enemies (any species with a behaviour). */
function devSpawns(): SpeciesId[] | undefined {
  if (!import.meta.env.DEV) return undefined;
  const species = parseSpawnList(new URLSearchParams(window.location.search).get('spawn'));
  return species.length > 0 ? species : undefined;
}

/**
 * Development server only: `?boss=<seed>` fights herald `<seed>` straight
 * away on a Sima herald floor (`&floor=32`: that depth, rounded to a herald
 * floor; default 22), at the tier picked on the loadout.
 */
function devBoss(): { seed: number; floor: number } | undefined {
  if (!import.meta.env.DEV) return undefined;
  const params = new URLSearchParams(window.location.search);
  const seed = Number.parseInt(params.get('boss') ?? '', 10);
  if (!Number.isFinite(seed)) return undefined;
  return { seed: seed >>> 0, floor: devHeraldFloor(Number.parseInt(params.get('floor') ?? '', 10)) };
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
  /** The host's tier (absent = easy). */
  difficulty?: Difficulty;
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
  // The host left: a run still going ends here, paid as a defeat (its end screen says why); elsewhere a notice and the way back to the menu.
  session.onHostLeft(() => {
    if (current !== session) return;
    if (running) return running.cutShort('hostLeft');
    messageScreen(root, t('net.hostLeft'), returnPlace('lobby'));
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
    difficulty: settings.difficulty,
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
  // A new nickname or species reaches the public profile now (signed in only; a no-op when nothing changed).
  if ((changes.nickname !== undefined || changes.species !== undefined) && account.state().kind === 'signed-in') publicProfile.changed();
  audio.setVolumes(settings);
  if (changes.touchMode) setTouchMode(settings.touchMode);
  setTouchPrefs(touchPrefsOf(settings));
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

/** A short message (room full, host left, no connection) and the way back to the menu, or to the town after a run. */
function messageScreen(root: HTMLElement, text: string, place: ReturnPlace = 'title'): void {
  leaveNet();
  const back = place === 'town' ? single(t('screen.town'), () => townScreen(root)) : single(t('screen.menu'), () => titleScreen(root));
  show(root, [mdWindow({ className: 'narrow' }, [h('p', { textContent: text }), back])]);
}

/** A short line over whatever is on screen (the town, a run), gone after a few seconds. */
function toast(root: HTMLElement, text: string): void {
  const line = h('p', { className: 'net-toast', textContent: text });
  line.setAttribute('role', 'status');
  root.append(line);
  window.setTimeout(() => line.remove(), TOAST_MS);
}

const TOAST_MS = 6000;

/** Loading or connecting: a window with the text only. */
function waitScreen(root: HTMLElement, text: string): void {
  show(root, [mdWindow({ className: 'narrow wait' }, [h('p', { textContent: text })])]);
}

function titleScreen(root: HTMLElement, initial = 0): void {
  leaveNet();
  applyLanguage(settings.language);
  // Three entries only (src/app/title-menu.ts): every service lives in the town and its Esc menu.
  const action: Record<TitleEntry, () => void> = {
    play: () => playScreen(root),
    online: () => onlineScreen(root),
    options: () => optionsScreen(root),
  };
  const list = cursorList({ initial, label: t('app.title'), items: TITLE_ENTRIES.map((entry) => ({ label: t(TITLE_LABEL[entry]), onConfirm: action[entry] })) });
  show(root, [
    h('header', { className: 'title-logo' }, [h('h1', { textContent: t('app.title') }), h('p', { className: 'title-alt', textContent: t('title.alt') })]),
    mdWindow({ className: 'title-menu' }, [list.element]),
    h('p', { className: 'hint', textContent: t('title.hint') }),
  ]);
  pwa.banner(root);
}

/** The title's "Opciones": settings, account, achievements, prologue, credits and the install offer, in the shared described menu. */
function optionsScreen(root: HTMLElement, at: OptionsEntry = 'settings'): void {
  const entries = optionsEntries(pwa.offer() !== 'none');
  const action: Record<OptionsEntry, () => void> = {
    settings: () => settingsScreen(root),
    account: () => accountScreen(root, () => optionsScreen(root, 'account')),
    achievements: () => achievementsScreen(root),
    prologue: () => prologue(root, () => optionsScreen(root, 'prologue')),
    credits: () => creditsScreen(root),
    install: () => pwa.install(root),
  };
  const open = menuWindow({
    title: t('title.options'),
    rows: entries.map((entry) => ({ label: t(TITLE_LABEL[entry]), about: t(optionsAboutKey(entry)), onConfirm: action[entry] })),
    back: { label: t('menu.back'), about: t('options.about.back'), onConfirm: () => titleScreen(root, TITLE_ENTRIES.indexOf('options')) },
    className: 'options',
    initial: Math.max(0, entries.indexOf(at)),
  });
  show(root, [open.element]);
}

/**
 * A returning player (the save or records, which travel with the account,
 * show progress) on a device that never chose a starter: it counts as chosen
 * and the prologue as seen, so neither replays and the quiz never overwrites
 * its species (app/adventure-route.ts `hasProgress`).
 */
function adoptReturningPlayer(): void {
  if (settings.starterChosen) return;
  const save = loadSave(store);
  const records = readRecords(store);
  if (!hasProgress(save, records)) return;
  markPrologueSeen(store);
  update(withReturningPlayer(settings, records.lastSpecies, rosterOf(save)));
}

/** The title's "Jugar": the prologue and the quiz the first time (as before), then the town, where every run starts. */
function playScreen(root: HTMLElement): void {
  adoptReturningPlayer();
  const next = nextPlayScreen({ prologueSeen: hasSeenPrologue(store), starterChosen: settings.starterChosen });
  if (next === 'prologue') prologue(root, () => playScreen(root));
  else if (next === 'quiz') quiz(root, () => playScreen(root), () => titleScreen(root, 0));
  else townScreen(root);
}

/**
 * Play: the prologue the first time in this browser, then the quiz while no
 * starter is chosen, then the loadout with the starter preselected (see
 * `nextAdventureScreen`; each step comes back here when it ends).
 */
function newAdventure(root: HTMLElement, dungeon?: DungeonId): void {
  adoptReturningPlayer();
  const next = nextAdventureScreen({ prologueSeen: hasSeenPrologue(store), starterChosen: settings.starterChosen });
  if (next === 'prologue') prologue(root, () => newAdventure(root, dungeon));
  else if (next === 'quiz') quiz(root, () => newAdventure(root, dungeon), () => titleScreen(root, 0));
  else loadout(root, 'species', dungeon);
}

/** Dungeons whose guardian fell on this device (they open the next ones). */
const cleared = (): Set<string> => clearedDungeons(readRecords(store));

/** The challenge dungeons the selected species may play (open, and of its line: core/challenge.ts). */
const playableChallenges = (): DungeonDef[] => openChallenges(loadSave(store).owned ?? []).filter((d) => challengeMisfits(d, [settings.species]).length === 0);

/** What the town's exit lists: the open dungeons (the challenges have their own menu, `townChallenges`). */
const townDungeons = (): { id: string; label: string }[] => unlockedDungeons(cleared()).map((d) => ({ id: d.id, label: t(d.lore.nameKey) }));

/** After the loadout: the dungeon select when more than one dungeon is open or a challenge fits the species, otherwise straight in. */
function chooseDungeon(root: HTMLElement, back: () => void): void {
  if (!needsDungeonSelect(cleared()) && playableChallenges().length === 0) {
    void play(root);
    return;
  }
  const again = () => chooseDungeon(root, back);
  show(
    root,
    dungeonSelectScreen({
      records: readRecords(store),
      cleared: cleared(),
      onChallenges: () => {
        // After the loadout the species is final: a challenge of another line is greyed out.
        const menu = challengesWindow({ collection: loadSave(store), species: settings.species, requireFit: true, sheets: sheetsReady(), onChoose: (dungeon) => enterDungeon(root, dungeon, again), onBack: again });
        show(root, [h('div', { className: 'screen-row' }, [menu.element])]);
      },
      onChoose: (dungeon) => enterDungeon(root, dungeon, again),
      onBack: back,
    }),
  );
}

/**
 * The challenges menu over the town (the waystone's "Desafíos" row and
 * Phantump's): the species is not final yet, so any open challenge can be
 * chosen (alone, the loadout then lists only the line's forms; in a room the
 * host's start checks everyone, `roomDepartBlock`).
 */
const townChallenges = (parent: HTMLElement, onClose: () => void, depart: (id: string) => void): (() => void) =>
  townWindow(parent, challengesWindow({ collection: loadSave(store), species: settings.species, requireFit: false, sheets: sheetsReady(), onChoose: depart, onBack: onClose }));

/** Today's day of the daily challenge (UTC). */
const today = (): string => utcDateKey(Date.now());

/** Into a dungeon: the endless one shows its entry card first (rules, modes), the others start straight away. */
function enterDungeon(root: HTMLElement, dungeon: DungeonId, back: () => void): void {
  if (!dungeonById(dungeon).endless) {
    void play(root, undefined, dungeon);
    return;
  }
  const day = today();
  show(
    root,
    endlessEntryScreen({
      today: day,
      // The Sima's board of the tier picked on the loadout (each tier keeps its own).
      board: tierBoard(readScores(store), settings.difficulty),
      onStart: (mode: EndlessMode) => void play(root, undefined, dungeon, endlessSeed(mode, day, runSeed())),
      onBack: back,
    }),
  );
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

/**
 * A Sima cinematic (data/sima-scenes.ts) on the prologue player: over the
 * running game (`overlay`, solo: the run stands still) or as its own screen
 * (the mouth before the first descent, the return after a run). It counts as
 * seen once it ends or is skipped; a seen one returns null, plays nothing and
 * does not call `onDone` (the return's short form always plays).
 */
function simaScene(root: HTMLElement, id: SimaSceneId, info: SimaSceneInfo, onDone: () => void, overlay: boolean, replay?: { startMs: number }): (() => void) | null {
  // A seen one plays nothing and never calls back: the caller goes on (`simaMoment` already does on null).
  if (simaSceneSkipped(id, hasSeenSimaScene(store, id), replay !== undefined)) return null;
  void sheetsReady();
  const text = simaText(t, info.floor);
  const screen = prologueScreen({
    sheets: () => sheets,
    panels: simaPanels(id, info, text),
    draw: (ctx, panel, time, camera, alpha) => drawSimaScene(ctx, panel as SimaPanel, time, camera, alpha),
    label: t('sima.scene.title'),
    text,
    ...(replay ? { startMs: replay.startMs } : {}),
    onDone: () => {
      markSimaSceneSeen(store, id);
      screen.remove();
      onDone();
    },
  });
  if (overlay) {
    screen.style.zIndex = '6';
    root.append(screen);
  } else {
    show(root, [screen], false);
    root.querySelector('.notice')?.classList.add('in-game');
  }
  return () => screen.remove();
}

/**
 * A Senda chapter's cinematic (docs/story-quests.md): before the run starts
 * and after its victory, on the prologue player with the story tableaux,
 * skippable the same way. Solo only (a shared run never pauses).
 */
function storyCinematic(root: HTMLElement, story: StoryRun, phase: StoryPhase, onDone: () => void): void {
  const panels = storyPanels(story, phase, t);
  if (panels.length === 0) return onDone();
  void sheetsReady();
  const screen = prologueScreen({
    sheets: () => sheets,
    panels,
    draw: (ctx, panel, time, camera, alpha) => drawStoryScene(ctx, panel as StoryPanel, time, camera, alpha),
    label: t(`story.${story.line}.${story.chapter}.title`),
    onDone,
  });
  show(root, [screen], false);
  root.querySelector('.notice')?.classList.add('in-game');
}

/**
 * A herald's intro over the running game (solo): in full the first time this
 * device meets its seed (the bestiary), then the 2 s title card
 * (ui/herald-intro.ts); skippable like the guardian cinematics. The herald
 * is remembered either way. Its title card is drawn in its type's colour.
 */
function heraldCinematic(root: HTMLElement, def: HeraldDef, onDone: () => void): (() => void) | null {
  const mode = heraldIntroMode({ seen: hasMet(store, def.seed), shared: false });
  recordHerald(store, { seed: def.seed, name: def.name });
  if (mode === 'card') return null;
  const intro = composeHeraldIntro(def, mode, getLanguage());
  const screen = prologueScreen({
    sheets: () => sheets,
    panels: intro.panels,
    draw: (ctx, panel, time, camera, alpha) => drawHeraldScene(ctx, def, intro, panel, time, camera, alpha),
    label: def.name,
    music: { start: (offsetS) => audio.playCue(intro.music, offsetS), stop: () => audio.stopCue() },
    styleLines: (panel, lines) => styleHeraldLines(panel.scene === 'title', def, lines),
    onDone: () => {
      screen.remove();
      onDone();
    },
  });
  screen.style.zIndex = '6';
  root.append(screen);
  return () => screen.remove();
}

/** The herald title card's lines: the name large and in its colour, the epithet, the epigraph quieter. */
function styleHeraldLines(title: boolean, def: HeraldDef, lines: readonly HTMLElement[]): void {
  const [name, epithet, epigraph] = lines;
  for (const p of lines) p.removeAttribute('style');
  if (!title || !name || !epithet || !epigraph) return;
  name.style.cssText = `font-size: 2.1em; letter-spacing: 0.12em; color: ${def.theme.colour}; text-shadow: 0 0 12px ${def.theme.glow}, 0 2px 0 #000, 0 0 22px #000`;
  epithet.style.cssText = `color: ${def.theme.colour}; opacity: 0.9`;
  epigraph.style.cssText = 'font-style: italic; opacity: 0.75; font-size: 0.85em';
}

/** The personality quiz over a black screen; its starter becomes the `species` setting. */
function quiz(root: HTMLElement, then: () => void, cancel: () => void): void {
  const onDone = (starter: StarterId) => {
    // An evolved starter plays as its current form.
    update(withStarter(settings, currentForm(loadSave(store), starter)));
    then();
  };
  show(root, quizScreen({ seed: runSeed(), sheets: sheetsReady(), onDone, onCancel: cancel }), false);
}

/** The picker: species first, then its moves (Back from moves returns to the species list). */
function loadout(root: HTMLElement, stage: 'species' | 'moves' = 'species', dungeon?: DungeonId): void {
  // A challenge is played only with a form of its line (core/challenge.ts): the picker lists those, and starts on the one the player has.
  const line = dungeon ? dungeonById(dungeon).challenge?.line : undefined;
  const save = loadSave(store);
  if (line && lineOf(settings.species) !== line) update(withSpecies(settings, currentForm(save, line)));
  show(root, [
    ...loadoutScreen({
      stage,
      species: settings.species,
      loadout: settings.loadout,
      roster: rosterOf(save).filter((id) => !line || lineOf(id) === line),
      sheets: sheetsReady(),
      ...tutorView(settings.species),
      ...skins(),
      onSpecies: (species) => {
        update(withSpecies(settings, species));
        loadout(root, 'moves', dungeon);
      },
      onChange: (next) => update({ loadout: next }),
      // Solo: the tier for the run (remembered); a room's is the host's, picked in the town.
      difficulty: { value: settings.difficulty, onChange: (next) => update({ difficulty: next }) },
      onStart: () => (dungeon ? enterDungeon(root, dungeon, () => loadout(root, 'moves', dungeon)) : chooseDungeon(root, () => loadout(root, 'moves'))),
      // Runs start in the town now: the loadout's way back is the town.
      onBack: () => (stage === 'moves' ? loadout(root, 'species', dungeon) : townScreen(root)),
    }),
  ]);
}

function settingsScreen(root: HTMLElement): void {
  const back = () => optionsScreen(root, 'settings');
  const access: SettingsAccess = {
    get: () => settings,
    update,
    setLanguage: (language) => {
      applyLanguage(language);
      settingsScreen(root);
    },
  };
  const list = cursorList({ items: [], onBack: back, label: t('title.settings') });
  const retake = () => quiz(root, () => settingsScreen(root), () => settingsScreen(root));
  const nickname = nicknameRow();
  const accountRow = { label: t('title.account'), onConfirm: () => accountScreen(root, () => settingsScreen(root)) };
  const refresh = () => list.setItems([...settingItems(access, refresh), nickname, accountRow, { label: t('quiz.retake'), onConfirm: retake }, { label: t('menu.back'), onConfirm: back }]);
  refresh();
  show(root, [
    h('h1', { className: 'screen-title', textContent: t('title.settings') }),
    h('div', { className: 'screen-row' }, [
      mdWindow({ title: t('title.settings'), className: 'settings' }, [list.element]),
      mdWindow({ title: t('menu.controls'), className: 'controls' }, [h('ul', { className: 'control-list' }, CONTROL_KEYS.map((key) => h('li', { textContent: t(`menu.controls.${key}`) })))]),
    ]),
  ]);
}

/** The account screen (log in, sign up, log out, delete; cloud sync choices, status and backups), from the title or Settings. */
function accountScreen(root: HTMLElement, back: () => void, view: AccountView = 'main'): void {
  accountRedraw = () => accountScreen(root, back);
  accountView = view;
  show(root, [accountWindow({ account, refresh: (next) => accountScreen(root, back, next), onBack: back }, view)]);
}

/** The account window over the town (its Esc menu, solo or in a room): the town, the room and its session stay underneath. */
function townAccount(parent: HTMLElement, onClose: () => void): () => void {
  const overlay = h('div', { className: 'town-shop' });
  let closed = false;
  const render = (view: AccountView = 'main'): void => {
    if (closed) return;
    accountRedraw = () => render('main');
    accountView = view;
    overlay.replaceChildren(accountWindow({ account, refresh: render, onBack: onClose }, view));
  };
  render();
  parent.append(overlay);
  return () => {
    closed = true;
    if (overlay.isConnected) {
      accountRedraw = null;
      accountView = null;
    }
    overlay.remove();
  };
}

/**
 * The gallery over the town (its Esc menu; app/lore-gallery.ts): the groups,
 * then a group's scenes; a seen one plays again over the town (the window
 * waits under it), an unseen one is "???" and does nothing. Nothing is
 * written: no seen flag, save, record or story. The pleas replay on the
 * crater's rim through the town (`replayPlea`, alone only).
 */
function townGallery(root: HTMLElement) {
  return (parent: HTMLElement, onClose: () => void, replayPlea: (() => void) | null): (() => void) => {
    const overlay = h('div', { className: 'town-shop' });
    const groups = galleryGroups();
    let open: { element: HTMLElement; dispose(): void } | null = null;
    let closeScene: (() => void) | null = null;
    const render = (group: number | null, initial = 0): void => {
      open?.dispose();
      const seen = readGallerySeen(store, settings.starterChosen);
      if (group === null) {
        open = menuWindow({
          title: t('gallery.title'),
          intro: t('gallery.intro'),
          rows: groups.map((g, i) => ({ label: g.title(t), about: t('gallery.group.about').replace('{seen}', String(groupSeen(g, seen))).replace('{total}', String(g.entries.length)), onConfirm: () => render(i) })),
          back: { label: t('menu.back'), about: t('gallery.back.about'), onConfirm: onClose },
          className: 'town-menu',
          initial,
        });
      } else {
        const g = groups[group]!;
        open = menuWindow({
          title: g.title(t),
          rows: g.entries.map((e, i) => {
            const unlocked = galleryUnlocked(e.scene, seen);
            const roomPlea = e.scene.kind === 'plea' && !replayPlea;
            return {
              label: unlocked ? e.label(t) : t('gallery.locked'),
              about: !unlocked ? t('gallery.locked.about') : roomPlea ? t('gallery.plea.room') : t('gallery.play.about'),
              onConfirm: () => {
                if (!unlocked || roomPlea || closeScene) return;
                if (e.scene.kind === 'plea') return replayPlea?.();
                closeScene = galleryCinematic(root, e.scene, () => {
                  closeScene = null;
                  render(group, i);
                });
              },
            };
          }),
          back: { label: t('menu.back'), about: t('gallery.groups.about'), onConfirm: () => render(null, group) },
          className: 'town-menu',
          initial,
        });
      }
      overlay.replaceChildren(open.element);
    };
    render(null);
    parent.append(overlay);
    return () => {
      closeScene?.();
      closeScene = null;
      open?.dispose();
      overlay.remove();
    };
  };
}

/**
 * One of the gallery's cinematics over the town, on the prologue player and
 * skippable the same way, in full: the prologue (with its music), a Sima
 * scene (the player's Pokémon, its best Sima floor), a guardian's, a Senda
 * chapter's. Replaying writes nothing; `onDone` runs when it ends.
 */
function galleryCinematic(root: HTMLElement, scene: Exclude<GalleryScene, { kind: 'plea' }>, onDone: () => void): () => void {
  void sheetsReady();
  const play = ((): Omit<PrologueOptions, 'sheets' | 'onDone'> => {
    switch (scene.kind) {
      case 'prologue':
        return { label: t('title.prologue'), music: { start: (offsetS) => audio.playCue(PROLOGUE_MUSIC, offsetS), stop: () => audio.stopCue() } };
      case 'sima': {
        const text = simaText(t, readRecords(store).dungeons[ECLIPSE.id]?.bestFloor);
        return { label: t('sima.scene.title'), text, panels: simaPanels(scene.id, { species: settings.species }, text), draw: (ctx, panel, time, camera, alpha) => drawSimaScene(ctx, panel as SimaPanel, time, camera, alpha) };
      }
      case 'guardian': {
        const cinematic = GUARDIAN_CINEMATICS[scene.species]!;
        return { label: t(`species.${scene.species}`), panels: cinematicPanels(scene.species, scene.phase, 'full'), draw: (ctx, panel, time, camera, alpha) => drawGuardianScene(ctx, cinematic, panel, time, camera, alpha) };
      }
      case 'story':
        return { label: t(`story.${scene.line}.${scene.chapter}.title`), panels: storyPanels({ line: scene.line, chapter: scene.chapter }, scene.phase, t), draw: (ctx, panel, time, camera, alpha) => drawStoryScene(ctx, panel as StoryPanel, time, camera, alpha) };
    }
  })();
  const screen = prologueScreen({
    sheets: () => sheets,
    ...play,
    onDone: () => {
      screen.remove();
      // The town's own track comes back after the prologue's.
      if (scene.kind === 'prologue') audio.setMusic('title');
      onDone();
    },
  });
  screen.style.zIndex = '6';
  root.append(screen);
  return () => screen.remove();
}

/**
 * The hub town (src/town): walk around; its route exit goes on exactly like
 * "Play" (`newAdventure`), Esc goes back to the title. It keeps the title
 * track (Lonely Village) playing, so the step from the title is seamless
 * (`setMusic` with the context already playing does nothing); the planned
 * dry "hub" version in src/data/music.ts is not shipped yet.
 */
function townScreen(root: HTMLElement, at?: TownPlace): void {
  // The hub is walked alone: a room (or a local tab session) left behind is left here, the one way back for solo play.
  leaveNet();
  waitScreen(root, t('app.loading'));
  const showTown = (nodes: Node[]) => {
    show(root, nodes, false);
    audio.setMusic('title');
  };
  const dungeons = townDungeons();
  void openTown({ sheets: sheetsReady(), species: settings.species, shiny: skinOn(), dungeons, show: showTown, onDepart: (id) => newAdventure(root, dungeonById(id).id), onQuit: () => titleScreen(root, 0), openShop: townShop, openTutor: townTutor, openGacha: townGacha, openEvolve: townEvolve, openBoard: townBoard, openChallenges: townChallenges, openShrine: () => shrineScreen(root, 'town'), openOnline: () => onlineScreen(root, 'town'), openAchievements: townAchievements, openSettings: townSettings, openAccount: townAccount, openGallery: townGallery(root), difficulty: () => settings.difficulty, simaPlea: { dungeon: ECLIPSE.id, due: () => simaPleaDue(store), ready: () => pleaReady(cleared()), seen: () => markSimaSceneSeen(store, 'plea') }, story: loadSave(store).story, globalBoard, ...at });
}

/** What the loadout needs from the move tutor (app/tutor.ts): the known moves, their Mejoras and the recommended build. */
function tutorView(species: SpeciesId): { known: MoveId[]; ranks: Partial<Record<MoveId, number>>; buildHint: string } {
  const save = loadSave(store);
  return { known: knownMoves(save, species), ranks: { ...runRanks(save, species) }, buildHint: buildHint(species) };
}

/** A run's Mejoras, awakening steps and shiny skin of `species` (none: no field). */
function ranksOf(species: SpeciesId): { moveRanks?: Partial<Record<MoveId, number>>; awakened?: number; shiny?: boolean } {
  const save = loadSave(store);
  const ranks = runRanks(save, species);
  const awakened = awakenedOf(save, species);
  return { ...(ranks ? { moveRanks: ranks } : {}), ...(awakened > 0 ? { awakened } : {}), ...(wearsShiny(save, species) ? { shiny: true } : {}) };
}

/** Whether `species` (the picked one by default) wears its line's shiny skin (odd/tasks/shiny-echo.md). */
const skinOn = (species: SpeciesId = settings.species): boolean => wearsShiny(loadSave(store), species);

/**
 * The loadout's shiny skins, read from and written to the save; `after` runs
 * after a change (a room hears it through the hello).
 */
function skins(after?: () => void): { skin: ShinySkins } {
  return {
    skin: {
      unlocked: (species) => hasShiny(loadSave(store), species),
      worn: (species) => skinOn(species),
      wear: (species, on) => {
        wearShinyAt(store, species, on);
        after?.();
      },
    },
  };
}

/** Smeargle's move tutor over the town, like the shop. */
function townTutor(parent: HTMLElement, onClose: () => void): () => void {
  const tutor = tutorWindow({ store, species: settings.species, cleared: cleared(), play: (sound) => audio.play(sound), onBack: onClose });
  const overlay = h('div', { className: 'town-shop' }, [tutor.element]);
  parent.append(overlay);
  return () => {
    tutor.dispose();
    overlay.remove();
  };
}

/** A stall window over the town, centred like the shop (the town waits behind it). */
function townWindow(parent: HTMLElement, open: { element: HTMLElement; dispose(): void }): () => void {
  const overlay = h('div', { className: 'town-shop' }, [open.element]);
  parent.append(overlay);
  return () => {
    open.dispose();
    overlay.remove();
  };
}

/** Leaving a stall that changes the collection (a pull, an evolution) settles the achievements the save earns (app/progress.ts). */
const settleOnClose = (onClose: () => void) => () => {
  onClose();
  achievementToast(recordSave(store, Date.now()).unlocked);
};

/** The achievements window over the town (its Esc menu). */
const townAchievements = (parent: HTMLElement, onClose: () => void): (() => void) => townWindow(parent, achievementsWindow({ store, onBack: onClose }));

/** The settings over the town (its Esc menu): the same rows as the Settings screen; a language change redraws them in place. */
function townSettings(parent: HTMLElement, onClose: () => void): () => void {
  const list = cursorList({ items: [], onBack: onClose, label: t('title.settings') });
  const access: SettingsAccess = {
    get: () => settings,
    update,
    setLanguage: (language) => {
      applyLanguage(language);
      refresh();
    },
  };
  const refresh = (): void => list.setItems([...settingItems(access, refresh), nicknameRow(), { label: t('menu.back'), onConfirm: onClose }]);
  refresh();
  return townWindow(parent, { element: mdWindow({ title: t('title.settings'), className: 'settings' }, [list.element]), dispose: () => list.dispose() });
}

/** Mimikyu's gacha stall over the town. */
const townGacha = (parent: HTMLElement, onClose: () => void): (() => void) => townWindow(parent, gachaWindow({ store, sheets: sheetsReady(), play: (sound) => audio.play(sound), onBack: settleOnClose(onClose) }));

/** The Lago oracle Phantump's evolutions over the town; evolving the selected species keeps it selected as its new form. */
function townEvolve(parent: HTMLElement, onClose: () => void, depart: (id: string) => void): () => void {
  let close = (): void => undefined;
  const evolve = () => {
    close();
    close = townWindow(parent, evolveWindow({ store, play: (sound) => audio.play(sound), onEvolved: followEvolution, onChallenges: challenges, onBack: settleOnClose(onClose) }));
  };
  // Its "Desafíos" row opens the same challenges menu as the waystone; Back returns to Phantump.
  const challenges = () => {
    close();
    close = townChallenges(parent, evolve, depart);
  };
  evolve();
  return () => close();
}

/**
 * The notice board's missions over the town (after its records are read),
 * and the achievements window in its place from there (its way back is the
 * board).
 */
function townBoard(parent: HTMLElement, onClose: () => void): () => void {
  const overlay = h('div', { className: 'town-shop' });
  let open: { element: HTMLElement; dispose(): void } | null = null;
  const swap = (next: { element: HTMLElement; dispose(): void }) => {
    open?.dispose();
    open = next;
    overlay.replaceChildren(next.element);
  };
  const board = () => swap(missionBoardWindow({ store, now: () => Date.now(), play: (sound) => audio.play(sound), onAchievements: () => swap(achievementsWindow({ store, onBack: board })), onBack: onClose }));
  board();
  parent.append(overlay);
  return () => {
    open?.dispose();
    overlay.remove();
  };
}

/** The achievements window from the title menu. */
function achievementsScreen(root: HTMLElement): void {
  const open = achievementsWindow({ store, onBack: () => optionsScreen(root, 'achievements') });
  show(root, [open.element]);
}

/** The selected species evolved: play as its new form (with that form's default loadout). */
function followEvolution(from: SpeciesId, to: SpeciesId): void {
  if (settings.species === from) update(withSpecies(settings, to));
}

/** The dev `?screen=challenges` hook: the challenges menu as the town opens it. */
function devScreenChallenges(root: HTMLElement): void {
  show(root, [challengesWindow({ collection: loadSave(store), species: settings.species, requireFit: false, sheets: sheetsReady(), onChoose: (id) => newAdventure(root, dungeonById(id).id), onBack: () => titleScreen(root) }).element]);
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

/** Where the shrine sends the player back: the title menu (its entry), the Refugio beside the altar, or an online room's town. */
type ShrineFrom = 'title' | 'town' | 'room';

/** The Refugio tile in front of the altar (data/world.ts `REFUGIO.shrine`). */
const SHRINE_TILE = { at: 'refugio', tile: { x: 22, y: 15 } } as const;

/** The online room, when this screen belongs to it (the session is still the current one). */
const liveRoom = (from: ShrineFrom) => (from === 'room' && room && current === room.session ? room : null);

/**
 * Santuario de los Juramentos (app/shrine.ts): the window, then the loadout,
 * then a trial. Alone, or the host of an online room for the whole room
 * (guests get `roomShrineGuest`).
 */
function shrineScreen(root: HTMLElement, from: ShrineFrom = 'title', view?: ShrineView, focus?: string): void {
  const r = liveRoom(from);
  if (from === 'room' && !r) return titleScreen(root);
  if (r && !r.asHost) return roomShrineGuest(root);
  if (!r) leaveNet();
  applyLanguage(settings.language);
  const back = () => (r ? townLobby(root) : from === 'town' ? townScreen(root, SHRINE_TILE) : titleScreen(root));
  const shrine = shrineWindow({
    shrine: readShrine(store),
    beaten: beatenBosses(readRecords(store)),
    heralds: readBestiary(store),
    // A room's tier is the host's for the room (the town's tier row too).
    difficulty: r ? r.session.difficulty() : settings.difficulty,
    sheets: sheetsReady(),
    onTier: (difficulty) => {
      r?.session.setDifficulty(difficulty);
      update({ difficulty });
    },
    onFight: (request) => {
      shrine.dispose();
      // The guests see the pick at once (read-only) and choose their own Pokémon.
      r?.session.setTrial(roomTrialOf(request));
      shrineStep(root, from, shrineFight(request));
    },
    onBack: () => {
      shrine.dispose();
      back();
    },
    ...(r ? { note: t('shrine.room.host') } : {}),
    ...(view ? { view } : {}),
    ...(focus ? { focus } : {}),
  });
  show(root, [shrine.element]);
}

/** A herald's name from the bestiary (its request id is its seed). */
const heraldName = (request: TrialRequest): string | undefined => (request.kind === 'herald' ? readBestiary(store).find((e) => String(e.seed) === request.id)?.name : undefined);

const requestLine = (request: TrialRequest): string => `${requestName(request, heraldName(request))} · ${t(`difficulty.${request.difficulty}`)}`;

/**
 * One step of the shrine's way to a trial (app/shrine-route.ts): the shrine
 * window, the run's loadout picker (species, then moves; the same persisted
 * settings as a run, so the last pick is remembered for both) or the trial.
 */
function shrineStep(root: HTMLElement, from: ShrineFrom, step: ShrineStep): void {
  const r = liveRoom(from);
  if (step.screen === 'shrine') {
    // The tier picked is already the remembered one (`onTier`); kept explicit.
    if (step.difficulty !== settings.difficulty) update({ difficulty: step.difficulty });
    return shrineScreen(root, from, step.view, step.focus);
  }
  if (step.screen === 'trial') return r ? startRoomTrial(root, step.request, step) : void playTrial(root, step.request, from, step);
  const { request, stage } = step;
  show(root, [
    ...loadoutScreen({
      stage,
      species: settings.species,
      loadout: settings.loadout,
      roster: rosterOf(loadSave(store)),
      sheets: sheetsReady(),
      ...tutorView(settings.species),
      ...skins(() => r?.session.repick(settings.species, settings.loadout, skinOn())),
      startLabel: t('shrine.start'),
      context: requestLine(request),
      onSpecies: (species) => {
        update(withSpecies(settings, species));
        // The room sees the host's new species too.
        r?.session.repick(settings.species, settings.loadout, skinOn());
        shrineStep(root, from, loadoutSpecies(request));
      },
      onChange: (next) => update({ loadout: next }),
      onStart: () => shrineStep(root, from, loadoutStart(request, settings)),
      onBack: () => shrineStep(root, from, loadoutBack(stage, request)),
    }),
  ]);
}

/** The species and moves a trial is played with. */
type TrialPick = Pick<Extract<ShrineStep, { screen: 'trial' }>, 'species' | 'loadout'>;

/** A trial under way: what was asked, where it returns, the pick, and whether it was played by a group (an online room of two or more). */
interface TrialRun {
  request: TrialRequest;
  from: ShrineFrom;
  pick: TrialPick;
  group?: boolean;
}

/** A shrine trial: its first arena's dungeon, the request's tier, a fresh seed, the picked species and moves. */
const playTrial = (root: HTMLElement, request: TrialRequest, from: ShrineFrom, pick: TrialPick): Promise<void> => play(root, undefined, request.stops[0]!.dungeon, undefined, { request, from, pick });

/** The online room's guest at the altar: the host's pick (read-only) and its own Pokémon and moves; the host begins. */
function roomShrineGuest(root: HTMLElement, stage: 'menu' | 'species' | 'moves' = 'menu'): void {
  const r = liveRoom('room');
  if (!r) return titleScreen(root);
  const back = () => townLobby(root);
  const picked = r.session.trial();
  const request = picked ? trialRequestOf(picked) : null;
  if (stage !== 'menu') {
    show(root, [
      ...loadoutScreen({
        stage,
        species: settings.species,
        loadout: settings.loadout,
        roster: rosterOf(loadSave(store)),
        sheets: sheetsReady(),
        ...tutorView(settings.species),
        ...skins(),
        startLabel: t('shrine.ready'),
        ...(request ? { context: requestLine(request) } : {}),
        onSpecies: (species) => {
          update(withSpecies(settings, species));
          roomShrineGuest(root, 'moves');
        },
        onChange: (next) => update({ loadout: next }),
        // Ready: the host's roster gets this species; the moves stay on this device (each player plays its own).
        onStart: () => {
          r.session.repick(settings.species, settings.loadout, skinOn());
          back();
        },
        onBack: () => roomShrineGuest(root, stage === 'moves' ? 'species' : 'menu'),
      }),
    ]);
    return;
  }
  const status = picked && !request ? t('shrine.unknown') : request ? t('shrine.room.pick').replace('{name}', requestName(request, heraldName(request))).replace('{tier}', t(`difficulty.${request.difficulty}`)) : t('shrine.room.wait');
  const list = cursorList({
    onBack: back,
    label: t('shrine.title'),
    items: [
      { label: t('shrine.room.loadout'), onConfirm: () => roomShrineGuest(root, 'species') },
      { label: t('shrine.room.back'), onConfirm: back },
    ],
  });
  show(root, [
    mdWindow({ title: t('shrine.title'), className: 'shrine' }, [
      h('h3', { className: 'dim', textContent: t('shrine.subtitle') }),
      h('p', { className: 'shrine-room-pick', textContent: status }),
      h('p', { className: 'dim', textContent: t('shrine.room.guest') }),
      list.element,
    ]),
  ]);
}

/** The room's host begins the trial for everyone (every player shares its version: net/version.ts). */
function startRoomTrial(root: HTMLElement, request: TrialRequest, pick: TrialPick): void {
  const r = liveRoom('room');
  if (!r) return titleScreen(root);
  const dungeon = request.stops[0]!.dungeon;
  r.session.repick(pick.species, pick.loadout, skinOn(pick.species));
  r.session.setDifficulty(request.difficulty);
  r.session.begin(dungeon, r.seed, roomTrialOf(request));
  const group = r.session.roster().length > 1;
  void play(root, { session: r.session, role: 'host', localId: 'p1', seed: r.seed, floor: 1, dungeon, difficulty: request.difficulty, online: true }, dungeon, undefined, { request, from: 'room', pick, group });
}

/** A trial ended: its record (heralds are not kept; a group's apart), a gauntlet's first solo clear reward, and the shrine's result screen. */
function trialEnd(root: HTMLElement, run: TrialRun, result: GameResult, summary: RunSummary): void {
  const { request, from, pick } = run;
  const group = run.group === true;
  const trial = summary.trial!;
  const victory = result === 'victory';
  const kind = request.kind === 'gauntlet' ? 'gauntlet' : 'boss';
  const kept = request.kind !== 'herald';
  const before = kept ? trialBest(readShrine(store), kind, request.id, request.difficulty, group) : null;
  const first = kept && saveTrial(store, { kind, id: request.id, difficulty: request.difficulty, victory, ms: trial.ms, noHit: trial.noHit, captures: trial.captures, species: pick.species, ...(group ? { group } : {}) });
  // No farming: reflections pay nothing, a gauntlet pays once per tier, and only alone.
  const coins = first && !group && request.kind === 'gauntlet' ? gauntletReward(request.id as GauntletId, request.difficulty) : 0;
  const balance = coins > 0 ? earnCoins(store, coins).coins : loadSave(store).coins;
  const view = viewOf(request);
  const herald = heraldName(request);
  // An online room goes back to its town (the host reopens it, the guests follow); no retry from here.
  const actions = from === 'room' ? { onBack: () => backToRoom(root) } : { onRetry: () => void playTrial(root, request, from, pick), onBack: () => shrineScreen(root, from, view, request.id) };
  show(root, [shrineResultScreen({ request, victory, trial, before, coins, balance, ...actions }, herald)], true, victory ? 'victory' : 'defeat');
}

/** The upgrade shop from the title menu (its last entry). */
function shopScreen(root: HTMLElement): void {
  const shop = shopWindow({ store, play: (sound) => audio.play(sound), onBack: () => titleScreen(root) });
  show(root, [shop.element]);
}

function creditsScreen(root: HTMLElement): void {
  show(root, [creditsWindow(single(t('menu.back'), () => optionsScreen(root, 'credits')))]);
}

/** "Play online": create a room or join one by code (`?room=CODE` prefills it). */
function onlineScreen(root: HTMLElement, from: OnlineFrom = 'title'): void {
  const back = () => (from === 'town' ? townScreen(root, BEACON_TILE) : titleScreen(root, 1));
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
    if (normalized) void openLobby(root, normalized, false, undefined, from);
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
      { label: t('lobby.create'), onConfirm: () => void openLobby(root, generateRoomCode(), true, undefined, from) },
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
async function openLobby(root: HTMLElement, code: string, asHost: boolean, transport?: () => Transport<string>, from: OnlineFrom = 'title'): Promise<void> {
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
  room = { session, code, asHost, seed: runSeed(), from };
  // Load the sprites while connecting, so the town and the run do not wait for them.
  void sheetsReady();
  session.onFull((reason) => {
    if (current === session) messageScreen(root, t(reason === 'version' ? 'net.version' : 'lobby.full'));
  });
  // A run is under way: this player comes in at the next floor start or bonfire respawn (it keeps walking the town meanwhile).
  session.onWait(() => {
    if (current === session) toast(root, t('net.waitFloor'));
  });
  // Host: someone on another version knocked; say so here too (they see "reload the page").
  session.onVersionRefused(() => {
    if (current === session) toast(root, t('net.versionRefused'));
  });
  session.onStart((start) => {
    if (current !== session) return;
    const join: NetJoin = { session, role: 'guest', localId: start.localId, seed: start.seed, floor: start.floor, ...(start.dungeon !== undefined ? { dungeon: start.dungeon } : {}), ...(start.difficulty ? { difficulty: start.difficulty } : {}), online: true };
    if (!start.trial) return void play(root, join);
    // The host began a shrine trial for the room: its arenas, with this player's own Pokémon and moves.
    const request = trialRequestOf(start.trial);
    if (!request) return messageScreen(root, t('shrine.unknown'));
    void play(root, join, request.stops[0]!.dungeon, undefined, { request, from: 'room', pick: { species: settings.species, loadout: [...settings.loadout] }, group: session.roster().length > 1 });
  });
  // The host brought the room back to the town after a run: a run still going here ends first (its end runs once, paid);
  // its end screen then leads back to the town. Anywhere else, follow it there (unless already walking it).
  session.onLobby(() => {
    if (current !== session) return;
    if (running) return running.cutShort('closed');
    if (!root.querySelector('canvas.town')) townLobby(root);
  });
  const name = sanitizeNickname(settings.nickname) || nameOf({ peer: session.peerId() });
  if (asHost) session.host(room.seed, 1, settings.species, { lobby: true, name, difficulty: settings.difficulty, shiny: skinOn() });
  else session.join(settings.species, settings.loadout, name, skinOn());
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
  // Leaving goes back where the room was opened: the title menu, or the Refugio beside the signal pillar (walked alone again).
  const leave = () => (r.from === 'town' ? townScreen(root, BEACON_TILE) : titleScreen(root, 1));
  const lobby: TownLobby = {
    isHost: r.asHost,
    selfName: sanitizeNickname(settings.nickname) || nameOf({ peer: session.peerId() }),
    code: () => (hideCode ? '•'.repeat(r.code.length) : r.code),
    players: () => session.roster().map((e) => ({ name: nameOf(e), host: e.id === 'p1', self: e.peer === session.peerId() })),
    walkers: () => session.townWalkers().map((w) => ({ id: w.id, name: nameOf(w), species: w.species, ...(w.shiny ? { shiny: true } : {}), map: w.map, pos: w.pos, facing: w.facing, moving: w.moving })),
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
    // The host's call for the group: the Sima del Eclipse is entered as the daily challenge or a free run (its seed goes in `start`).
    // The room's tier: the host picks it (remembered as its own last choice), the guests see the host's.
    difficulty: () => session.difficulty(),
    setDifficulty: (next) => {
      session.setDifficulty(next);
      update({ difficulty: next });
    },
    variants: (id) => (dungeonById(id).id === id && dungeonById(id).endless ? ENDLESS_MODES.map((m) => ({ label: t(`endless.mode.${m}`), value: m })) : null),
  };
  const depart = (id: string, variant?: string) => {
    if (!session.canLead()) return;
    const def = dungeonById(id);
    const runSeed = def.endless ? endlessSeed(variant === 'free' ? 'free' : 'daily', today(), r.seed) : r.seed;
    session.begin(def.id, runSeed);
    void play(root, { session, role: 'host', localId: 'p1', seed: runSeed, floor: 1, dungeon: def.id, difficulty: session.difficulty(), online: true });
  };
  // A challenge only for the line's forms: the host's start names who plays another Pokémon (core/challenge.ts).
  const departBlock = (id: string): string | null => {
    const def = dungeonById(id);
    const roster = session.roster();
    const misfits = challengeMisfits(def, roster.map((e) => e.species));
    if (!def.challenge || misfits.length === 0) return null;
    return t('challenges.party')
      .replace('{line}', t(`species.${def.challenge.line}`))
      .replace('{names}', misfits.map((i) => nameOf(roster[i]!)).join(', '));
  };
  const dungeons = townDungeons();
  void openTown({ sheets: sheetsReady(), species: settings.species, shiny: skinOn(), dungeons, show: showTown, onDepart: depart, departBlock, onQuit: leave, openShop: townShop, openTutor: townTutor, openGacha: townGacha, openEvolve: townEvolve, openBoard: townBoard, openChallenges: townChallenges, openShrine: () => shrineScreen(root, 'room'), openAchievements: townAchievements, openSettings: townSettings, openAccount: townAccount, openGallery: townGallery(root), story: loadSave(store).story, globalBoard, lobby });
}

/** After a shared run: the host reopens the room's lobby with a new seed (guests follow), a guest goes ahead to wait in the town. */
function backToRoom(root: HTMLElement): void {
  // The room is gone (the host left): back to the hub, alone.
  if (!room || current !== room.session) return townScreen(root);
  if (room.asHost) {
    room.seed = runSeed();
    room.session.reopenLobby(room.seed);
  }
  townLobby(root);
}

/** The end screen: result, floor reached, seed, level and items, the Pokémonedas earned and the new balance, then retry or back. */
/** An endless run's score on the end screen: its rank on this device's board (null: not in the top) and the board. */
interface EndScore {
  entry: ScoreEntry;
  rank: number | null;
  board: readonly ScoreEntry[];
}

/** The Sima del Eclipse column of the end screen: mode, date, seed, floor and time left, rank, and the top of the board. */
function scoreColumn(score: EndScore): HTMLElement {
  const { entry } = score;
  // Across both columns: this run on the left, the top of the board on the right (this run's row highlighted).
  const top = h(
    'div',
    {},
    score.board.slice(0, 3).map((e, i) => {
      const row = h('p', { className: i + 1 === score.rank ? '' : 'dim', textContent: scoreLine(e, i + 1, t) });
      row.style.margin = '0.15rem 0';
      if (i + 1 === score.rank) row.style.color = 'var(--cursor, #ffd447)';
      return row;
    }),
  );
  const column = h('div', { className: 'endless-score' }, [
    h('div', {}, [
      h('h3', { className: 'dim', textContent: t('endless.score') }),
      statLine(t('endless.score.mode'), `${t(`endless.mode.${entry.mode}`)} · ${entry.date}`),
      statLine(t('endless.score.time'), clockText(entry.clockMs)),
      statLine(t('endless.score.rank'), score.rank === null ? t('endless.score.unranked') : `#${score.rank}`),
    ]),
    h('div', {}, [h('h3', { className: 'dim', textContent: t('endless.board.top') }), top]),
  ]);
  Object.assign(column.style, { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: '0 2.5rem' });
  return column;
}

function resultScreen(root: HTMLElement, result: GameResult, summary: RunSummary, online: boolean, balance: number, score?: EndScore, materials?: string | null): void {
  // A room run: the room goes back to its town together for another one (`backToRoom`); every other run to the hub (after-run.ts).
  const inRoom = online && room !== null && current === room.session;
  const party = inRoom ? room!.session.roster().map(nameOf) : null;
  const back = townOf({ inRoom }) === 'room' ? () => backToRoom(root) : () => townScreen(root);
  // Retrying the Sima goes back to its entry card (pick the mode again).
  const retry = () => (dungeonById(summary.dungeon).endless ? enterDungeon(root, summary.dungeon, back) : void play(root, undefined, summary.dungeon));
  const items: ListItem[] = endActions({ online }).map((action) =>
    action === 'retry' ? { label: t('screen.retry'), onConfirm: retry } : { label: t(party ? 'lobby.backToTown' : 'screen.town'), onConfirm: back },
  );
  const held = heldItems(summary.items as ItemId[]);
  show(root, [
    mdWindow({ className: `result ${result}` }, [
      h('h1', { textContent: t(`screen.${result}.title`) }),
      // Victory names the dungeon's guardian, defeat the player's Pokémon.
      h('p', { textContent: t(`screen.${result}.text`).replace('{name}', t(`species.${result === 'victory' ? (guardianOf(dungeonById(summary.dungeon)) ?? 'aegislash') : settings.species}`)) }),
      // The host cut the run short: why it ended, and what was kept.
      ...(summary.cutShort ? [h('p', { className: 'dim', textContent: t(`net.cutShort.${summary.cutShort}`) })] : []),
      // A challenge's own closing line (its trial's lore).
      ...(victoryLine(dungeonById(summary.dungeon), result) ? [h('p', { className: 'dim', textContent: t(victoryLine(dungeonById(summary.dungeon), result)!) })] : []),
      // Run summary and Pokémonedas side by side on wide screens (stacked when narrow).
      h('div', { className: 'result-columns' }, [
        h('div', {}, [
          h('h3', { className: 'dim', textContent: t('screen.summary') }),
          statLine(t('difficulty.label'), t(`difficulty.${summary.difficulty}`)),
          statLine(t('screen.floorReached'), String(summary.floor)),
          statLine(t('screen.level'), String(summary.level)),
          statLine(t('screen.seed'), String(summary.seed)),
          statLine(t('screen.items'), held.length === 0 ? t('screen.noItems') : held.map((i) => `${i.name}${i.count > 1 ? ` ×${i.count}` : ''}`).join(', ')),
          ...(party ? [statLine(t('screen.party'), party.join(', '))] : []),
          // The Sima: the floor events taken this run.
          ...(summary.simaEvents?.length
            ? [h('h3', { className: 'dim', textContent: t('sima.summary.title') }), ...simaEventLines(summary.simaEvents, t).map((line) => simaLine(line))]
            : []),
        ]),
        h('div', { className: 'coin-lines' }, [
          h('h3', { className: 'dim', textContent: t('screen.coins') }),
          // The Sima's ×0.5 is its pay rate, not a difficulty: its line says so.
          ...coinLines(summary.coins, balance, (key) => t(score && key === 'screen.coins.multiplier' ? 'endless.coins.rate' : key)).map((line) => statLine(line.label, line.value)),
          // A challenge clear: the materials it paid (after-run.ts).
          ...(materials ? [statLine(t('screen.materials'), materials)] : []),
        ]),
        ...(score ? [scoreColumn(score)] : []),
      ]),
      cursorList({ items, onBack: back, className: 'result-actions' }).element,
    ]),
  ], true, result === 'eclipse' ? 'victory' : result);
}

/** One line of the Sima's events on the end screen: small and tight, so the actions stay in view. */
function simaLine(text: string): HTMLElement {
  const line = h('p', { className: 'dim', textContent: text });
  Object.assign(line.style, { margin: '0.1rem 0', fontSize: '0.85em', lineHeight: '1.25' });
  return line;
}

/** Records an endless run's score (floor, time left, mode from its seed, the UTC day) and returns its rank. */
function endlessScore(summary: RunSummary): EndScore {
  const date = today();
  const tier = summary.difficulty !== DEFAULT_DIFFICULTY ? { difficulty: summary.difficulty } : {};
  // The build goes with the score: Mejoras and Maestro moves count in the Sima too.
  const save = loadSave(store);
  const build = buildTag(knownLoadout(save, settings.species, settings.loadout), runRanks(save, settings.species));
  const entry: ScoreEntry = { floor: summary.floor, clockMs: Math.round(summary.clockMs ?? 0), mode: modeOfSeed(summary.seed, date), date, seed: summary.seed, species: settings.species, level: summary.level, ...tier, build };
  // Ranked on its own tier's board, which the end screen shows.
  const saved = saveScore(store, entry);
  return { entry, rank: saved.rank, board: tierBoard(saved.board, summary.difficulty) };
}

/** Starts a run: solo, a `?net=local` tab session, or the shared run of a lobby (`join`). */
async function play(root: HTMLElement, join?: NetJoin, dungeon: DungeonId = devDungeon(), seed?: number, trial?: TrialRun): Promise<void> {
  if (!sheets) {
    waitScreen(root, t('app.loading'));
    await sheetsReady();
  }
  // The HUD draws text in the pixel font on the canvas: it must be ready first.
  await document.fonts?.load(`${FONT.hudPx}px "${FONT.family}"`).catch(() => undefined);
  let shared: Pick<GameOptions, 'net' | 'seed' | 'startFloor' | 'dungeon' | 'testSpawns' | 'difficulty' | 'heraldSeed'> = { seed: seed ?? runSeed(), startFloor: devStartFloor(), dungeon, testSpawns: devSpawns(), difficulty: settings.difficulty };
  // `?boss=<seed>`: that herald on a Sima herald floor.
  const boss = devBoss();
  if (boss) shared = { ...shared, dungeon: 'eclipse-chasm', startFloor: boss.floor, heraldSeed: boss.seed };
  // A shrine trial: solo, its own arenas and tier, no dev overrides.
  if (trial) shared = { seed: seed ?? runSeed(), dungeon, difficulty: trial.request.difficulty };
  if (!join && !trial && netMode()) {
    waitScreen(root, t('net.connecting'));
    join = await connectLocal(root, shared.seed!, shared.startFloor ?? 1, dungeon);
  }
  if (join) {
    if (join.online && current !== join.session) return;
    current = join.session;
    // A guest plays the host's dungeon (an unknown id plays the first one).
    // ...and the host's tier (an older host sends none: easy).
    shared = { seed: join.seed, startFloor: join.floor, dungeon: dungeonById(join.dungeon).id, difficulty: join.difficulty ?? DEFAULT_DIFFICULTY, net: { session: join.session, role: join.role, localId: join.localId, keepSession: join.online } };
  }
  const online = join?.online ?? false;
  // A Senda chapter (each peer its own save; the tier is the run's): its cinematic first, alone.
  const story = trial ? null : storyRunOf(loadSave(store), dungeonById(shared.dungeon ?? dungeon), shared.difficulty ?? DEFAULT_DIFFICULTY);
  if (story && !shared.net && !devStoryDone()) await new Promise<void>((resolve) => storyCinematic(root, story, 'before', resolve));
  // The Sima's mouth (docs/sima-redesign.md §5.1): the first descent on this device, alone, after the villagers' pleas.
  const sima = !trial && dungeonById(shared.dungeon ?? dungeon).endless !== undefined;
  if (sima && !shared.net && !hasSeenSimaScene(store, 'mouth')) await new Promise<void>((resolve) => {
      if (!simaScene(root, 'mouth', { species: settings.species }, resolve, false)) resolve();
    });
  const canvas = h('canvas', { className: 'game' });
  show(root, [canvas], false);
  root.querySelector('.notice')?.classList.add('in-game');
  running = startGame(canvas, sheets!, {
    species: trial?.pick.species ?? settings.species,
    // Only moves the species knows reach a run (the tutor's, once bought); its Mejoras go with it.
    loadout: knownLoadout(loadSave(store), trial?.pick.species ?? settings.species, trial?.pick.loadout ?? settings.loadout),
    lockType: settings.lockType,
    clickToLock: settings.clickToLock,
    upgrades: loadSave(store).upgrades,
    ...ranksOf(trial?.pick.species ?? settings.species),
    ...shared,
    ...(devStartClock() !== undefined ? { startClockMs: devStartClock() } : {}),
    ...(trial ? { trial: trial.request.stops } : {}),
    audio,
    onToggleMute: () => update({ muted: !settings.muted }),
    touch: { autoAim: () => settings.autoAim, haptics: () => settings.haptics },
    openMenu: (actions, held) => openPauseMenu(root, { get: () => settings, update, setLanguage: applyLanguage }, actions, held),
    // Quitting from the Esc menu goes back to the town too (`returnPlace('quit')`).
    onQuit: () => (trial?.from === 'room' ? backToRoom(root) : trial ? shrineScreen(root, trial.from, viewOf(trial.request), trial.request.id) : townScreen(root)),
    playCinematic: (request, onDone) => guardianCinematic(root, request, onDone),
    ...(story ? { story } : {}),
    onHeraldMet: (seed, name) => void recordHerald(store, { seed, name }),
    playHeraldIntro: (def, onDone) => heraldCinematic(root, def, onDone),
    // The Sima as this player remembers it (names only; every peer reads its own: app/sima-lore.ts).
    ...(sima
      ? {
          figurations: () => figurationMode(settings.figurations, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
          simaMemory: readSimaMemory(store),
          simaScenes: { seen: (id: SimaSceneId) => hasSeenSimaScene(store, id), play: (id: SimaSceneId, info: SimaSceneInfo, onDone: () => void) => simaScene(root, id, info, onDone, true) },
        }
      : {}),
    onEnd: (result, summary) => {
      // The host left mid-run: the room is gone, this peer goes back to the hub alone (after being paid below).
      if (summary.cutShort === 'hostLeft') leaveNet();
      // A shrine trial keeps its own records and never counts as a run (no dungeon records, no run coins).
      if (trial && summary.trial) return trialEnd(root, trial, result, summary);
      // Solo and hosted runs count for the notice board; a guest's run is the host's.
      if (shared.net?.role !== 'guest') saveRun(store, { dungeon: summary.dungeon, floor: summary.floor, level: summary.level, species: settings.species, victory: result === 'victory', difficulty: summary.difficulty });
      // Every peer earns its own Pokémonedas, guests too.
      earnCoins(store, summary.coins.total);
      // A challenge dungeon's victory pays its line's materials of the run's tier, to every peer that owns the line.
      const before = loadSave(store);
      const save = earnChallengeReward(store, dungeonById(summary.dungeon), result === 'victory', summary.difficulty);
      const materials = materialsEarned(dungeonById(summary.dungeon), summary.difficulty, before, save, t);
      // Achievements: every peer settles its own run on its own save (app/progress.ts); new ones pay into the balance shown.
      const progress = recordRun(store, runReport(summary, result, settings.species), Date.now());
      achievementToast(progress.unlocked);
      // The Sima del Eclipse: every peer keeps its own leaderboard (guests too: it is their score).
      // A run the host cut short never reached its end: no score.
      const score = summary.clockMs !== undefined && !summary.cutShort ? endlessScore(summary) : undefined;
      // A won Senda chapter is closed (its bond line shows at Phantump's), and alone its closing cinematic plays first.
      recordStory(store, story, result === 'victory' && !summary.cutShort);
      const results = () => resultScreen(root, result, summary, online, progress.save.coins, score, materials);
      if (story && result === 'victory' && !shared.net) return storyCinematic(root, story, 'after', results);
      // The Sima, alone: the first run lost or defeated, the breaking point and the waking with Phantump; after any other run, the return.
      const id = sima && !shared.net ? simaEndScene({ result, cutShort: summary.cutShort !== undefined, seenLost: hasSeenSimaScene(store, 'lost'), seenReturn: hasSeenSimaScene(store, 'return') }) : null;
      if (id) {
        if (!simaScene(root, id, { species: settings.species, floor: summary.floor }, results, false)) results();
        return;
      }
      results();
    },
  });
}

/** Where the town opens: a map of the overworld and a tile on it (the hub's spawn when absent). */
type TownPlace = Pick<TownOptions, 'at' | 'tile' | 'startWindow'>;

/** Development server only: `&coins=N` sets the saved balance (smoke tests of the stalls). */
function devCoins(): void {
  const coins = Number(new URLSearchParams(window.location.search).get('coins'));
  if (coins > 0) writeSave(store, { ...loadSave(store), coins });
}

/** Development server only: `&storySkip=1` starts a Senda run without its opening cinematic. */
function devStoryDone(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('storySkip') === '1';
}

/** Development server only: the `map`, `tile` and `window` (travel or menu) query of `?screen=town` (window: travel, menu or account). */
function devTownPlace(): TownPlace {
  const params = new URLSearchParams(window.location.search);
  const [x, y] = (params.get('tile') ?? '').split(',').map(Number);
  const at = (params.get('map') ?? undefined) as TownOptions['at'];
  const window_ = params.get('window');
  const startWindow = window_ === 'travel' || window_ === 'menu' || window_ === 'account' || window_ === 'gallery' ? window_ : undefined;
  return { ...(at ? { at } : {}), ...(Number.isFinite(x) && Number.isFinite(y) && params.get('tile') ? { tile: { x: x!, y: y! } } : {}), ...(startWindow ? { startWindow } : {}) };
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
  const summary: RunSummary = { dungeon: devDungeon(), floor: 4, seed: runSeed(), level: 6, items: ['leftovers', 'scope-lens', 'leftovers', 'focus-sash'], coins, difficulty: settings.difficulty };
  const screens: Record<string, () => void> = {
    loadout: () => loadout(root),
    dungeons: () => chooseDungeon(root, () => titleScreen(root)),
    // `&line=mimikyu&chapter=1&phase=before&at=ms`: a Senda chapter's cinematic over the title.
    story: () =>
      void sheetsReady().then(() => {
        const params = new URLSearchParams(window.location.search);
        const chapter = Math.min(3, Math.max(1, Number(params.get('chapter') ?? 1))) as 1 | 2 | 3;
        const story: StoryRun = { line: (params.get('line') ?? 'mimikyu') as StoryRun['line'], chapter };
        storyCinematic(root, story, params.get('phase') === 'after' ? 'after' : 'before', () => titleScreen(root));
      }),
    // `&scene=lost&at=ms&species=cubone&floor=23&sprite=haunter&known=1`: a Sima cinematic (data/sima-scenes.ts), seen or not.
    sima: () =>
      void sheetsReady().then(() => {
        const params = new URLSearchParams(window.location.search);
        const sprite = params.get('sprite');
        const info: SimaSceneInfo = {
          species: (params.get('species') ?? settings.species) as SpeciesId,
          floor: Number(params.get('floor') ?? 12),
          ...(sprite ? { other: { sprite, known: params.get('known') === '1' } } : {}),
        };
        simaScene(root, (params.get('scene') ?? 'mouth') as SimaSceneId, info, () => titleScreen(root), false, { startMs: Number(params.get('at') ?? 0) });
      }),
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
    // Mimikyu's gacha stall and Phantump's evolutions on their own (back goes to the title); `&coins=1000` first sets the balance (smoke tests).
    gacha: () => {
      devCoins();
      show(root, [gachaWindow({ store, sheets: sheetsReady(), play: (sound) => audio.play(sound), onBack: () => titleScreen(root) }).element]);
    },
    evolve: () => {
      devCoins();
      show(root, [evolveWindow({ store, play: (sound) => audio.play(sound), onEvolved: followEvolution, onChallenges: () => devScreenChallenges(root), onBack: () => titleScreen(root) }).element]);
    },
    // The achievements window and the notice board's missions on their own (back goes to the title).
    achievements: () => achievementsScreen(root),
    board: () => {
      devCoins();
      const board = (): void => show(root, [missionBoardWindow({ store, now: () => Date.now(), play: (sound) => audio.play(sound), onAchievements: () => show(root, [achievementsWindow({ store, onBack: board }).element]), onBack: () => titleScreen(root) }).element]);
      board();
    },
    // The challenges menu on its own, as from the town (choosing one goes to its loadout).
    challenges: () => devScreenChallenges(root),
    // Smeargle's move tutor on its own (back goes to the title).
    tutor: () => {
      const tutor = tutorWindow({ store, species: settings.species, cleared: cleared(), play: (sound) => audio.play(sound), onBack: () => titleScreen(root) });
      show(root, [tutor.element]);
    },
    // `&view=gauntlets` (or reflections, heralds): the Santuario de los Juramentos.
    shrine: () => shrineScreen(root, 'title', (new URLSearchParams(window.location.search).get('view') ?? undefined) as ShrineView | undefined),
    online: () => onlineScreen(root),
    account: () => accountScreen(root, () => titleScreen(root)),
    // `&guest=1`: join the preview room instead of creating it (two windows walk the town together).
    lobby: () => void openLobby(root, 'K7M2Q', new URLSearchParams(window.location.search).get('guest') !== '1', () => new BroadcastChannelTransport()),
    victory: () => resultScreen(root, 'victory', summary, false, loadSave(store).coins),
    endless: () => enterDungeon(root, 'eclipse-chasm', () => titleScreen(root)),
    // `&dungeon=toxic-swamp&floor=5&seed=3` (or `flooded-caves`): straight into a run of that dungeon (any of the story dungeons), with the saved loadout.
    run: () => void sheetsReady().then(() => enterDungeon(root, devDungeon(), () => titleScreen(root))),
    // The Sima's end screen with a sample score (recorded on this device's board, like a real one).
    eclipse: () => {
      const simaEvents = [
        { floor: 3, kind: 'crystal', outcome: 'taken' },
        { floor: 4, kind: 'shrine', outcome: 'accepted' },
        { floor: 7, kind: 'waves', outcome: 'cleared' },
        { floor: 9, kind: 'nest', outcome: 'destroyed' },
      ] as const;
      const run = { ...summary, dungeon: 'eclipse-chasm' as const, floor: 12, level: 9, clockMs: 0, seed: endlessSeed('daily', today(), 0), coins: { ...coins, multiplier: 0.5, total: 78 }, simaEvents };
      resultScreen(root, 'eclipse', run, false, loadSave(store).coins, endlessScore(run));
    },
    defeat: () =>
      resultScreen(root, 'defeat', { ...summary, floor: 2, level: 3, items: [], coins: { ...coins, escapes: 0, guardian: 0, time: 6, subtotal: 83, share: 0.75, total: 62 } }, false, loadSave(store).coins),
    // Waits for the sprites so a screenshot shows the silhouettes.
    prologue: () => void sheetsReady().then(() => prologue(root, () => titleScreen(root), Number(new URLSearchParams(window.location.search).get('at')) || 0)),
  };
  // `?boss=<seed>`: straight into that herald's fight.
  if (devBoss()) {
    applyLanguage(settings.language);
    void play(root, undefined, 'eclipse-chasm');
    return true;
  }
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
