import { SPRITE_KEYS } from '../data/sprites';
import { GROUND_SHEETS, TOWN_GROUND, TOWN_PROPS, type TownNpc } from '../data/town';
import { HUB, WORLD, type MapLink, type WorldMap, type WorldMapId } from '../data/world';
import { TILE } from '../core/tiles';
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
import { FONT } from '../ui/tokens';
import { h, mdWindow } from '../ui/window';
import { advanceDialog, lineDone, npcLines, openDialog, shownText, tickDialog, type DialogState } from './dialog';
import { nearestInteractable, stepWalker, townArena, type Interactable, type Walker } from './interact';
import { buildTownGrid, type MapShape } from './map';
import { arrival, bannerAlpha, FADE_MS, fadeAlpha, linkAt, linkEdge, offsetAlong, type Fade } from './overworld';
import { DUNGEON_LORE } from '../data/dungeon-lore';
import { boardLines, readRecords } from './records';
import { drawTownOverlay, drawTownWorld, SKY_BAND, type TownCharacter, type TownImages } from './render';

/**
 * The town and the overworld around it (src/data/world.ts): the player's
 * species walks with WASD (or the arrows, or the touch joystick), the camera
 * follows, and walking off a map edge fades into the next map. NPCs, the
 * notice board and the signs talk through an MD-style dialog box with a
 * typewriter (E, Enter or Space); the hub's waystone opens the destination
 * window that hands over to the run flow. It owns its canvas and loop and
 * stops by itself when the page replaces the canvas. Esc closes the dialog,
 * else goes back to the title.
 */
export const TOWN_VIEW = { width: 512, height: 320 } as const;

export interface TownOptions {
  sheets: Promise<SheetStore>;
  /** Player species (a SPRITE_KEYS name); unknown names fall back to Mimikyu. */
  species: string;
  /** Replaces the page with the town's nodes (no menu backdrop). */
  show: (nodes: Node[]) => void;
  /** The dungeons open on this device, in select order (the exit window lists them). */
  dungeons: readonly { id: string; label: string }[];
  /** The route exit was taken towards dungeon `id`: start the run flow. */
  onDepart: (id: string) => void;
  /** Esc: back to the title. */
  onQuit: () => void;
  /** Opens the upgrade shop window inside `parent` (Poochyena's stall); returns a function that closes it. `onClose` runs when the player leaves it. */
  openShop?: (parent: HTMLElement, onClose: () => void) => () => void;
  /** The map to open (the hub, at its spawn, when absent). */
  at?: WorldMapId;
  /** The tile to start on (the map's spawn or first arrival when absent). */
  tile?: { x: number; y: number };
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
const FLOATERS = new Set<string>(['gastly', 'litwick', 'hoothoot', 'pumpkabooSmall', 'pumpkabooSuper', 'decidueye']);

type Target = Interactable & ({ kind: 'npc'; npc: TownNpc } | { kind: 'board' } | { kind: 'waystone' });

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

export function playerSprite(species: string): string {
  return (SPRITE_KEYS as Record<string, string>)[species] ?? SPRITE_KEYS.mimikyu;
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

/** The notice board's lines: the local records of the first dungeon, if there are any. */
const readBoard = (): string[] =>
  boardLines(
    readRecords(browserStore()),
    DUNGEON_LORE[0]!.id,
    (key) => t(key),
    DUNGEON_LORE.slice(1).map((l) => ({ id: l.id, name: t(l.nameKey) })),
  );

export interface TownHandle {
  stop(): void;
}

/** What can be talked to or read on a map. */
function targetsOf(map: WorldMap): Target[] {
  return [
    ...map.npcs.map((npc): Target => ({ id: npc.id, kind: 'npc', npc, pos: tileCentre(npc.x, npc.y) })),
    ...(map.board ? [{ id: 'board', kind: 'board', pos: { x: map.board.x * TILE, y: map.board.y * TILE } } as Target] : []),
    ...(map.waystone ? [{ id: 'waystone', kind: 'waystone', pos: { x: map.waystone.x * TILE, y: map.waystone.y * TILE } } as Target] : []),
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
    buttons: [{ id: 'talk', label: t('touch.talk'), className: 'big', onPress: () => !exitWindow && interact() }],
  });
  canvas.parentElement?.append(touch.element);

  let walker: Walker = options.tile ? { pos: tileCentre(options.tile.x, options.tile.y), facing: { x: 0, y: 1 } } : startOf(map);
  let camera = walker.pos;
  let pixelScale = 1;
  let stopped = false;
  let raf = 0;
  let dialog: { speaker: string; state: DialogState; opens?: 'shop' } | null = null;
  /** The shop window is open: the scene waits and its cursor list has the keys. */
  let closeShop: (() => void) | null = null;
  /** The destination window is open: the scene waits and its cursor list has the keys. */
  let exitWindow: HTMLElement | null = null;
  /** Changing maps: the black fade, and the link taken (switched at the fade's darkest point). */
  let fade: (Fade & { link?: MapLink }) | null = null;
  const held = new Set<string>();
  const start = performance.now();
  let last = start;
  /** When the current map's name banner started (view time). */
  let bannerAt = 0;

  const sprite = playerSprite(options.species);
  let targets = targetsOf(map);

  /** Leave through `link` onto the paired link of the next map, keeping the offset along the edge. */
  function crossLink(link: MapLink): void {
    const next = WORLD[link.to];
    const back = next.links.find((l) => l.id === link.toLink);
    if (!back) return;
    const offset = offsetAlong(walker.pos, link, linkEdge(map, link) ?? 'west');
    map = next;
    arena = arenaOf(map);
    targets = targetsOf(map);
    walker = arrival(map, back, offset);
    camera = walker.pos;
    bannerAt = performance.now() - start;
  }

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
      if (!next && opens === 'shop') openShopWindow();
      return;
    }
    const target = nearestInteractable(walker.pos, targets);
    if (!target) return;
    held.clear();
    if (target.kind === 'waystone') {
      openExitWindow();
      return;
    }
    dialog =
      target.kind === 'board'
        ? { speaker: t('town.name.board'), state: openDialog(readBoard()) }
        : { speaker: t(`town.name.${target.npc.role}`), state: openDialog(npcLines(target.npc, talk(target.npc.id)).map((key) => t(key))), ...(target.npc.opens ? { opens: target.npc.opens } : {}) };
  }

  function openShopWindow(): void {
    const parent = canvas.parentElement;
    if (!options.openShop || !parent) return;
    held.clear();
    // The joystick and "Hablar" step aside while the shop window takes the taps.
    touch.setSuspended(true);
    closeShop = options.openShop(parent, () => {
      closeShop?.();
      closeShop = null;
      held.clear();
      touch.setSuspended(false);
      last = performance.now();
    });
  }

  function closeExitWindow(): void {
    exitWindow?.remove();
    exitWindow = null;
    held.clear();
    touch.setSuspended(false);
    last = performance.now();
  }

  function openExitWindow(): void {
    held.clear();
    touch.setSuspended(true);
    const depart = (id: string) => {
      handle.stop();
      options.onDepart(id);
    };
    // One row per open dungeon, then stay.
    const list = cursorList({
      label: t('town.exit.title'),
      items: [
        ...options.dungeons.map((d) => ({ label: d.label, onConfirm: () => depart(d.id) })),
        { label: t('town.exit.stay'), onConfirm: closeExitWindow },
      ],
      onBack: closeExitWindow,
    });
    exitWindow = h('div', { className: 'town-exit' }, [
      mdWindow({ title: t('town.exit.title'), className: 'narrow' }, [h('p', { textContent: t('town.exit.text') }), list.element]),
    ]);
    Object.assign(exitWindow.style, { position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '5' });
    canvas.parentElement?.append(exitWindow);
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
      if (dialog) dialog = null;
      else {
        handle.stop();
        options.onQuit();
      }
    }
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
  const onBlur = () => held.clear();

  /** NPCs turn towards the player when it comes near. */
  function characters(moving: boolean): TownCharacter[] {
    const npcs = map.npcs.map((npc): TownCharacter => {
      const pos = tileCentre(npc.x, npc.y);
      const toPlayer = { x: walker.pos.x - pos.x, y: walker.pos.y - pos.y };
      const near = Math.hypot(toPlayer.x, toPlayer.y) < TILE * 4;
      return { sprite: npcSprite(npc.species), pos, facing: near ? toPlayer : { x: 0, y: 1 }, moving: false, floats: FLOATERS.has(npc.species) };
    });
    return [...npcs, { sprite, pos: walker.pos, facing: walker.facing, moving }];
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
        fade = { phase: 'in', ms: 0 };
      } else if (fade.phase === 'in' && fade.ms >= FADE_MS) fade = null;
    }
    const move = dialog || exitWindow || closeShop || fade ? { x: 0, y: 0 } : moveInput();
    const moving = move.x !== 0 || move.y !== 0;
    walker = stepWalker(walker, move, dt, arena);
    if (dialog) dialog = { ...dialog, state: tickDialog(dialog.state, dt) };
    if (!fade && !exitWindow) {
      const link = linkAt(walker.pos, map.links);
      if (link) fade = { phase: 'out', ms: 0, link };
    }
    camera = followCamera(camera, walker.pos, dt);
    resize();
    const view = townCamera(camera, map);
    const timeMs = now - start;
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawTownWorld(ctx, images, sheets, { map, look: map.look, view, timeMs, characters: characters(moving) });
    const target = exitWindow || closeShop || fade ? null : nearestInteractable(walker.pos, targets);
    touch.setHidden('talk', exitWindow !== null || closeShop !== null || (!target && !dialog));
    if (target && !dialog) touch.setLabel('talk', t(target.kind === 'npc' ? 'touch.talk' : 'touch.read'));
    drawTownOverlay(
      ctx,
      view,
      {
        prompt: target ? { text: t(target.kind === 'npc' ? 'town.talk' : target.kind === 'waystone' ? 'world.travel' : 'town.read'), pos: target.pos } : null,
        dialog: dialog ? { speaker: dialog.speaker, text: shownText(dialog.state), done: lineDone(dialog.state) } : null,
        banner: { text: t(map.nameKey), alpha: bannerAlpha(timeMs - bannerAt) },
        fade: fadeAlpha(fade),
      },
      timeMs,
    );
    raf = requestAnimationFrame(frame);
  }

  const handle: TownHandle = {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      exitWindow?.remove();
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
  raf = requestAnimationFrame(frame);
  return handle;
}
