import { glyphSvg, type Glyph } from '../town/town-map-view';
import { markTutorialSeen, tutorialSeen } from './tutorial';
import { figurationMode } from '../adapters/figurations';
import { fullscreenSupported, isFullscreen, toggleFullscreen } from '../ui/fullscreen';
import { devHeraldFloor } from '../core/herald/floor';
import { hasMet } from '../town/bestiary';
import { composeHeraldIntro, heraldIntroMode } from '../ui/herald-intro';
import { drawHeraldScene } from '../adapters/herald-scenes';
import type { HeraldDef } from '../data/herald';
import { readBestiary, recordHerald } from '../town/bestiary';
import { beatenBosses, gauntletReward, readShrine, saveTrial, trialBest, type TrialBest } from '../town/shrine-records';
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
import { sceneLayers } from '../ui/scene';
import { applyTokens, FONT } from '../ui/tokens';
import { h, mdWindow, statLine } from '../ui/window';
import { creditsWindow } from './credits';
import { endModel } from './end-model';
import { endScreen, endVeil } from './end-screen';
import { APP_VERSION, buildLabel } from './build-info';
import { markVersionSeen, patchNotesDue, patchNotesWindow, readLastSeenVersion } from './patch-notes';
import { setupAccount } from './account-screen';
import { openAccountDrawer } from './account-drawer';
import { createAuthFlow } from './auth-flow';
import { clerkFromEnv } from '../adapters/clerk-auth';
import { startGame, type GameOptions, type GameResult, type RunningGame, type RunSummary } from './game';
import { heldItems } from './item-pick';
import { loadoutScreen, portrait, typeBadge, type LineGender, type ShinySkins } from './loadout';
import { CHANGELOG, CHANGELOG_SECTIONS } from '../data/changelog';
import { openPauseMenu } from './menu';
import { prologueScreen, type PrologueOptions } from './prologue';
import { readSimaMemory } from './sima-lore';
import { hasSeenSimaScene, markSimaSceneSeen, simaEndScene, simaPanels, simaPleaDue, simaSceneSkipped, simaText, type SimaSceneInfo } from './sima-cinematic';
import { drawSimaScene, type SimaPanel } from '../adapters/sima-scenes';
import type { SimaSceneId } from '../data/sima-scenes';
import { hasSeenPrologue, markPrologueSeen } from './prologue-seen';
import { galleryGroups, type GalleryScene } from './lore-gallery';
import { galleryView } from './gallery-view';
import { readGallerySeen } from './gallery-seen';
import { quizScreen } from './quiz-screen';
import { welcomeScreen } from './welcome-screen';
import { afterWelcome, bootRoute, clearOnboarding, readOnboarding, writeOnboarding, type OnboardingStep } from './onboarding';
import { hasProgress, nextAdventureScreen, nextOnlineScreen, nextPlayScreen, townOpen, townTourDue } from './adventure-route';
import { optionsAboutKey, optionsEntries, TITLE_LABEL, type OptionsEntry } from './title-menu';
import { hubButtons, type HubId } from './title-hub';
import { titleHub } from './title-hub-view';
import { menuWindow } from '../ui/menu-window';
import { defaultSettings, loadSettings, saveSettings, touchPrefsOf, withReturningPlayer, withSpecies, withStarter, type Settings } from './settings';
import { type SettingsAccess } from './settings-panel';
import { settingsView } from './settings-view';
import { openTown, type TownHandle, type TownOptions } from '../town/scene';
import { clearResume, createResumeWriter, newRunId, readResume, storedOwner, townRecord, writeResume, type ResumeRecord, type RunLaunch } from './run-resume';
import { pleaReady } from '../town/plea';
import { hasSeenTour, markTourSeen } from '../town/tour';
import { globalRankingLines, globalRankingSource } from '../town/global-ranking';
import { apiBaseUrl, httpAccountApi } from '../adapters/account-api';
import { fetchIceServers } from '../adapters/turn';
import { sendReport } from '../adapters/report-api';
import { deviceSummary, reportWindow } from './report-screen';
import { installDismiss } from '../ui/dismiss';
import { adminAccess, ticketsWindow } from './tickets-screen';
import { friendsHeartbeat, type Heartbeat } from './friends-screen';
import { friendsWindow } from './friends-window';
import { httpFriendsApi } from '../adapters/friends-api';
import { httpAdminApi } from '../adapters/admin-api';
import { createGamepads } from '../adapters/gamepad';
import { controlsWindow, initialStyle as savedPadStyle } from './gamepad-help';
import { profilePublisher } from './profile-publish';
import { roomStatus, versionNotice, type TownLobby } from '../town/lobby';
import { displayName, isPublicNickname, sanitizeNickname } from '../net/nickname';
import { clearedDungeons, readRecords, saveRun } from '../town/records';
import { dungeonById, ECLIPSE, TUTORIAL, tierFor, guardianOf, type ChallengeLine, type DungeonDef, type DungeonId } from '../data/dungeons';
import { facePortrait } from '../adapters/portrait';
import { partnerPlate } from './partner-plate';
import { lineRoot } from '../data/player-evolutions';
import { needsDungeonSelect, unlockedDungeons } from '../core/dungeon-select';
import { dungeonSelectScreen } from './dungeon-select';
import { GUARDIAN_CINEMATICS, type CinematicPhase } from '../data/guardian-cinematics';
import { drawGuardianScene } from '../adapters/guardian-scenes';
import { cinematicMode, cinematicPanels, hasSeen, markSeen } from './guardian-cinematic';
import { SPECIES, type SpeciesId } from '../data/species';
import type { MoveId } from '../data/moves';
import { parseSpawnList } from '../core/test-floor';
import { unlockEverything, veteranProfile } from './dev-unlock';
import { earnChallengeReward, earnCoins, loadSave, SAVE_KEY, setFemaleAt, wearShinyAt, writeSave } from './save';
import { gachaWindow } from './gacha';
import { gachaPage } from './gacha-page';
import { gachaUrl, isGachaPath, leaveUrl } from './gacha-route';
import { missionBoardWindow } from './board';
import { achievementsWindow, achievementToast, holdToasts, releaseToasts } from './achievements';
import { recordPast, recordRun, recordSave } from './progress';
import { runReport } from '../core/run-report';
import { evolveWindow } from './evolve';
import { challengeMisfits, openChallenges } from '../core/challenge';
import { lineOf } from '../core/evolution';
import { challengesWindow } from './challenges';
import { bondLine, recordStoryScene, recordStory, STORY_SKIP_AFTER_MS, storyPanels, storyRunOf, type StoryPanel, type StoryPhase } from './story';
import { drawStoryScene } from '../adapters/story-scenes';
import { sendaTier, sendaTierOpen, type StoryRun } from '../core/story';
import { shopWindow } from './shop';
import { buildHint } from './tutor';
import { tutorWindow } from './tutor-screen';
import { buildTag, knownLoadout, knownMoves, runRanks } from '../core/tutor';
import { awakenedOf, currentForm, rosterOf } from '../core/collection';
import { isFemale } from '../core/gender';
import { hasShiny, wearsShiny } from '../core/shiny';
import { coinLines } from './coin-lines';
import { isTouchUi, setTouchMode, setTouchPrefs } from '../adapters/touch-mode';
import { buildDiagnostics, createDiagnosticsLog, diagnosticsText, type Diagnostics } from './diagnostics';
import { isLinkProbe } from '../net/diagnostics';
import { PROTOCOL_VERSION } from '../net/version';
import { installTouchChrome } from '../ui/touch-chrome';
import { notices, setNoticesBlocked } from '../ui/notice';
import { setupPwa } from '../ui/pwa';
import { newsNotice } from '../pwa/notices';
import { endActions, endHeading, hostGoneRoute, materialsEarned, returnPlace, roomGone, victoryLine, townOf, type ReturnPlace } from './after-run';
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
/** Redraws the open account drawer in place; declared before the account, whose start may report a change at once. */
let accountRedraw: (() => void) | null = null;
/** The account drawer opened from the welcome gate, while it is open: a cloud profile arriving closes it and routes on (onboarding.ts). */
let onboardingDrawer: { close(): void } | null = null;
/** One client for the public calls (Sima ranking, public profile); the account keeps its own. */
const publicApi = httpAccountApi(apiBaseUrl(import.meta.env.VITE_API_URL));
/** The account's public profile (nickname + species) for the Sima global ranking; written after each sync, only with a valid nickname. */
const publicProfile = profilePublisher({ api: publicApi, nickname: () => settings.nickname, species: () => settings.species });
// Accounts (src/app/account-screen.ts): the game's store is the device store, observed so a signed-in player's save writes reach the cloud.
/** The tickets inbox while it is open, and whose it is. */
let openTickets: { email: string | null; leave(): void } | null = null;
/** The friends window while it is open, and whose it is. */
let openFriends: { email: string | null; leave(): void } | null = null;
/** Tells the server this account is here (app/friends-screen.ts); set right after the account, whose start may report a change at once. */
let friendsBeat: Heartbeat | null = null;
const signedInEmail = (): string | null => {
  const state = account.state();
  return state.kind === 'signed-in' ? state.email : null;
};
const { account, store } = setupAccount({
  store: browserStore(),
  onSynced: (session) => publicProfile.synced(session),
  notify: (text) => {
    const app = document.getElementById('app');
    if (app) toast(app, text);
  },
  // Sync moved (status, a choice, another tab): a signed-in account screen shows it at once; the title redraws for a replaced profile.
  onChange: () => {
    // The inbox is for the account that opened it: logging out, here or in another tab, closes it.
    if (openTickets && openTickets.email !== signedInEmail()) openTickets.leave();
    if (openFriends && openFriends.email !== signedInEmail()) openFriends.leave();
    friendsBeat?.sync();
    accountRedraw?.();
  },
  onReplaced: () => {
    // The picked species must still be in the (possibly new) roster.
    settings = loadSettings(store, settings, rosterOf(loadSave(store)));
    const app = document.getElementById('app');
    // A walker that arrived with the cloud profile ends the onboarding: the welcome's drawer closes and routes on, any other step re-checks.
    if (onboardingDrawer) onboardingDrawer.close();
    else if (app?.querySelector('.ob')) onboardingGate(app);
    if (app?.querySelector('.title-logo')) titleScreen(app);
  },
});
/** The controller, for the whole page: every screen hears it as keys, a run takes it over (adapters/gamepad.ts). */
const gamepads = createGamepads({
  onConnect: () => {
    const app = document.getElementById('app');
    if (app) toast(app, t('gamepad.connected'));
  },
});
/** Sign-in for the account drawer: Clerk when the build has a publishable key, else the password endpoints (app/auth-flow.ts). */
const authFlow = createAuthFlow({ clerk: clerkFromEnv(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY, window.location.origin), account });
const adminApi = httpAdminApi(apiBaseUrl(import.meta.env.VITE_API_URL));
const friendsApi = httpFriendsApi(apiBaseUrl(import.meta.env.VITE_API_URL));
const ticketAdmin = adminAccess({ token: () => account.token(), isAdmin: (token) => adminApi.isAdmin(token) });
let settings: Settings = loadSettings(store, defaultSettings(detectLanguage(navigator.language)), rosterOf(loadSave(store)));
/** The in-game control hint bar (src/ui/play-hints.ts), for the town and the runs: the Settings switch and the pad layout last chosen. */
const playHints = { enabled: () => settings.showHints, padStyle: savedPadStyle };
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
    // The title is the hub now (its logo is `.hub-logo`); a window open over it stays.
    if (app?.querySelector('.title-logo, .hub-logo') && !app.querySelector('.town-shop')) titleScreen(app);
  },
});
if (import.meta.env.DEV) void import('./dev-notices').then((dev) => dev.queueDevNotices(window.location.search));
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
// iOS Safari only lets a context start or resume on the end of a touch (or a click), not on its start.
window.addEventListener('touchend', unlockAudio);
window.addEventListener('click', unlockAudio);
// Phones: switching apps or locking the screen suspends the audio (music and loops); it resumes when the page is back.
document.addEventListener('visibilitychange', () => audio.setBackground(document.hidden));
// F1 opens the browser's help in another tab (ticket SD-LJJ7QL): the game never wants it, in menus or the town either.
window.addEventListener('keydown', (e) => {
  if (e.code === 'F1') e.preventDefault();
});
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
let room: { session: NetSession; code: string; asHost: boolean; seed: number; from: OnlineFrom; openedAt: number; turnServers: number } | null = null;
// The heartbeat reads the room above, so it starts here.
friendsBeat = friendsHeartbeat({
  session: () => {
    const token = account.token();
    const who = signedInEmail();
    return token && who ? { who, token } : null;
  },
  room: () => room?.code ?? null,
  visible: () => !document.hidden,
  send: (token, code) => void friendsApi.presence(token, code),
  start: (tick, ms) => setInterval(tick, ms),
  stop: (timer) => clearInterval(timer as ReturnType<typeof setInterval>),
});
friendsBeat.sync();
document.addEventListener('visibilitychange', () => friendsBeat?.sync());

/**
 * The technical report (issue #6, src/app/diagnostics.ts): the page's recent
 * errors and room transitions, kept in memory only. It leaves the browser
 * only inside a bug report with "Adjuntar información técnica" on, or when
 * the player copies it from the room menu.
 */
const diagLog = createDiagnosticsLog(() => performance.now());
window.addEventListener('error', (e) => diagLog.error(e.error ?? e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => diagLog.error(e.reason));

/** Copies the technical report, pretty-printed, to the clipboard, and says whether it worked. */
async function copyReport(root: HTMLElement): Promise<void> {
  try {
    const text = diagnosticsText(await collectDiagnostics());
    if (!navigator.clipboard) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    toast(root, t('lobby.reportCopied'));
  } catch {
    toast(root, t('lobby.reportCopyFailed'));
  }
}

/** Where the player is, in a word, for the report. */
function screenContext(): string {
  if (running) return 'run';
  const town = document.querySelector('canvas.town') !== null;
  if (room) return town ? 'room town' : 'room';
  return town ? 'town' : document.querySelector('.title-menu') ? 'title' : 'menu';
}

/** The snapshot of this session now: build, screen, run, recent errors and, in a room, the connection. */
async function collectDiagnostics(): Promise<Diagnostics> {
  const session = room?.session ?? current;
  const r = room;
  const coop = session
    ? {
        session: session.diagnostics(),
        roomStatus: r ? roomStatus({ isHost: r.asHost, admitted: session.roster().some((e) => e.peer === session.peerId()), held: session.held(), waitedMs: Date.now() - r.openedAt }) : 'local',
        turnServers: r?.turnServers ?? 0,
        links: await session.links().catch(() => ({})),
        linkEvents: session.linkEvents(),
      }
    : undefined;
  return buildDiagnostics({
    build: buildLabel(),
    protocol: PROTOCOL_VERSION,
    lang: getLanguage(),
    touch: isTouchUi(),
    screen: screenContext(),
    ...(running ? { run: running.info() } : {}),
    errors: diagLog.errors(),
    transitions: diagLog.transitions(),
    ...(coop ? { coop } : {}),
  });
}

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
  const session = createSession({ transport, scheduler, build: buildLabel(), ...(isLinkProbe(base) ? { probe: base } : {}), ...(Number.isFinite(delay) ? { renderDelayMs: Math.max(0, delay) } : {}) });
  // The host left, or its link stayed down past the grace window: a run still going ends here, paid as a defeat
  // (its end screen says why: left, or the connection was lost); elsewhere a message saying so and the way back to the menu.
  session.onHostLeft((why) => {
    if (current !== session) return;
    const route = hostGoneRoute(why, running !== null);
    if ('cut' in route) return running?.cutShort(route.cut);
    messageScreen(root, t(route.message), returnPlace('lobby'));
  });
  // The link to the host dropped: a line stays on screen while the session waits for it (the guest's run stands still meanwhile).
  let reconnectLine: HTMLElement | null = null;
  session.onReconnecting((on) => {
    reconnectLine?.remove();
    reconnectLine = null;
    if (!on || current !== session) return;
    reconnectLine = h('p', { className: 'net-toast', textContent: t('net.reconnecting') });
    reconnectLine.setAttribute('role', 'status');
    root.append(reconnectLine);
  });
  return session;
}

// Closing or reloading the page leaves the room out loud (best effort), so the others free its slot at once
// instead of holding it for a dropped link's grace window (net/session.ts PEER_GRACE_MS). A page kept in the
// back/forward cache (`persisted`) may come back, so it keeps its session.
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  current?.leave();
  if (room && room.session !== current) room.session.leave();
});

function leaveNet(): void {
  current?.leave();
  if (room && room.session !== current) room.session.leave();
  current = null;
  room = null;
  friendsBeat?.sync();
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
 * `freeze`: an end-of-run dialog keeps the run's last frame (dimmed by its veil) and never the backdrop (ui/scene.ts).
 */
function show(root: HTMLElement, children: Node[], backdrop = true, music: MusicContext = 'title', freeze = false): void {
  const frame = freeze && running ? root.querySelector<HTMLCanvasElement>('canvas.game') : null;
  const layers = sceneLayers(backdrop ? 'title' : 'game', frame !== null);
  if (running) {
    // Stopping the game leaves its session, unless it is the room's (back to the town together).
    running.stop();
    running = null;
    if (current !== room?.session) current = null;
  }
  if (backdrop || freeze) audio.setMusic(music);
  frame?.classList.add('is-frozen');
  root.replaceChildren(...(layers.frozenGame && frame ? [frame] : []), ...(layers.backdrop ? [eclipseBackdrop()] : []), ...children, notice());
  if (layers.frozenGame) root.querySelector('.notice')?.classList.add('in-game');
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

/**
 * The title hub (owner, 2026-11-03; odd/tasks/title-hub.md): relic buttons
 * round the screen, the partner on its altar and one dominant Play. Town
 * services open as the same windows the town uses, over the scene; full
 * screens (Pokémon, shrine, credits...) come back here with their button
 * focused. Supersedes the three-entry title (2026-10-26).
 */
function titleScreen(root: HTMLElement, initial?: HubId | number): void {
  leaveNet();
  applyLanguage(settings.language);
  // A profile with no walker never sees the hub: the welcome gate and the onboarding come first (app/onboarding.ts).
  if (onboardingGate(root)) return;
  if (patchNotesOnBoot(root)) return;
  const save = loadSave(store);
  const records = readRecords(store);
  const back = (id: HubId) => () => titleScreen(root, id);
  /** A town window over the hub; closing it redraws the hub (coins, language and partner may have changed). */
  const overlay = (id: HubId, open: (parent: HTMLElement, onClose: () => void, depart: (dungeon: string) => void) => () => void) => {
    let close = () => {};
    close = open(root, () => {
      close();
      titleScreen(root, id);
    }, (dungeon) => {
      close();
      newAdventure(root, dungeonById(dungeon).id);
    });
  };
  const action: Record<HubId, () => void> = {
    play: () => playScreen(root),
    online: () => onlineEntry(root),
    pokemon: () => pokemonScreen(root, back('pokemon')),
    tutor: () => overlay('tutor', townTutor),
    evolve: () => overlay('evolve', townEvolve),
    gacha: () => openGachaPage(root, 'hub'),
    shop: () => overlay('shop', townShop),
    board: () => overlay('board', townBoard),
    challenges: () => overlay('challenges', townChallenges),
    achievements: () => overlay('achievements', townAchievements),
    settings: () => overlay('settings', townSettings),
    controls: () => overlay('controls', townControls),
    account: () => overlay('account', townAccount),
    friends: () => overlay('friends', (parent, onClose) => townFriends(root)(parent, onClose, (go) => go())),
    gallery: () => overlay('gallery', (parent, onClose) => townGallery(root)(parent, onClose, null)),
    shrine: () => shrineScreen(root, 'title'),
    news: () => newsScreen(root, back('news')),
    fullscreen: () => void toggleFullscreen(),
    prologue: () => prologue(root, back('prologue')),
    credits: () => creditsScreen(root),
    report: () => reportScreen(root, back('report')),
    install: () => pwa.install(root),
    tickets: () => ticketsScreen(root, back('tickets')),
  };
  const state = { townOpen: townIsOpen(), starterChosen: settings.starterChosen, newsUnseen: readLastSeenVersion(store) !== APP_VERSION, installable: pwa.offer() !== 'none', ticketAdmin: ticketAdmin.known() };
  const playLine = t(!settings.starterChosen ? 'title.play.first' : state.townOpen ? 'title.play.town' : 'title.play.path');
  const species = settings.species;
  const best = Math.max(0, ...Object.values(records.dungeons).map((d) => d.bestFloor));
  const latest = CHANGELOG[0];
  const latestItem = latest ? CHANGELOG_SECTIONS.map((section) => latest.sections[section]?.[0]).find(Boolean) : undefined;
  const view = titleHub({
    buttons: hubButtons(state),
    onPick: (id) => action[id](),
    partner: settings.starterChosen
      ? (() => {
          const plate = partnerPlate(species, bondLine(save, lineRoot(species) as ChallengeLine)?.level ?? null);
          return {
            portrait: portrait(sheetsReady(), species, 5, skinOn(), femaleOn()),
            name: t(plate.nameKey),
            badges: plate.types.map(typeBadge),
            ...(plate.passiveKey ? { passive: { name: t(plate.passiveKey), description: t(`${plate.passiveKey}.description`) } } : {}),
            ...(plate.bond ? { bond: t('hub.partner.bond').replace('{n}', String(plate.bond)) } : {}),
          };
        })()
      : null,
    profile: {
      name: settings.nickname || t('hub.wanderer'),
      portrait: settings.starterChosen ? facePortrait(species, { size: 60, shiny: skinOn(), female: femaleOn(), sheets: sheetsReady() }) : null,
      line: records.runs > 0 ? t('hub.record').replace('{floor}', String(best)).replace('{runs}', String(records.runs)) : t('hub.record.none'),
    },
    coins: save.coins,
    playLine,
    news: latest && latestItem ? { version: latest.version, line: latestItem[getLanguage() === 'en' ? 'en' : 'es'] } : null,
    buildLabel: buildLabel(),
    touch: isTouchUi(),
    ...(typeof initial === 'string' ? { initial } : {}),
  });
  show(root, [view.element]);
  pwa.banner(root);
  if (!state.ticketAdmin) {
    void ticketAdmin.check().then((admin) => {
      if (admin && view.element.isConnected && !root.querySelector('.town-shop')) titleScreen(root, typeof initial === 'string' ? initial : undefined);
    });
  }
}

/** The patch notes are checked once per page load, on the first title reached (never over the prologue, the quiz or a cinematic). */
let patchNotesChecked = false;

/**
 * Queues the "Novedades" notice once after an update to a version this
 * browser has not seen (src/app/patch-notes.ts); a brand-new install only
 * records the version. The seen flag is written here, as before; the title is
 * always drawn (false), the notice shows over it when the queue allows.
 */
function patchNotesOnBoot(root: HTMLElement): boolean {
  if (patchNotesChecked) return false;
  patchNotesChecked = true;
  const returningPlayer = settings.starterChosen || hasSeenPrologue(store) || hasProgress(loadSave(store), readRecords(store));
  const due = patchNotesDue({ lastSeen: readLastSeenVersion(store), current: APP_VERSION, returningPlayer });
  if (due === 'none') return false;
  markVersionSeen(store, APP_VERSION);
  if (due === 'record') return false;
  // The notes are a system notice over the hub now (queued after an update or install notice); "Ver novedades" opens the screen.
  const release = CHANGELOG.find((entry) => entry.version === APP_VERSION);
  if (release) notices.enqueue(newsNotice(release, () => newsScreen(root, () => titleScreen(root))));
  return false;
}

/** "Novedades": every release's notes, newest first; `back` leaves it. */
function newsScreen(root: HTMLElement, back: () => void): void {
  show(root, [patchNotesWindow(single(t('menu.back'), back))]);
}

/** The title's "Opciones": settings, account, achievements, patch notes, prologue, credits, the bug report and the install offer, in the shared described menu. */
function optionsScreen(root: HTMLElement, at: OptionsEntry | 'report' | 'controls' | 'friends' | 'tickets' = 'settings'): void {
  const entries = optionsEntries(pwa.offer() !== 'none');
  const action: Record<OptionsEntry, () => void> = {
    settings: () => settingsScreen(root),
    account: () => accountScreen(root, () => optionsScreen(root, 'account')),
    achievements: () => achievementsScreen(root),
    news: () => newsScreen(root, () => optionsScreen(root, 'news')),
    prologue: () => prologue(root, () => optionsScreen(root, 'prologue')),
    credits: () => creditsScreen(root),
    install: () => pwa.install(root),
  };
  // Grouped, each with its glyph (odd/tasks/menu-redesign.md S11): Partida, Perfil, Historia, Ayuda.
  type OptionRow = { id: OptionsEntry | 'report' | 'controls' | 'friends' | 'tickets'; label: string; about: string; glyph: Glyph; onConfirm: () => void; group?: string };
  const entry = (id: OptionsEntry, glyph: Glyph): OptionRow => ({ id, label: t(TITLE_LABEL[id]), about: t(optionsAboutKey(id)), glyph, onConfirm: action[id] });
  const has = (id: OptionsEntry) => entries.includes(id);
  const grouped: OptionRow[][] = [
    [entry('settings', 'settings'), { id: 'controls', label: t('title.controls'), about: t('options.about.controls'), glyph: 'controls', onConfirm: () => controlsScreen(root, () => optionsScreen(root, 'controls')) }],
    [entry('account', 'account'), entry('achievements', 'achievements'), { id: 'friends', label: t('title.friends'), about: t('options.about.friends'), glyph: 'friends', onConfirm: () => friendsScreen(root, () => optionsScreen(root, 'friends')) }],
    [entry('news', 'board'), entry('prologue', 'gallery'), entry('credits', 'title')],
    [
      // Players report problems from the game, anonymously (issue #9).
      { id: 'report', label: t('title.report'), about: t('options.about.report'), glyph: 'board', onConfirm: () => reportScreen(root, () => optionsScreen(root, 'report')) },
      ...(has('install') ? [entry('install', 'travel')] : []),
      // The server says who is an admin; a yes that arrives later redraws this menu below.
      ...(ticketAdmin.known() ? [{ id: 'tickets' as const, label: t('title.tickets'), about: t('options.about.tickets'), glyph: 'board' as const, onConfirm: () => ticketsScreen(root, () => optionsScreen(root, 'tickets')) }] : []),
    ],
  ];
  const groupKeys = ['options.group.game', 'options.group.profile', 'options.group.story', 'options.group.help'];
  const optionRows = grouped.flatMap((rows, g) => rows.map((row, i) => (i === 0 ? { ...row, group: t(groupKeys[g]!) } : row)));
  const open = menuWindow({
    title: t('title.options'),
    rows: optionRows.map((row) => ({ label: row.label, about: row.about, onConfirm: row.onConfirm, icon: glyphSvg(row.glyph), ...(row.group ? { group: row.group } : {}) })),
    back: { label: t('menu.back'), about: t('options.about.back'), onConfirm: () => titleScreen(root, 'settings') },
    className: 'options',
    initial: Math.max(0, optionRows.findIndex((row) => row.id === at)),
  });
  show(root, [open.element]);
  if (!ticketAdmin.known()) {
    void ticketAdmin.check().then((admin) => {
      if (admin && open.element.isConnected) optionsScreen(root, at);
    });
  }
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

/**
 * First-run onboarding (owner, 2026-11-04): welcome gate (account or guest) -> prologue -> questionnaire -> reveal -> the first run.
 * Each step writes where it got to (app/onboarding.ts) and comes back here, so a reload continues where the player was.
 * Returns true when it took the screen; false when the profile has a walker and the hub goes on.
 */
function onboardingGate(root: HTMLElement): boolean {
  adoptReturningPlayer();
  const stored = readOnboarding(store);
  const route = bootRoute({
    starterChosen: settings.starterChosen,
    hasProgress: hasProgress(loadSave(store), readRecords(store)),
    signedIn: account.state().kind === 'signed-in',
    prologueSeen: hasSeenPrologue(store),
    state: stored,
  });
  if (route === 'hub') {
    if (stored.step !== 'welcome' || stored.picks.length > 0 || stored.starter) clearOnboarding(store);
    setNoticesBlocked(false);
    return false;
  }
  // System notices (install, update, news) wait until the first-run flow reaches the hub.
  setNoticesBlocked(true);
  const go = (step: OnboardingStep, patch: Partial<ReturnType<typeof readOnboarding>> = {}): void => {
    writeOnboarding(store, { ...readOnboarding(store), ...patch, step });
    onboardingGate(root);
  };
  if (route === 'welcome') {
    welcome(root, () => go(afterWelcome(hasSeenPrologue(store))));
  } else if (route === 'prologue') {
    writeOnboarding(store, { ...stored, step: 'prologue' });
    prologue(root, () => go('quiz'));
  } else {
    const seed = stored.seed > 0 ? stored.seed : Math.abs(runSeed()) || 1;
    writeOnboarding(store, { ...stored, step: route, seed });
    const view = quizScreen({
      seed,
      sheets: sheetsReady(),
      touch: isTouchUi(),
      mode: 'onboarding',
      resume: { picks: stored.picks, starter: stored.starter },
      newSeed: () => Math.abs(runSeed()) || 1,
      onProgress: (progress) => writeOnboarding(store, progress),
      onDone: (starter) => {
        // An evolved starter plays as its current form.
        update(withStarter(settings, currentForm(loadSave(store), starter)));
        markPrologueSeen(store);
        clearOnboarding(store);
        playScreen(root);
      },
    });
    show(root, [view.element]);
  }
  return true;
}

/** The welcome gate: sign in (the account drawer), play as a guest, or take up the game this device already holds. */
function welcome(root: HTMLElement, asGuest: () => void): void {
  const openAccount = (): void => {
    const drawer = openAccountDrawer({
      account,
      flow: authFlow,
      parent: document.body,
      onGuest: asGuest,
      onClose: () => {
        accountRedraw = null;
        onboardingDrawer = null;
        // Signed in: a cloud walker goes to the hub, else the onboarding goes on. A sync choice still open (the cloud holds a game this device has not taken) waits here.
        if (account.state().kind === 'signed-in' && !account.pendingChoice()) onboardingGate(root);
      },
    });
    accountRedraw = drawer.redraw;
    onboardingDrawer = drawer;
  };
  welcomeOpenAccount = openAccount;
  const view = welcomeScreen({
    hasLocalSave: store.get(SAVE_KEY) !== null || account.backups().length > 0,
    touch: isTouchUi(),
    onAccount: openAccount,
    onGuest: asGuest,
    // A game kept on this device: it counts as chosen and the prologue as seen, as adoptReturningPlayer does for a profile with progress.
    onDevice: () => {
      markPrologueSeen(store);
      update(withReturningPlayer(settings, readRecords(store).lastSpecies, rosterOf(loadSave(store))));
      clearOnboarding(store);
      titleScreen(root);
    },
  });
  show(root, [view.element]);
}

/** Opens the welcome's account drawer (set while the welcome is up; the OAuth return uses it). */
let welcomeOpenAccount: (() => void) | null = null;

/** The title's "Jugar": the prologue and the quiz the first time (as before), then the town, where every run starts. */
function playScreen(root: HTMLElement): void {
  adoptReturningPlayer();
  const next = nextPlayScreen({ prologueSeen: hasSeenPrologue(store), starterChosen: settings.starterChosen, townOpen: townIsOpen() });
  if (next === 'prologue') prologue(root, () => playScreen(root));
  else if (next === 'quiz') quiz(root, () => playScreen(root), () => titleScreen(root, 0));
  // Like Hollow Knight's opening path, the way down to the town is the tutorial (odd/tasks/tutorial-dungeon.md S1): straight into it.
  else if (next === 'tutorial') enterDungeon(root, TUTORIAL.id, () => titleScreen(root, 0));
  else townScreen(root);
}

/** Whether the town is open on this device (adventure-route.ts `townOpen`: the tutorial dungeon or the Crypt cleared, or town progress already in the save). */
const townIsOpen = (): boolean => townOpen(cleared(), loadSave(store));

/** Where a solo run goes back to: the town once it is open, the title before (the next "Play" enters the tutorial dungeon again). */
const hub = (root: HTMLElement): void => (townIsOpen() ? townScreen(root) : titleScreen(root, 0));

/** The title's "Play online": the same first-time steps as Play, so a new player chooses a starter before reaching a room. */
function onlineEntry(root: HTMLElement): void {
  adoptReturningPlayer();
  const next = nextOnlineScreen({ prologueSeen: hasSeenPrologue(store), starterChosen: settings.starterChosen });
  if (next === 'prologue') prologue(root, () => onlineEntry(root));
  else if (next === 'quiz') quiz(root, () => onlineEntry(root), () => titleScreen(root, 1));
  else onlineScreen(root);
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
  // No achievement toast over it (the boot's catch-up one comes back after).
  holdToasts();
  const screen = prologueScreen({
    sheets: () => sheets,
    startMs,
    music: { start: (offsetS) => audio.playCue(PROLOGUE_MUSIC, offsetS), stop: () => audio.stopCue() },
    // Released however it goes away (ended, skipped, or replaced by another screen).
    onClose: releaseToasts,
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
  // In full on every attempt (owner, 2026-10-28), skippable from the first frame.
  const panels = storyPanels(story, phase, t);
  if (panels.length === 0) return onDone();
  recordStoryScene(store, story, phase);
  void sheetsReady();
  const screen = prologueScreen({
    sheets: () => sheets,
    panels,
    draw: (ctx, panel, time, camera, alpha) => drawStoryScene(ctx, panel as StoryPanel, time, camera, alpha),
    label: t(`story.${story.line}.${story.chapter}.title`),
    skipAfterMs: STORY_SKIP_AFTER_MS,
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

/** The questionnaire (Settings' retake, or the first-run steps reached through Play): its walker becomes the `species` setting. Not persisted: the onboarding gate has its own. */
function quiz(root: HTMLElement, then: () => void, cancel: () => void): void {
  const onDone = (starter: StarterId) => {
    // An evolved starter plays as its current form.
    update(withStarter(settings, currentForm(loadSave(store), starter)));
    then();
  };
  const view = quizScreen({ seed: runSeed(), sheets: sheetsReady(), touch: isTouchUi(), mode: settings.starterChosen ? 'retake' : 'onboarding', newSeed: runSeed, onDone, onCancel: cancel });
  show(root, [view.element]);
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
      difficulty: {
        // A Senda shows the tier its run will really play at, without touching the one remembered for other dungeons.
        value: dungeon ? sendaTier(dungeonById(dungeon), settings.difficulty, save.story) : settings.difficulty,
        onChange: (next) => update({ difficulty: next }),
        allowed: (d) => !dungeon || sendaTierOpen(dungeonById(dungeon), d, save.story),
      },
      onStart: () => (dungeon ? enterDungeon(root, dungeon, () => loadout(root, 'moves', dungeon)) : chooseDungeon(root, () => loadout(root, 'moves'))),
      // Runs start in the town now: the loadout's way back is the town.
      onBack: () => (stage === 'moves' ? loadout(root, 'species', dungeon) : townScreen(root)),
    }),
  ]);
}

function settingsScreen(root: HTMLElement, tab = 0): void {
  let current = tab;
  const access: SettingsAccess = {
    get: () => settings,
    update,
    setLanguage: (language) => {
      applyLanguage(language);
      settingsScreen(root, current);
    },
    preview: () => audio.play('click'),
  };
  const here = () => settingsScreen(root, current);
  // The shared Settings window (app/settings-view.ts); the profile actions sit in its footer.
  const view = settingsView({
    access,
    tab,
    onTab: (next) => (current = next),
    onBack: () => optionsScreen(root, 'settings'),
    actions: [
      { label: t('title.account'), icon: 'account', run: () => accountScreen(root, here) },
      { label: t('quiz.retake'), icon: 'title', run: () => quiz(root, here, here) },
    ],
  });
  show(root, [h('h1', { className: 'screen-title', textContent: t('title.settings') }), h('div', { className: 'screen-row' }, [view.element])]);
}

/**
 * "Reportar un problema" (issue #9): the anonymous report form, sent to the
 * game API. The version is attached only when the player keeps technical
 * info on, with the coarse device summary (browser / OS / touch) and this
 * session's diagnostics snapshot (issue #6), taken only at send time.
 */
function reportOptions(onBack: () => void) {
  return {
    store,
    version: buildLabel(),
    device: deviceSummary(navigator),
    diagnostics: collectDiagnostics,
    send: (report: Parameters<typeof sendReport>[1]) => sendReport(apiBaseUrl(import.meta.env.VITE_API_URL), report),
    onBack,
  };
}

/** "Controles del mando": what each button does. */
function controlsScreen(root: HTMLElement, back: () => void): void {
  const open = controlsWindow(() => {
    open.dispose();
    back();
  });
  show(root, [open.element]);
}

/** The same help over the town, like its other windows. */
const townControls = (parent: HTMLElement, onClose: () => void): (() => void) => townWindow(parent, controlsWindow(onClose));

/** "Tickets": the admins' inbox of player reports. */
function ticketsScreen(root: HTMLElement, back: () => void): void {
  const leave = () => {
    openTickets = null;
    open.dispose();
    back();
  };
  const open = ticketsWindow({ api: adminApi, token: () => account.token(), onBack: leave });
  openTickets = { email: signedInEmail(), leave };
  show(root, [open.element]);
}

/** "Amigos", from Options on the title. */
function friendsScreen(root: HTMLElement, back: () => void): void {
  const close = () => {
    openFriends = null;
    open.dispose();
  };
  const leave = () => {
    close();
    back();
  };
  const open = friendsWindow({
    api: friendsApi,
    token: () => account.token(),
    myRoom: () => room?.code ?? null,
    onLoaded: () => friendsBeat?.now(),
    onBack: leave,
    onAccount: () => {
      close();
      accountScreen(root, () => friendsScreen(root, back));
    },
    onJoin: (code) => {
      close();
      void openLobby(root, code, false, undefined, 'title');
    },
  });
  openFriends = { email: signedInEmail(), leave };
  show(root, [open.element]);
}

/** The same window over the town, solo or in a room; joining a friend leaves the town (and any room) for theirs. */
const townFriends =
  (root: HTMLElement) =>
  (parent: HTMLElement, onClose: () => void, leaveTown: (go: () => void) => void): (() => void) => {
    let closeInner = () => {};
    const showFriends = () => {
      closeInner = townWindow(
        parent,
        friendsWindow({
          api: friendsApi,
          token: () => account.token(),
          myRoom: () => room?.code ?? null,
          onLoaded: () => friendsBeat?.now(),
          onBack: onClose,
          onAccount: () => {
            // The account window takes over: signing in there must not close it as this window's account changing would.
            openFriends = null;
            closeInner();
            closeInner = townAccount(parent, () => {
              closeInner();
              showFriends();
            });
          },
          onJoin: (code) => leaveTown(() => void openLobby(root, code, false, undefined, room?.from ?? 'town')),
        }),
      );
      openFriends = { email: signedInEmail(), leave: onClose };
    };
    showFriends();
    return () => {
      openFriends = null;
      closeInner();
    };
  };

function reportScreen(root: HTMLElement, back: () => void): void {
  const open = reportWindow(reportOptions(() => {
    open.dispose();
    back();
  }));
  show(root, [open.element]);
}

/** The account drawer over whatever is on screen (the title, Options, Settings, Friends); `back` runs when it closes. */
function accountScreen(_root: HTMLElement, back: () => void): void {
  townAccount(document.body, back);
}

/** The account drawer over the town (its Esc menu, solo or in a room) or any screen: the scene, the room and its session stay underneath. */
function townAccount(parent: HTMLElement, onClose: () => void): () => void {
  let closeDrawer = (): void => undefined;
  const drawer = openAccountDrawer({
    account,
    flow: authFlow,
    parent,
    face: () => (settings.starterChosen ? facePortrait(settings.species, { size: 48, shiny: skinOn(), female: femaleOn(), sheets: sheetsReady() }) : null),
    onClose: () => {
      accountRedraw = null;
      onClose();
    },
  });
  closeDrawer = drawer.close;
  accountRedraw = drawer.redraw;
  return () => closeDrawer();
}

/**
 * The gallery over the town (its Esc menu; app/gallery-view.ts): a card per
 * group beside a sheet of its scenes; a seen one plays again over the town (the
 * window waits under it), an unseen one is "???" and does nothing. Nothing is
 * written: no seen flag, save, record or story. The pleas replay on the
 * crater's rim through the town (`replayPlea`, alone only).
 */
function townGallery(root: HTMLElement) {
  return (parent: HTMLElement, onClose: () => void, replayPlea: (() => void) | null): (() => void) => {
    const overlay = h('div', { className: 'town-shop' });
    let closeScene: (() => void) | null = null;
    const view = galleryView({
      groups: galleryGroups(),
      seen: readGallerySeen(store, settings.starterChosen),
      // The pleas replay on the crater's rim, alone only.
      canPlay: (entry) => entry.scene.kind !== 'plea' || replayPlea !== null,
      onPlay: (entry, done) => {
        const scene = entry.scene;
        if (scene.kind === 'plea') {
          replayPlea?.();
          done();
          return;
        }
        closeScene = galleryCinematic(root, scene, () => {
          closeScene = null;
          done();
        });
      },
      onBack: onClose,
    });
    // A click on the veil closes the window.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) onClose();
    });
    overlay.append(view.element);
    parent.append(overlay);
    return () => {
      closeScene?.();
      closeScene = null;
      view.dispose();
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

/** Reload-proof play (app/run-resume.ts): a device-local record, apart from the profile (its key is not in PROFILE_KEYS: it never syncs). */
const resumeStore = store;
const resumeWho = () => ({ owner: storedOwner(resumeStore), build: APP_VERSION });
/** The page threw since it opened: a stored run that crashes the page is dropped instead of crashing it on every reload. */
let pageCrashed = false;
window.addEventListener('error', () => {
  pageCrashed = true;
});

/** The solo town keeps the walker's map and tile (every 2 s and as the page goes), until the town is left. */
function keepTownSpot(handle: TownHandle): void {
  const who = resumeWho();
  const runId = newRunId();
  const save = () => {
    const place = handle.place();
    const record = place ? townRecord(who, runId, place, Date.now()) : null;
    if (record) writeResume(resumeStore, record);
  };
  const onHide = () => save();
  const timer = window.setInterval(save, 2000);
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onHide);
  save();
  const stop = handle.stop.bind(handle);
  handle.stop = () => {
    window.clearInterval(timer);
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onHide);
    stop();
    // Only this visit's own record: a run that began meanwhile has already replaced it.
    clearResume(resumeStore, runId);
  };
}

/** The title is skipped when a record is waiting: the town at its spot, or the run, both paused behind the menu. True when it took over. */
function resumeBoot(root: HTMLElement): boolean {
  const who = resumeWho();
  const record = readResume(resumeStore, who.owner, who.build);
  if (!record) return false;
  applyLanguage(settings.language);
  if (record.kind === 'town') {
    townScreen(root, { at: record.at, tile: record.tile, startWindow: 'menu' });
    return true;
  }
  waitScreen(root, t('resume.restoring'));
  const { launch } = record;
  const trial = launch.trial ? { ...launch.trial, pick: { ...launch.trial.pick, loadout: [...launch.trial.pick.loadout] } } : undefined;
  void play(root, undefined, launch.dungeon, launch.seed, trial, record).catch(() => {
    // A record that cannot start is gone, and the title is where the player lands, as before.
    clearResume(resumeStore);
    titleScreen(root);
  });
  return true;
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
  const { tour: forceTour, ...place } = at ?? {};
  // The welcome tour after the Sunken Way (town/tour.ts): alone, once per device, only for a player new to the town.
  const townTour = { due: () => townTourDue({ inRoom: false, startWindow: place.startWindow !== undefined, seen: hasSeenTour(store), cleared: cleared(), traces: loadSave(store), forced: forceTour === true }), seen: () => markTourSeen(store) };
  void openTown({ sheets: sheetsReady(), hints: playHints, species: settings.species, shiny: skinOn(), female: femaleOn(), dungeons, show: showTown, onDepart: (id) => newAdventure(root, dungeonById(id).id), openPokemon: () => pokemonScreen(root, () => townScreen(root)), onQuit: () => titleScreen(root, 0), openShop: townShop, openTutor: townTutor, openGacha: townGacha, openGachaPage: () => openGachaPage(root, 'town'), openEvolve: townEvolve, openBoard: townBoard, openChallenges: townChallenges, openShrine: () => shrineScreen(root, 'town'), openOnline: () => onlineScreen(root, 'town'), openAchievements: townAchievements, openSettings: townSettings, openControls: townControls, openAccount: townAccount, openFriends: townFriends(root), openGallery: townGallery(root), difficulty: () => settings.difficulty, simaPlea: { dungeon: ECLIPSE.id, due: () => simaPleaDue(store), ready: () => pleaReady(cleared()), seen: () => markSimaSceneSeen(store, 'plea') }, townTour, story: loadSave(store).story, globalBoard, ...place }).then(keepTownSpot);
}

/** What the loadout needs from the move tutor (app/tutor.ts): the known moves, their Mejoras and the recommended build. */
function tutorView(species: SpeciesId): { known: MoveId[]; ranks: Partial<Record<MoveId, number>>; buildHint: string } {
  const save = loadSave(store);
  return { known: knownMoves(save, species), ranks: { ...runRanks(save, species) }, buildHint: buildHint(species) };
}

/** A run's Mejoras, awakening steps, shiny skin and gender of `species` (none: no field). */
function ranksOf(species: SpeciesId): { moveRanks?: Partial<Record<MoveId, number>>; awakened?: number; shiny?: boolean; female?: boolean } {
  const save = loadSave(store);
  const ranks = runRanks(save, species);
  const awakened = awakenedOf(save, species);
  return { ...(ranks ? { moveRanks: ranks } : {}), ...(awakened > 0 ? { awakened } : {}), ...(wearsShiny(save, species) ? { shiny: true } : {}), ...(isFemale(save, species) ? { female: true } : {}) };
}

/** Whether `species` (the picked one by default) wears its line's shiny skin (odd/tasks/shiny-echo.md). */
const skinOn = (species: SpeciesId = settings.species): boolean => wearsShiny(loadSave(store), species);

/** Whether `species`' line (the picked one's by default) was picked as female (odd/tasks/pokemon-gender.md). */
const femaleOn = (species: SpeciesId = settings.species): boolean => isFemale(loadSave(store), species);

/**
 * The loadout's shiny skins and line genders, read from and written to the
 * save; `after` runs after a change (a room hears it through the hello).
 */
function skins(after?: () => void): { skin: ShinySkins; gender: LineGender } {
  return {
    gender: {
      female: (species) => femaleOn(species),
      set: (species, female) => {
        setFemaleAt(store, species, female);
        after?.();
      },
    },
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

/** A species' idle animation for the move tutor's chips (its worn skin and gender). */
const tutorPortrait = (id: SpeciesId, scale: number): HTMLElement => portrait(sheetsReady(), id, scale, skinOn(id), femaleOn(id));

/** Smeargle's move tutor over the town, like the shop. */
function townTutor(parent: HTMLElement, onClose: () => void): () => void {
  const tutor = tutorWindow({ store, species: settings.species, cleared: cleared(), portrait: tutorPortrait, sheets: sheetsReady(), play: (sound) => audio.play(sound), onBack: onClose });
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

/** The settings over the town (its Esc menu): the same window as the Settings screen; a language change redraws it in place. */
function townSettings(parent: HTMLElement, onClose: () => void): () => void {
  let close = (): void => undefined;
  let current = 0;
  const open = (): void => {
    close();
    const access: SettingsAccess = {
      get: () => settings,
      update,
      setLanguage: (language) => {
        applyLanguage(language);
        open();
      },
      preview: () => audio.play('click'),
    };
    // "Reportar un problema" over the town (issue #9); Back returns to these settings.
    const report = (): void => {
      close();
      close = townWindow(parent, reportWindow(reportOptions(open)));
    };
    const view = settingsView({ access, tab: current, onTab: (next) => (current = next), onBack: onClose, actions: [{ label: t('title.report'), icon: 'report', run: report }] });
    close = townWindow(parent, { element: view.element, dispose: view.dispose });
  };
  open();
  return () => close();
}

/** Mimikyu's gacha stall over the town. */
const townGacha = (parent: HTMLElement, onClose: () => void): (() => void) => townWindow(parent, gachaWindow({ store, sheets: sheetsReady(), play: (sound) => audio.play(sound), onBack: settleOnClose(onClose) }));

/**
 * The gacha as its own page, /gacha (odd/tasks/gacha-page.md; owner, 2026-11-03). The hub's button and Mimikyu's stall
 * (alone; a room keeps the window above) push the route with the origin in the history state, so the browser's back
 * button, Esc and "Volver" all return there. A direct visit has no origin: back goes to the title. The route needs a
 * server that answers /gacha with the app (Vite dev does; GitHub Pages via dist/404.html, see deploy.yml).
 */
type GachaOrigin = 'hub' | 'town';
let gachaOpen: { dispose(): void } | null = null;
let gachaFrom: GachaOrigin | null = null;
const gachaOrigin = (): GachaOrigin | null => (window.history.state as { gacha?: GachaOrigin } | null)?.gacha ?? null;
/** In front of Mimikyu's stall, where the town returns the player to. */
const STALL_FRONT = { at: 'refugio', tile: { x: 8, y: 8 } } as const;

function showGachaPage(root: HTMLElement): void {
  leaveNet();
  applyLanguage(settings.language);
  gachaOpen?.dispose();
  gachaFrom = gachaOrigin();
  const page = gachaPage({ store, sheets: sheetsReady(), play: (sound) => audio.play(sound), touch: isTouchUi(), onBack: () => leaveGachaPage(root) });
  gachaOpen = page;
  show(root, [page.element], false);
  audio.setMusic('title');
}

function openGachaPage(root: HTMLElement, from: GachaOrigin): void {
  window.history.pushState({ gacha: from }, '', gachaUrl(window.location.pathname));
  showGachaPage(root);
}

/** Back and Esc: one step back when the page was pushed (the same step as the browser's back button); a direct visit goes to the title. */
function leaveGachaPage(root: HTMLElement): void {
  if (gachaOrigin()) {
    window.history.back();
    return;
  }
  window.history.replaceState(null, '', leaveUrl(window.location.pathname));
  exitGachaPage(root, null);
}

/** Leaves the page for where it was opened from, settling the achievements the pulls earned (app/progress.ts). */
function exitGachaPage(root: HTMLElement, from: GachaOrigin | null): void {
  gachaOpen?.dispose();
  gachaOpen = null;
  achievementToast(recordSave(store, Date.now()).unlocked);
  if (from === 'town') townScreen(root, STALL_FRONT);
  else titleScreen(root, 'gacha');
}

/** The Lago oracle Phantump's evolutions over the town; evolving the selected species keeps it selected as its new form. */
function townEvolve(parent: HTMLElement, onClose: () => void, depart: (id: string) => void): () => void {
  let close = (): void => undefined;
  const evolve = () => {
    close();
    close = townWindow(parent, evolveWindow({ store, sheets: sheetsReady(), play: (sound) => audio.play(sound), onEvolved: followEvolution, onChallenges: challenges, onBack: settleOnClose(onClose) }));
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
      ...skins(() => r?.session.repick(settings.species, settings.loadout, skinOn(), femaleOn())),
      startLabel: t('shrine.start'),
      context: requestLine(request),
      onSpecies: (species) => {
        update(withSpecies(settings, species));
        // The room sees the host's new species too.
        r?.session.repick(settings.species, settings.loadout, skinOn(), femaleOn());
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

/**
 * "Cambiar Pokémon" in the town's menu: the Pokémon, then its moves, and back
 * to the town. In a room `repick` tells the others; the session stays open
 * meanwhile, so the host starting a run still brings this player along.
 */
function pokemonScreen(root: HTMLElement, back: () => void, repick?: () => void, stage: 'species' | 'moves' = 'species'): void {
  show(root, [
    ...loadoutScreen({
      stage,
      species: settings.species,
      loadout: settings.loadout,
      roster: rosterOf(loadSave(store)),
      sheets: sheetsReady(),
      ...tutorView(settings.species),
      ...skins(repick),
      startLabel: t('shrine.ready'),
      onSpecies: (species) => {
        update(withSpecies(settings, species));
        repick?.();
        pokemonScreen(root, back, repick, 'moves');
      },
      onChange: (next) => update({ loadout: next }),
      onStart: () => {
        repick?.();
        back();
      },
      onBack: () => (stage === 'moves' ? pokemonScreen(root, back, repick, 'species') : back()),
    }),
  ]);
}

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
          r.session.repick(settings.species, settings.loadout, skinOn(), femaleOn());
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
  r.session.repick(pick.species, pick.loadout, skinOn(pick.species), femaleOn(pick.species));
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
  show(root, [shrineResultScreen({ request, victory, trial, before, coins, balance, sheets: sheetsReady(), ...actions }, herald)], false, victory ? 'victory' : 'defeat', true);
}

/** The upgrade shop from the title menu (its last entry). */
function shopScreen(root: HTMLElement): void {
  const shop = shopWindow({ store, play: (sound) => audio.play(sound), onBack: () => titleScreen(root) });
  show(root, [shop.element]);
}

function creditsScreen(root: HTMLElement): void {
  show(root, [creditsWindow(single(t('menu.back'), () => titleScreen(root, 'credits')))]);
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
  let turnServers = 0;
  try {
    // The relay credentials come with the room (issue #4); without them the room still opens, direct only.
    const base = transport
      ? transport()
      : await Promise.all([import('../adapters/trystero'), fetchIceServers(apiBaseUrl(import.meta.env.VITE_API_URL))]).then(([trystero, turn]) => {
          turnServers = turn.length;
          return trystero.joinTrysteroRoom(code, turn);
        });
    session = sessionOver(root, base);
  } catch {
    diagLog.transition('roomError');
    messageScreen(root, t('lobby.error'));
    return;
  }
  diagLog.transition(asHost ? 'joinedRoom:host' : 'joinedRoom:guest');
  current = session;
  room = { session, code, asHost, seed: runSeed(), from, openedAt: Date.now(), turnServers };
  friendsBeat?.sync();
  // Load the sprites while connecting, so the town and the run do not wait for them.
  void sheetsReady();
  // Another version: both builds named, and how to update (issue #7); an older host sent no label and gets the older line.
  session.onFull((reason, theirs) => {
    if (current === session) messageScreen(root, reason === 'version' ? versionNotice('guest', buildLabel(), theirs) : t('lobby.full'));
  });
  // A run is under way: this player comes in at the next floor start or bonfire respawn (it keeps walking the town meanwhile).
  session.onWait(() => {
    if (current === session) toast(root, t('net.waitFloor'));
  });
  // Host: someone on another version knocked; say so here too (they see "reload the page").
  session.onVersionRefused((_name, theirs) => {
    if (current === session) toast(root, versionNotice('host', buildLabel(), theirs));
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
  if (asHost) session.host(room.seed, 1, settings.species, { lobby: true, name, difficulty: settings.difficulty, shiny: skinOn(), female: femaleOn() });
  else session.join(settings.species, settings.loadout, name, skinOn(), femaleOn());
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
    walkers: () => session.townWalkers().map((w) => ({ id: w.id, name: nameOf(w), species: w.species, ...(w.shiny ? { shiny: true } : {}), ...(w.female ? { female: true } : {}), map: w.map, pos: w.pos, facing: w.facing, moving: w.moving })),
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
      // The technical report (issue #6) to paste into a chat or a GitHub issue: the same snapshot a bug report attaches.
      { label: t('lobby.copyReport'), onConfirm: () => void copyReport(root).then(close) },
      { label: t('lobby.leave'), onConfirm: leave },
    ],
    // The host's call for the group: the Sima del Eclipse is entered as the daily challenge or a free run (its seed goes in `start`).
    // The room's tier: the host picks it (remembered as its own last choice), the guests see the host's.
    difficulty: () => session.difficulty(),
    setDifficulty: (next) => {
      session.setDifficulty(next);
      update({ difficulty: next });
    },
    status: () => roomStatus({ isHost: r.asHost, admitted: session.roster().some((e) => e.peer === session.peerId()), held: session.held(), waitedMs: Date.now() - r.openedAt }),
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
  void openTown({ sheets: sheetsReady(), species: settings.species, shiny: skinOn(), female: femaleOn(), dungeons, show: showTown, onDepart: depart, departBlock, openPokemon: () => pokemonScreen(root, () => townLobby(root), () => session.repick(settings.species, settings.loadout, skinOn(), femaleOn())), onQuit: leave, openShop: townShop, openTutor: townTutor, openGacha: townGacha, openEvolve: townEvolve, openBoard: townBoard, openChallenges: townChallenges, openShrine: () => shrineScreen(root, 'room'), openAchievements: townAchievements, openSettings: townSettings, openControls: townControls, openAccount: townAccount, openFriends: townFriends(root), openGallery: townGallery(root), story: loadSave(store).story, globalBoard, lobby });
}

/** After a shared run: the host reopens the room's lobby with a new seed (guests follow), a guest goes ahead to wait in the town. */
function backToRoom(root: HTMLElement): void {
  // The room is gone (the host left or its link was lost): back to the hub, alone (the title while the town is closed).
  if (!room || current !== room.session) return hub(root);
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

function resultScreen(root: HTMLElement, result: GameResult, summary: RunSummary, online: boolean, balance: number, score?: EndScore, materials?: string | null): void {
  // A room run: the room goes back to its town together for another one (`backToRoom`); every other run to the hub (after-run.ts).
  const inRoom = online && room !== null && current === room.session;
  const party = inRoom ? room!.session.roster().map(nameOf) : null;
  const back = townOf({ inRoom }) === 'room' ? () => backToRoom(root) : () => hub(root);
  // Retrying the Sima goes back to its entry card (pick the mode again).
  const retry = () => (dungeonById(summary.dungeon).endless ? enterDungeon(root, summary.dungeon, back) : void play(root, undefined, summary.dungeon));
  const held = heldItems(summary.items as ItemId[]);
  const view = endModel({ result, summary, online, balance, party, playerSpecies: settings.species, townOpen: townIsOpen(), heldNames: held.map((i) => `${i.name}${i.count > 1 ? ` ×${i.count}` : ''}`), ...(score ? { score } : {}), materials }, t);
  // A dialog over the run's last frame, not over the title's backdrop (ui/scene.ts).
  show(root, [endVeil(endScreen({ view, sheets: sheetsReady(), onAction: (id) => (id === 'retry' ? retry() : back()) }))], false, result === 'eclipse' ? 'victory' : result, true);
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
async function play(root: HTMLElement, join?: NetJoin, dungeon: DungeonId = devDungeon(), seed?: number, trial?: TrialRun, resume?: Extract<ResumeRecord, { kind: 'run' }>): Promise<void> {
  if (!sheets) {
    waitScreen(root, t('app.loading'));
    await sheetsReady();
  }
  // The HUD draws text in the pixel font on the canvas: it must be ready first.
  await document.fonts?.load(`${FONT.hudPx}px "${FONT.family}"`).catch(() => undefined);
  let shared: Pick<GameOptions, 'net' | 'seed' | 'startFloor' | 'dungeon' | 'testSpawns' | 'difficulty' | 'heraldSeed'> = { seed: seed ?? runSeed(), startFloor: devStartFloor(), dungeon, testSpawns: devSpawns(), difficulty: tierFor(dungeonById(dungeon), sendaTier(dungeonById(dungeon), settings.difficulty, loadSave(store).story)) };
  // `?boss=<seed>`: that herald on a Sima herald floor.
  const boss = resume ? undefined : devBoss();
  if (boss) shared = { ...shared, dungeon: 'eclipse-chasm', startFloor: boss.floor, heraldSeed: boss.seed };
  // A shrine trial: solo, its own arenas and tier, no dev overrides.
  if (trial) shared = { seed: seed ?? runSeed(), dungeon, difficulty: trial.request.difficulty };
  // A stored run comes back with its own seed and tier, never today's settings or the dev overrides.
  if (resume) shared = { seed: resume.launch.seed, dungeon: resume.launch.dungeon, difficulty: resume.launch.difficulty };
  if (!join && !trial && !resume && netMode()) {
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
  // A shared run has nowhere to come back to (no rejoin): whatever solo record was left is stale now.
  if (shared.net) clearResume(resumeStore);
  // A Senda chapter (each peer its own save; the tier is the run's): its cinematic first, alone.
  const story = trial ? null : storyRunOf(loadSave(store), dungeonById(shared.dungeon ?? dungeon), shared.difficulty ?? DEFAULT_DIFFICULTY);
  if (story && !shared.net && !resume && !devStoryDone()) await new Promise<void>((resolve) => storyCinematic(root, story, 'before', resolve));
  // The Sima's mouth (docs/sima-redesign.md §5.1): the first descent on this device, alone, after the villagers' pleas.
  const sima = !trial && dungeonById(shared.dungeon ?? dungeon).endless !== undefined;
  if (sima && !shared.net && !resume && !hasSeenSimaScene(store, 'mouth')) await new Promise<void>((resolve) => {
      if (!simaScene(root, 'mouth', { species: settings.species }, resolve, false)) resolve();
    });
  const canvas = h('canvas', { className: 'game' });
  show(root, [canvas], false);
  root.querySelector('.notice')?.classList.add('in-game');
  // Reload-proof play: a solo run keeps its record; a stored one is continued, paused behind the menu.
  pageCrashed = false;
  const launch: RunLaunch = resume
    ? resume.launch
    : { dungeon: shared.dungeon ?? dungeon, seed: shared.seed!, difficulty: shared.difficulty ?? DEFAULT_DIFFICULTY, ...(trial ? { trial: { request: trial.request, from: trial.from, pick: trial.pick } } : {}) };
  const keep = shared.net ? null : { writer: createResumeWriter(resumeStore, resumeWho(), launch, newRunId(), 0, Date.now), crashed: () => pageCrashed, ...(resume ? { from: resume.part } : {}) };
  running = startGame(canvas, sheets!, {
    ...(keep ? { resume: keep } : {}),
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
    hints: playHints,
    onToggleMute: () => update({ muted: !settings.muted }),
    touch: { autoAim: () => settings.autoAim, haptics: () => settings.haptics },
    gamepad: gamepads,
    // The Esc menu also reports a problem (the form in place of the menu) and copies the technical report (issues #6, #9).
    openMenu: (actions, held, context) =>
      openPauseMenu(root, { get: () => settings, update, setLanguage: applyLanguage }, { ...actions, openReport: (back) => reportWindow(reportOptions(back)), copyReport: () => void copyReport(root), ...(fullscreenSupported() ? { toggleFullscreen: () => void toggleFullscreen(), isFullscreen } : {}) }, held, {
        ...context,
        portrait: (id) => portrait(sheetsReady(), id, 4, skinOn(id), femaleOn(id)),
      }),
    // Quitting from the Esc menu goes back to the town too (`returnPlace('quit')`): a room's run to the room's town, still in it (ticket SD-RIKZIZ);
    // a solo run to the hub (the title until the town opens: odd/tasks/menu-redesign.md S7).
    onQuit: () =>
      trial?.from === 'room' || townOf({ inRoom: online && room !== null && current === room.session }) === 'room'
        ? backToRoom(root)
        : trial
          ? shrineScreen(root, trial.from, viewOf(trial.request), trial.request.id)
          : hub(root),
    playCinematic: (request, onDone) => guardianCinematic(root, request, onDone),
    ...(story ? { story } : {}),
    // The Crypt's tutorial signs this device has seen (app/tutorial.ts); the run decides whether it teaches.
    tutorial: { seen: (hint) => tutorialSeen(store).has(hint), mark: (hint) => markTutorialSeen(store, hint) },
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
      // The host left mid-run (or its link was lost): the room is gone, this peer goes back to the hub alone (after being paid below).
      if (roomGone(summary.cutShort)) leaveNet();
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
      // Its toasts wait for the cinematics after the run and come out with the results.
      holdToasts();
      achievementToast(progress.unlocked);
      // The Sima del Eclipse: every peer keeps its own leaderboard (guests too: it is their score).
      // A run the host cut short never reached its end: no score.
      const score = summary.clockMs !== undefined && !summary.cutShort ? endlessScore(summary) : undefined;
      // A won Senda chapter is closed (its bond line shows at Phantump's), and alone its closing cinematic plays first.
      recordStory(store, story, result === 'victory' && !summary.cutShort);
      const results = () => {
        resultScreen(root, result, summary, online, progress.save.coins, score, materials);
        releaseToasts();
      };
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

/** Where the town opens: a map of the overworld and a tile on it (the hub's spawn when absent); `tour` forces the welcome tour (development). */
type TownPlace = Pick<TownOptions, 'at' | 'tile' | 'startWindow'> & { tour?: boolean };

/** Development server only: `&coins=N` sets the saved balance (smoke tests of the stalls). */
function devCoins(): void {
  const coins = Number(new URLSearchParams(window.location.search).get('coins'));
  if (coins > 0) writeSave(store, { ...loadSave(store), coins });
}

/** Development server only: `&storySkip=1` starts a Senda run without its opening cinematic. */
function devStoryDone(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('storySkip') === '1';
}

/** Development server only: the `map`, `tile` and `window` (travel or menu) query of `?screen=town` (window: travel, menu or account); `tour=1` plays the welcome tour. */
function devTownPlace(): TownPlace {
  const params = new URLSearchParams(window.location.search);
  const [x, y] = (params.get('tile') ?? '').split(',').map(Number);
  const at = (params.get('map') ?? undefined) as TownOptions['at'];
  const window_ = params.get('window');
  const startWindow = window_ === 'travel' || window_ === 'menu' || window_ === 'account' || window_ === 'gallery' ? window_ : undefined;
  return { ...(at ? { at } : {}), ...(Number.isFinite(x) && Number.isFinite(y) && params.get('tile') ? { tile: { x: x!, y: y! } } : {}), ...(startWindow ? { startWindow } : {}), ...(params.get('tour') === '1' ? { tour: true } : {}) };
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
    news: () => newsScreen(root, () => titleScreen(root)),
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
      show(root, [evolveWindow({ store, sheets: sheetsReady(), play: (sound) => audio.play(sound), onEvolved: followEvolution, onChallenges: () => devScreenChallenges(root), onBack: () => titleScreen(root) }).element]);
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
      const tutor = tutorWindow({ store, species: settings.species, cleared: cleared(), portrait: tutorPortrait, sheets: sheetsReady(), play: (sound) => audio.play(sound), onBack: () => titleScreen(root) });
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
    // `&result=victory|defeat`: a real run cut after three seconds, to see the end dialog over its frozen last frame.
    runend: () => {
      void play(root, undefined, devDungeon());
      const result = new URLSearchParams(window.location.search).get('result') === 'victory' ? 'victory' : 'defeat';
      window.setTimeout(() => resultScreen(root, result, summary, false, loadSave(store).coins), 3000);
    },
    // `&kind=boss|gauntlet|herald&won=1&ms=83400&before=91000&coins=195&retry=0`: the shrine's result screen on its own.
    shrineresult: () => {
      const params = new URLSearchParams(window.location.search);
      const kind = params.get('kind') ?? 'boss';
      const request = trialRequestOf(kind === 'gauntlet' ? { kind: 'gauntlet', id: 'guardians', difficulty: 'normal' } : kind === 'herald' ? { kind: 'herald', id: '7', difficulty: 'normal' } : { kind: 'boss', id: 'aegislash', difficulty: 'normal' })!;
      const before = params.get('before');
      const won = params.get('won') !== '0';
      const trial = { stops: request.stops, beaten: won ? request.stops.length : 1, ms: Number(params.get('ms') ?? 83400), captures: 3, noHit: params.get('nohit') === '1' };
      const actions = params.get('retry') === '0' ? { onBack: () => titleScreen(root) } : { onRetry: () => titleScreen(root), onBack: () => titleScreen(root) };
      show(root, [shrineResultScreen({ request, victory: won, trial, before: before ? ({ bestMs: Number(before) } as TrialBest) : null, coins: Number(params.get('coins') ?? 0), balance: 640, sheets: sheetsReady(), ...actions })], false, won ? 'victory' : 'defeat', true);
    },
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
  // A press that starts and ends on the backdrop closes the open menu like Esc (ui/dismiss.ts).
  installDismiss();
  // Back from Google or Discord (`/?sso=1`): Clerk finishes, the game session follows, then the parameter goes.
  void authFlow.returnFromSso(window.location.search).then((result) => {
    if (!result) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('sso');
    window.history.replaceState(null, '', url);
    toast(root, t(result.ok ? 'account.drawer.signedIn' : `account.error.${result.error}`));
    // At the welcome gate the drawer carries on from there (it routes on when it closes, or at once with no choice to make).
    if (result.ok && root.querySelector('.ob-welcome')) {
      if (account.pendingChoice()) welcomeOpenAccount?.();
      else onboardingGate(root);
      return;
    }
    // The cloud may hold other progress: the drawer is where that choice is made.
    if (result.ok && account.pendingChoice()) townAccount(document.body, () => undefined);
  });
  // Development server only: `?unlock=all` opens everything in this browser's local save.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('unlock') === 'all') unlockEverything(store);
  // Development server only: `?unlock=veteran` writes an advanced, believable profile (dev-unlock.ts) and the story flags of a long-time
  // player (prologue, starter, town tour), counts the achievements it proves, then drops the parameter so a reload keeps playing it normally.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('unlock') === 'veteran') {
    veteranProfile(store);
    markPrologueSeen(store);
    markTourSeen(store);
    markVersionSeen(store, APP_VERSION);
    update(withReturningPlayer(settings, 'zorua', rosterOf(loadSave(store))));
    recordPast(store, Date.now());
    const url = new URL(window.location.href);
    url.searchParams.delete('unlock');
    window.history.replaceState(null, '', url);
  }
  // /gacha: the stall's own page. The town must be open (the hub's button is locked until then); the browser's back and forward buttons move between it and the app.
  const onGachaPath = (): boolean => isGachaPath(window.location.pathname);
  window.addEventListener('popstate', () => {
    if (onGachaPath() && townIsOpen()) showGachaPage(root);
    else if (gachaOpen) exitGachaPage(root, gachaFrom);
  });
  if (onGachaPath() && townIsOpen()) showGachaPage(root);
  else {
    if (onGachaPath()) window.history.replaceState(null, '', leaveUrl(window.location.pathname));
    if (!devScreen(root) && !resumeBoot(root)) titleScreen(root);
  }
}
