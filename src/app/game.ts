import type { MoveId } from '../data/moves';
import { ROOMS, type RoomId } from '../data/rooms';
import { atExit, loadRoom, roomCleared } from '../core/rooms';
import { enemyUnderCursor } from '../core/lockon';
import type { PlayerInput, WorldState } from '../core/state';
import { step } from '../core/step';
import { advanceClock, FIXED_DT_MS } from '../core/timestep';
import { length, vec } from '../core/vec';
import { createWorld } from '../core/world';
import type { SheetStore } from '../adapters/assets';
import type { AudioEngine } from '../adapters/audio';
import { attachInput, toPlayerInput } from '../adapters/input';
import { applyEvents, initialJuice, tickJuice } from '../adapters/juice';
import { createRenderer } from '../adapters/renderer';
import { cameraView, lerpVec, pixelScaleFor } from '../adapters/view';

/** World pixels shown on screen; the canvas is this times an integer scale. */
export const VIEW_WIDTH = 512;
export const VIEW_HEIGHT = 320;
/** Longest frame fed to the simulation clock (a tab coming back from the background). */
const MAX_FRAME_MS = 250;

export type GameResult = 'defeat' | 'victory';

export interface GameOptions {
  loadout: readonly (MoveId | null)[];
  clickToLock: boolean;
  seed?: number;
  /** Sound effects from core events and the room / boss music. */
  audio?: Pick<AudioEngine, 'handleEvents' | 'setMusic'>;
  /** The M key. */
  onToggleMute?(): void;
  onEnd(result: GameResult): void;
}

export interface RunningGame {
  stop(): void;
}

/**
 * The play session: fixed-step simulation, interpolated rendering, juice and
 * the room flow (sandbox -> exit -> boss room; death or the boss falling ends it),
 * with sound driven by the same events and the music following the room.
 */
export function startGame(canvas: HTMLCanvasElement, sheets: SheetStore, options: GameOptions): RunningGame {
  const input = attachInput(canvas);
  const renderer = createRenderer(canvas, sheets);
  let roomId: RoomId = 'sandbox';
  const base = createWorld({
    seed: options.seed ?? 1,
    arena: { width: 1, height: 1 },
    playerPos: vec(0, 0),
    loadout: options.loadout,
    clickToLock: options.clickToLock,
  });
  let world: WorldState = loadRoom(base, roomId);
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
  const audio = options.audio;
  const music = (id: RoomId) => audio?.setMusic(id === 'boss' ? 'boss' : 'room');
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyM' && !e.repeat) options.onToggleMute?.();
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
    window.setTimeout(() => options.onEnd(result), 700);
  }

  function simulate(frameMs: number): void {
    const clock = advanceClock(accumulator, frameMs);
    accumulator = clock.accumulatorMs;
    for (let i = 0; i < clock.steps; i++) {
      const view = cameraView(world.player.pos, VIEW_WIDTH, VIEW_HEIGHT, world.arena);
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
      if (world.player.hp <= 0) end('defeat');
      else if (roomId === 'boss' && roomCleared(world)) end('victory');
      else if (atExit(world, roomId) && ROOMS[roomId].next) {
        roomId = ROOMS[roomId].next!;
        world = loadRoom(world, roomId);
        prev = world;
        defeatedAt.clear();
        music(roomId);
      }
      if (juice.hitstopMs > 0) {
        // Hitstop: freeze the simulation from this step on; drop the backlog.
        accumulator = 0;
        break;
      }
    }
  }

  function frame(now: number): void {
    const frameMs = Math.min(MAX_FRAME_MS, Math.max(0, now - lastFrame));
    lastFrame = now;
    realMs += frameMs;
    resize();
    const frozen = juice.hitstopMs > 0;
    juice = tickJuice(juice, frameMs);
    if (!frozen && !(ended && world.player.hp <= 0)) simulate(frameMs);

    const alpha = frozen ? 1 : accumulator / FIXED_DT_MS;
    const focus = lerpVec(prev.player.pos, world.player.pos, alpha);
    const exit = ROOMS[roomId].exit;
    // Click-to-lock hover: the enemy a click would lock (same rule as the core).
    const hovered =
      options.clickToLock && lastInput
        ? enemyUnderCursor({ playerPos: world.player.pos, cursor: lastInput.aim, view: lastInput.view, enemies: world.enemies })
        : null;
    renderer.draw({
      prev,
      current: world,
      alpha,
      juice,
      view: cameraView(focus, VIEW_WIDTH, VIEW_HEIGHT, world.arena),
      pixelScale,
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
  music(roomId);
  window.addEventListener('keydown', onKeyDown);
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      input.dispose();
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
