import { bestiaryLines } from './bestiary';
import { devPerfProbe } from '../adapters/perf-probe';
import { lookKey, SPRITE_KEYS } from '../data/sprites';
import { GROUND_SHEETS, TOWN_GROUND, TOWN_PROPS, type TownNpc } from '../data/town';
import { HUB, WORLD, type DungeonEntrance, type LorePoint, type MapLink, type WorldMap, type WorldMapId } from '../data/world';
import { DUNGEONS } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import { TILE, tileOf } from '../core/tiles';
import type { Arena } from '../core/state';
import type { Vec2 } from '../core/vec';
import { image as assetImage, imageState, reportAssetFailure, type SheetImage, type SheetStore } from '../adapters/assets';
import { browserStore } from '../adapters/storage';
import { cameraView, followCamera } from '../adapters/view';
import { fitCanvasToWindow } from '../adapters/fit';
import { isTouchUi } from '../adapters/touch-mode';
import { createTouchControls } from '../ui/touch-controls';
import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { FONT, PALETTE } from '../ui/tokens';
import { h, mdWindow } from '../ui/window';
import { npcView } from './residents';
import type { StoryProgress } from '../core/story';
import { advanceDialog, dialogueView, npcLines, openDialog, tickDialog, type DialogState } from './dialog';
import { nearestInteractable, RUN_FACTOR, stepWalker, townArena, type Interactable, type Walker } from './interact';
import { buildTownGrid, type MapShape } from './map';
import { arrival, entranceAt, entranceState, FADE_MS, fadeAlpha, linkAt, linkEdge, loreLines, offsetAlong, type Fade } from './overworld';
import { startWander, stepWander, type WanderState } from './ambience';
import { markVisited, readVisited, travelDestinations, type TravelDestination } from './travel';
import { travelWindow } from './travel-window';
import { serviceAboutKey, serviceLabelKey, TOWN_SERVICES, townMenuServices, type TownService } from './town-menu';
import { townMenuOptions } from './menu-groups';
import { townMapView, type TownMapEntry } from './town-map-view';
import { placeCards, townMapMarkers } from './town-map';
import { menuTiming } from './sheet-model';
import { wheelServices } from './quick-wheel';
import { quickWheelView } from './quick-wheel-view';
import { pleaActor, pleaAnswered, pleaCrowd, pleaOnArrival, pleaSpoken, startPlea, stepPlea, type PleaState } from './plea';
import { PLEA_ANSWERS, PLEA_STAGE, answerKey, pleaKeys, replyKey, type PleaAnswer } from '../data/sima-plea';
import { guideFacing, playerFacing, skipTour, startTour, stepTour, tourEndSpot, tourSpoken, tourStop, type TourState } from './tour';
import { TOWN_TOUR, tourKeys } from '../data/town-tour';
import { beaconAction, canTravel, entranceAction, enterRows, presenceDue, tierRow, type TierRow, type TownLobby } from './lobby';

/** A row of a town choice window. */
type ChoiceRow = { label: string; onConfirm: () => void } | TierRow;
import { DUNGEON_LORE } from '../data/dungeon-lore';
import { boardLines, clearedDungeons, readRecords } from './records';
import { beatenBosses, readShrine, shrineBoardLine } from './shrine-records';
import { leaderboardLines, readBoard as readScores } from './leaderboard';
import { townActionOf, type TownAction } from '../adapters/bindings';
import { mountPlayHints } from '../ui/play-hints';
import { mountLocationPlaque } from '../ui/location-plaque';
import { plaqueOf, townPlace } from '../ui/location-plaque-model';
import { trackLastDevice } from '../adapters/last-device';
import { creatureRect } from '../adapters/creature-scale';
import { SPRITES } from '../data/sprites';
import { mountDialogueBox } from '../ui/dialogue-box';
import { mountWorldTooltip } from '../ui/world-tooltip';
import { interactKind, type Box } from '../ui/world-tooltip-model';
import type { PadStyle } from '../app/gamepad-help-data';
import { drawTownOverlay, drawTownWorld, type TownCharacter, type TownImages } from './render';
import { deviceHint } from '../ui/device-hint';
import { wordingKey, wordingOfDevice } from '../ui/device-wording';

/**
 * The town and the overworld around it (src/data/world.ts): the player's
 * species walks with WASD (or the arrows, or the touch joystick), the camera
 * follows, and walking off a map edge fades into the next map. NPCs, the
 * notice board and the signs talk through an MD-style dialog box with a
 * typewriter (E, Enter or Space); the hub's waystone opens the destination
 * window that hands over to the run flow. It owns its canvas and loop and
 * stops by itself when the page replaces the canvas. Esc closes the dialog,
 * else opens the town menu (every service as a window, travel, back to the
 * title; src/town/town-menu.ts).
 */
/**
 * Opens a window over the town inside `parent` and returns a function that
 * closes it; `onClose` runs when the player leaves it, `depart` takes the
 * player (or the room) into dungeon `id` from it (the challenges menu).
 */
export type TownWindowOpener = (parent: HTMLElement, onClose: () => void, depart: (id: string) => void) => () => void;

export interface TownOptions {
  sheets: Promise<SheetStore>;
  /** The in-game control hint bar (src/ui/play-hints.ts): the settings switch, read live, and the pad layout the hints draw. */
  hints?: { enabled(): boolean; padStyle?(): PadStyle };
  /** Player species (a SPRITE_KEYS name); unknown names fall back to Mimikyu. */
  species: string;
  /** The player wears its line's shiny skin (odd/tasks/shiny-echo.md). */
  shiny?: boolean;
  /** The player's line was picked as female (odd/tasks/pokemon-gender.md). */
  female?: boolean;
  /** Replaces the page with the town's nodes (no menu backdrop). */
  show: (nodes: Node[]) => void;
  /** The dungeons open on this device, in select order (the exit window lists them). */
  dungeons: readonly { id: string; label: string }[];
  /** The route exit was taken towards dungeon `id` (with the `variant` the host picked, see `TownLobby.variants`): start the run flow. */
  onDepart: (id: string, variant?: string) => void;
  /** Esc: back to the title. */
  onQuit: () => void;
  /** Opens the upgrade shop window (Poochyena's stall). */
  openShop?: TownWindowOpener;
  /** Opens Smeargle's move tutor window, like `openShop`. */
  openTutor?: TownWindowOpener;
  /** Opens Mimikyu's gacha stall, like `openShop`. */
  openGacha?: TownWindowOpener;
  /** Alone, the stall is its own page (/gacha, app/gacha-page.ts): the town is left for it, like the shrine; a room keeps `openGacha`'s window. */
  openGachaPage?: () => void;
  /** Opens Phantump's evolution window, like `openShop` (its "Desafíos" row departs from it). */
  openEvolve?: TownWindowOpener;
  /** Opens the notice board's missions window once its records are read, like `openShop`. */
  openBoard?: TownWindowOpener;
  /** Opens the challenges menu (a "Desafíos" row in the waystone's window; app/challenges.ts). */
  openChallenges?: TownWindowOpener;
  /**
   * Why the group cannot go into dungeon `id` now (a room: a challenge only
   * the line's forms may play), shown as a dialog instead of departing; null
   * lets it go.
   */
  departBlock?: (id: string) => string | null;
  /** The map to open (the hub, at its spawn, when absent). */
  at?: WorldMapId;
  /** The tile to start on (the map's spawn or first arrival when absent). */
  tile?: { x: number; y: number };
  /**
   * The online room walking the town together: other players' walkers and
   * names, the room window in a corner, Esc opens the room menu, and only
   * the host may lead the group into a dungeon (`onDepart`).
   */
  lobby?: TownLobby;
  /** The tier picked now (solo: the player's last; a room: the host's), for the notice board's records. */
  difficulty?: () => Difficulty;
  /** The hub's altar: opens the Santuario de los Juramentos (alone, or the room's shared trial in a lobby). */
  openShrine?: () => void;
  /** The hub's signal pillar, alone: opens the online room window (create a room, or join one by code). */
  openOnline?: () => void;
  /** The achievements window over the town (its Esc menu), like `openShop`. */
  openAchievements?: TownWindowOpener;
  /** The settings over the town (its Esc menu), like `openShop`. */
  openSettings?: TownWindowOpener;
  /** Opens the controller's button list, like `openShop`. */
  openControls?: TownWindowOpener;
  /** Leaves the town for the screen that changes the Pokémon and its moves (the town's sprite is the species, so it reopens after). */
  openPokemon?(): void;
  /** The account window over the town (its Esc menu), like `openShop`: in a room the room stays. */
  openAccount?: TownWindowOpener;
  /** Friends, over the town; `leave` closes it and the town, then goes on (joining a friend's room). */
  openFriends?: (parent: HTMLElement, onClose: () => void, leave: (go: () => void) => void) => () => void;
  /**
   * The gallery over the town (its Esc menu), like `openShop`: the cinematics
   * already seen, to watch again. `replayPlea` plays the villagers' pleas
   * again on the crater's rim and brings the player back (null in a room:
   * the walker never leaves the room's town).
   */
  openGallery?: (parent: HTMLElement, onClose: () => void, replayPlea: (() => void) | null) => () => void;
  /** Development (`?screen=town&window=travel|menu|account|gallery`): a window open from the start, for screenshots and the menu geometry check. */
  startWindow?: 'travel' | 'menu' | 'account' | 'gallery';
  /**
   * The villagers' pleas before the first descent into the Sima (data/sima-plea.ts):
   * alone, while due, the scene moves to the crater's rim and the villagers
   * come up one by one: as the town opens once `ready` (the Crypt cleared;
   * the player then goes back where the town opened), or when the player
   * heads for `dungeon` (then it departs).
   */
  simaPlea?: { dungeon: string; due(): boolean; ready(): boolean; seen(): void };
  /**
   * The welcome tour after the Sunken Way (data/town-tour.ts, town/tour.ts):
   * when `due` as the town opens (alone), it fades in at the hub's spawn,
   * the guide comes to meet the player and leads it from place to place,
   * and it ends opening the dungeons window at the waystone; Esc skips it
   * (still ending there). `seen` runs once it is over or skipped.
   */
  townTour?: { due(): boolean; seen(): void };
  /**
   * This player's Senda progress (the save's `story`): the residents whose
   * wounds the Sendas are recognise the player once a chapter is closed
   * (src/town/residents.ts). Read once as the town opens (it only changes
   * after a run, which leaves the town); absent = none.
   */
  story?: StoryProgress;
  /**
   * The Sima global ranking's notice board pages for a tier (src/town/global-ranking.ts):
   * what is cached now, never waiting on the network. Called once as the town
   * opens too, so the rows are usually there by the time the board is read.
   */
  globalBoard?: (difficulty: Difficulty) => string[];
}

const DIRECTIONS: Partial<Record<TownAction, Vec2>> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/**
 * Held keys are kept by code, the pad's synthetic ones as `pad:<code>`: those read the default bindings, so the pad
 * walks with its arrows whatever the keyboard is bound to (issue #62).
 */
const PAD_PREFIX = 'pad:';
const heldKey = (e: KeyboardEvent): string => (e.isTrusted ? e.code : `${PAD_PREFIX}${e.code}`);
const heldAction = (key: string): TownAction | null => (key.startsWith(PAD_PREFIX) ? townActionOf(key.slice(PAD_PREFIX.length), undefined, false) : townActionOf(key));


const npcSprite = (species: TownNpc['species']): string => SPRITE_KEYS[species];

/** Floaters bob over the ground. */
const FLOATERS = new Set<string>(['gastly', 'litwick', 'lampent', 'chandelure', 'hoothoot', 'pumpkabooSmall', 'pumpkabooSuper', 'decidueye']);

type Target = Interactable & ({ kind: 'npc'; npc: TownNpc } | { kind: 'board' } | { kind: 'waystone' } | { kind: 'shrine' } | { kind: 'beacon' } | { kind: 'lore'; point: LorePoint });

/** The town tiles from public/tiles/town (missing files draw as flat colours or not at all). */
export async function loadTownImages(): Promise<TownImages> {
  const base = `${import.meta.env.BASE_URL}tiles/town/`;
  const files = [...new Set([TOWN_GROUND.file, ...Object.values(GROUND_SHEETS), ...Object.values(TOWN_PROPS).map((p) => p.file)])];
  const loaded = await Promise.all(files.map(async (file) => [file, await assetImage(base + file)] as const));
  // A tile that gave up stands in as a placeholder: say so once (the error model raises the toast) instead of drawing flat colours silently.
  if (files.some((file) => imageState(base + file) === 'failed')) reportAssetFailure('tile');
  const out = new Map<string, SheetImage>();
  for (const [file, image] of loaded) out.set(file, image);
  return out;
}

export const tileCentre = (x: number, y: number): Vec2 => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

/** A walker's sheet: its species' (Mimikyu for an unknown name), its shiny, its female. */
export function playerSprite(species: string, shiny = false, female = false): string {
  const key = Object.hasOwn(SPRITE_KEYS, species) ? SPRITE_KEYS[species as keyof typeof SPRITE_KEYS] : SPRITE_KEYS.mimikyu;
  return lookKey(key, shiny, female);
}

/**
 * The camera centres the player in a view that fills the window (src/adapters/viewport.ts) and stays inside the map;
 * a map smaller than the view is centred, the rest is the void colour.
 */
function townCamera(focus: Vec2, map: MapShape, viewWidth: number, viewHeight: number) {
  const width = (map.rows[0]?.length ?? 0) * TILE;
  const height = map.rows.length * TILE;
  return cameraView(focus, viewWidth, viewHeight, { width, height });
}

/** The notice board's lines: the local records of the first dungeon, if there are any, then the Sima del Eclipse's best scores; both for the tier picked now. */
const readBoard = (difficulty: Difficulty, globalBoard?: (difficulty: Difficulty) => string[]): string[] => {
  const tier = { difficulty, name: t(`difficulty.${difficulty}`) };
  return [
    ...boardLines(
      readRecords(browserStore()),
      DUNGEON_LORE[0]!.id,
      (key) => t(key),
      DUNGEON_LORE.slice(1).map((l) => ({ id: l.id, name: t(l.nameKey) })),
      tier,
    ),
    ...leaderboardLines(readScores(browserStore()), (key) => t(key), 5, tier),
    // Every account's best on this tier (the server's; guests see how to appear on it).
    ...safeLines(globalBoard, difficulty),
    // The heralds met on this device (count only).
    ...bestiaryLines(browserStore(), (key) => t(key)),
    // The Santuario de los Juramentos: reflections open and gauntlets beaten.
    ...shrineBoardLine(readShrine(browserStore()), beatenBosses(readRecords(browserStore())), (key) => t(key)),
  ];
};

/** The global board's pages, or none if it fails: the notice board never breaks over it. */
function safeLines(globalBoard: ((difficulty: Difficulty) => string[]) | undefined, difficulty: Difficulty): string[] {
  try {
    return globalBoard?.(difficulty) ?? [];
  } catch {
    return [];
  }
}

export interface TownHandle {
  stop(): void;
  /**
   * Where the walker stands, for the reload-proof record (app/run-resume.ts): the map and the tile. Null while the
   * town is stopped, fading between maps, in a cutscene (plea, tour) or a room's (the group never restores).
   */
  place(): { at: WorldMapId; tile: { x: number; y: number } } | null;
}

/** What can be talked to or read on a map. */
function targetsOf(map: WorldMap): Target[] {
  return [
    ...map.npcs.map((npc): Target => ({ id: npc.id, kind: 'npc', npc, pos: tileCentre(npc.x, npc.y) })),
    ...(map.board ? [{ id: 'board', kind: 'board', pos: { x: map.board.x * TILE, y: map.board.y * TILE } } as Target] : []),
    ...(map.waystone ? [{ id: 'waystone', kind: 'waystone', pos: { x: map.waystone.x * TILE, y: map.waystone.y * TILE } } as Target] : []),
    ...(map.shrine ? [{ id: 'shrine', kind: 'shrine', pos: { x: map.shrine.x * TILE, y: map.shrine.y * TILE } } as Target] : []),
    ...(map.beacon ? [{ id: 'beacon', kind: 'beacon', pos: { x: map.beacon.x * TILE, y: map.beacon.y * TILE } } as Target] : []),
    ...map.lore.map((point): Target => ({ id: point.id, kind: 'lore', point, pos: { x: point.x * TILE, y: point.y * TILE } })),
  ];
}

/** The target's on-screen footprint in world px, for the tooltip's anchor: a villager's creature rect, else the tile it stands on. */
function targetRect(target: Target, species: TownNpc['species']): { x: number; y: number; width: number; height: number } {
  if (target.kind === 'npc') {
    const meta = SPRITES.sprites[SPRITE_KEYS[species]]?.anims.Idle;
    if (meta) return creatureRect(meta, target.pos);
  }
  return { x: target.pos.x - TILE / 2, y: target.pos.y - TILE / 2, width: TILE, height: TILE };
}

/** Where a visit of `map` starts: its spawn, else one tile inside its first link. */
function startOf(map: WorldMap): Walker {
  if (map.spawn) return { pos: tileCentre(map.spawn.x, map.spawn.y), facing: { x: 0, y: 1 } };
  const link = map.links[0];
  return link ? arrival(map, link, TILE / 2) : { pos: tileCentre(1, 1), facing: { x: 0, y: 1 } };
}

export async function openTown(options: TownOptions): Promise<TownHandle> {
  let map: WorldMap = (options.at && WORLD[options.at]) || WORLD[HUB];
  const [sheets, images] = await Promise.all([
    options.sheets,
    loadTownImages(),
    // The dialog box draws in the pixel font on the canvas: it must be ready first.
    document.fonts?.load(`${FONT.hudPx}px "${FONT.family}"`).catch(() => undefined),
  ]);
  const arenas = new Map<WorldMapId, Arena>();
  const arenaOf = (m: WorldMap): Arena => {
    let a = arenas.get(m.id);
    if (!a) arenas.set(m.id, (a = townArena(buildTownGrid(m))));
    return a;
  };
  let arena = arenaOf(map);
  const canvas = h('canvas', { className: 'game town' });
  canvas.style.cursor = 'default';
  options.show([canvas]);
  // The fan-project notice shrinks as during a run.
  canvas.parentElement?.querySelector('.notice')?.classList.add('in-game');
  const ctx = canvas.getContext('2d')!;
  // Touch (shown only with html.touch): the joystick walks, "Hablar" talks or reads, a tap advances a dialog; "Atrás" is Esc.
  const touch = createTouchControls({
    tapTarget: canvas,
    onTap: () => {
      if (dialog && !exitWindow) interact();
    },
    buttons: [
      { id: 'talk', label: t('touch.talk'), className: 'big', onPress: () => !exitWindow && interact() },
      // The town's Esc menu, in the top corner "Atrás" leaves free over the bare town.
      { id: 'pause', label: t('townMenu.button'), className: 'top', onPress: () => (tour ? skipTourNow() : openMenu()) },
    ],
  });
  canvas.parentElement?.append(touch.element);
  /** The device used last, for the glyphs of the tooltip and the dialogue box. */
  const device = trackLastDevice();
  /** Reduced motion: dialogue pages show whole, no typewriter (and the tooltip does not rise). */
  const speak = (lines: readonly string[]): DialogState => openDialog(lines, typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  /** The one tooltip over the target `interact` would pick, and the dialogue box (DESIGN.md §4). */
  const tooltip = mountWorldTooltip(canvas.parentElement ?? document.body, { device: () => device.current(), padStyle: options.hints?.padStyle ?? (() => 'xbox' as const), onActivate: () => !exitWindow && interact() });
  const dialogueBox = mountDialogueBox(canvas.parentElement ?? document.body, { device: () => device.current(), padStyle: options.hints?.padStyle ?? (() => 'xbox' as const), onAdvance: () => !exitWindow && interact() });
  /** The control hint bar along the bottom edge (null without the option). */
  const hints = options.hints ? mountPlayHints(canvas.parentElement ?? document.body, options.hints) : null;

  let walker: Walker = options.tile ? { pos: tileCentre(options.tile.x, options.tile.y), facing: { x: 0, y: 1 } } : startOf(map);
  let camera = walker.pos;
  let pixelScale = 1;
  /** CSS pixels per world pixel (the tooltip anchors in CSS px). */
  let zoom = 1;
  /** World pixels the camera shows, from the window (resize). */
  let viewWidth = 512;
  let viewHeight = 320;
  let stopped = false;
  let raf = 0;
  let dialog: { speaker: string; state: DialogState; opens?: 'shop' | 'tutor' | 'gacha' | 'evolve' | 'shrine' | 'online' | 'board'; portrait?: string } | null = null;
  /** The villagers' pleas before the first descent (data/sima-plea.ts), while they play; then where the player was going. */
  let plea: PleaState | null = null;
  let pleaThen: (() => void) | null = null;
  /** The pleas play again from the gallery: nothing is marked, and the player goes back where it was. */
  let pleaReplay = false;
  /** The welcome tour after the Sunken Way, while it plays. */
  let tour: TourState | null = null;
  /** The shop window is open: the scene waits and its cursor list has the keys. */
  let closeShop: (() => void) | null = null;
  /** The destination window is open: the scene waits and its cursor list has the keys. */
  let exitWindow: HTMLElement | null = null;
  /** Changing maps: the black fade, and the link taken, the travel destination or what follows (switched at the fade's darkest point). */
  let fade: (Fade & { link?: MapLink; to?: TravelDestination; then?: () => void }) | null = null;
  const held = new Set<string>();
  const start = performance.now();
  let last = start;
  /** The location plaque (src/ui/location-plaque.ts): the current map announces itself on arrival, and once when the scene opens. */
  const plaque = mountLocationPlaque(canvas.parentElement ?? document.body);
  const announce = (): void => plaque.show(plaqueOf(townPlace(map.id), { name: t(map.nameKey) }));
  announce();

  const sprite = playerSprite(options.species, options.shiny, options.female);
  const lobby = options.lobby ?? null;
  // Warm the global ranking of the tier picked now, so the board has it when read.
  safeLines(options.globalBoard, lobby?.difficulty?.() ?? options.difficulty?.() ?? 'easy');
  let presenceAt: number | null = null;
  /** The room window in a corner (lobby only): code and players, redrawn when they change. */
  const roomList = h('ul', { className: 'roster' });
  // The code in the corner stays small: the big lobby style would cover the sky.
  const roomCode = h('div', { className: 'town-room-code' });
  Object.assign(roomCode.style, { fontSize: '1.5em', letterSpacing: '0.2em', color: PALETTE.cursor });
  /** The room's tier, for everyone (the host changes it in the entrance and waystone windows). */
  const roomTier = h('p', { className: 'town-room-tier' });
  const roomWindow = lobby ? h('div', { className: 'town-room' }, [mdWindow({ title: t('lobby.room'), className: 'narrow' }, [roomCode, roomTier, roomList, deviceHint('dim', 'lobby.townHint')])]) : null;
  if (roomWindow) {
    Object.assign(roomWindow.style, { position: 'fixed', top: '8px', right: '8px', zIndex: '4', maxWidth: '40vw', fontSize: '0.8em', pointerEvents: 'none' });
    canvas.parentElement?.append(roomWindow);
  }
  let roomShown = '';
  function renderRoom(): void {
    if (!lobby) return;
    const players = lobby.players();
    const tier = lobby.difficulty?.() ?? null;
    const status = lobby.status?.() ?? 'in';
    const key = `${lobby.code()}|${tier}|${status}|` + players.map((p) => `${p.name}|${p.host}|${p.self}`).join(',');
    if (key === roomShown) return;
    roomShown = key;
    roomCode.textContent = lobby.code();
    // The tier is the host's: unknown until it has answered.
    roomTier.textContent = tier && status === 'in' ? `${t('difficulty.label')}: ${t(`difficulty.${tier}`)}` : '';
    roomList.replaceChildren(
      ...players.map((p) => {
        const tags = [p.host ? t('lobby.host') : null, p.self ? t('lobby.you') : null].filter(Boolean);
        return h('li', {}, [h('span', { className: 'roster-id', textContent: p.name }), tags.length > 0 ? h('span', { className: 'dim', textContent: ` ${tags.join(' · ')}` }) : null]);
      }),
      // Not let in yet: nobody else is drawn until the host answers, so say why the town looks empty.
      ...(status === 'in' ? [] : [h('li', { className: `room-status ${status}`, textContent: t(`lobby.${status}`) })]),
    );
  }
  let targets = targetsOf(map);
  /** The wandering Pokémon of the current map, restarted at home on every visit. */
  let wanderers = new Map<string, WanderState>(map.wanderers.map((w) => [w.id, startWander(w)]));

  markVisited(browserStore(), map.id);

  /** Puts the walker on `next` (its NPCs, wanderers and name banner start over) and records the visit on this device. */
  function enterMap(next: WorldMap, at: Walker): void {
    map = next;
    arena = arenaOf(map);
    targets = targetsOf(map);
    wanderers = new Map(map.wanderers.map((w) => [w.id, startWander(w)]));
    walker = at;
    camera = walker.pos;
    announce();
    markVisited(browserStore(), map.id);
  }

  /** Leave through `link` onto the paired link of the next map, keeping the offset along the edge. */
  function crossLink(link: MapLink): void {
    const next = WORLD[link.to];
    const back = next.links.find((l) => l.id === link.toLink);
    if (!back) return;
    enterMap(next, arrival(next, back, offsetAlong(walker.pos, link, linkEdge(map, link) ?? 'west')));
  }

  /** Fast travel: lands on the destination's tile (each player alone, also in a room: positions are per player). */
  const travelTo = (dest: TravelDestination): void => enterMap(WORLD[dest.map], { pos: tileCentre(dest.tile.x, dest.tile.y), facing: dest.facing });

  /** The "Viajar" window over the town: choosing a place fades out and back in there. */
  const openTravel: TownWindowOpener = (parent, onClose) => {
    const open = travelWindow({
      destinations: travelDestinations(readVisited(browserStore())),
      current: map.id,
      onTravel: (dest) => {
        onClose();
        fade = { phase: 'out', ms: 0, to: dest };
      },
      onBack: onClose,
    });
    const overlay = h('div', { className: 'town-shop' }, [open.element]);
    parent.append(overlay);
    return () => {
      open.dispose();
      overlay.remove();
    };
  };

  function resize(): void {
    const fit = fitCanvasToWindow(canvas, isTouchUi());
    pixelScale = fit.pixelScale;
    zoom = fit.zoom;
    viewWidth = fit.viewWidth;
    viewHeight = fit.viewHeight;
  }

  function moveInput(): Vec2 {
    let x = 0;
    let y = 0;
    for (const key of held) {
      const action = heldAction(key);
      const dir = action ? DIRECTIONS[action] : undefined;
      if (dir) {
        x += dir.x;
        y += dir.y;
      }
    }
    if (x === 0 && y === 0) return touch.move();
    return { x: Math.sign(x), y: Math.sign(y) };
  }

  // Conversations per NPC in this visit (the storyteller tells a new line each time).
  const talks = new Map<string, number>();
  const talk = (id: string): number => {
    const n = talks.get(id) ?? 0;
    talks.set(id, n + 1);
    return n;
  };

  function interact(): void {
    if (dialog) {
      const next = advanceDialog(dialog.state);
      const opens = dialog.opens;
      dialog = next ? { ...dialog, state: next } : null;
      // A villager of the pleas finished speaking: it steps back; Phantump's reply to the player's answer ends the scene.
      if (!next && plea) plea = plea.phase === 'choose' ? pleaAnswered(plea) : pleaSpoken(plea);
      // The guide finished speaking at this stop: on to the next one.
      if (!next && tour) tour = tourSpoken(tour);
      if (!next && opens === 'shop') openShopWindow();
      if (!next && opens === 'tutor') openShopWindow(options.openTutor);
      if (!next && opens === 'gacha') {
        if (options.openGachaPage) {
          handle.stop();
          options.openGachaPage();
        } else openShopWindow(options.openGacha);
      }
      if (!next && opens === 'evolve') openShopWindow(options.openEvolve);
      if (!next && opens === 'board') openShopWindow(options.openBoard);
      if (!next && opens === 'shrine' && options.openShrine) {
        handle.stop();
        options.openShrine();
      }
      if (!next && opens === 'online' && options.openOnline) {
        handle.stop();
        options.openOnline();
      }
      return;
    }
    if (plea || tour) return;
    const target = nearestInteractable(walker.pos, targets);
    if (!target) return;
    held.clear();
    if (target.kind === 'waystone') {
      // The hub's waystone also leads into the dungeons (the host's call in a room); every other one travels at once.
      if (map.id === HUB && canTravel(lobby)) openExitWindow();
      else openShopWindow(openTravel);
      return;
    }
    if (target.kind === 'shrine') {
      // The altar speaks, then the shrine opens (in a room: the host's pick for everyone, main.ts).
      dialog = { speaker: t('world.lore.shrine.name'), state: speak([t('world.lore.shrine.1')]), opens: 'shrine' };
      return;
    }
    if (target.kind === 'beacon') {
      dialog =
        beaconAction(lobby) === 'open'
          ? { speaker: t('town.name.beacon'), state: speak([t('town.beacon.1')]), opens: 'online' }
          : { speaker: t('town.name.beacon'), state: speak([t(wordingKey('town.beacon.room', wordingOfDevice(device.current())))]) };
      return;
    }
    if (target.kind === 'lore') {
      const cleared = clearedDungeons(readRecords(browserStore()));
      dialog = { speaker: t(target.point.nameKey), state: speak(loreLines(target.point, cleared).map((key) => t(key))) };
      return;
    }
    dialog =
      target.kind === 'board'
        ? { speaker: t('town.name.board'), state: speak(readBoard(lobby?.difficulty?.() ?? options.difficulty?.() ?? 'easy', options.globalBoard)), ...(options.openBoard ? { opens: 'board' as const } : {}) }
        : npcDialog(target.npc);
  }

  /** What an NPC says now: a resident's lines depend on the player's Senda progress. */
  function npcDialog(npc: TownNpc): NonNullable<typeof dialog> {
    const view = npcView(npc, options.story);
    return { speaker: t(view.nameKey), state: speak(npcLines(view, talk(npc.id)).map((key) => t(key))), portrait: npcSprite(view.species), ...(npc.opens ? { opens: npc.opens } : {}) };
  }

  /** Opens a stall window (the shop, or the move tutor's: `open`) over the town. */
  function openShopWindow(open = options.openShop): void {
    const parent = canvas.parentElement;
    if (!open || !parent) return;
    held.clear();
    // The joystick and "Hablar" step aside while the shop window takes the taps.
    touch.setSuspended(true);
    closeShop = open(
      parent,
      () => {
        closeShop?.();
        closeShop = null;
        held.clear();
        touch.setSuspended(false);
        last = performance.now();
      },
      (id) => depart(id),
    );
  }

  function closeExitWindow(): void {
    redrawChoice = () => undefined;
    exitWindow?.remove();
    exitWindow = null;
    held.clear();
    touch.setSuspended(false);
    last = performance.now();
  }

  /** Rebuilds the open choice window's rows (after the host's tier changed). */
  let redrawChoice: () => void = () => undefined;
  /** Host in a room: the tier row on top of the entrance and waystone windows. */
  const tierRows = (): ChoiceRow[] => {
    const row = tierRow(lobby, t('difficulty.label'), (d) => t(`difficulty.${d}`), () => redrawChoice());
    return row ? [row] : [];
  };

  /** The villagers' pleas: to the crater's rim, the villagers one by one, then `then` (the departure). */
  function beginPlea(then: () => void): void {
    closeExitWindow();
    closeShop?.();
    closeShop = null;
    held.clear();
    dialog = null;
    pleaThen = then;
    fade = {
      phase: 'out',
      ms: 0,
      then: () => {
        map = WORLD[PLEA_STAGE.map];
        arena = arenaOf(map);
        targets = targetsOf(map);
        wanderers = new Map();
        walker = { pos: { x: PLEA_STAGE.player.x * TILE, y: PLEA_STAGE.player.y * TILE }, facing: { x: 0, y: 1 } };
        camera = { x: walker.pos.x, y: walker.pos.y + TILE * 2 };
        announce();
        plea = startPlea(TILE);
        fade = { phase: 'in', ms: 0 };
      },
    };
  }

  /**
   * The player's answer to Phantump (odd/tasks/menu-redesign.md S6): a small
   * window with the two answers; the reply comes in the dialog box, and
   * closing it ends the scene. Esc in the window answers with silence.
   */
  const openPleaAnswer: TownWindowOpener = (parent, onClose) => {
    const answer = (choice: PleaAnswer) => () => {
      onClose();
      dialog = { speaker: t('town.name.oracle'), state: speak([t(replyKey(choice))]) };
    };
    const list = cursorList({ items: PLEA_ANSWERS.map((choice) => ({ label: t(answerKey(choice)), onConfirm: answer(choice) })), onBack: answer('silent'), label: t('town.name.oracle') });
    const overlay = h('div', { className: 'town-shop plea-answer' }, [mdWindow({ title: t('town.name.oracle'), className: 'narrow' }, [list.element])]);
    parent.append(overlay);
    return () => {
      list.dispose();
      overlay.remove();
    };
  };

  /** The pleas are over (or skipped): seen on this device, and on (to the Sima, or back where the player was). */
  function endPlea(): void {
    if (!plea) return;
    plea = null;
    dialog = null;
    if (!pleaReplay) options.simaPlea?.seen();
    pleaReplay = false;
    const then = pleaThen;
    pleaThen = null;
    fade = { phase: 'out', ms: 0, then: () => then?.() };
  }

  /** The gallery's replay of the pleas (alone): the same scene on the rim, then back to the map and tile the player left. */
  function replayPlea(): void {
    if (lobby || plea || fade) return;
    const back = { map, walker };
    pleaReplay = true;
    beginPlea(() => enterMap(back.map, back.walker));
  }

  /** The welcome tour: the town fades in at the hub's spawn under its name, then the guide comes (`frame` moves it). */
  function beginTour(): void {
    const hub = WORLD[HUB];
    if (map.id !== hub.id || options.tile) enterMap(hub, startOf(hub));
    announce();
    tour = startTour(TILE, walker.pos);
    fade = { phase: 'in', ms: 0 };
  }

  /** Esc (or «Atrás» on touch): the whole tour is skipped; the next frame ends it at the waystone. */
  function skipTourNow(): void {
    if (!tour) return;
    tour = skipTour(tour);
    dialog = null;
  }

  /** The tour is over (or skipped): seen on this device, the player by the waystone, and its dungeons window open (the Crypt first). */
  function endTour(): void {
    if (!tour) return;
    tour = null;
    dialog = null;
    held.clear();
    options.townTour?.seen();
    walker = { pos: tourEndSpot(TILE), facing: { x: 0, y: -1 } };
    openExitWindow();
  }

  const depart = (id: string, variant?: string) => {
    // The first descent into the Sima, alone: the villagers come to the rim first.
    if (!lobby && !plea && options.simaPlea && id === options.simaPlea.dungeon && options.simaPlea.due()) {
      beginPlea(() => {
        handle.stop();
        options.onDepart(id, variant);
      });
      return;
    }
    // In a room only the host leads (a guest reaching a challenge from Phantump's window is told so).
    const blocked = lobby && !lobby.isHost ? t('lobby.hostOnly') : (options.departBlock?.(id) ?? null);
    if (blocked) {
      closeExitWindow();
      closeShop?.();
      closeShop = null;
      touch.setSuspended(false);
      dialog = { speaker: t('lobby.room'), state: speak([blocked]) };
      return;
    }
    handle.stop();
    options.onDepart(id, variant);
  };

  /** An MD-style window over the scene: a line of text and a cursor list; the scene waits while it is open. */
  function openChoiceWindow(title: string, text: string, rows: ChoiceRow[] | (() => ChoiceRow[]), onBack: () => void): void {
    held.clear();
    touch.setSuspended(true);
    const build = typeof rows === 'function' ? rows : () => rows;
    const list = cursorList({ label: title, items: build(), onBack });
    redrawChoice = () => list.setItems(build());
    exitWindow = h('div', { className: 'town-exit' }, [mdWindow({ title, className: 'narrow' }, [h('p', { textContent: text }), list.element])]);
    Object.assign(exitWindow.style, { position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '5' });
    canvas.parentElement?.append(exitWindow);
  }

  /** The waystone's quick travel: one row per open dungeon, then stay. */
  function openExitWindow(): void {
    openChoiceWindow(
      t('town.exit.title'),
      t('town.exit.text'),
      () => [
        ...tierRows(),
        ...options.dungeons.flatMap((d) => enterRows(d.id, d.label, lobby, depart)),
        ...(options.openChallenges && (!lobby || lobby.isHost)
          ? [
              {
                label: t('challenges.title'),
                onConfirm: () => {
                  closeExitWindow();
                  openShopWindow(options.openChallenges);
                },
              },
            ]
          : []),
        {
          label: t('travel.title'),
          onConfirm: () => {
            closeExitWindow();
            openShopWindow(openTravel);
          },
        },
        { label: t('town.exit.stay'), onConfirm: closeExitWindow },
      ],
      closeExitWindow,
    );
  }

  /** Stepped on a dungeon's mouth: ask to enter, or say why it stays shut; either way the walker ends up on its way back. */
  function reachEntrance(entrance: DungeonEntrance): void {
    const def = DUNGEONS.find((d) => d.id === entrance.dungeon);
    const name = def ? t(def.lore.nameKey) : t(entrance.nameKey);
    const state = entranceState(entrance.dungeon, options.dungeons.map((d) => d.id), DUNGEONS.map((d) => d.id));
    const stepBack = () => {
      walker = { pos: tileCentre(entrance.back.x, entrance.back.y), facing: { x: -walker.facing.x, y: -walker.facing.y } };
    };
    const action = entranceAction(state, lobby);
    if (action === 'enter') {
      const stay = () => {
        closeExitWindow();
        stepBack();
      };
      openChoiceWindow(name, t(lobby ? 'world.enter.party' : 'world.enter.text').replace('{name}', name), () => [
        ...tierRows(),
        ...enterRows(entrance.dungeon, t('world.enter.yes'), lobby, depart),
        { label: t('world.enter.no'), onConfirm: stay },
      ], stay);
      return;
    }
    held.clear();
    stepBack();
    const before = def?.unlockedBy ? DUNGEONS.find((d) => d.id === def.unlockedBy) : undefined;
    const line =
      action === 'host-only' ? t('lobby.hostOnly') : action === 'locked' && before ? t('world.sealed.locked').replace('{dungeon}', t(before.lore.nameKey)) : t('world.sealed.missing');
    dialog = { speaker: name, state: speak([line]) };
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // A window's cursor list already handled this key (its Esc must not also leave the town).
    if (exitWindow || closeShop || e.defaultPrevented) return;
    // The player's bindings (issue #62); the pad's synthetic keys read the defaults.
    const action = townActionOf(e.code, undefined, e.isTrusted);
    // The run key (Shift) counts while held (released in onKeyUp like the move keys).
    if (action === 'run') held.add(heldKey(e));
    if (action && DIRECTIONS[action]) {
      e.preventDefault();
      if (!dialog) held.add(heldKey(e));
    } else if (action === 'interact') {
      e.preventDefault();
      if (!e.repeat) interact();
    } else if (action === 'map') {
      // The quick wheel (odd/tasks/menu-redesign.md S8): held open while Tab is down.
      e.preventDefault();
      if (!e.repeat) openWheel();
    } else if (action === 'menu') {
      // Taken here: the menu opened now must not read this same Esc as its own "back".
      e.preventDefault();
      // Esc skips the villagers' pleas, or the welcome tour, whole.
      if (plea) endPlea();
      else if (tour) skipTourNow();
      else if (dialog) dialog = null;
      else openMenu();
    }
  };

  /** The services the app wired for this town (the Esc menu lists them). */
  function services(): Set<TownService> {
    const wired: Record<TownService, boolean> = {
      pokemon: !!options.openPokemon,
      travel: true,
      dungeons: true,
      challenges: !!options.openChallenges,
      evolve: !!options.openEvolve,
      shop: !!options.openShop,
      tutor: !!options.openTutor,
      gacha: !!(options.openGacha ?? options.openGachaPage),
      board: !!options.openBoard,
      achievements: !!options.openAchievements,
      shrine: !!options.openShrine,
      online: !!options.openOnline,
      friends: !!options.openFriends,
      account: !!options.openAccount,
      gallery: !!options.openGallery,
      settings: !!options.openSettings,
      controls: !!options.openControls,
    };
    return new Set(TOWN_SERVICES.filter((s) => wired[s]));
  }

  const hostOnly = () => {
    dialog = { speaker: t('lobby.room'), state: speak([t('lobby.hostOnly')]) };
  };
  const leaveTown = (go: (() => void) | undefined) => {
    if (!go) return;
    handle.stop();
    go();
  };

  /** The gallery as a town window: alone it may replay the pleas, in a room it may not. */
  const galleryOpener = (): TownWindowOpener | undefined => {
    const open = options.openGallery;
    return open ? (parent, onClose) => open(parent, onClose, lobby ? null : replayPlea) : undefined;
  };

  const friendsOpener = (): TownWindowOpener | undefined => {
    const open = options.openFriends;
    return open
      ? (parent, onClose) =>
          open(parent, onClose, (go) => {
            onClose();
            leaveTown(go);
          })
      : undefined;
  };

  /** What a row of the Esc menu does (the same windows the NPCs and places open). */
  function serviceAction(service: TownService): void {
    switch (service) {
      case 'pokemon':
        return leaveTown(options.openPokemon);
      case 'travel':
        return openShopWindow(openTravel);
      case 'dungeons':
        return canTravel(lobby) ? openExitWindow() : hostOnly();
      case 'challenges':
        return canTravel(lobby) ? openShopWindow(options.openChallenges) : hostOnly();
      case 'evolve':
        return openShopWindow(options.openEvolve);
      case 'shop':
        return openShopWindow(options.openShop);
      case 'tutor':
        return openShopWindow(options.openTutor);
      case 'gacha':
        return options.openGachaPage ? leaveTown(options.openGachaPage) : openShopWindow(options.openGacha);
      case 'board':
        return openShopWindow(options.openBoard);
      case 'achievements':
        return openShopWindow(options.openAchievements);
      case 'settings':
        return openShopWindow(options.openSettings);
      case 'controls':
        return openShopWindow(options.openControls);
      case 'shrine':
        return leaveTown(options.openShrine);
      case 'online':
        return leaveTown(options.openOnline);
      case 'friends':
        return openShopWindow(friendsOpener());
      case 'account':
        return openShopWindow(options.openAccount);
      case 'gallery':
        return openShopWindow(galleryOpener());
    }
  }

  /** The Esc menu: every town service as a window, then back to the title (a room: its own rows, copy the code, leave). */
  const openTownMenu: TownWindowOpener = (parent, onClose) => {
    // Leaving to another window or the title is instant (that one has its own entrance); "Seguir" and Esc sink away.
    let instant = false;
    const pick = (action: () => void) => () => {
      instant = true;
      onClose();
      action();
    };
    const end: TownMapEntry[] = lobby
      ? lobby.menu(onClose).map((row, i) => ({ id: `room-${i}`, label: row.label, about: t('townMenu.room.about'), glyph: 'room' as const, onConfirm: row.onConfirm }))
      : [{ id: 'title', label: t('townMenu.title'), about: t('townMenu.title.about'), glyph: 'title' as const, onConfirm: pick(() => leaveTown(options.onQuit)) }];
    // The Esc menu as a map of this town (odd/tasks/menu-redesign.md S8): its NPCs and places, the rest in a column beside it.
    const available = new Set(townMenuServices(services(), lobby !== null));
    const entry = (service: TownService, id: string = service): TownMapEntry => ({ id, label: t(serviceLabelKey(service)), about: t(serviceAboutKey(service)), glyph: service, onConfirm: pick(() => serviceAction(service)) });
    const markers = townMapMarkers(map, available);
    const cards = placeCards(markers, map);
    const open = townMapView({
      heading: lobby ? `${t(map.nameKey)} · ${lobby.code()}` : t(map.nameKey),
      map,
      placed: markers.map((m, i) => ({ ...m, entry: { ...entry(m.service, m.id), who: t(cards[i]!.whoKey) } })),
      options: [...townMenuOptions(available).map((s) => entry(s)), ...end],
      primary: { id: 'resume', label: t('townMenu.resume'), about: t('townMenu.resume.about'), glyph: 'resume', onConfirm: onClose },
      player: { x: walker.pos.x / TILE, y: walker.pos.y / TILE },
      onClose,
    });
    const overlay = h('div', { className: 'town-shop tm-veil' }, [open.element]);
    parent.append(overlay);
    return () => {
      open.dispose();
      if (instant) overlay.remove();
      else {
        // The panel sinks back the way it came (menuTiming); a stray press meanwhile reaches nothing.
        overlay.classList.add('is-leaving');
        window.setTimeout(() => overlay.remove(), menuTiming(matchMedia('(prefers-reduced-motion: reduce)').matches).exitMs);
      }
    };
  };

  /** The quick wheel on Tab: the most used services of this town (quick-wheel.ts), opened on release. */
  const openQuickWheel: TownWindowOpener = (parent, onClose) => {
    const pick = (action: () => void) => () => {
      onClose();
      action();
    };
    const entries: TownMapEntry[] = wheelServices(new Set(townMenuServices(services(), lobby !== null))).map((service) => ({ id: service, label: t(serviceLabelKey(service)), about: t(serviceAboutKey(service)), glyph: service, onConfirm: pick(() => serviceAction(service)) }));
    const open = quickWheelView({ entries, onClose });
    const overlay = h('div', { className: 'town-shop' }, [open.element]);
    parent.append(overlay);
    return () => {
      open.dispose();
      overlay.remove();
    };
  };

  function openWheel(): void {
    if (exitWindow || closeShop || fade || plea || tour || stopped) return;
    dialog = null;
    openShopWindow(openQuickWheel);
  }

  /** Opens the Esc menu when nothing else is on screen. */
  function openMenu(): void {
    if (exitWindow || closeShop || fade || plea || tour || stopped) return;
    dialog = null;
    openShopWindow(openTownMenu);
  }
  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
    held.delete(`${PAD_PREFIX}${e.code}`);
  };
  const onBlur = () => held.clear();

  /** NPCs turn towards the player when it comes near. */
  function characters(moving: boolean): TownCharacter[] {
    const npcs = map.npcs.map((npc): TownCharacter => {
      const pos = tileCentre(npc.x, npc.y);
      const toPlayer = { x: walker.pos.x - pos.x, y: walker.pos.y - pos.y };
      const near = !npc.asleep && Math.hypot(toPlayer.x, toPlayer.y) < TILE * 4;
      const { species } = npcView(npc, options.story);
      return { sprite: npcSprite(species), pos, facing: near ? toPlayer : { x: 0, y: 1 }, moving: false, floats: FLOATERS.has(species) };
    });
    const roaming = map.wanderers.flatMap((w): TownCharacter[] => {
      const state = wanderers.get(w.id);
      return state ? [{ sprite: npcSprite(w.species), pos: state.pos, facing: state.facing, moving: state.target !== null && state.waitMs <= 0, floats: FLOATERS.has(w.species) }] : [];
    });
    const others = (lobby?.walkers() ?? []).filter((w) => w.map === map.id).map((w): TownCharacter => ({ sprite: playerSprite(w.species, w.shiny, w.female), pos: w.pos, facing: w.facing, moving: w.moving }));
    // The villagers of the pleas: the crowd at their places, and the one coming (facing the player while it speaks).
    const crowd = plea ? pleaCrowd(plea, TILE).map((c): TownCharacter => ({ sprite: npcSprite(c.actor.species), pos: c.pos, facing: { x: walker.pos.x - c.pos.x, y: walker.pos.y - c.pos.y }, moving: false, floats: FLOATERS.has(c.actor.species) })) : [];
    const coming = plea ? pleaActor(plea) : null;
    const actor: TownCharacter[] = plea && coming ? [{ sprite: npcSprite(coming.species), pos: plea.pos, facing: { x: 0, y: plea.phase === 'aside' ? 1 : -1 }, moving: plea.phase !== 'talk', floats: FLOATERS.has(coming.species) }] : [];
    // The welcome tour's guide leaves its spot and walks with the player.
    const guide: TownCharacter[] = tour ? [{ sprite: npcSprite(TOWN_TOUR.species), pos: tour.guide, facing: guideFacing(tour, TILE), moving: tour.guideMoving, floats: FLOATERS.has(TOWN_TOUR.species) }] : [];
    const npcsHere = plea ? [] : tour ? npcs.filter((_, i) => map.npcs[i]?.id !== TOWN_TOUR.npcId) : npcs;
    return [...npcsHere, ...roaming, ...others, ...crowd, ...actor, ...guide, { sprite, pos: walker.pos, facing: walker.facing, moving }];
  }

  /** Names over the room's walkers on this map, this player's own dimmer. */
  function nameLabels(): { text: string; pos: Vec2; dim?: boolean }[] {
    if (!lobby) return [];
    const others = lobby.walkers().filter((w) => w.map === map.id).map((w) => ({ text: w.name, pos: w.pos }));
    return [...others, { text: lobby.selfName, pos: walker.pos, dim: true }];
  }

  function frame(now: number): void {
    if (stopped) return;
    if (!canvas.isConnected) {
      handle.stop();
      return;
    }
    const dt = Math.min(50, now - last);
    last = now;
    if (fade) {
      fade = { ...fade, ms: fade.ms + dt };
      if (fade.phase === 'out' && fade.ms >= FADE_MS) {
        if (fade.link) crossLink(fade.link);
        if (fade.to) travelTo(fade.to);
        const then = fade.then;
        if (then) {
          fade = null;
          then();
          if (stopped) return;
        }
        fade = { phase: 'in', ms: 0 };
      } else if (fade.phase === 'in' && fade.ms >= FADE_MS) fade = null;
    }
    const move = dialog || exitWindow || closeShop || fade || plea || tour ? { x: 0, y: 0 } : moveInput();
    // The pleas: the villager walks; at the player it speaks (its portrait on the dialog box); then the next.
    if (plea && !fade && !dialog) {
      plea = stepPlea(plea, dt, TILE);
      const actor = pleaActor(plea);
      if (plea.phase === 'talk' && actor) dialog = { speaker: t(actor.nameKey), state: speak(pleaKeys(actor).map((key) => t(key))), portrait: npcSprite(actor.species) };
      // Everyone has spoken: the player answers Phantump's question.
      if (plea.phase === 'choose' && !closeShop) openShopWindow(openPleaAnswer);
      if (plea.phase === 'done') endPlea();
    }
    // The player turns to whoever comes up to it.
    if (plea && plea.phase !== 'done') walker = { ...walker, facing: { x: plea.pos.x - walker.pos.x, y: plea.pos.y - walker.pos.y } };
    // The welcome tour: the guide walks to the next place with the player behind it; there it speaks (its portrait on the dialog box).
    if (tour && !fade && !dialog) {
      tour = stepTour(tour, dt, TILE);
      const stop = tourStop(tour);
      if (tour.phase === 'talk' && stop) dialog = { speaker: t(TOWN_TOUR.nameKey), state: speak(tourKeys(stop).map((key) => t(key))), portrait: npcSprite(TOWN_TOUR.species) };
    }
    if (tour) walker = { pos: tour.player, facing: playerFacing(tour, TILE) };
    if (tour?.phase === 'done') endTour();
    const moving = move.x !== 0 || move.y !== 0 || (tour?.playerMoving ?? false);
    // Shift held, or the joystick pushed to its edge, runs (odd/tasks/menu-redesign.md: "opcion de correr").
    const keysMove = [...held].some((key) => DIRECTIONS[heldAction(key) ?? 'map']);
    const running = [...held].some((key) => heldAction(key) === 'run') || (!keysMove && Math.hypot(move.x, move.y) > 0.95);
    walker = stepWalker(walker, move, dt, arena, running ? RUN_FACTOR : 1);
    if (dialog) dialog = { ...dialog, state: tickDialog(dialog.state, dt) };
    for (const w of map.wanderers) {
      const state = wanderers.get(w.id);
      if (state) wanderers.set(w.id, stepWander(w, state, dt, arena));
    }
    if (!fade && !exitWindow && !plea && !tour) {
      const link = linkAt(walker.pos, map.links);
      if (link) fade = { phase: 'out', ms: 0, link };
      const entrance = dialog ? null : entranceAt(walker.pos, map.entrances);
      if (entrance) reachEntrance(entrance);
    }
    if (lobby && presenceDue(presenceAt, now)) {
      presenceAt = now;
      lobby.sendPresence({ map: map.id, pos: walker.pos, facing: walker.facing, moving });
    }
    renderRoom();
    camera = followCamera(camera, walker.pos, dt);
    resize();
    const view = townCamera(camera, map, viewWidth, viewHeight);
    const timeMs = now - start;
    const perf = devPerfProbe();
    const drawAt = perf ? performance.now() : 0;
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawTownWorld(ctx, images, sheets, { map, look: map.look, view, timeMs, characters: characters(moving), glows: map.entrances });
    const target = exitWindow || closeShop || fade || plea || tour ? null : nearestInteractable(walker.pos, targets);
    // The tooltip replaces "Hablar" on the touch layer and the floating prompt: one chip over the one target.
    touch.setHidden('talk', true);
    touch.setHidden('pause', exitWindow !== null || closeShop !== null);
    device.poll();
    drawTownOverlay(
      ctx,
      view,
      {
        fade: fadeAlpha(fade),
        names: nameLabels(),
      },
      timeMs,
    );
    const origin = canvas.getBoundingClientRect();
    const onScreen = (rect: { x: number; y: number; width: number; height: number }): Box => ({ x: origin.left + (rect.x - view.x) * zoom, y: origin.top + (rect.y - view.y) * zoom, w: rect.width * zoom, h: rect.height * zoom });
    tooltip.update(target && !dialog ? { kind: interactKind(target), target: onScreen(targetRect(target, target.kind === 'npc' ? npcView(target.npc, options.story).species : 'mimikyu')), avoid: onScreen(creatureRect(SPRITES.sprites[sprite]?.anims.Idle ?? { frameWidth: 32, frameHeight: 48 }, walker.pos)) } : null);
    dialogueBox.update(dialog ? { speaker: dialog.speaker, view: dialogueView(dialog.state), ...(dialog.portrait ? { portrait: dialog.portrait } : {}) } : null, timeMs);
    hints?.update(
      {
        place: 'town',
        minimap: false,
        spectating: false,
        suppressed: dialog !== null || exitWindow !== null || closeShop !== null || fade !== null || plea !== null || tour !== null,
        band: { left: 12, right: 12, bottom: 12 },
      },
      timeMs,
    );
    if (perf) {
      perf.record('frame', dt);
      perf.record('render', performance.now() - drawAt);
    }
    raf = requestAnimationFrame(frame);
  }

  const handle: TownHandle = {
    place() {
      if (stopped || fade || plea || tour || lobby) return null;
      return { at: map.id, tile: tileOf(walker.pos) };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      exitWindow?.remove();
      roomWindow?.remove();
      closeShop?.();
      closeShop = null;
      touch.dispose();
      hints?.dispose();
      plaque.dispose();
      tooltip.dispose();
      dialogueBox.dispose();
      device.dispose();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  resize();
  // The pleas, alone, the first time this device opens the town once the Crypt is cleared (old profiles too): on the crater's rim, then back where the town opened.
  const opened = { map, walker };
  if (!lobby && options.townTour?.due()) beginTour();
  else if (options.simaPlea && pleaOnArrival({ inRoom: lobby !== null, startWindow: options.startWindow !== undefined, due: options.simaPlea.due(), ready: options.simaPlea.ready() })) beginPlea(() => enterMap(opened.map, opened.walker));
  if (options.startWindow === 'travel') openShopWindow(openTravel);
  if (options.startWindow === 'menu') openMenu();
  if (options.startWindow === 'account') openShopWindow(options.openAccount);
  if (options.startWindow === 'gallery') openShopWindow(galleryOpener());
  raf = requestAnimationFrame(frame);
  return handle;
}
