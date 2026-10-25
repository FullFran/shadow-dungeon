import type { MoveId } from '../data/moves';
import { ROOMS } from '../data/rooms';
import { roomCleared } from '../core/rooms';
import { floorPlanOf, isBossFloor, progressRun, startRun, type RunState } from '../core/run';
import { clickLockActive, configureLock, enemyUnderCursor } from '../core/lockon';
import type { LockType, PlayerInput, WorldState } from '../core/state';
import { step } from '../core/step';
import { advanceClock, FIXED_DT_MS, frameTime } from '../core/timestep';
import { length } from '../core/vec';
import type { SheetStore } from '../adapters/assets';
import type { AudioEngine } from '../adapters/audio';
import { attachInput, toPlayerInput } from '../adapters/input';
import { applyEvents, initialJuice, tickJuice } from '../adapters/juice';
import { createRenderer } from '../adapters/renderer';
import { cameraView, followCamera, lerpVec, pixelScaleFor } from '../adapters/view';
import { simulationPaused, type MenuActions } from './menu';

/** World pixels shown on screen; the canvas is this times an integer scale. */
export const VIEW_WIDTH = 512;
export const VIEW_HEIGHT = 320;

export type GameResult = 'defeat' | 'victory';

/** Shown on the end screens. */
export interface RunSummary {
  floor: number;
  seed: number;
}

export interface GameOptions {
  loadout: readonly (MoveId | null)[];
  lockType: LockType;
  clickToLock: boolean;
  seed?: number;
  /** Sound effects from core events and the room / boss music (ducked while the Esc menu is open). */
  audio?: Pick<AudioEngine, 'handleEvents' | 'setMusic' | 'setDucked'>;
  /** The M key. */
  onToggleMute?(): void;
  /** Esc: shows the menu overlay and returns a function that removes it. */
  openMenu?(actions: MenuActions): () => void;
  /** "Quit to main menu" in the Esc menu. */
  onQuit?(): void;
  onEnd(result: GameResult, summary: RunSummary): void;
}

export interface RunningGame {
  /** Applies changed lock settings mid-run (from the Esc menu). */
  setLock(settings: { lockType: LockType; clickToLock: boolean }): void;
  stop(): void;
}

/**
 * The play session: fixed-step simulation, interpolated rendering, juice and
 * the run (generated floors 1-3 -> stairs -> boss floor; death or the boss falling ends it),
 * with sound driven by the same events and the music following the room.
 * Esc opens the menu: game input is cut off and, per the pause policy in
 * `menu.ts`, the simulation stands still until it closes.
 */
export function startGame(canvas: HTMLCanvasElement, sheets: SheetStore, options: GameOptions): RunningGame {
  const input = attachInput(canvas);
  const renderer = createRenderer(canvas, sheets);
  const started = startRun(options.seed ?? 1, {
    loadout: options.loadout,
    lockType: options.lockType,
    clickToLock: options.clickToLock,
  });
  let run: RunState = started.run;
  let world: WorldState = started.world;
  let lockSettings = { lockType: options.lockType, clickToLock: options.clickToLock };
  /** World as the current floor was entered, for "Restart floor". */
  let floorStart = world;
  let prev = world;
  let accumulator = 0;
  let juice = initialJuice();
  let realMs = 0;
  let lastFrame = performance.now();
  let lastHurtAt = Number.NEGATIVE_INFINITY;
  const defeatedAt = new Map<string, number>();
  let moving = false;
  let lastInput: PlayerInput | null = null;
  let pixelScale = 1;
  let ended = false;
  let raf = 0;
  /** Smoothed camera focus; the visible rect it gives is also the lock-on view. */
  let camera = world.player.pos;
  let view = cameraView(camera, VIEW_WIDTH, VIEW_HEIGHT, world.arena);
  let closeMenu: (() => void) | null = null;
  const audio = options.audio;
  const music = () => audio?.setMusic(isBossFloor(run) ? 'boss' : 'room');

  function hideMenu(): void {
    if (!closeMenu) return;
    closeMenu();
    closeMenu = null;
    input.setSuspended(false);
    audio?.setDucked(false);
  }

  function restartFloor(): void {
    hideMenu();
    world = { ...floorStart, lock: configureLock(floorStart.lock, lockSettings) };
    prev = world;
    accumulator = 0;
    juice = initialJuice();
    lastHurtAt = Number.NEGATIVE_INFINITY;
    defeatedAt.clear();
    lastInput = null;
    camera = world.player.pos;
  }

  function showMenu(): void {
    if (closeMenu || ended || !options.openMenu) return;
    // Release everything held: menu clicks must not attack, and keys held now must not stick.
    input.setSuspended(true);
    audio?.setDucked(true);
    closeMenu = options.openMenu({
      resume: hideMenu,
      restart: restartFloor,
      quit: () => {
        hideMenu();
        options.onQuit?.();
      },
    });
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (closeMenu) hideMenu();
      else showMenu();
    } else if (e.code === 'KeyM' && !closeMenu) options.onToggleMute?.();
  };

  function resize(): void {
    pixelScale = pixelScaleFor(window.innerWidth, window.innerHeight, VIEW_WIDTH, VIEW_HEIGHT);
    const width = VIEW_WIDTH * pixelScale;
    const height = VIEW_HEIGHT * pixelScale;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function end(result: GameResult): void {
    if (ended) return;
    ended = true;
    audio?.setMusic(null);
    // Let the last hit land on screen before the result screen.
    window.setTimeout(() => options.onEnd(result, { floor: run.floor, seed: run.seed }), 700);
  }

  function simulate(frameMs: number): void {
    const clock = advanceClock(accumulator, frameMs);
    accumulator = clock.accumulatorMs;
    for (let i = 0; i < clock.steps; i++) {
      const playerInput = toPlayerInput(input.take(), view, pixelScale);
      moving = length(playerInput.move) > 0;
      lastInput = playerInput;
      prev = world;
      world = step(world, playerInput, FIXED_DT_MS);
      juice = applyEvents(juice, world.events, world.player.pos);
      audio?.handleEvents(world.events);
      for (const event of world.events) {
        if (event.type === 'playerHurt' || event.type === 'disguiseBroken') lastHurtAt = realMs;
        if (event.type === 'enemyDefeated') defeatedAt.set(event.enemyId, realMs);
      }
      const progress = progressRun(run, world);
      if (progress.outcome) end(progress.outcome);
      else if (progress.entered) {
        run = progress.run;
        world = progress.world;
        floorStart = world;
        prev = world;
        camera = world.player.pos;
        defeatedAt.clear();
        music();
      }
      if (juice.hitstopMs > 0) {
        // Hitstop: freeze the simulation from this step on; drop the backlog.
        accumulator = 0;
        break;
      }
    }
  }

  function frame(now: number): void {
    // Paused: no game time at all (animations, juice and the clock stand still); resuming does not catch up.
    const time = frameTime(lastFrame, now, simulationPaused(closeMenu !== null));
    const frameMs = time.frameMs;
    lastFrame = time.lastFrameMs;
    realMs += frameMs;
    resize();
    const frozen = juice.hitstopMs > 0;
    juice = tickJuice(juice, frameMs);
    if (!frozen && !(ended && world.player.hp <= 0)) simulate(frameMs);

    const alpha = frozen ? 1 : accumulator / FIXED_DT_MS;
    camera = followCamera(camera, lerpVec(prev.player.pos, world.player.pos, alpha), frameMs);
    view = cameraView(camera, VIEW_WIDTH, VIEW_HEIGHT, world.arena);
    const plan = floorPlanOf(run);
    const exit = plan.kind === 'room' ? ROOMS[plan.room].exit : null;
    // Click-to-lock hover: the enemy a click would lock (same rule as the core).
    const hovered =
      clickLockActive(world.lock) && !closeMenu && lastInput
        ? enemyUnderCursor({ playerPos: world.player.pos, cursor: lastInput.aim, view: lastInput.view, enemies: world.enemies })
        : null;
    renderer.draw({
      prev,
      current: world,
      alpha,
      juice,
      view,
      pixelScale,
      floor: run.floor,
      exit,
      exitOpen: exit !== null && roomCleared(world),
      timeMs: realMs,
      sinceHurtMs: realMs - lastHurtAt,
      defeatedAt,
      moving,
      hoverId: hovered && hovered.id !== world.lock.targetId ? hovered.id : null,
    });
    raf = requestAnimationFrame(frame);
  }

  resize();
  music();
  window.addEventListener('keydown', onKeyDown);
  raf = requestAnimationFrame(frame);
  return {
    setLock(settings) {
      lockSettings = settings;
      world = { ...world, lock: configureLock(world.lock, settings) };
    },
    stop() {
      closeMenu?.();
      closeMenu = null;
      audio?.setDucked(false);
      cancelAnimationFrame(raf);
      input.dispose();
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
