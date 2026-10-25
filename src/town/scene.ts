import { SPRITE_KEYS } from '../data/sprites';
import { TOWN, TOWN_GROUND, TOWN_PROPS, type TownMap } from '../data/town';
import { TILE } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import type { SheetStore } from '../adapters/assets';
import { cameraView, followCamera, pixelScaleFor } from '../adapters/view';
import { h } from '../ui/window';
import { inExit, stepWalker, townArena, type Walker } from './interact';
import { buildTownGrid } from './map';
import { drawTownWorld, SKY_BAND, type TownCharacter, type TownImages } from './render';

/**
 * The hub town scene: the player's species walks the plaza with WASD (or
 * the arrows), the camera follows, and the route exit on the east edge hands
 * over to the run flow. It owns its canvas and loop and stops by itself when
 * the page replaces the canvas. Esc goes back to the title.
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

/** The camera may scroll up under the sky band, so the north edge of the town is never hidden by it. */
function townCamera(focus: Vec2, map: TownMap) {
  const width = (map.rows[0]?.length ?? 0) * TILE;
  const height = map.rows.length * TILE;
  const view = cameraView({ x: focus.x, y: focus.y + SKY_BAND }, TOWN_VIEW.width, TOWN_VIEW.height, { width, height: height + SKY_BAND });
  return { ...view, y: view.y - SKY_BAND };
}

export interface TownHandle {
  stop(): void;
}

export async function openTown(options: TownOptions): Promise<TownHandle> {
  const map = TOWN;
  const [sheets, images] = await Promise.all([options.sheets, loadTownImages()]);
  const arena = townArena(buildTownGrid(map));
  const canvas = h('canvas', { className: 'game town' });
  canvas.style.cursor = 'default';
  options.show([canvas]);
  // The fan-project notice shrinks as during a run.
  canvas.parentElement?.querySelector('.notice')?.classList.add('in-game');
  const ctx = canvas.getContext('2d')!;

  let walker: Walker = { pos: tileCentre(map.spawn.x, map.spawn.y), facing: { x: 0, y: 1 } };
  let camera = walker.pos;
  let pixelScale = 1;
  let moving = false;
  let stopped = false;
  let raf = 0;
  const held = new Set<string>();
  const start = performance.now();
  let last = start;

  const sprite = playerSprite(options.species);

  function resize(): void {
    pixelScale = pixelScaleFor(window.innerWidth, window.innerHeight, TOWN_VIEW.width, TOWN_VIEW.height);
    if (canvas.width !== TOWN_VIEW.width * pixelScale) canvas.width = TOWN_VIEW.width * pixelScale;
    if (canvas.height !== TOWN_VIEW.height * pixelScale) canvas.height = TOWN_VIEW.height * pixelScale;
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
    return { x: Math.sign(x), y: Math.sign(y) };
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (MOVE_KEYS[e.code]) {
      e.preventDefault();
      held.add(e.code);
    } else if (e.code === 'Escape') {
      handle.stop();
      options.onQuit();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
  const onBlur = () => held.clear();

  function frame(now: number): void {
    if (stopped) return;
    if (!canvas.isConnected) {
      handle.stop();
      return;
    }
    const dt = Math.min(50, now - last);
    last = now;
    const move = moveInput();
    moving = move.x !== 0 || move.y !== 0;
    walker = stepWalker(walker, move, dt, arena);
    if (inExit(walker.pos, map.exit)) {
      handle.stop();
      options.onDepart();
      return;
    }
    camera = followCamera(camera, walker.pos, dt);
    resize();
    const view = townCamera(camera, map);
    const characters: TownCharacter[] = [{ sprite, pos: walker.pos, facing: walker.facing, moving }];
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawTownWorld(ctx, images, sheets, { map, view, timeMs: now - start, characters });
    raf = requestAnimationFrame(frame);
  }

  const handle: TownHandle = {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
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
