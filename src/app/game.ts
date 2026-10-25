import type { MoveId } from '../data/moves';
import { ROOMS } from '../data/rooms';
import { roomCleared } from '../core/rooms';
import { collapseProximity } from '../core/collapse';
import { chooseItem, floorPlanOf, followToFloor, isBossFloor, progressRun, startRun, type RunState } from '../core/run';
import { clickLockActive, configureLock, enemyUnderCursor } from '../core/lockon';
import type { GameEvent, LockType, PlayerInput, WorldState } from '../core/state';
import { step } from '../core/step';
import { advanceClock, FIXED_DT_MS, frameTime } from '../core/timestep';
import { tileOf } from '../core/tiles';
import { length, vec } from '../core/vec';
import type { SheetStore } from '../adapters/assets';
import { floorEntrySounds, type AudioEngine } from '../adapters/audio';
import { heldItems, type HeldItem } from '../adapters/hud';
import type { FloorCard } from '../adapters/card';
import { createMemory, revealAround, type MinimapMemory } from '../adapters/minimap';
import { attachInput, toPlayerInput } from '../adapters/input';
import { applyEvents, initialJuice, rumbleLevel, tickJuice } from '../adapters/juice';
import { createRenderer } from '../adapters/renderer';
import { cameraView, followCamera, lerpVec, pixelScaleFor } from '../adapters/view';
import type { NetSession } from '../net/session';
import { openItemPick, pickCards, pickIndexForKey, pickPausesSimulation } from './item-pick';
import { simulationPaused, type MenuActions } from './menu';
import { createNetOverlay } from './net-overlay';

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
  /** Development only: start on this floor of the run (`?floor=` on the dev server). */
  startFloor?: number;
  /** Sound effects from core events and the room / boss music (ducked while the Esc menu is open). */
  audio?: Pick<AudioEngine, 'handleEvents' | 'play' | 'setMusic' | 'setDucked' | 'setRumble'>;
  /** The M key. */
  onToggleMute?(): void;
  /** Esc: shows the menu overlay (with the held items listed) and returns a function that removes it. */
  openMenu?(actions: MenuActions, held: readonly HeldItem[]): () => void;
  /** "Quit to main menu" in the Esc menu. */
  onQuit?(): void;
  onEnd(result: GameResult, summary: RunSummary): void;
  /** Shared run (`?net=local`): this peer's session, role and player id. Absent solo. */
  net?: { session: NetSession; role: 'host' | 'guest'; localId: string };
}

/** What a fainted player sends in a shared run: nothing (no revive in the spike). */
function idleInput(from: PlayerInput): PlayerInput {
  return { ...from, move: vec(0, 0), roll: false, slots: from.slots.map(() => false), slotMouse: from.slotMouse.map(() => false), click: false, lock: false, wheel: 0 };
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
 * `menu.ts`, the simulation stands still until it closes. Entering a floor
 * after the first offers three held items (item-pick.ts): solo, input is cut
 * off and the game pauses until one is picked; a shared run keeps running
 * and only clicks on the cards or 1/2/3 pick.
 */
export function startGame(canvas: HTMLCanvasElement, sheets: SheetStore, options: GameOptions): RunningGame {
  const input = attachInput(canvas);
  const renderer = createRenderer(canvas, sheets);
  const net = options.net;
  /** F3 in a shared run: the net stats overlay. */
  const overlay = net ? createNetOverlay(canvas.parentElement ?? document.body, net.session, net.role, net.localId) : null;
  const started = startRun(
    options.seed ?? 1,
    {
      loadout: options.loadout,
      lockType: options.lockType,
      clickToLock: options.clickToLock,
      ...(net ? { localId: net.localId, role: net.role } : {}),
    },
    options.startFloor,
  );
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
  /** The held item pick overlay, while open. */
  let closePick: (() => void) | null = null;
  const overlayParent = canvas.parentElement ?? document.body;
  const audio = options.audio;
  const music = () => audio?.setMusic(isBossFloor(run) ? 'boss' : 'room');
  /** Title card of the current floor; game input keeps working while it shows. */
  let card: FloorCard | null = null;
  /** Fog-of-war memory of the current floor's minimap (presentation state; reset on each floor and on restart). */
  let minimap: MinimapMemory | null = null;
  let showMinimap = true;
  function announceFloor(descended: boolean): void {
    card = { floor: run.floor, kind: run.kind, escape: run.escape, shownAtMs: realMs };
    for (const id of floorEntrySounds(run.kind, descended)) audio?.play(id);
    minimap = world.arena.tiles ? createMemory(world.arena.tiles) : null;
  }

  function hideMenu(): void {
    if (!closeMenu) return;
    closeMenu();
    closeMenu = null;
    // A solo pick still open keeps game input cut off.
    input.setSuspended(closePick !== null && !net);
    audio?.setDucked(false);
  }

  function hidePick(): void {
    if (!closePick) return;
    closePick();
    closePick = null;
    if (!net && !closeMenu) input.setSuspended(false);
  }

  /** Takes card `index` of the floor's offer; "Restart floor" keeps the item. */
  function choose(index: number): void {
    if (!closePick) return;
    const picked = chooseItem(run, world, index);
    if (picked.run === run) return;
    floorStart = chooseItem(run, floorStart, index).world;
    run = picked.run;
    world = picked.world;
    audio?.play('item');
    hidePick();
  }

  /** Shows the current floor's held item offer, if any. */
  function offerPick(): void {
    hidePick();
    if (!run.offer || run.offer.length === 0 || ended) return;
    // Solo: menu clicks must not attack and held keys must not stick (the game pauses meanwhile).
    if (!net) input.setSuspended(true);
    closePick = openItemPick(overlayParent, pickCards(run.offer, world.player.items), Boolean(net), choose);
  }

  function restartFloor(): void {
    hideMenu();
    // A shared run cannot rewind one peer.
    if (net) return;
    world = { ...floorStart, lock: configureLock(floorStart.lock, lockSettings) };
    prev = world;
    accumulator = 0;
    juice = initialJuice();
    lastHurtAt = Number.NEGATIVE_INFINITY;
    defeatedAt.clear();
    lastInput = null;
    camera = world.player.pos;
    announceFloor(false);
  }

  function showMenu(): void {
    if (closeMenu || ended || !options.openMenu) return;
    // Release everything held: menu clicks must not attack, and keys held now must not stick.
    input.setSuspended(true);
    audio?.setDucked(true);
    closeMenu = options.openMenu(
      {
        resume: hideMenu,
        restart: restartFloor,
        quit: () => {
          hideMenu();
          net?.session.leave();
          options.onQuit?.();
        },
      },
      heldItems(world.player.items),
    );
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (closeMenu) hideMenu();
      else showMenu();
    } else if (e.code === 'F3' && overlay) {
      // F3 would open the browser's find bar.
      e.preventDefault();
      overlay.toggle();
    } else if (closePick && !closeMenu && pickIndexForKey(e.code, run.offer?.length ?? 0) !== null) {
      choose(pickIndexForKey(e.code, run.offer?.length ?? 0)!);
    } else if (e.code === 'KeyM' && !closeMenu) options.onToggleMute?.();
    else if (e.code === 'Tab' && !closeMenu) {
      // Tab would move the page focus; here it shows or hides the minimap.
      e.preventDefault();
      showMinimap = !showMinimap;
    }
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
    hidePick();
    audio?.setMusic(null);
    // Let the last hit land on screen before the result screen.
    window.setTimeout(() => options.onEnd(result, { floor: run.floor, seed: run.seed }), 700);
  }

  function enterFloor(next: { run: RunState; world: WorldState }): void {
    run = next.run;
    world = next.world;
    floorStart = world;
    prev = world;
    camera = world.player.pos;
    defeatedAt.clear();
    music();
    announceFloor(true);
    offerPick();
  }

  function simulate(frameMs: number): void {
    const clock = advanceClock(accumulator, frameMs);
    accumulator = clock.accumulatorMs;
    for (let i = 0; i < clock.steps; i++) {
      const raw = toPlayerInput(input.take(), view, pixelScale);
      const playerInput = net && world.player.hp <= 0 ? idleInput(raw) : raw;
      moving = length(playerInput.move) > 0;
      lastInput = playerInput;
      prev = world;
      let netEvents: GameEvent[] = [];
      if (net) {
        const synced = net.session.beforeStep(world, run.floor);
        world = synced.world;
        netEvents = synced.events;
      }
      world = step(world, playerInput, FIXED_DT_MS);
      net?.session.afterStep(world, run.floor);
      const events = netEvents.length > 0 ? [...netEvents, ...world.events] : world.events;
      juice = applyEvents(juice, events, world.player.pos);
      audio?.handleEvents(events);
      for (const event of events) {
        if (event.type === 'playerHurt' || event.type === 'disguiseBroken' || event.type === 'collapseHurt') lastHurtAt = realMs;
        if (event.type === 'enemyDefeated') defeatedAt.set(event.enemyId, realMs);
      }
      const progress = progressRun(run, world);
      const hostFloor = net?.role === 'guest' ? net.session.takeFloorChange() : null;
      if (progress.outcome) end(progress.outcome);
      else if (progress.entered) {
        enterFloor(progress);
        if (net) net.session.sendFloor(run.floor);
      } else if (hostFloor !== null && hostFloor > run.floor) enterFloor(followToFloor(run, world, hostFloor));
      if (juice.hitstopMs > 0) {
        // Hitstop: freeze the simulation from this step on; drop the backlog.
        accumulator = 0;
        break;
      }
    }
  }

  function frame(now: number): void {
    // Paused: no game time at all (animations, juice and the clock stand still); resuming does not catch up.
    // A shared run never pauses: the others keep playing.
    const paused = simulationPaused(closeMenu !== null, !net) || pickPausesSimulation(closePick !== null, Boolean(net));
    const time = frameTime(lastFrame, now, paused);
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
    if (minimap && world.arena.tiles) revealAround(minimap, world.arena.tiles, world.arena.rooms ?? [], tileOf(world.player.pos));
    // The rumble stops while paused or after the run ends.
    const rumble = closeMenu || ended ? 0 : rumbleLevel(collapseProximity(world));
    audio?.setRumble(rumble);
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
      card,
      rumble,
      minimap: showMinimap ? minimap : null,
    });
    overlay?.update(realMs);
    raf = requestAnimationFrame(frame);
  }

  resize();
  music();
  announceFloor(false);
  // Development start below floor 1 (`?floor=`): that floor's offer.
  offerPick();
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
      closePick?.();
      closePick = null;
      audio?.setDucked(false);
      audio?.setRumble(0);
      cancelAnimationFrame(raf);
      input.dispose();
      net?.session.leave();
      overlay?.dispose();
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
