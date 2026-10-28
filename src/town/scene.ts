import { bestiaryLines } from './bestiary';
import { devPerfProbe } from '../adapters/perf-probe';
import { shinyKey, SPRITE_KEYS } from '../data/sprites';
import { GROUND_SHEETS, TOWN_GROUND, TOWN_PROPS, type TownNpc } from '../data/town';
import { HUB, WORLD, type DungeonEntrance, type LorePoint, type MapLink, type WorldMap, type WorldMapId } from '../data/world';
import { DUNGEONS } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import { TILE, tileOf } from '../core/tiles';
import type { Arena } from '../core/state';
import type { Vec2 } from '../core/vec';
import type { SheetStore } from '../adapters/assets';
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
import { advanceDialog, lineDone, npcLines, openDialog, shownText, tickDialog, type DialogState } from './dialog';
import { nearestInteractable, stepWalker, townArena, type Interactable, type Walker } from './interact';
import { buildTownGrid, type MapShape } from './map';
import { arrival, bannerAlpha, entranceAt, entranceState, FADE_MS, fadeAlpha, linkAt, linkEdge, loreLines, offsetAlong, type Fade } from './overworld';
import { startWander, stepWander, type WanderState } from './ambience';
import { markVisited, readVisited, travelDestinations, type TravelDestination } from './travel';
import { travelWindow } from './travel-window';
import { serviceAboutKey, serviceLabelKey, TOWN_SERVICES, townMenuServices, type TownService } from './town-menu';
import { menuWindow } from '../ui/menu-window';
import { pleaActor, pleaCrowd, pleaOnArrival, pleaSpoken, startPlea, stepPlea, type PleaState } from './plea';
import { PLEA_STAGE, pleaKeys } from '../data/sima-plea';
import { beaconAction, canTravel, entranceAction, enterRows, presenceDue, tierRow, type TierRow, type TownLobby } from './lobby';

/** A row of a town choice window. */
type ChoiceRow = { label: string; onConfirm: () => void } | TierRow;
import { DUNGEON_LORE } from '../data/dungeon-lore';
import { boardLines, clearedDungeons, readRecords } from './records';
import { beatenBosses, readShrine, shrineBoardLine } from './shrine-records';
import { leaderboardLines, readBoard as readScores } from './leaderboard';
import { drawTownOverlay, drawTownWorld, SKY_BAND, type TownCharacter, type TownImages } from './render';

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
export const TOWN_VIEW = { width: 512, height: 320 } as const;

/**
 * Opens a window over the town inside `parent` and returns a function that
 * closes it; `onClose` runs when the player leaves it, `depart` takes the
 * player (or the room) into dungeon `id` from it (the challenges menu).
 */
export type TownWindowOpener = (parent: HTMLElement, onClose: () => void, depart: (id: string) => void) => () => void;

export interface TownOptions {
  sheets: Promise<SheetStore>;
  /** Player species (a SPRITE_KEYS name); unknown names fall back to Mimikyu. */
  species: string;
  /** The player wears its line's shiny skin (odd/tasks/shiny-echo.md). */
  shiny?: boolean;
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
  /** The account window over the town (its Esc menu), like `openShop`: in a room the room stays. */
  openAccount?: TownWindowOpener;
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

const MOVE_KEYS: Record<string, Vec2> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const INTERACT_KEYS = new Set(['KeyE', 'Enter', 'NumpadEnter', 'Space']);

const npcSprite = (species: TownNpc['species']): string => SPRITE_KEYS[species];

/** Floaters bob over the ground. */
const FLOATERS = new Set<string>(['gastly', 'litwick', 'lampent', 'chandelure', 'hoothoot', 'pumpkabooSmall', 'pumpkabooSuper', 'decidueye']);

type Target = Interactable & ({ kind: 'npc'; npc: TownNpc } | { kind: 'board' } | { kind: 'waystone' } | { kind: 'shrine' } | { kind: 'beacon' } | { kind: 'lore'; point: LorePoint });

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** The town tiles from public/tiles/town (missing files draw as flat colours or not at all). */
export async function loadTownImages(): Promise<TownImages> {
  const base = `${import.meta.env.BASE_URL}tiles/town/`;
  const files = [...new Set([TOWN_GROUND.file, ...Object.values(GROUND_SHEETS), ...Object.values(TOWN_PROPS).map((p) => p.file)])];
  const loaded = await Promise.all(files.map(async (file) => [file, await loadImage(base + file)] as const));
  const out = new Map<string, HTMLImageElement>();
  for (const [file, image] of loaded) if (image) out.set(file, image);
  return out;
}

export const tileCentre = (x: number, y: number): Vec2 => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

/** A walker's sheet: its species' (Mimikyu for an unknown name), or its shiny. */
export function playerSprite(species: string, shiny = false): string {
  const key = Object.hasOwn(SPRITE_KEYS, species) ? SPRITE_KEYS[species as keyof typeof SPRITE_KEYS] : SPRITE_KEYS.mimikyu;
  return shiny ? shinyKey(key) : key;
}

/**
 * The camera centres the player in the part of the view below the sky band,
 * and may scroll up under the band so the north edge of the town is never hidden by it.
 */
function townCamera(focus: Vec2, map: MapShape) {
  const width = (map.rows[0]?.length ?? 0) * TILE;
  const height = map.rows.length * TILE;
  const view = cameraView({ x: focus.x, y: focus.y + SKY_BAND / 2 }, TOWN_VIEW.width, TOWN_VIEW.height, { width, height: height + SKY_BAND });
  return { ...view, y: view.y - SKY_BAND };
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
      { id: 'pause', label: t('townMenu.button'), className: 'top', onPress: () => openMenu() },
    ],
  });
  canvas.parentElement?.append(touch.element);

  let walker: Walker = options.tile ? { pos: tileCentre(options.tile.x, options.tile.y), facing: { x: 0, y: 1 } } : startOf(map);
  let camera = walker.pos;
  let pixelScale = 1;
  let stopped = false;
  let raf = 0;
  let dialog: { speaker: string; state: DialogState; opens?: 'shop' | 'tutor' | 'gacha' | 'evolve' | 'shrine' | 'online' | 'board'; portrait?: string } | null = null;
  /** The villagers' pleas before the first descent (data/sima-plea.ts), while they play; then where the player was going. */
  let plea: PleaState | null = null;
  let pleaThen: (() => void) | null = null;
  /** The pleas play again from the gallery: nothing is marked, and the player goes back where it was. */
  let pleaReplay = false;
  /** The shop window is open: the scene waits and its cursor list has the keys. */
  let closeShop: (() => void) | null = null;
  /** The destination window is open: the scene waits and its cursor list has the keys. */
  let exitWindow: HTMLElement | null = null;
  /** Changing maps: the black fade, and the link taken, the travel destination or what follows (switched at the fade's darkest point). */
  let fade: (Fade & { link?: MapLink; to?: TravelDestination; then?: () => void }) | null = null;
  const held = new Set<string>();
  const start = performance.now();
  let last = start;
  /** When the current map's name banner started (view time). */
  let bannerAt = 0;

  const sprite = playerSprite(options.species, options.shiny);
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
  const roomWindow = lobby ? h('div', { className: 'town-room' }, [mdWindow({ title: t('lobby.room'), className: 'narrow' }, [roomCode, roomTier, roomList, h('p', { className: 'dim', textContent: t('lobby.townHint') })])]) : null;
  if (roomWindow) {
    Object.assign(roomWindow.style, { position: 'fixed', top: '8px', right: '8px', zIndex: '4', maxWidth: '40vw', fontSize: '0.8em', pointerEvents: 'none' });
    canvas.parentElement?.append(roomWindow);
  }
  let roomShown = '';
  function renderRoom(): void {
    if (!lobby) return;
    const players = lobby.players();
    const tier = lobby.difficulty?.() ?? null;
    const key = `${lobby.code()}|${tier}|` + players.map((p) => `${p.name}|${p.host}|${p.self}`).join(',');
    if (key === roomShown) return;
    roomShown = key;
    roomCode.textContent = lobby.code();
    roomTier.textContent = tier ? `${t('difficulty.label')}: ${t(`difficulty.${tier}`)}` : '';
    roomList.replaceChildren(
      ...players.map((p) => {
        const tags = [p.host ? t('lobby.host') : null, p.self ? t('lobby.you') : null].filter(Boolean);
        return h('li', {}, [h('span', { className: 'roster-id', textContent: p.name }), tags.length > 0 ? h('span', { className: 'dim', textContent: ` ${tags.join(' · ')}` }) : null]);
      }),
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
    bannerAt = performance.now() - start;
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
    pixelScale = fitCanvasToWindow(canvas, TOWN_VIEW.width, TOWN_VIEW.height, isTouchUi());
  }

  function moveInput(): Vec2 {
    let x = 0;
    let y = 0;
    for (const key of held) {
      const dir = MOVE_KEYS[key];
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
      // A villager of the pleas finished speaking: it steps aside.
      if (!next && plea) plea = pleaSpoken(plea);
      if (!next && opens === 'shop') openShopWindow();
      if (!next && opens === 'tutor') openShopWindow(options.openTutor);
      if (!next && opens === 'gacha') openShopWindow(options.openGacha);
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
    if (plea) return;
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
      dialog = { speaker: t('world.lore.shrine.name'), state: openDialog([t('world.lore.shrine.1')]), opens: 'shrine' };
      return;
    }
    if (target.kind === 'beacon') {
      dialog =
        beaconAction(lobby) === 'open'
          ? { speaker: t('town.name.beacon'), state: openDialog([t('town.beacon.1')]), opens: 'online' }
          : { speaker: t('town.name.beacon'), state: openDialog([t('town.beacon.room')]) };
      return;
    }
    if (target.kind === 'lore') {
      const cleared = clearedDungeons(readRecords(browserStore()));
      dialog = { speaker: t(target.point.nameKey), state: openDialog(loreLines(target.point, cleared).map((key) => t(key))) };
      return;
    }
    dialog =
      target.kind === 'board'
        ? { speaker: t('town.name.board'), state: openDialog(readBoard(lobby?.difficulty?.() ?? options.difficulty?.() ?? 'easy', options.globalBoard)), ...(options.openBoard ? { opens: 'board' as const } : {}) }
        : npcDialog(target.npc);
  }

  /** What an NPC says now: a resident's lines depend on the player's Senda progress. */
  function npcDialog(npc: TownNpc): NonNullable<typeof dialog> {
    const view = npcView(npc, options.story);
    return { speaker: t(view.nameKey), state: openDialog(npcLines(view, talk(npc.id)).map((key) => t(key))), ...(npc.opens ? { opens: npc.opens } : {}) };
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
        bannerAt = performance.now() - start;
        plea = startPlea(TILE);
        fade = { phase: 'in', ms: 0 };
      },
    };
  }

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
      dialog = { speaker: t('lobby.room'), state: openDialog([blocked]) };
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
    dialog = { speaker: name, state: openDialog([line]) };
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // A window's cursor list already handled this key (its Esc must not also leave the town).
    if (exitWindow || closeShop || e.defaultPrevented) return;
    if (MOVE_KEYS[e.code]) {
      e.preventDefault();
      if (!dialog) held.add(e.code);
    } else if (INTERACT_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) interact();
    } else if (e.code === 'Escape') {
      // Taken here: the menu opened now must not read this same Esc as its own "back".
      e.preventDefault();
      // Esc skips the villagers' pleas whole.
      if (plea) endPlea();
      else if (dialog) dialog = null;
      else openMenu();
    }
  };

  /** The services the app wired for this town (the Esc menu lists them). */
  function services(): Set<TownService> {
    const wired: Record<TownService, boolean> = {
      travel: true,
      dungeons: true,
      challenges: !!options.openChallenges,
      evolve: !!options.openEvolve,
      shop: !!options.openShop,
      tutor: !!options.openTutor,
      gacha: !!options.openGacha,
      board: !!options.openBoard,
      achievements: !!options.openAchievements,
      shrine: !!options.openShrine,
      online: !!options.openOnline,
      account: !!options.openAccount,
      gallery: !!options.openGallery,
      settings: !!options.openSettings,
    };
    return new Set(TOWN_SERVICES.filter((s) => wired[s]));
  }

  const hostOnly = () => {
    dialog = { speaker: t('lobby.room'), state: openDialog([t('lobby.hostOnly')]) };
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

  /** What a row of the Esc menu does (the same windows the NPCs and places open). */
  function serviceAction(service: TownService): void {
    switch (service) {
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
        return openShopWindow(options.openGacha);
      case 'board':
        return openShopWindow(options.openBoard);
      case 'achievements':
        return openShopWindow(options.openAchievements);
      case 'settings':
        return openShopWindow(options.openSettings);
      case 'shrine':
        return leaveTown(options.openShrine);
      case 'online':
        return leaveTown(options.openOnline);
      case 'account':
        return openShopWindow(options.openAccount);
      case 'gallery':
        return openShopWindow(galleryOpener());
    }
  }

  /** The Esc menu: every town service as a window, then back to the title (a room: its own rows, copy the code, leave). */
  const openTownMenu: TownWindowOpener = (parent, onClose) => {
    const pick = (action: () => void) => () => {
      onClose();
      action();
    };
    const end = lobby
      ? lobby.menu(onClose).map((row) => ({ label: row.label, about: t('townMenu.room.about'), onConfirm: row.onConfirm }))
      : [{ label: t('townMenu.title'), about: t('townMenu.title.about'), onConfirm: pick(() => leaveTown(options.onQuit)) }];
    const open = menuWindow({
      title: lobby ? `${t('townMenu.heading')} · ${lobby.code()}` : t('townMenu.heading'),
      rows: [...townMenuServices(services(), lobby !== null).map((s) => ({ label: t(serviceLabelKey(s)), about: t(serviceAboutKey(s)), onConfirm: pick(() => serviceAction(s)) })), ...end],
      back: { label: t('townMenu.resume'), about: t('townMenu.resume.about'), onConfirm: onClose },
      className: 'town-menu',
    });
    const overlay = h('div', { className: 'town-shop' }, [open.element]);
    parent.append(overlay);
    return () => {
      open.dispose();
      overlay.remove();
    };
  };

  /** Opens the Esc menu when nothing else is on screen. */
  function openMenu(): void {
    if (exitWindow || closeShop || fade || plea || stopped) return;
    dialog = null;
    openShopWindow(openTownMenu);
  }
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
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
    const others = (lobby?.walkers() ?? []).filter((w) => w.map === map.id).map((w): TownCharacter => ({ sprite: playerSprite(w.species, w.shiny), pos: w.pos, facing: w.facing, moving: w.moving }));
    // The villagers of the pleas: the crowd at their places, and the one coming (facing the player while it speaks).
    const crowd = plea ? pleaCrowd(plea, TILE).map((c): TownCharacter => ({ sprite: npcSprite(c.actor.species), pos: c.pos, facing: { x: walker.pos.x - c.pos.x, y: walker.pos.y - c.pos.y }, moving: false, floats: FLOATERS.has(c.actor.species) })) : [];
    const coming = plea ? pleaActor(plea) : null;
    const actor: TownCharacter[] = plea && coming ? [{ sprite: npcSprite(coming.species), pos: plea.pos, facing: { x: 0, y: plea.phase === 'aside' ? 1 : -1 }, moving: plea.phase !== 'talk', floats: FLOATERS.has(coming.species) }] : [];
    const npcsHere = plea ? [] : npcs;
    return [...npcsHere, ...roaming, ...others, ...crowd, ...actor, { sprite, pos: walker.pos, facing: walker.facing, moving }];
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
    const move = dialog || exitWindow || closeShop || fade || plea ? { x: 0, y: 0 } : moveInput();
    // The pleas: the villager walks; at the player it speaks (its portrait on the dialog box); then the next.
    if (plea && !fade && !dialog) {
      plea = stepPlea(plea, dt, TILE);
      const actor = pleaActor(plea);
      if (plea.phase === 'talk' && actor) dialog = { speaker: t(actor.nameKey), state: openDialog(pleaKeys(actor).map((key) => t(key))), portrait: npcSprite(actor.species) };
      if (plea.phase === 'done') endPlea();
    }
    // The player turns to whoever comes up to it.
    if (plea && plea.phase !== 'done') walker = { ...walker, facing: { x: plea.pos.x - walker.pos.x, y: plea.pos.y - walker.pos.y } };
    const moving = move.x !== 0 || move.y !== 0;
    walker = stepWalker(walker, move, dt, arena);
    if (dialog) dialog = { ...dialog, state: tickDialog(dialog.state, dt) };
    for (const w of map.wanderers) {
      const state = wanderers.get(w.id);
      if (state) wanderers.set(w.id, stepWander(w, state, dt, arena));
    }
    if (!fade && !exitWindow && !plea) {
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
    const view = townCamera(camera, map);
    const timeMs = now - start;
    const perf = devPerfProbe();
    const drawAt = perf ? performance.now() : 0;
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawTownWorld(ctx, images, sheets, { map, look: map.look, view, timeMs, characters: characters(moving), glows: map.entrances });
    const target = exitWindow || closeShop || fade || plea ? null : nearestInteractable(walker.pos, targets);
    touch.setHidden('talk', exitWindow !== null || closeShop !== null || (!target && !dialog));
    touch.setHidden('pause', exitWindow !== null || closeShop !== null);
    if (target && !dialog) touch.setLabel('talk', t(target.kind === 'npc' ? 'touch.talk' : 'touch.read'));
    drawTownOverlay(
      ctx,
      view,
      {
        prompt: target ? { text: t(target.kind === 'npc' ? 'town.talk' : target.kind === 'waystone' ? 'world.travel' : 'town.read'), pos: target.pos } : null,
        dialog: dialog ? { speaker: dialog.speaker, text: shownText(dialog.state), done: lineDone(dialog.state), ...(dialog.portrait ? { portrait: dialog.portrait } : {}) } : null,
        banner: { text: t(map.nameKey), alpha: bannerAlpha(timeMs - bannerAt) },
        fade: fadeAlpha(fade),
        names: nameLabels(),
      },
      timeMs,
      sheets,
    );
    if (perf) {
      perf.record('frame', dt);
      perf.record('render', performance.now() - drawAt);
    }
    raf = requestAnimationFrame(frame);
  }

  const handle: TownHandle = {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      exitWindow?.remove();
      roomWindow?.remove();
      closeShop?.();
      closeShop = null;
      touch.dispose();
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
  if (options.simaPlea && pleaOnArrival({ inRoom: lobby !== null, startWindow: options.startWindow !== undefined, due: options.simaPlea.due(), ready: options.simaPlea.ready() })) beginPlea(() => enterMap(opened.map, opened.walker));
  if (options.startWindow === 'travel') openShopWindow(openTravel);
  if (options.startWindow === 'menu') openMenu();
  if (options.startWindow === 'account') openShopWindow(options.openAccount);
  if (options.startWindow === 'gallery') openShopWindow(galleryOpener());
  raf = requestAnimationFrame(frame);
  return handle;
}
