import { SPRITE_KEYS } from '../data/sprites';
import { TOWN, TOWN_GROUND, TOWN_PROPS, type TownMap, type TownNpc } from '../data/town';
import { TILE, tileOf } from '../core/tiles';
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
import { inExit, nearestInteractable, stepWalker, townArena, type Interactable, type Walker } from './interact';
import { buildTownGrid } from './map';
import { DUNGEON_LORE } from '../data/dungeon-lore';
import { boardLines, readRecords } from './records';
import { drawTownOverlay, drawTownWorld, SKY_BAND, type TownCharacter, type TownImages } from './render';

/**
 * The hub town scene: the player's species walks the plaza with WASD (or
 * the arrows), the camera follows, and the route exit on the east edge opens
 * a destination window that hands over to the run flow. NPCs and the notice
 * board talk through an MD-style dialog box with a typewriter (E, Enter or
 * Space). It owns its canvas and loop and stops by itself when the page
 * replaces the canvas. Esc closes the dialog, else goes back to the title.
 */
export const TOWN_VIEW = { width: 512, height: 320 } as const;

export interface TownOptions {
  sheets: Promise<SheetStore>;
  /** Player species (a SPRITE_KEYS name); unknown names fall back to Mimikyu. */
  species: string;
  /** Replaces the page with the town's nodes (no menu backdrop). */
  show: (nodes: Node[]) => void;
  /** The route exit was taken: start the run flow. */
  onDepart: () => void;
  /** Esc: back to the title. */
  onQuit: () => void;
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

const NPC_SPRITES: Record<TownNpc['species'], string> = {
  mimikyu: SPRITE_KEYS.mimikyu,
  poochyena: SPRITE_KEYS.poochyena,
  gastly: SPRITE_KEYS.gastly,
};

type Target = Interactable & ({ kind: 'npc'; npc: TownNpc } | { kind: 'board' });

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
  const files = [TOWN_GROUND.file, ...new Set(Object.values(TOWN_PROPS).map((p) => p.file))];
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
function townCamera(focus: Vec2, map: TownMap) {
  const width = (map.rows[0]?.length ?? 0) * TILE;
  const height = map.rows.length * TILE;
  const view = cameraView({ x: focus.x, y: focus.y + SKY_BAND / 2 }, TOWN_VIEW.width, TOWN_VIEW.height, { width, height: height + SKY_BAND });
  return { ...view, y: view.y - SKY_BAND };
}

/** The notice board's lines: the local records of the first dungeon, if there are any. */
const readBoard = (): string[] => boardLines(readRecords(browserStore()), DUNGEON_LORE[0]!.id, (key) => t(key));

export interface TownHandle {
  stop(): void;
}

export async function openTown(options: TownOptions): Promise<TownHandle> {
  const map = TOWN;
  const [sheets, images] = await Promise.all([
    options.sheets,
    loadTownImages(),
    // The dialog box draws in the pixel font on the canvas: it must be ready first.
    document.fonts?.load(`${FONT.hudPx}px "${FONT.family}"`).catch(() => undefined),
  ]);
  const arena = townArena(buildTownGrid(map));
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

  let walker: Walker = { pos: tileCentre(map.spawn.x, map.spawn.y), facing: { x: 0, y: 1 } };
  let camera = walker.pos;
  let pixelScale = 1;
  let stopped = false;
  let raf = 0;
  let dialog: { speaker: string; state: DialogState } | null = null;
  /** The destination window is open: the scene waits and its cursor list has the keys. */
  let exitWindow: HTMLElement | null = null;
  const held = new Set<string>();
  const start = performance.now();
  let last = start;

  const sprite = playerSprite(options.species);
  const targets: Target[] = [
    ...map.npcs.map((npc): Target => ({ id: npc.id, kind: 'npc', npc, pos: tileCentre(npc.x, npc.y) })),
    { id: 'board', kind: 'board', pos: { x: map.board.x * TILE, y: map.board.y * TILE } },
  ];

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
      dialog = next ? { ...dialog, state: next } : null;
      return;
    }
    const target = nearestInteractable(walker.pos, targets);
    if (!target) return;
    held.clear();
    dialog =
      target.kind === 'board'
        ? { speaker: t('town.name.board'), state: openDialog(readBoard()) }
        : { speaker: t(`town.name.${target.npc.role}`), state: openDialog(npcLines(target.npc, talk(target.npc.id)).map((key) => t(key))) };
  }

  function closeExitWindow(): void {
    exitWindow?.remove();
    exitWindow = null;
    held.clear();
    touch.setSuspended(false);
    // Step back off the exit tiles, facing the town.
    walker = { pos: tileCentre(map.exit.x - 1, tileOf(walker.pos).y), facing: { x: -1, y: 0 } };
    last = performance.now();
  }

  function openExitWindow(): void {
    held.clear();
    touch.setSuspended(true);
    const depart = () => {
      handle.stop();
      options.onDepart();
    };
    const list = cursorList({
      label: t('town.exit.title'),
      items: [
        { label: t('town.exit.crypt'), onConfirm: depart },
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
    if (exitWindow) return;
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
      return { sprite: NPC_SPRITES[npc.species], pos, facing: near ? toPlayer : { x: 0, y: 1 }, moving: false, floats: npc.species === 'gastly' };
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
    const move = dialog || exitWindow ? { x: 0, y: 0 } : moveInput();
    const moving = move.x !== 0 || move.y !== 0;
    walker = stepWalker(walker, move, dt, arena);
    if (dialog) dialog = { ...dialog, state: tickDialog(dialog.state, dt) };
    if (!exitWindow && inExit(walker.pos, map.exit)) openExitWindow();
    camera = followCamera(camera, walker.pos, dt);
    resize();
    const view = townCamera(camera, map);
    const timeMs = now - start;
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawTownWorld(ctx, images, sheets, { map, view, timeMs, characters: characters(moving) });
    const target = exitWindow ? null : nearestInteractable(walker.pos, targets);
    touch.setHidden('talk', exitWindow !== null || (!target && !dialog));
    if (target && !dialog) touch.setLabel('talk', t(target.kind === 'board' ? 'touch.read' : 'touch.talk'));
    drawTownOverlay(
      ctx,
      view,
      {
        prompt: target ? { text: t(target.kind === 'board' ? 'town.read' : 'town.talk'), pos: target.pos } : null,
        dialog: dialog ? { speaker: dialog.speaker, text: shownText(dialog.state), done: lineDone(dialog.state) } : null,
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
